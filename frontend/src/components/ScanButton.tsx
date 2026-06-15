'use client';

import { useState } from 'react';
import { IconScan } from '@tabler/icons-react';
import { toast } from 'sonner';

/**
 * زر مسح مستند عبر «GSDMS Scanner Agent» المحلي.
 * عند النجاح يُمرّر الملف الممسوح للأب عبر onScanned.
 */
export function ScanButton({ onScanned }: { onScanned: (file: File) => void }) {
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    const agent = process.env.NEXT_PUBLIC_SCANNER_AGENT_URL || 'http://localhost:8723';
    try {
      setScanning(true);
      toast.info('جارٍ المسح... تابع نافذة الماسحة على جهازك');
      const res = await fetch(`${agent}/scan`);
      if (!res.ok) throw new Error('scan failed');
      const blob = await res.blob();
      onScanned(new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      toast.success('تمت إضافة المستند الممسوح');
    } catch {
      toast.error('تعذّر الاتصال ببرنامج الماسحة. تأكد أن "GSDMS Scanner Agent" يعمل على جهازك.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={scanning}
        onClick={handleScan}
        className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
      >
        <IconScan className="w-3.5 h-3.5" />
        {scanning ? 'جارٍ المسح...' : 'مسح مستند عن طريق السكانر (يمكن تكراره)'}
      </button>
      <div className="text-[10px] text-slate-400 leading-relaxed">
        يتطلب تشغيل برنامج «GSDMS Scanner Agent» على جهازك.
      </div>
    </div>
  );
}
