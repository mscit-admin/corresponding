'use client';

import { AuthLayout } from '@/components/layout/AuthLayout';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  IconArrowRight, IconFileText, IconBuilding, IconUser, IconCalendar,
  IconStar, IconAlertTriangle, IconCheck, IconClock, IconArrowDown,
  IconArrowBackUp, IconSend, IconPrinter, IconArchive, IconEye,
  IconCircleCheck, IconSparkles, IconPencil,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { incomingApi } from '@/lib/api';
import { DocumentViewer } from '@/components/DocumentViewer';
import { useAuthStore } from '@/store/auth';
import { canEditCorrespondence, canRoute } from '@/lib/permissions';
import { RoutingSection } from '@/components/RoutingSection';
import { priorityLabel, confidentialityLabel, statusLabel, visibilityLabel } from '@/lib/incoming-constants';
import { formatDateAr, formatDateTimeAr, timeAgoAr, cn } from '@/lib/utils';

function CorrespondenceDetailsPageInner() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user } = useAuthStore();
  const canEdit = canEditCorrespondence(user?.roleName);

  const { data, isLoading, error } = useQuery({
    queryKey: ['incoming', id],
    queryFn: () => incomingApi.getById(id),
  });

  if (isLoading) return <div className="text-center py-10 text-slate-500">جارٍ تحميل المراسلة...</div>;
  if (error) {
    const status = (error as any)?.response?.status;
    if (status === 403)
      return <div className="card text-center py-12 text-slate-600">🔒 ليس لديك صلاحية مشاهدة هذه المراسلة</div>;
  }
  if (error || !data) return <div className="card text-center py-10 text-slate-600">لم يتم العثور على المراسلة</div>;

  const handlePrint = () => {
    const esc = (s?: string) =>
      (s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const w = window.open('', '_blank', 'width=720,height=560');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>الرقم الإشاري</title>
      <style>
        body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;padding:24px;color:#0f172a}
        .box{border:2px solid #0f172a;border-radius:12px;padding:22px;max-width:540px;margin:auto}
        .t{font-size:13px;color:#475569;text-align:center}
        .serial{font-size:32px;font-weight:800;text-align:center;font-family:monospace;letter-spacing:2px;margin:12px 0;color:#1e3a8a}
        .row{display:flex;justify-content:space-between;gap:12px;font-size:13px;border-top:1px solid #e2e8f0;padding:7px 0}
        .label{color:#64748b}
      </style></head>
      <body onload="window.print()">
        <div class="box">
          <div class="t">نظام الأرشفة الإلكترونية — وزارة الشؤون الإدارية</div>
          <div class="t" style="margin-top:6px">الرقم الإشاري للمعاملة</div>
          <div class="serial">${esc(data.serialNo)}</div>
          ${data.registryNo ? `<div class="row"><span class="label">رقم القيد</span><span>${esc(data.registryNo)}</span></div>` : ''}
          <div class="row"><span class="label">الموضوع</span><span>${esc(data.subject)}</span></div>
          <div class="row"><span class="label">الجهة المرسلة</span><span>${esc(data.senderEntity?.nameAr)}</span></div>
          <div class="row"><span class="label">تاريخ الورود</span><span>${formatDateTimeAr(data.receivedAt)}</span></div>
        </div>
      </body></html>`);
    w.document.close();
    w.focus();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <button onClick={() => router.back()} className="btn text-xs py-1.5"><IconArrowRight className="w-3.5 h-3.5" /> رجوع</button>
        <span className="text-slate-400">الرئيسية › صندوق الوارد › <span className="text-slate-900 font-medium font-mono">{data.serialNo}</span></span>
      </div>

      {/* Header card */}
      <div className="card">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 font-mono">{data.serialNo}</span>
            {data.priority !== 'normal' && (
              <span className="badge-warning">{priorityLabel(data.priority)}</span>
            )}
            {data.confidentiality && data.confidentiality !== 'normal' && (
              <span className="badge-danger">{confidentialityLabel(data.confidentiality)}</span>
            )}
            <span className="badge-info">{statusLabel(data.status)}</span>
          </div>
          <button aria-label="مميزة"><IconStar className="w-5 h-5 text-amber-500" /></button>
        </div>

        <h1 className="text-lg font-medium text-slate-900 mb-3 leading-relaxed">{data.subject}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs p-3 bg-slate-50 rounded-md">
          <div><span className="text-slate-500">رقم المعاملة:</span> <span className="font-mono font-medium">{data.serialNo}</span></div>
          {data.registryNo && <div><span className="text-slate-500">رقم القيد:</span> <span className="font-mono font-medium">{data.registryNo}</span></div>}
          <div><span className="text-slate-500">الجهة المرسلة:</span> <span className="font-medium">{data.senderEntity?.nameAr}</span></div>
          {data.senderRefNo && <div><span className="text-slate-500">رقم المرسل:</span> <span className="font-mono">{data.senderRefNo}</span></div>}
          {data.transactionType && <div><span className="text-slate-500">نوع المعاملة:</span> <span className="font-medium">{data.transactionType}</span></div>}
          <div><span className="text-slate-500">تاريخ ورودها:</span> <span>{formatDateTimeAr(data.receivedAt)}</span></div>
          {data.originalDate && <div><span className="text-slate-500">تاريخ المستند:</span> <span>{formatDateAr(data.originalDate)}</span></div>}
          <div><span className="text-slate-500">درجة الأهمية:</span> <span className="font-medium">{priorityLabel(data.priority)}</span></div>
          <div><span className="text-slate-500">درجة السرية:</span> <span className="font-medium">{confidentialityLabel(data.confidentiality)}</span></div>
          <div>
            <span className="text-slate-500">صلاحية المشاهدة:</span> <span className="font-medium">{visibilityLabel(data.visibility)}</span>
            {data.visibility === 'departments' && data.visibilityDeptNames?.length ? (
              <span className="text-slate-400"> ({data.visibilityDeptNames.join('، ')})</span>
            ) : null}
          </div>
          {data.dueDate && <div><span className="text-slate-500">المهلة:</span> <span className="text-amber-700 font-medium">{formatDateAr(data.dueDate)}</span></div>}
          {data.currentOwner && <div><span className="text-slate-500">المالك الحالي:</span> <span className="font-medium">{data.currentOwner.fullName}</span></div>}
        </div>
      </div>

      {/* AI Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 items-start">
        <IconSparkles className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="flex-1 text-sm text-blue-900">
          <div className="font-medium mb-1">ملخص ذكي بواسطة AI</div>
          <div className="leading-relaxed text-blue-800">[سيتم توليد الملخص تلقائياً بعد تكامل خدمة OCR وNLP في المرحلة التالية]</div>
        </div>
      </div>

      {/* Document Preview */}
      <DocumentViewer attachments={data.attachments} showViewLog={user?.roleName === 'super_admin'} />

      {/* Timeline */}
      <div className="card">
        <h2 className="text-sm font-medium mb-4 flex items-center gap-2"><IconClock className="w-4 h-4 text-slate-400" /> سير المعاملة</h2>

        <TimelineStep
          icon={<IconArrowDown className="w-3 h-3" />}
          color="bg-emerald-100 text-emerald-700"
          title="وردت من الجهة المرسلة"
          subtitle={data.senderEntity?.nameAr}
          date={data.receivedAt}
        />
        <TimelineStep
          icon={<IconCheck className="w-3 h-3" />}
          color="bg-emerald-100 text-emerald-700"
          title="تم التسجيل في النظام"
          subtitle={data.creator ? `بواسطة: ${data.creator.fullName}` : ''}
          date={data.createdAt}
        />
        {data.currentOwner && (
          <TimelineStep
            icon={<IconSend className="w-3 h-3" />}
            color="bg-emerald-100 text-emerald-700"
            title="حُولت للمعالجة"
            subtitle={`إلى: ${data.currentOwner.fullName}`}
            date={data.updatedAt}
          />
        )}
        <TimelineStep
          icon={<IconClock className="w-3 h-3" />}
          color="bg-amber-100 text-amber-700"
          title="بانتظار إجراء"
          subtitle="الخطوة الحالية"
          date={null}
          isCurrent
          isLast
        />
      </div>

      {/* Routing / referral (التوجيه) */}
      <RoutingSection id={id} routings={data.routings} canRoute={canRoute(user?.roleName)} />

      {/* Viewers (read tracking) */}
      <div className="card">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
          <IconEye className="w-4 h-4 text-slate-400" /> من شاهد الرسالة
          {data.viewers?.length ? <span className="text-slate-400 font-normal">({data.viewers.length})</span> : null}
        </h2>
        {!data.viewers?.length ? (
          <p className="text-xs text-slate-400">لم يشاهدها أحد بعد.</p>
        ) : (
          <div className="space-y-2">
            {data.viewers.map((v) => (
              <div key={v.userId} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold">
                    {v.fullName?.slice(0, 2)}
                  </span>
                  <div>
                    <div className="font-medium text-slate-800">{v.fullName}</div>
                    {v.department && <div className="text-[10px] text-slate-400">{v.department}</div>}
                  </div>
                </div>
                <div className="text-left text-slate-400">
                  <div>{formatDateTimeAr(v.lastViewedAt)}</div>
                  {v.viewCount > 1 && <div className="text-[10px]">{v.viewCount} مرّات</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="card flex flex-wrap gap-2 justify-center">
        {canEdit && (
          <Link href={`/inbox/${id}/edit`} className="btn-primary"><IconPencil className="w-4 h-4" /> تعديل</Link>
        )}
        <button className="btn"><IconCircleCheck className="w-4 h-4" /> اعتماد</button>
        <button className="btn"><IconArrowBackUp className="w-4 h-4" /> رد</button>
        <button className="btn"><IconSend className="w-4 h-4" /> تحويل</button>
        <button onClick={handlePrint} className="btn"><IconPrinter className="w-4 h-4" /> طباعة الرقم الإشاري</button>
        <button className="btn"><IconArchive className="w-4 h-4" /> أرشفة</button>
      </div>
    </div>
  );
}

function TimelineStep({ icon, color, title, subtitle, date, isCurrent, isLast }: {
  icon: React.ReactNode; color: string; title: string; subtitle?: string;
  date: string | null; isCurrent?: boolean; isLast?: boolean;
}) {
  return (
    <div className="flex gap-3 mb-3 last:mb-0">
      <div className="flex flex-col items-center shrink-0">
        <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', color)}>{icon}</div>
        {!isLast && <div className="w-px flex-1 bg-slate-200 mt-1 min-h-[20px]" />}
      </div>
      <div className="flex-1 pb-2">
        <div className={cn('text-sm font-medium', isCurrent && 'text-amber-700')}>{title}</div>
        {subtitle && <div className="text-xs text-slate-600 mt-0.5">{subtitle}</div>}
        {date && <div className="text-xs text-slate-400 mt-0.5">{formatDateTimeAr(date)}</div>}
        {!date && isCurrent && <div className="text-xs text-slate-400 mt-0.5">الآن</div>}
      </div>
    </div>
  );
}

export default function CorrespondenceDetailsPage() {
  return (
    <AuthLayout>
      <CorrespondenceDetailsPageInner />
    </AuthLayout>
  );
}
