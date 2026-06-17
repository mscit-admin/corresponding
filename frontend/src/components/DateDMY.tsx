'use client';

/**
 * منتقي تاريخ بثلاث قوائم واضحة بالعربية: اليوم / الشهر / السنة.
 * القيمة المخزّنة بصيغة "YYYY-MM-DD" (وفارغة إن لم يكتمل الاختيار).
 */
const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

interface Props {
  value?: string;
  onChange: (value: string) => void;
}

export function DateDMY({ value, onChange }: Props) {
  const [y = '', m = '', d = ''] = (value || '').split('-');

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let yr = currentYear + 1; yr >= 1980; yr--) years.push(yr);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const emit = (nd: string, nm: string, ny: string) => {
    if (nd && nm && ny) {
      onChange(`${ny}-${nm.padStart(2, '0')}-${nd.padStart(2, '0')}`);
    } else {
      onChange('');
    }
  };

  return (
    <div className="grid grid-cols-3 gap-1.5">
      <select
        className="input"
        value={d ? String(Number(d)) : ''}
        onChange={(e) => emit(e.target.value, m ? String(Number(m)) : '', y)}
        aria-label="اليوم"
      >
        <option value="">اليوم</option>
        {days.map((day) => <option key={day} value={day}>{day}</option>)}
      </select>

      <select
        className="input"
        value={m ? String(Number(m)) : ''}
        onChange={(e) => emit(d ? String(Number(d)) : '', e.target.value, y)}
        aria-label="الشهر"
      >
        <option value="">الشهر</option>
        {MONTHS.map((name, i) => <option key={i} value={i + 1}>{name}</option>)}
      </select>

      <select
        className="input"
        value={y}
        onChange={(e) => emit(d ? String(Number(d)) : '', m ? String(Number(m)) : '', e.target.value)}
        aria-label="السنة"
      >
        <option value="">السنة</option>
        {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
      </select>
    </div>
  );
}
