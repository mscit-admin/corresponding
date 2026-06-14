'use client';

import { AuthLayout } from '@/components/layout/AuthLayout';
import { useRouter } from 'next/navigation';
import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  IconArrowRight, IconInfoCircle, IconCheck, IconDeviceFloppy, IconX,
  IconUpload, IconFile, IconTrash, IconScan, IconBuilding, IconUsers,
} from '@tabler/icons-react';
import { incomingApi } from '@/lib/api';
import axios from 'axios';

const schema = z.object({
  senderEntityId: z.string().min(1, 'الجهة المرسلة مطلوبة'),
  senderRefNo: z.string().optional(),
  subject: z.string().min(3, 'الموضوع يجب أن يكون 3 أحرف على الأقل'),
  priority: z.enum(['normal', 'urgent', 'top_secret']),
  receivedAt: z.string().min(1, 'تاريخ الاستلام مطلوب'),
  recipientType: z.enum(['internal', 'external']),
  recipientName: z.string().min(1, 'الجهة المرسل إليها مطلوبة'),
});

type FormData = z.infer<typeof schema>;

// قوائم تجريبية - يمكن جلبها لاحقاً من API
const INTERNAL_DEPARTMENTS = [
  'مكتب الوزير',
  'مكتب الوكيل',
  'إدارة الموارد البشرية',
  'الإدارة المالية',
  'إدارة الشؤون القانونية',
  'إدارة تقنية المعلومات',
  'الديوان العام',
];

const EXTERNAL_ENTITIES = [
  'وزارة المالية',
  'وزارة العدل',
  'وزارة الداخلية',
  'ديوان رئاسة الوزراء',
  'مصرف ليبيا المركزي',
  'ديوان المحاسبة',
  'هيئة الرقابة الإدارية',
];

function NewIncomingInner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      receivedAt: new Date().toISOString().slice(0, 16),
      priority: 'normal',
      senderEntityId: '1',
      recipientType: 'internal',
    },
  });

  const recipientType = watch('recipientType');
  const recipientOptions = recipientType === 'internal' ? INTERNAL_DEPARTMENTS : EXTERNAL_ENTITIES;

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const created = await incomingApi.create({
        receivedAt: new Date(data.receivedAt).toISOString(),
        senderEntityId: data.senderEntityId,
        senderRefNo: data.senderRefNo,
        subject: data.subject,
        priority: data.priority,
        recipientType: data.recipientType,
        recipientName: data.recipientName,
      });

      // Upload file if provided
      if (file && created?.id) {
        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const token = localStorage.getItem('gsdms-auth')
            ? JSON.parse(localStorage.getItem('gsdms-auth')!).state?.token
            : null;
          await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/attachments/upload/incoming/${created.id}`,
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `Bearer ${token}`,
              },
            }
          );
        } catch (e) {
          console.error('Upload failed:', e);
          toast.warning('تم تسجيل المراسلة لكن فشل رفع المرفق');
        } finally {
          setIsUploading(false);
        }
      }

      return created;
    },
    onSuccess: (created) => {
      toast.success(`تم تسجيل المراسلة بنجاح: ${created.serialNo}`);
      queryClient.invalidateQueries({ queryKey: ['incoming'] });
      router.push(`/inbox/${created.id}`);
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'حدث خطأ أثناء التسجيل';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowed.includes(selectedFile.type)) {
      toast.error('نوع الملف غير مدعوم. المسموح: PDF, JPG, PNG');
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      toast.error('حجم الملف كبير جداً (الحد الأقصى 20 ميجا)');
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <button onClick={() => router.back()} className="btn text-xs py-1.5">
          <IconArrowRight className="w-3.5 h-3.5" /> إلغاء
        </button>
        <span className="text-slate-400">
          الرئيسية › صندوق الوارد › <span className="text-slate-900 font-medium">تسجيل وارد جديد</span>
        </span>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">تسجيل مراسلة واردة</h1>
        <p className="text-sm text-slate-500 mt-1">سيتم توليد رقم تسلسلي تلقائياً عند الحفظ</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        {/* Info notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2 text-sm text-blue-800">
          <IconInfoCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <strong>ملاحظة:</strong> يمكنك رفع صورة أو ملف PDF للمستند الأصلي (الحد الأقصى 20 ميجا).
          </div>
        </div>

        {/* البيانات الأساسية */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <IconInfoCircle className="w-4 h-4 text-slate-400" /> البيانات الأساسية
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">الجهة المرسلة <span className="text-red-500">*</span></label>
              <select className="input" {...register('senderEntityId')}>
                <option value="1">وزارة المالية</option>
                <option value="2">ديوان رئاسة الوزراء</option>
              </select>
              {errors.senderEntityId && <p className="text-xs text-red-600 mt-1">{errors.senderEntityId.message}</p>}
            </div>

            <div>
              <label className="label">رقم المرسل (إن وُجد)</label>
              <input type="text" className="input font-mono" placeholder="MOF-2026-XXXX" {...register('senderRefNo')} />
            </div>

            <div>
              <label className="label">تاريخ ووقت الاستلام <span className="text-red-500">*</span></label>
              <input type="datetime-local" className="input" {...register('receivedAt')} />
              {errors.receivedAt && <p className="text-xs text-red-600 mt-1">{errors.receivedAt.message}</p>}
            </div>

            <div>
              <label className="label">الأهمية <span className="text-red-500">*</span></label>
              <select className="input" {...register('priority')}>
                <option value="normal">عادي</option>
                <option value="urgent">عاجل</option>
                <option value="top_secret">سري</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label">الموضوع <span className="text-red-500">*</span></label>
              <textarea rows={3} className="input" placeholder="مثال: طلب موافقة على ميزانية الربع الثاني" {...register('subject')} />
              {errors.subject && <p className="text-xs text-red-600 mt-1">{errors.subject.message}</p>}
            </div>
          </div>
        </div>

        {/* الجهة المرسل إليها */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <IconUsers className="w-4 h-4 text-slate-400" /> الجهة المرسل إليها
          </h2>

          {/* اختيار النوع */}
          <div className="grid grid-cols-2 gap-2">
            <label className={`cursor-pointer border rounded-md p-3 flex items-center gap-2 transition-colors ${
              recipientType === 'internal' 
                ? 'border-brand-500 bg-brand-50 text-brand-700' 
                : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <input type="radio" value="internal" className="hidden" {...register('recipientType')} 
                onChange={() => { setValue('recipientType', 'internal'); setValue('recipientName', ''); }}
              />
              <IconBuilding className="w-4 h-4" />
              <div>
                <div className="text-sm font-medium">جهة داخلية</div>
                <div className="text-[10px] text-slate-500">إدارة داخل وزارتنا</div>
              </div>
            </label>

            <label className={`cursor-pointer border rounded-md p-3 flex items-center gap-2 transition-colors ${
              recipientType === 'external'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <input type="radio" value="external" className="hidden" {...register('recipientType')} 
                onChange={() => { setValue('recipientType', 'external'); setValue('recipientName', ''); }}
              />
              <IconBuilding className="w-4 h-4" />
              <div>
                <div className="text-sm font-medium">جهة خارجية</div>
                <div className="text-[10px] text-slate-500">وزارة أو هيئة أخرى</div>
              </div>
            </label>
          </div>

          {/* اختيار الجهة */}
          <div>
            <label className="label">
              {recipientType === 'internal' ? 'الإدارة المستلمة' : 'الجهة الخارجية'} 
              <span className="text-red-500">*</span>
            </label>
            <select className="input" {...register('recipientName')}>
              <option value="">-- اختر --</option>
              {recipientOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {errors.recipientName && <p className="text-xs text-red-600 mt-1">{errors.recipientName.message}</p>}
          </div>
        </div>

        {/* رفع المستند */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <IconUpload className="w-4 h-4 text-slate-400" /> المستند الأصلي
            </h2>
            <span className="text-xs text-slate-500">اختياري</span>
          </div>

          {!file ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
              }`}
            >
              <IconUpload className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <div className="text-sm font-medium text-slate-700">اسحب الملف هنا أو اضغط للاختيار</div>
              <div className="text-xs text-slate-500 mt-1">PDF, JPG, PNG (حتى 20 ميجا)</div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              />

              <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
                <button
                  type="button"
                  disabled={scanning}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const agent = process.env.NEXT_PUBLIC_SCANNER_AGENT_URL || 'http://localhost:8723';
                    try {
                      setScanning(true);
                      toast.info('جارٍ المسح... تابع نافذة الماسحة على جهازك');
                      const res = await fetch(`${agent}/scan`);
                      if (!res.ok) throw new Error('scan failed');
                      const blob = await res.blob();
                      const scanned = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
                      handleFileSelect(scanned);
                      toast.success('تم مسح المستند بنجاح');
                    } catch {
                      toast.error('تعذّر الاتصال ببرنامج الماسحة. تأكد أن "GSDMS Scanner Agent" يعمل على جهازك.');
                    } finally {
                      setScanning(false);
                    }
                  }}
                  className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
                >
                  <IconScan className="w-3.5 h-3.5" />
                  {scanning ? 'جارٍ المسح...' : 'مسح المستند عن طريق السكانر'}
                </button>
                <div className="text-[10px] text-slate-400 leading-relaxed">
                  يتطلب تشغيل برنامج «GSDMS Scanner Agent» على جهازك. أو اسحب/اختر ملفاً ممسوحاً مسبقاً.
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg p-3 flex items-center gap-3 bg-slate-50">
              <IconFile className="w-8 h-8 text-brand-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{file.name}</div>
                <div className="text-xs text-slate-500">
                  {formatBytes(file.size)} • {file.type.split('/')[1].toUpperCase()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                title="إزالة"
              >
                <IconTrash className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="card flex justify-between items-center gap-2 flex-wrap">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <IconDeviceFloppy className="w-4 h-4" /> 
            {isUploading ? 'جارٍ رفع المرفق...' : 'سيتم الحفظ في قاعدة البيانات'}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => router.back()} className="btn text-sm">
              <IconX className="w-4 h-4" /> إلغاء
            </button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary text-sm">
              <IconCheck className="w-4 h-4" />
              {mutation.isPending ? 'جارٍ التسجيل...' : 'تسجيل المراسلة'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewIncomingPage() {
  return (
    <AuthLayout>
      <NewIncomingInner />
    </AuthLayout>
  );
}
