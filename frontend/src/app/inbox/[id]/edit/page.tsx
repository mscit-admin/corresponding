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
import { incomingApi, referenceApi } from '@/lib/api';
import { uploadAttachments } from '@/lib/uploads';
import { MultiFileUpload } from '@/components/MultiFileUpload';
import { ScanButton } from '@/components/ScanButton';
import { ManagedSelect } from '@/components/ManagedSelect';
import { ExistingAttachments } from '@/components/ExistingAttachments';
import { useAuthStore } from '@/store/auth';
import { canEditCorrespondence } from '@/lib/permissions';
import { PRIORITY_OPTIONS, CONFIDENTIALITY_OPTIONS, TRANSACTION_TYPES } from '@/lib/incoming-constants';
import { VisibilitySelector } from '@/components/VisibilitySelector';

const schema = z
  .object({
    registryNo: z.string().optional(),
    senderEntityId: z.string().min(1, 'الجهة المرسلة مطلوبة'),
    senderRefNo: z
      .string()
      .optional()
      .refine((v) => !v || /^[0-9]+$/.test(v), 'رقم المرسل يجب أن يكون أرقاماً فقط'),
    originalDate: z.string().optional(),
    subject: z.string().min(3, 'الموضوع يجب أن يكون 3 أحرف على الأقل'),
    transactionType: z.string().optional(),
    priority: z.enum(['normal', 'urgent', 'immediate']),
    confidentiality: z.enum(['normal', 'secret', 'top_secret']),
    visibility: z.enum(['public', 'departments', 'private']),
    visibilityDeptIds: z.array(z.string()).optional(),
    receivedAt: z.string().min(1, 'تاريخ الاستلام مطلوب'),
    recipientType: z.enum(['internal', 'external']),
    recipientName: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.visibility === 'departments' && (!data.visibilityDeptIds || data.visibilityDeptIds.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['visibilityDeptIds'], message: 'اختر إدارة واحدة على الأقل' });
    }
  });

type FormData = z.infer<typeof schema>;

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
    defaultValues: { priority: 'normal', confidentiality: 'normal', visibility: 'public', visibilityDeptIds: [], recipientType: 'internal', senderEntityId: '1' },
  });

  // pre-fill once the correspondence is loaded
  useEffect(() => {
    if (!data) return;
    reset({
      registryNo: data.registryNo || '',
      senderEntityId: data.senderEntity?.id?.toString() || '1',
      senderRefNo: data.senderRefNo || '',
      originalDate: data.originalDate ? new Date(data.originalDate).toISOString().slice(0, 10) : '',
      subject: data.subject || '',
      transactionType: data.transactionType || '',
      priority: ((data.priority === 'top_secret' ? 'normal' : data.priority) as any) || 'normal',
      confidentiality: (data.confidentiality as any) || 'normal',
      visibility: (data.visibility as any) || 'public',
      visibilityDeptIds: data.visibilityDeptIds || [],
      receivedAt: data.receivedAt ? new Date(data.receivedAt).toISOString().slice(0, 16) : '',
      recipientType: (data.recipientType as any) || 'internal',
      recipientName: data.recipientName || '',
    });
  }, [data, reset]);

  const recipientType = watch('recipientType');

  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      const updated = await incomingApi.update(id, {
        receivedAt: new Date(form.receivedAt).toISOString(),
        registryNo: form.registryNo || '',
        senderEntityId: form.senderEntityId,
        senderRefNo: form.senderRefNo || '',
        originalDate: form.originalDate || undefined,
        subject: form.subject,
        transactionType: form.transactionType || '',
        priority: form.priority,
        confidentiality: form.confidentiality,
        visibility: form.visibility,
        visibilityDeptIds: form.visibility === 'departments' ? form.visibilityDeptIds : [],
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
              <label className="label">رقم القيد</label>
              <input type="text" className="input font-mono" placeholder="مثال: 2026/145" {...register('registryNo')} />
            </div>

            <div>
              <label className="label">الجهة المرسلة <span className="text-red-500">*</span></label>
              <ManagedSelect
                value={watch('senderEntityId') || ''}
                onChange={(v) => setValue('senderEntityId', v, { shouldValidate: true })}
                queryKey={['entities']}
                fetcher={referenceApi.entities}
                creator={allowed ? referenceApi.createEntity : undefined}
                getValue={(e) => e.id}
                getLabel={(e) => e.nameAr}
                placeholder="-- اختر الجهة المرسِلة --"
                canCreate={allowed}
                createLabel="إضافة جهة جديدة"
              />
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
              <label className="label">تاريخ المستند</label>
              <input type="date" className="input" {...register('originalDate')} />
            </div>

            <div>
              <label className="label">نوع المعاملة</label>
              <select className="input" {...register('transactionType')}>
                <option value="">-- اختر --</option>
                {TRANSACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="label">درجة الأهمية <span className="text-red-500">*</span></label>
              <select className="input" {...register('priority')}>
                {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="label">درجة السرية <span className="text-red-500">*</span></label>
              <select className="input" {...register('confidentiality')}>
                {CONFIDENTIALITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
              <div><div className="text-sm font-medium">الإدارات</div><div className="text-[10px] text-slate-500">إدارات داخل وزارتنا</div></div>
            </label>

            <label className={`cursor-pointer border rounded-md p-3 flex items-center gap-2 transition-colors ${
              recipientType === 'external' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 hover:bg-slate-50'
            }`}>
              <input type="radio" value="external" className="hidden" {...register('recipientType')}
                onChange={() => { setValue('recipientType', 'external'); setValue('recipientName', '', { shouldValidate: true }); }}
              />
              <IconBuilding className="w-4 h-4" />
              <div><div className="text-sm font-medium">المكاتب</div><div className="text-[10px] text-slate-500">المكاتب والجهات الخارجية</div></div>
            </label>
          </div>

          <div>
            <label className="label">
              {recipientType === 'internal' ? 'الإدارة المستلمة' : 'المكتب المستلم'}
            </label>
            {recipientType === 'internal' ? (
              <ManagedSelect
                value={watch('recipientName') || ''}
                onChange={(v) => setValue('recipientName', v, { shouldValidate: true })}
                queryKey={['departments']}
                fetcher={referenceApi.departments}
                creator={allowed ? referenceApi.createDepartment : undefined}
                getValue={(d) => d.name}
                getLabel={(d) => d.name}
                placeholder="-- اختر الإدارة --"
                canCreate={allowed}
                createLabel="إضافة إدارة جديدة"
              />
            ) : (
              <ManagedSelect
                value={watch('recipientName') || ''}
                onChange={(v) => setValue('recipientName', v, { shouldValidate: true })}
                queryKey={['entities']}
                fetcher={referenceApi.entities}
                creator={allowed ? referenceApi.createEntity : undefined}
                getValue={(e) => e.nameAr}
                getLabel={(e) => e.nameAr}
                placeholder="-- اختر المكتب --"
                canCreate={allowed}
                createLabel="إضافة مكتب جديد"
              />
            )}
            {errors.recipientName && <p className="text-xs text-red-600 mt-1">{errors.recipientName.message}</p>}
          </div>
        </div>

        {/* صلاحية المشاهدة */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <IconUsers className="w-4 h-4 text-slate-400" /> صلاحية المشاهدة
          </h2>
          <VisibilitySelector
            visibility={watch('visibility')}
            onVisibilityChange={(v) => setValue('visibility', v as any, { shouldValidate: true })}
            deptIds={watch('visibilityDeptIds') || []}
            onDeptIdsChange={(ids) => setValue('visibilityDeptIds', ids, { shouldValidate: true })}
          />
        </div>

        {/* المرفقات الحالية */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <IconPaperclip className="w-4 h-4 text-slate-400" /> المرفقات الحالية
            {!!data?.attachments?.length && <span className="text-slate-400 font-normal">({data.attachments.length})</span>}
          </h2>
          <ExistingAttachments
            attachments={data?.attachments}
            onChange={() => queryClient.invalidateQueries({ queryKey: ['incoming', id] })}
          />
        </div>

        {/* إضافة مستندات */}
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <IconUpload className="w-4 h-4 text-slate-400" /> إضافة مستندات جديدة
          </h2>
          <p className="text-[11px] text-slate-400">الملفات الجديدة تُضاف عند الحفظ (لن تُحذف المرفقات الحالية).</p>
          <MultiFileUpload
            files={files}
            onAdd={addFiles}
            onRemove={removeFile}
            scannerSlot={<ScanButton onScanned={(f) => addFiles([f])} />}
          />
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
