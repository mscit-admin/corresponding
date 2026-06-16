'use client';

import { AuthLayout } from '@/components/layout/AuthLayout';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  IconArrowRight, IconInfoCircle, IconCheck, IconDeviceFloppy, IconX,
  IconUpload, IconBuilding, IconUsers,
} from '@tabler/icons-react';
import { incomingApi, referenceApi } from '@/lib/api';
import { uploadAttachments } from '@/lib/uploads';
import { MultiFileUpload } from '@/components/MultiFileUpload';
import { ScanButton } from '@/components/ScanButton';
import { ManagedSelect } from '@/components/ManagedSelect';
import { useAuthStore } from '@/store/auth';
import { canManageReference } from '@/lib/permissions';
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
    recipientName: z.string().min(1, 'الجهة المرسل إليها مطلوبة'),
  })
  .superRefine((data, ctx) => {
    if (data.visibility === 'departments' && (!data.visibilityDeptIds || data.visibilityDeptIds.length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['visibilityDeptIds'], message: 'اختر إدارة واحدة على الأقل' });
    }
  });

type FormData = z.infer<typeof schema>;

function NewIncomingInner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManage = canManageReference(user?.roleName);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const addFiles = (newFiles: File[]) => setFiles((prev) => [...prev, ...newFiles]);
  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const { register, handleSubmit, watch, setValue, formState: { errors, isValid } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      receivedAt: new Date().toISOString().slice(0, 16),
      priority: 'normal',
      confidentiality: 'normal',
      visibility: 'public',
      visibilityDeptIds: [],
      senderEntityId: '1',
      recipientType: 'internal',
    },
  });

  const recipientType = watch('recipientType');

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const created = await incomingApi.create({
        receivedAt: new Date(data.receivedAt).toISOString(),
        registryNo: data.registryNo || undefined,
        senderEntityId: data.senderEntityId,
        senderRefNo: data.senderRefNo,
        originalDate: data.originalDate || undefined,
        subject: data.subject,
        transactionType: data.transactionType || undefined,
        priority: data.priority,
        confidentiality: data.confidentiality,
        visibility: data.visibility,
        visibilityDeptIds: data.visibility === 'departments' ? data.visibilityDeptIds : [],
        recipientType: data.recipientType,
        recipientName: data.recipientName,
      });

      // Upload attachments if provided
      if (files.length && created?.id) {
        setIsUploading(true);
        try {
          const failed = await uploadAttachments(created.id, files);
          if (failed > 0) toast.warning(`تم تسجيل المراسلة لكن فشل رفع ${failed} مرفق`);
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
            <strong>ملاحظة:</strong> يمكنك رفع أكثر من صورة أو ملف PDF للمستند الأصلي (الحد الأقصى 20 ميجا لكل ملف).
          </div>
        </div>

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
                creator={canManage ? referenceApi.createEntity : undefined}
                getValue={(e) => e.id}
                getLabel={(e) => e.nameAr}
                placeholder="-- اختر الجهة المرسِلة --"
                canCreate={canManage}
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
            {recipientType === 'internal' ? (
              <ManagedSelect
                value={watch('recipientName') || ''}
                onChange={(v) => setValue('recipientName', v, { shouldValidate: true })}
                queryKey={['departments']}
                fetcher={referenceApi.departments}
                creator={canManage ? referenceApi.createDepartment : undefined}
                getValue={(d) => d.name}
                getLabel={(d) => d.name}
                placeholder="-- اختر الإدارة المستلمة --"
                canCreate={canManage}
                createLabel="إضافة إدارة جديدة"
              />
            ) : (
              <ManagedSelect
                value={watch('recipientName') || ''}
                onChange={(v) => setValue('recipientName', v, { shouldValidate: true })}
                queryKey={['entities']}
                fetcher={referenceApi.entities}
                creator={canManage ? referenceApi.createEntity : undefined}
                getValue={(e) => e.nameAr}
                getLabel={(e) => e.nameAr}
                placeholder="-- اختر الجهة الخارجية --"
                canCreate={canManage}
                createLabel="إضافة جهة جديدة"
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

        {/* رفع المستندات */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <IconUpload className="w-4 h-4 text-slate-400" /> المستندات الأصلية
            </h2>
            <span className="text-xs text-slate-500">اختياري · يمكن إضافة أكثر من ملف</span>
          </div>

          <MultiFileUpload
            files={files}
            onAdd={addFiles}
            onRemove={removeFile}
            scannerSlot={<ScanButton onScanned={(f) => addFiles([f])} />}
          />
        </div>

        {/* Submit */}
        <div className="card flex justify-between items-center gap-2 flex-wrap">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <IconDeviceFloppy className="w-4 h-4" />
            {isUploading ? 'جارٍ رفع المرفق...' : isValid ? 'جاهز للحفظ' : 'أكمِل الحقول المطلوبة (*) لتفعيل الحفظ'}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => router.back()} className="btn text-sm">
              <IconX className="w-4 h-4" /> إلغاء
            </button>
            <button type="submit" disabled={!isValid || mutation.isPending} className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed">
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
