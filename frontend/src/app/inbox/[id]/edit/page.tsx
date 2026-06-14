'use client';

import { AuthLayout } from '@/components/layout/AuthLayout';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  IconArrowRight, IconInfoCircle, IconCheck, IconX, IconUsers, IconBuilding, IconLock, IconUpload, IconPaperclip,
} from '@tabler/icons-react';
import { incomingApi } from '@/lib/api';
import { uploadAttachments } from '@/lib/uploads';
import { MultiFileUpload } from '@/components/MultiFileUpload';
import { useAuthStore } from '@/store/auth';
import { canEditCorrespondence } from '@/lib/permissions';

const schema = z.object({
  senderEntityId: z.string().min(1, 'الجهة المرسلة مطلوبة'),
  senderRefNo: z
    .string()
    .optional()
    .refine((v) => !v || /^[0-9]+$/.test(v), 'رقم المرسل يجب أن يكون أرقاماً فقط'),
  subject: z.string().min(3, 'الموضوع يجب أن يكون 3 أحرف على الأقل'),
  priority: z.enum(['normal', 'urgent', 'top_secret']),
  receivedAt: z.string().min(1, 'تاريخ الاستلام مطلوب'),
  recipientType: z.enum(['internal', 'external']),
  recipientName: z.string().min(1, 'الجهة المرسل إليها مطلوبة'),
});

type FormData = z.infer<typeof schema>;

const INTERNAL_DEPARTMENTS = [
  'مكتب الوزير', 'مكتب الوكيل', 'إدارة الموارد البشرية', 'الإدارة المالية',
  'إدارة الشؤون القانونية', 'إدارة تقنية المعلومات', 'الديوان العام',
];
const EXTERNAL_ENTITIES = [
  'وزارة المالية', 'وزارة العدل', 'وزارة الداخلية', 'ديوان رئاسة الوزراء',
  'مصرف ليبيا المركزي', 'ديوان المحاسبة', 'هيئة الرقابة الإدارية',
];

function EditIncomingInner() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const allowed = canEditCorrespondence(user?.roleName);
  const [files, setFiles] = useState<File[]>([]);
  const addFiles = (newFiles: File[]) => setFiles((prev) => [...prev, ...newFiles]);
  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const { data, isLoading } = useQuery({
    queryKey: ['incoming', id],
    queryFn: () => incomingApi.getById(id),
    enabled: allowed,
  });

  const {
    register, handleSubmit, watch, setValue, reset,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { priority: 'normal', recipientType: 'internal', senderEntityId: '1' },
  });

  // pre-fill once the correspondence is loaded
  useEffect(() => {
    if (!data) return;
    reset({
      senderEntityId: data.senderEntity?.id?.toString() || '1',
      senderRefNo: data.senderRefNo || '',
      subject: data.subject || '',
      priority: (data.priority as any) || 'normal',
      receivedAt: data.receivedAt ? new Date(data.receivedAt).toISOString().slice(0, 16) : '',
      recipientType: (data.recipientType as any) || 'internal',
      recipientName: data.recipientName || '',
    });
  }, [data, reset]);

  const recipientType = watch('recipientType');
  const recipientOptions = recipientType === 'internal' ? INTERNAL_DEPARTMENTS : EXTERNAL_ENTITIES;

  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      const updated = await incomingApi.update(id, {
        receivedAt: new Date(form.receivedAt).toISOString(),
        senderEntityId: form.senderEntityId,
        senderRefNo: form.senderRefNo || undefined,
        subject: form.subject,
        priority: form.priority,
        recipientType: form.recipientType,
        recipientName: form.recipientName,
      });
      // upload any newly added attachments
      if (files.length) {
        const failed = await uploadAttachments(id, files);
        if (failed > 0) toast.warning(`تم الحفظ لكن فشل رفع ${failed} مرفق`);
      }
      return updated;
    },
    onSuccess: () => {
      toast.success('تم حفظ التعديلات بنجاح');
      queryClient.invalidateQueries({ queryKey: ['incoming'] });
      router.push(`/inbox/${id}`);
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'حدث خطأ أثناء الحفظ';
      toast.error(Array.isArray(msg) ? msg.join('، ') : msg);
    },
  });

  if (!allowed) {
    return (
      <div className="card text-center py-16 max-w-lg mx-auto">
        <IconLock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <h3 className="text-base font-medium text-slate-900">لا تملك صلاحية التعديل</h3>
        <p className="text-sm text-slate-500 mt-1">هذه الصفحة مخصصة للمستخدمين الذين لديهم صلاحية تعديل المراسلات.</p>
        <button onClick={() => router.back()} className="btn mt-4 inline-flex text-sm">
          <IconArrowRight className="w-4 h-4" /> رجوع
        </button>
      </div>
    );
  }

  if (isLoading) return <div className="text-center py-10 text-slate-500">جارٍ تحميل المراسلة...</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <button onClick={() => router.back()} className="btn text-xs py-1.5">
          <IconArrowRight className="w-3.5 h-3.5" /> إلغاء
        </button>
        <span className="text-slate-400">
          الرئيسية › صندوق الوارد › <span className="text-slate-900 font-medium font-mono">{data?.serialNo}</span> › تعديل
        </span>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">تعديل المراسلة الواردة</h1>
        <p className="text-sm text-slate-500 mt-1">عدّل الحقول ثم احفظ. لا يمكن الحفظ حتى تكتمل الحقول المطلوبة.</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
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
              <label className="label">رقم المرسل (أرقام فقط)</label>
              <input
                type="text"
                inputMode="numeric"
                className="input font-mono"
                placeholder="مثال: 12471"
                {...register('senderRefNo')}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.value = el.value.replace(/[^0-9]/g, '');
                }}
              />
              {errors.senderRefNo && <p className="text-xs text-red-600 mt-1">{errors.senderRefNo.message}</p>}
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
              <textarea rows={3} className="input" {...register('subject')} />
              {errors.subject && <p className="text-xs text-red-600 mt-1">{errors.subject.message}</p>}
            </div>
          </div>
        </div>

        {/* الجهة المرسل إليها */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <IconUsers className="w-4 h-4 text-slate-400" /> الجهة المرسل إليها
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <label className={`cursor-pointer border rounded-md p-3 flex items-center gap-2 transition-colors ${
              recipientType === 'internal' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <input type="radio" value="internal" className="hidden" {...register('recipientType')}
                onChange={() => { setValue('recipientType', 'internal'); setValue('recipientName', '', { shouldValidate: true }); }}
              />
              <IconBuilding className="w-4 h-4" />
              <div><div className="text-sm font-medium">جهة داخلية</div><div className="text-[10px] text-slate-500">إدارة داخل وزارتنا</div></div>
            </label>

            <label className={`cursor-pointer border rounded-md p-3 flex items-center gap-2 transition-colors ${
              recipientType === 'external' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <input type="radio" value="external" className="hidden" {...register('recipientType')}
                onChange={() => { setValue('recipientType', 'external'); setValue('recipientName', '', { shouldValidate: true }); }}
              />
              <IconBuilding className="w-4 h-4" />
              <div><div className="text-sm font-medium">جهة خارجية</div><div className="text-[10px] text-slate-500">وزارة أو هيئة أخرى</div></div>
            </label>
          </div>

          <div>
            <label className="label">
              {recipientType === 'internal' ? 'الإدارة المستلمة' : 'الجهة الخارجية'} <span className="text-red-500">*</span>
            </label>
            <select className="input" {...register('recipientName')}>
              <option value="">-- اختر --</option>
              {recipientOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            {errors.recipientName && <p className="text-xs text-red-600 mt-1">{errors.recipientName.message}</p>}
          </div>
        </div>

        {/* إضافة مستندات */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <IconUpload className="w-4 h-4 text-slate-400" /> إضافة مستندات
            </h2>
            {!!data?.attachments?.length && (
              <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                <IconPaperclip className="w-3.5 h-3.5" /> مرفقات حالية: {data.attachments.length}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">يمكنك إضافة صور/ملفات جديدة (لن تُحذف المرفقات الحالية).</p>
          <MultiFileUpload files={files} onAdd={addFiles} onRemove={removeFile} />
        </div>

        {/* Submit */}
        <div className="card flex justify-between items-center gap-2 flex-wrap">
          <div className="text-xs text-slate-500">
            {isValid ? 'جاهز للحفظ' : 'أكمِل الحقول المطلوبة (*) لتفعيل الحفظ'}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => router.back()} className="btn text-sm">
              <IconX className="w-4 h-4" /> إلغاء
            </button>
            <button type="submit" disabled={!isValid || mutation.isPending} className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <IconCheck className="w-4 h-4" />
              {mutation.isPending ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function EditIncomingPage() {
  return (
    <AuthLayout>
      <EditIncomingInner />
    </AuthLayout>
  );
}
