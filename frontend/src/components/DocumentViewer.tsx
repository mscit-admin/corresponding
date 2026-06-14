'use client';

import { useEffect, useState } from 'react';
import {
  IconFileText, IconDownload, IconExternalLink, IconPhoto, IconLoader2, IconAlertTriangle,
} from '@tabler/icons-react';
import { attachmentsApi } from '@/lib/api';
import type { Attachment } from '@/types';

function formatBytes(bytes: number) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * يعرض المستند الأصلي المرفق (PDF أو صورة) مباشرة داخل الصفحة.
 * يجلب الملف مع رمز المصادقة ثم يعرضه عبر Blob URL.
 */
export function DocumentViewer({ attachments }: { attachments?: Attachment[] }) {
  const [active, setActive] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const current = attachments?.[active];

  useEffect(() => {
    if (!current) return;
    let objectUrl: string | null = null;
    setLoading(true);
    setError(false);
    setUrl(null);
    attachmentsApi
      .download(current.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [current?.id]);

  if (!attachments || attachments.length === 0) {
    return (
      <div className="card overflow-hidden p-0">
        <div className="bg-slate-50 px-4 py-2 flex items-center gap-2 text-xs font-medium border-b border-slate-200">
          <IconFileText className="w-4 h-4" /> المستند الأصلي
        </div>
        <div className="h-48 bg-slate-100 flex flex-col items-center justify-center gap-2 text-slate-400">
          <IconFileText className="w-12 h-12" />
          <div className="text-xs">لا يوجد مستند مرفق لهذه المراسلة</div>
        </div>
      </div>
    );
  }

  const isPdf = current?.mimeType === 'application/pdf';
  const isImage = current?.mimeType?.startsWith('image/');

  return (
    <div className="card overflow-hidden p-0">
      {/* Header */}
      <div className="bg-slate-50 px-4 py-2 flex items-center justify-between gap-2 border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs font-medium min-w-0">
          {isImage ? <IconPhoto className="w-4 h-4 shrink-0" /> : <IconFileText className="w-4 h-4 shrink-0" />}
          <span className="truncate">{current?.originalName || 'المستند الأصلي'}</span>
          {current?.fileSize ? (
            <span className="text-slate-400 shrink-0">· {formatBytes(Number(current.fileSize))}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {url && (
            <>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn text-xs py-1" title="فتح في تبويب جديد">
                <IconExternalLink className="w-3.5 h-3.5" /> فتح
              </a>
              <a href={url} download={current?.originalName} className="btn text-xs py-1" title="تنزيل">
                <IconDownload className="w-3.5 h-3.5" /> تنزيل
              </a>
            </>
          )}
        </div>
      </div>

      {/* Tabs (when more than one attachment) */}
      {attachments.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-200 overflow-x-auto bg-white">
          {attachments.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setActive(i)}
              className={`text-xs px-2.5 py-1 rounded-md whitespace-nowrap ${
                i === active ? 'bg-brand-100 text-brand-700 font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              مرفق {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Preview area */}
      <div className="bg-slate-100 min-h-[20rem] flex items-center justify-center">
        {loading && (
          <div className="flex flex-col items-center gap-2 text-slate-400 py-16">
            <IconLoader2 className="w-8 h-8 animate-spin" />
            <div className="text-xs">جارٍ تحميل المستند...</div>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-2 text-red-500 py-16">
            <IconAlertTriangle className="w-8 h-8" />
            <div className="text-xs">تعذّر تحميل المستند</div>
          </div>
        )}

        {url && !loading && !error && (
          isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={current?.originalName} className="max-h-[75vh] w-auto object-contain" />
          ) : isPdf ? (
            <iframe src={url} title={current?.originalName} className="w-full h-[75vh] bg-white" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-slate-500 py-16">
              <IconFileText className="w-12 h-12" />
              <div className="text-xs">لا يمكن معاينة هذا النوع من الملفات</div>
              <a href={url} download={current?.originalName} className="btn-primary text-xs">
                <IconDownload className="w-4 h-4" /> تنزيل الملف
              </a>
            </div>
          )
        )}
      </div>
    </div>
  );
}
