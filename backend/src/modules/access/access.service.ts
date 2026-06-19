import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// مفاتيح التخزين في جدول system_settings
const K = {
  enabled: 'access.schedule.enabled',
  start: 'access.schedule.start',
  end: 'access.schedule.end',
  days: 'access.schedule.days',
  tz: 'access.schedule.timezone',
  cidrs: 'access.company.cidrs',
  notifyExternal: 'access.external.notify',
};

export interface AccessConfig {
  enabled: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
  days: number[]; // 0=الأحد .. 6=السبت
  timezone: string;
  companyCidrs: string[];
  notifyExternal: boolean;
}

export interface AccessEvaluation {
  companyDevice: boolean;
  scheduleEnabled: boolean;
  withinHours: boolean;
  allowed: boolean;
  start: string;
  end: string;
  timezone: string;
  nowMinutes: number;
}

const DEFAULTS: AccessConfig = {
  enabled: false,
  start: '08:00',
  end: '16:00',
  days: [0, 1, 2, 3, 4], // الأحد إلى الخميس
  timezone: 'Asia/Riyadh',
  companyCidrs: [],
  notifyExternal: true,
};

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);
  private cache: { config: AccessConfig; at: number } | null = null;
  private readonly CACHE_TTL_MS = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  /** يقرأ الإعدادات من قاعدة البيانات (مع تخزين مؤقت قصير لتقليل الاستعلامات). */
  async getConfig(force = false): Promise<AccessConfig> {
    if (!force && this.cache && Date.now() - this.cache.at < this.CACHE_TTL_MS) {
      return this.cache.config;
    }
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: Object.values(K) } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value ?? '']));
    const config: AccessConfig = {
      enabled: (map.get(K.enabled) ?? String(DEFAULTS.enabled)) === 'true',
      start: map.get(K.start) || DEFAULTS.start,
      end: map.get(K.end) || DEFAULTS.end,
      days: this.parseJson(map.get(K.days), DEFAULTS.days),
      timezone: map.get(K.tz) || DEFAULTS.timezone,
      companyCidrs: this.parseJson(map.get(K.cidrs), DEFAULTS.companyCidrs),
      notifyExternal: (map.get(K.notifyExternal) ?? String(DEFAULTS.notifyExternal)) === 'true',
    };
    this.cache = { config, at: Date.now() };
    return config;
  }

  /** تحديث الإعدادات (لمدير النظام). */
  async updateConfig(input: Partial<AccessConfig>): Promise<AccessConfig> {
    const entries: [string, string][] = [];
    if (input.enabled !== undefined) entries.push([K.enabled, String(!!input.enabled)]);
    if (input.start !== undefined) entries.push([K.start, this.validateTime(input.start)]);
    if (input.end !== undefined) entries.push([K.end, this.validateTime(input.end)]);
    if (input.days !== undefined) {
      const days = (input.days || []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      entries.push([K.days, JSON.stringify([...new Set(days)])]);
    }
    if (input.timezone !== undefined) entries.push([K.tz, this.validateTimezone(input.timezone)]);
    if (input.companyCidrs !== undefined) {
      const cidrs = (input.companyCidrs || []).map((c) => this.validateCidr(c));
      entries.push([K.cidrs, JSON.stringify(cidrs)]);
    }
    if (input.notifyExternal !== undefined) entries.push([K.notifyExternal, String(!!input.notifyExternal)]);

    for (const [key, value] of entries) {
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    this.cache = null; // إبطال التخزين المؤقت
    return this.getConfig(true);
  }

  /** يقيّم سياسة الوصول لعنوان IP في لحظة معيّنة. */
  async evaluate(ip: string, now: Date = new Date()): Promise<AccessEvaluation> {
    const config = await this.getConfig();
    const companyDevice = this.isCompanyIp(ip, config.companyCidrs);
    const { withinHours, nowMinutes } = this.checkSchedule(config, now);
    const allowed = companyDevice || !config.enabled || withinHours;
    return {
      companyDevice,
      scheduleEnabled: config.enabled,
      withinHours,
      allowed,
      start: config.start,
      end: config.end,
      timezone: config.timezone,
      nowMinutes,
    };
  }

  /** هل العنوان ضمن شبكة الشركة؟ (المضيف المحلي يُعدّ ضمن الشركة) */
  isCompanyIp(ip: string, cidrs: string[]): boolean {
    const clean = this.normalizeIp(ip);
    if (clean === '127.0.0.1') return true; // loopback / تطوير محلي
    const long = this.ipv4ToLong(clean);
    if (long === null) return false; // IPv6 غير مدعوم في المطابقة — يُعدّ خارجياً
    for (const cidr of cidrs) {
      if (this.cidrContains(cidr, long)) return true;
    }
    return false;
  }

  // ----- مساعدات داخلية -----

  private checkSchedule(config: AccessConfig, now: Date): { withinHours: boolean; nowMinutes: number } {
    // نحوّل الوقت إلى التوقيت المحلي للمنطقة الزمنية المحدّدة
    let local: Date;
    try {
      local = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
    } catch {
      local = now;
    }
    const day = local.getDay();
    const nowMinutes = local.getHours() * 60 + local.getMinutes();
    if (!config.enabled) return { withinHours: true, nowMinutes };
    const startM = this.toMinutes(config.start);
    const endM = this.toMinutes(config.end);
    const dayOk = config.days.includes(day);
    const timeOk = endM > startM
      ? nowMinutes >= startM && nowMinutes < endM
      : nowMinutes >= startM || nowMinutes < endM; // نافذة تعبر منتصف الليل
    return { withinHours: dayOk && timeOk, nowMinutes };
  }

  private normalizeIp(ip: string): string {
    let s = (ip || '').split(',')[0].trim();
    if (s.startsWith('::ffff:')) s = s.slice(7); // IPv4-mapped IPv6
    if (s === '::1') s = '127.0.0.1';
    // إزالة المنفذ إن وُجد على IPv4
    const m = s.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/);
    if (m) s = m[1];
    return s;
  }

  private ipv4ToLong(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    let long = 0;
    for (const p of parts) {
      const n = Number(p);
      if (!Number.isInteger(n) || n < 0 || n > 255) return null;
      long = long * 256 + n;
    }
    return long >>> 0;
  }

  private cidrContains(cidr: string, ipLong: number): boolean {
    const [range, bitsStr] = cidr.split('/');
    const bits = bitsStr === undefined ? 32 : Number(bitsStr);
    const base = this.ipv4ToLong(range);
    if (base === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    if (bits === 0) return true;
    const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0;
    return (base & mask) === (ipLong & mask);
  }

  private toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
    return (h || 0) * 60 + (m || 0);
  }

  private parseJson<T>(raw: string | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private validateTime(t: string): string {
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) {
      throw new BadRequestException(`صيغة وقت غير صحيحة: ${t} (المتوقع HH:mm)`);
    }
    const [h, m] = t.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }

  private validateTimezone(tz: string): string {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    } catch {
      throw new BadRequestException(`منطقة زمنية غير صحيحة: ${tz}`);
    }
  }

  private validateCidr(cidr: string): string {
    const c = cidr.trim();
    const [range, bitsStr] = c.split('/');
    if (this.ipv4ToLong(range) === null) {
      throw new BadRequestException(`نطاق IP غير صحيح: ${cidr}`);
    }
    if (bitsStr !== undefined) {
      const bits = Number(bitsStr);
      if (!Number.isInteger(bits) || bits < 0 || bits > 32) {
        throw new BadRequestException(`قناع الشبكة غير صحيح: ${cidr}`);
      }
    }
    return bitsStr === undefined ? `${range}/32` : c;
  }
}
