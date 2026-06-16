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
  IconUpload, IconBuilding, IconMapPin,
} from '@tabler/icons-react';
import { allocationApi, referenceApi } from '@/lib/api';
import { uploadAttachments } from '@/lib/uploads';
import { MultiFileUpload } from '@/components/MultiFileUpload';
import { ScanButton } from '@/components/ScanButton';
import { ManagedSelect } from '@/components/ManagedSelect';
import { useAuthStore } from '@/store/auth';
import { canEditCorrespondence } from '@/lib/permissions';
import { PRIORITY_OPTIONS } from '@/lib/allocation-constants';

const schema = z.object({
  priorityNo: z.string().optional().refine((v) => !v || /^[0-9]+$/.test(v), 'الأسبقية أرقام فقط'),
  receivedAt: z.string().min(1, 'تاريخ الاستلام مطلوب'),
  requestingOfficeId: z.string().min(1, 'المكتب المختص مطلوب'),
  beneficiary: z.string().optional(),
  subject: z.string().min(3, 'الموضوع يجب أن يكون 3 أحرف على الأقل'),
  purpose: z.string().optional(),
  locationDesc: z.string().optional(),
  area: z.string().optional(),
  isOutsidePlan: z.boolean(),
  priority: z.enum(['normal', 'urgent', 'immediate']),
});

type FormData = z.infer<typeof schema>;

function NewAllocationInner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManage = canEditCorrespondence(user?.roleName);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const addFiles = (newFiles: File[]) => setFiles((p) => [...p, ...newFiles]);
  const removeFile = (i: number) => setFiles((p) => p.filter((_, idx) => idx !== i));

  const { register, handleSubmit, watch, setValue, formState: { errors, isValid } } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      receivedAt: new Date().toISOString().slice(0, 16),
      priority: 'normal',
      isOutsidePlan: false,
      requestingOfficeId: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const created = await allocationApi.create({
        receivedAt: new Date(data.receivedAt).toISOString(),
        priorityNo: data.priorityNo || undefined,
        requestingOfficeId: data.requestingOfficeId,
        beneficiary: data.beneficiary || undefined,
        subject: data.subject,
        purpose: data.purpose || undefined,
        locationDesc: data.locationDesc || undefined,
        area: data.area || undefined,
        isOutsidePlan: data.isOutsidePlan,
        priority: data.priority,
      });

      if (files.length && created?.id) {
        setIsUploading(true);
        try {
          const failed = await uploadAttachments(created.id, files, 'allocation');
          if (failed > 0) toast.warning(`تم تسجيل الطلب لكن فشل رفع ${failed} مرفق`);
        } finally {
          setIsUploading(false);
        }
      }
      return created;
    },
    onSuccess: (created) => {
      toast.success(`تم تسجيل طلب التخصيص: ${created.serialNo}`);
      queryClient.invalidateQueries({ queryKey: ['allocation'] });
      queryClient.invalidateQueries({ queryKey: ['allocation-stats'] });
      router.push(`/allocation/${created.id}`);
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
          الرئيسية › لجنة التخصيص › <span className="text-slate-900 font-medium">طلب تخصيص جديد</span>
        </span>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">تسجيل طلب تخصيص أرض</h1>
        <p className="text-sm text-slate-500 mt-1">سيتم توليد رقم تسلسلي تلقائياً وإنشاء قائمة المستندات المطلوبة</p>
      </div>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex gap-2 text-sm text-blue-800">
          <IconInfoCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            ستُنشأ قائمة المستندات المطلوبة تلقائياً (رسم كروكي، شهادة عقارية، تقرير من الطبيعة).
            عند تحديد «الموقع خارج المخطط» تُضاف موافقة وزارة الزراعة كمستند مطلوب.
          </div>
        </div>

        {/* بيانات الطلب */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <IconInfoCircle className="w-4 h-4 text-slate-400" /> بيانات الطلب
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">رقم الأسبقية</label>
              <input type="text" inputMode="numeric" className="input font-mono" placeholder="مثال: 145" {...register('priorityNo')}
                onInput={(e) => { const el = e.currentTarget; el.value = el.value.replace(/[^0-9]/g, ''); }} />
              {errors.priorityNo && <p className="text-xs text-red-600 mt-1">{errors.priorityNo.message}</p>}
            </div>

            <div>
              <label className="label">المكتب المختص <span className="text-red-500">*</span></label>
              <ManagedSelect
                value={watch('requestingOfficeId') || ''}
                onChange={(v) => setValue('requestingOfficeId', v, { shouldValidate: true })}
                queryKey={['entities']}
                fetcher={referenceApi.entities}
                creator={canManage ? referenceApi.createEntity : undefined}
                getValue={(e) => e.id}
                getLabel={(e) => e.nameAr}
                placeholder="-- اختر المكتب المختص --"
                canCreate={canManage}
                createLabel="إضافة جهة جديدة"
              />
              {errors.requestingOfficeId && <p className="text-xs text-red-600 mt-1">{errors.requestingOfficeId.message}</p>}
            </div>

            <div>
              <label className="label">تاريخ ووقت الاستلام <span className="text-red-500">*</span></label>
              <input type="datetime-local" className="input" {...register('receivedAt')} />
              {errors.receivedAt && <p className="text-xs text-red-600 mt-1">{errors.receivedAt.message}</p>}
            </div>

            <div>
              <label className="label">درجة الأهمية <span className="text-red-500">*</span></label>
              <select className="input" {...register('priority')}>
                {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label">الجهة المستفيدة من التخصيص</label>
              <input type="text" className="input" placeholder="مثال: وزارة الصحة - مشروع مستشفى" {...register('beneficiary')} />
            </div>

            <div className="md:col-span-2">
              <label className="label">الموضوع <span className="text-red-500">*</span></label>
              <textarea rows={2} className="input" placeholder="مثال: طلب تخصيص قطعة أرض لإقامة مرفق عام" {...register('subject')} />
              {errors.subject && <p className="text-xs text-red-600 mt-1">{errors.subject.message}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="label">الغرض من التخصيص</label>
              <textarea rows={2} className="input" placeholder="وصف الغرض المخصص له الموقع" {...register('purpose')} />
            </div>
          </div>
        </div>

        {/* بيانات الموقع */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <IconMapPin className="w-4 h-4 text-slate-400" /> بيانات الموقع
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">وصف الموقع</label>
              <textarea rows={2} className="input" placeholder="الموقع، الحدود، المعالم..." {...register('locationDesc')} />
            </div>
            <div>
              <label className="label">المساحة</label>
              <input type="text" className="input" placeholder="مثال: 5000 م²" {...register('area')} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer border border-slate-200 rounded-md p-3 w-full hover:bg-slate-50">
                <input type="checkbox" className="w-4 h-4" {...register('isOutsidePlan')} />
                <div>
                  <div className="text-sm font-medium">الموقع خارج المخطط العمراني</div>
                  <div className="text-[10px] text-slate-500">يتطلب موافقة وزارة الزراعة</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* المرفقات */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <IconUpload className="w-4 h-4 text-slate-400" /> المستندات والمرفقات
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

        <div className="card flex justify-between items-center gap-2 flex-wrap">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <IconDeviceFloppy className="w-4 h-4" />
            {isUploading ? 'جارٍ رفع المرفقات...' : isValid ? 'جاهز للحفظ' : 'أكمِل الحقول المطلوبة (*)'}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => router.back()} className="btn text-sm">
              <IconX className="w-4 h-4" /> إلغاء
            </button>
            <button type="submit" disabled={!isValid || mutation.isPending} className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              <IconCheck className="w-4 h-4" />
              {mutation.isPending ? 'جارٍ التسجيل...' : 'تسجيل الطلب'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewAllocationPage() {
  return (
    <AuthLayout>
      <NewAllocationInner />
    </AuthLayout>
  );
}
