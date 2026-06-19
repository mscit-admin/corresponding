'use client';

// معلومات الجهاز (MAC والـIP المحلي والاسم) عبر الـAgentالمحلي إن كان يعمل.
// تُخزَّن في localStorage وتُرسل مع طلبات الـAPI لتسجيلها في سجلّ التدقيق.

const KEY = 'gsdms-device';
const ID_KEY = 'gsdms-device-id';
const AGENT = process.env.NEXT_PUBLIC_SCANNER_AGENT_URL || 'http://localhost:8723';

export interface DeviceInfo {
  mac?: string;
  localIp?: string;
  hostname?: string;
}

/** معرّف جهاز ثابت يُولَّد مرّة ويُحفظ في المتصفّح — يعمل على كل الأجهزة بلا تثبيت. */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id =
      (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(ID_KEY, id);
  }
  return id;
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
