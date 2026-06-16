'use client';

import { AuthLayout } from '@/components/layout/AuthLayout';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import {
  IconArrowRight, IconGavel, IconBuilding, IconCalendar, IconMapPin, IconFileText,
  IconClipboardList, IconCheck, IconX, IconUpload, IconHistory, IconBook,
  IconAlertTriangle, IconCircleCheck, IconCircleDashed, IconSend, IconCertificate, IconRuler,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { allocationApi, minutesApi } from '@/lib/api';
import { uploadAttachments } from '@/lib/uploads';
import { ExistingAttachments } from '@/components/ExistingAttachments';
import { MultiFileUpload } from '@/components/MultiFileUpload';
import { ScanButton } from '@/components/ScanButton';
import { useAuthStore } from '@/store/auth';
import { canEditCorrespondence } from '@/lib/permissions';
import { formatDateAr, formatDateTimeAr } from '@/lib/utils';
import { ALLOCATION_STATUS, docTypeLabel, priorityLabel } from '@/lib/allocation-constants';
import type { AllocationRequest } from '@/types';

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-sm text-slate-900">{value}</div>
    </div>
  );
}

function DetailInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canManage = canEditCorrespondence(user?.roleName);

  const { data: item, isLoading, refetch } = useQuery({
    queryKey: ['allocation', id],
    queryFn: () => allocationApi.getById(id),
  });

  const invalidate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['allocation'] });
    queryClient.invalidateQueries({ queryKey: ['allocation-stats'] });
  };

  if (isLoading) return <div className="text-center py-10 text-slate-500">جارٍ تحميل الطلب...</div>;
  if (!item) return <div className="text-center py-10 text-slate-500">الطلب غير موجود</div>;

  const status = ALLOCATION_STATUS[item.status];

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <button onClick={() => router.push('/allocation')} className="btn text-xs py-1.5">
          <IconArrowRight className="w-3.5 h-3.5" /> رجوع
        </button>
        <span className="text-slate-400">
          الرئيسية › لجنة التخصيص › <span className="text-slate-900 font-medium">{item.serialNo}</span>
        </span>
      </div>

      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-mono inline-flex items-center gap-1">
              <IconFileText className="w-3.5 h-3.5" /> {item.serialNo}
            </span>
            {item.priorityNo != null && <span className="badge-secondary">أسبقية {item.priorityNo}</span>}
            {item.priority !== 'normal' && <span className="badge-warning">{priorityLabel(item.priority)}</span>}
            <span className={status?.class}>{status?.text}</span>
            {item.minutes && (
              <Link href={`/allocation/minutes/${item.minutes.id}`} className="badge-info inline-flex items-center gap-1 hover:underline">
                <IconBook className="w-3 h-3" /> {item.minutes.minutesNo}{item.minutesItemNo ? ` · بند ${item.minutesItemNo}` : ''}
              </Link>
            )}
          </div>
          <span className="text-xs text-slate-400 inline-flex items-center gap-1">
            <IconGavel className="w-3.5 h-3.5" /> لجنة التخصيص
          </span>
        </div>
        <h1 className="text-lg font-semibold text-slate-900 leading-relaxed">{item.subject}</h1>
      </div>

      {/* Workflow actions */}
      {canManage && <WorkflowPanel item={item} onChange={invalidate} />}

      {/* Decision / rejection banners */}
      {item.status === 'approved' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 text-sm text-emerald-800 flex items-start gap-2">
          <IconCircleCheck className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <strong>اعتُمد المحضر وصدر قرار التخصيص.</strong> تم تحويل المعاملة إلى المكتب المختص لاتخاذ الإجراءات.
            {item.decisionNo && <div className="mt-1">رقم القرار: <span className="font-mono">{item.decisionNo}</span>{item.decisionDate ? ` · بتاريخ ${formatDateAr(item.decisionDate)}` : ''}</div>}
          </div>
        </div>
      )}
      {item.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800 flex items-start gap-2">
          <IconAlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <strong>لم تتم الموافقة على التخصيص.</strong> تم إبلاغ المكتب المختص بعدم الموافقة بعد اعتماد المحضر.
            {item.committeeNotes && <div className="mt-1">ملاحظات اللجنة: {item.committeeNotes}</div>}
          </div>
        </div>
      )}

      {/* Basic info */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2"><IconBuilding className="w-4 h-4 text-slate-400" /> بيانات الطلب</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="المكتب المختص" value={item.requestingOffice?.nameAr} />
          <Field label="الجهة المستفيدة" value={item.beneficiary} />
          <Field label="تاريخ الاستلام" value={formatDateAr(item.receivedAt)} />
          <Field label="المساحة" value={item.area && <span className="inline-flex items-center gap-1"><IconRuler className="w-3.5 h-3.5 text-slate-400" />{item.area}</span>} />
          <Field label="ضمن المخطط؟" value={item.isOutsidePlan ? 'خارج المخطط العمراني' : 'داخل المخطط'} />
          <Field label="سُجّل بواسطة" value={item.creator?.fullName} />
        </div>
        {item.purpose && <Field label="الغرض من التخصيص" value={item.purpose} />}
        {item.locationDesc && (
          <div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1"><IconMapPin className="w-3.5 h-3.5" /> وصف الموقع</div>
            <div className="text-sm text-slate-900 whitespace-pre-wrap">{item.locationDesc}</div>
          </div>
        )}
      </div>

      {/* Documents checklist */}
      <DocumentsChecklist item={item} canManage={canManage} onChange={invalidate} />

      {/* Attachments */}
      <AttachmentsSection item={item} canManage={canManage} onChange={invalidate} />

      {/* Timeline */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2"><IconHistory className="w-4 h-4 text-slate-400" /> سجل الإجراءات</h2>
        {(!item.events || item.events.length === 0) && <p className="text-xs text-slate-400">لا يوجد سجل بعد.</p>}
        <ol className="space-y-3">
          {item.events?.map((ev) => (
            <li key={ev.id} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
              <div className="flex-1">
                <div className="text-sm text-slate-900">{ev.notes || ev.action}</div>
                <div className="text-[11px] text-slate-500">
                  {ev.user?.fullName} · {formatDateTimeAr(ev.createdAt)}
                  {ev.toStatus && ev.fromStatus !== ev.toStatus && (
                    <> · {ALLOCATION_STATUS[ev.toStatus as keyof typeof ALLOCATION_STATUS]?.text || ev.toStatus}</>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Workflow action panel
// ----------------------------------------------------------------------------
function WorkflowPanel({ item, onChange }: { item: AllocationRequest; onChange: () => void }) {
  const [notes, setNotes] = useState('');
  const { data: minutesList } = useQuery({ queryKey: ['minutes'], queryFn: minutesApi.list });
  const [minutesId, setMinutesId] = useState('');
  const [itemNo, setItemNo] = useState('1');
  const [decisionNo, setDecisionNo] = useState('');
  const [decisionDate, setDecisionDate] = useState('');

  const run = (fn: () => Promise<any>, success: string) =>
    fn().then(() => { toast.success(success); setNotes(''); onChange(); })
      .catch((e: any) => {
        const msg = e.response?.data?.message || 'تعذّر تنفيذ الإجراء';
        toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
      });

  const s = item.status;
  const draftMinutes = (minutesList || []).filter((m) => m.status === 'draft');

  return (
    <div className="card space-y-3 border-brand-200 bg-brand-50/40">
      <h2 className="text-sm font-semibold flex items-center gap-2"><IconSend className="w-4 h-4 text-brand-500" /> الإجراء التالي</h2>

      {(s === 'received' || s === 'under_review' || s === 'missing_docs') && (
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات الإجراء (اختياري)..."
          className="input"
        />
      )}

      <div className="flex flex-wrap gap-2">
        {(s === 'received' || s === 'missing_docs') && (
          <button className="btn-primary text-sm" onClick={() => run(() => allocationApi.submit(item.id, notes), 'تم عرض الطلب على اللجنة')}>
            <IconSend className="w-4 h-4" /> عرض على اللجنة
          </button>
        )}
        {(s === 'received' || s === 'under_review') && (
          <button className="btn text-sm" onClick={() => run(() => allocationApi.markMissing(item.id, notes), 'تم تسجيل النواقص ومراسلة المكتب المختص')}>
            <IconAlertTriangle className="w-4 h-4" /> تسجيل نواقص (مراسلة المكتب)
          </button>
        )}
        {s === 'under_review' && (
          <>
            <button className="btn-primary text-sm" onClick={() => run(() => allocationApi.committeeDecision(item.id, 'approve', notes), 'سُجّلت موافقة اللجنة')}>
              <IconCheck className="w-4 h-4" /> موافقة اللجنة
            </button>
            <button className="btn-danger text-sm" onClick={() => run(() => allocationApi.committeeDecision(item.id, 'reject', notes), 'سُجّل عدم موافقة اللجنة')}>
              <IconX className="w-4 h-4" /> عدم موافقة اللجنة
            </button>
          </>
        )}
      </div>

      {/* Assign to minutes */}
      {(s === 'committee_approved' || s === 'committee_rejected') && (
        <div className="border-t border-brand-100 pt-3 space-y-2">
          <div className="text-xs text-slate-600 flex items-center gap-1"><IconBook className="w-4 h-4" /> إدراج الطلب في محضر اللجنة</div>
          {draftMinutes.length === 0 ? (
            <div className="text-xs text-amber-600">
              لا توجد محاضر مفتوحة. <Link href="/allocation/minutes" className="underline">أنشئ محضراً جديداً</Link> أولاً.
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="label">المحضر</label>
                <select className="input" value={minutesId} onChange={(e) => setMinutesId(e.target.value)}>
                  <option value="">-- اختر المحضر --</option>
                  {draftMinutes.map((m) => <option key={m.id} value={m.id}>{m.minutesNo}</option>)}
                </select>
              </div>
              <div>
                <label className="label">رقم البند (1-12)</label>
                <input type="number" min={1} max={12} className="input w-24" value={itemNo} onChange={(e) => setItemNo(e.target.value)} />
              </div>
              <button
                className="btn-primary text-sm"
                disabled={!minutesId}
                onClick={() => run(() => allocationApi.assignMinutes(item.id, minutesId, Number(itemNo)), 'تم إدراج الطلب في المحضر')}
              >
                <IconBook className="w-4 h-4" /> إدراج في المحضر
              </button>
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            بعد إدراج جميع الطلبات، يُعتمد المحضر من مجلس الوزراء من صفحة المحضر، فتُحسم الطلبات تلقائياً.
          </p>
        </div>
      )}

      {/* Record decision after approval */}
      {s === 'approved' && (
        <div className="border-t border-emerald-100 pt-3 space-y-2">
          <div className="text-xs text-slate-600 flex items-center gap-1"><IconCertificate className="w-4 h-4" /> تسجيل قرار التخصيص</div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label">رقم القرار</label>
              <input className="input" value={decisionNo} onChange={(e) => setDecisionNo(e.target.value)} placeholder="مثال: 2026/123" />
            </div>
            <div>
              <label className="label">تاريخ القرار</label>
              <input type="date" className="input" value={decisionDate} onChange={(e) => setDecisionDate(e.target.value)} />
            </div>
            <button
              className="btn-primary text-sm"
              onClick={() => run(() => allocationApi.recordDecision(item.id, decisionNo || undefined, decisionDate || undefined), 'تم تسجيل قرار التخصيص')}
            >
              <IconCheck className="w-4 h-4" /> حفظ القرار
            </button>
          </div>
        </div>
      )}

      {(s === 'approved' || s === 'rejected') && (
        <p className="text-xs text-slate-500">اكتملت دورة معالجة هذا الطلب. تبقى جميع بياناته محفوظة للرجوع إليها.</p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Documents checklist
// ----------------------------------------------------------------------------
function DocumentsChecklist({ item, canManage, onChange }: { item: AllocationRequest; canManage: boolean; onChange: () => void }) {
  const docs = item.documents || [];
  const toggle = (docId: string, current: string) =>
    allocationApi.updateDocument(item.id, docId, { status: current === 'received' ? 'pending' : 'received' })
      .then(() => onChange())
      .catch(() => toast.error('تعذّر تحديث المستند'));

  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-2"><IconClipboardList className="w-4 h-4 text-slate-400" /> المستندات المطلوبة</h2>
      <div className="space-y-2">
        {docs.map((d) => {
          const received = d.status === 'received';
          return (
            <div key={d.id} className="flex items-center gap-3 border border-slate-200 rounded-md p-2.5">
              {received ? <IconCircleCheck className="w-5 h-5 text-emerald-500 shrink-0" /> : <IconCircleDashed className="w-5 h-5 text-slate-300 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-900">{docTypeLabel(d.docType)}</div>
                <div className="text-[11px] text-slate-500">
                  {d.required ? 'مطلوب' : 'اختياري'} · {received ? `مستوفى${d.receivedAt ? ` (${formatDateAr(d.receivedAt)})` : ''}` : 'ناقص'}
                </div>
              </div>
              {canManage && (
                <button
                  onClick={() => toggle(d.id, d.status)}
                  className={`btn text-xs py-1 ${received ? 'text-amber-600' : 'text-emerald-600'}`}
                >
                  {received ? 'تعليم كناقص' : 'تعليم كمستوفى'}
                </button>
              )}
            </div>
          );
        })}
        {docs.length === 0 && <p className="text-xs text-slate-400">لا توجد مستندات.</p>}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Attachments (files) section
// ----------------------------------------------------------------------------
function AttachmentsSection({ item, canManage, onChange }: { item: AllocationRequest; canManage: boolean; onChange: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const doUpload = async () => {
    if (!files.length) return;
    setBusy(true);
    try {
      const failed = await uploadAttachments(item.id, files, 'allocation');
      if (failed > 0) toast.warning(`فشل رفع ${failed} ملف`);
      else toast.success('تم رفع المرفقات');
      setFiles([]);
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-2"><IconUpload className="w-4 h-4 text-slate-400" /> المرفقات</h2>
      <ExistingAttachments attachments={item.attachments} onChange={onChange} />
      {canManage && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <p className="text-xs text-slate-500">يمكنك رفع المستندات الأصلية وصورة من كتاب مراسلة المكتب المختص.</p>
          <MultiFileUpload files={files} onAdd={(f) => setFiles((p) => [...p, ...f])} onRemove={(i) => setFiles((p) => p.filter((_, idx) => idx !== i))} scannerSlot={<ScanButton onScanned={(f) => setFiles((p) => [...p, f])} />} />
          {files.length > 0 && (
            <button onClick={doUpload} disabled={busy} className="btn-primary text-sm disabled:opacity-50">
              <IconCheck className="w-4 h-4" /> {busy ? 'جارٍ الرفع...' : `رفع ${files.length} ملف`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AllocationDetailPage() {
  return (
    <AuthLayout>
      <DetailInner />
    </AuthLayout>
  );
}
