'use client';

// معلومات الجهاز (MAC والـIP المحلي والاسم) عبر الـAgentالمحلي إن كان يعمل.
// تُخزَّن في localStorage وتُرسل مع طلبات الـAPI لتسجيلها في سجلّ التدقيق.

const KEY = 'gsdms-device';
const AGENT = process.env.NEXT_PUBLIC_SCANNER_AGENT_URL || 'http://localhost:8723';

export interface DeviceInfo {
  mac?: string;
  localIp?: string;
  hostname?: string;
}

export function getCachedDevice(): DeviceInfo {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

/** يحاول جلب معلومات الجهاز من الـAgent المحلي ويُخزّنها (بصمت إن لم يكن يعمل). */
export async function refreshDeviceInfo(): Promise<DeviceInfo> {
  if (typeof window === 'undefined') return {};
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${AGENT}/device`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return getCachedDevice();
    const data = (await res.json()) as DeviceInfo;
    if (data && (data.mac || data.hostname)) {
      localStorage.setItem(KEY, JSON.stringify(data));
    }
    return data;
  } catch {
    return getCachedDevice(); // الـAgent غير مشغّل — نكتفي بالمخزّن إن وُجد
  }
}
