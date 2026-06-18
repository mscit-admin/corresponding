'use client';

import { useEffect, useState } from 'react';
import {
  IconFileText, IconPhoto, IconTrash, IconExternalLink, IconLoader2, IconDownload,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { attachmentsApi } from '@/lib/api';
import { formatBytes, fileKind } from '@/lib/uploads';
import type { Attachment } from '@/types';

const KIND_LABEL: Record<string, string> = {
  pdf: 'PDF', word: 'Word', excel: 'Excel', image: 'صورة', other: 'ملف',
};

/** Thumbnail/preview for one existing attachment (fetched with auth). */
function AttachmentCard({ att, onDeleted }: { att: Attachment; onDeleted: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const kind = fileKind(att.mimeType);
  const isImage = kind === 'image';

  useEffect(() => {
    let objectUrl: string | null = null;
    attachmentsApi
      .download(att.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [att.id]);

  const handleDelete = async () => {
    if (!window.confirm(`حذف المرفق «${att.originalName}» نهائياً؟`)) return;
    try {
      setDeleting(true);
      await attachmentsApi.remove(att.id);
      toast.success('تم حذف المرفق');
      onDeleted();
    } catch {
      toast.error('تعذّر حذف المرفق');
      setDeleting(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="h-32 bg-slate-100 flex items-center justify-center overflow-hidden relative">
        {isImage && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={att.originalName} className="w-full h-full object-cover" />
        ) : !url ? (
          <IconLoader2 className="w-6 h-6 text-slate-300 animate-spin" />
        ) : (
          <IconFileText className="w-10 h-10 text-slate-400" />
        )}
        <span className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded bg-white/90 border border-slate-200 text-slate-600">
          {KIND_LABEL[kind]}
        </span>
      </div>
      <div className="p-2 space-y-1">
        <div className="text-xs font-medium text-slate-800 truncate flex items-center gap-1">
          {isImage ? <IconPhoto className="w-3.5 h-3.5 shrink-0" /> : <IconFileText className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate">{att.originalName}</span>
        </div>
        <div className="text-[10px] text-slate-400">{formatBytes(Number(att.fileSize))}</div>
        <div className="flex items-center gap-1 pt-1">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn text-[11px] py-1 px-2 justify-center" title="عرض">
              <IconExternalLink className="w-3.5 h-3.5" /> عرض
            </a>
          )}
          {url && (
            <a href={url} download={att.originalName} className="btn text-[11px] py-1 px-2 justify-center" title="تنزيل">
              <IconDownload className="w-3.5 h-3.5" /> تنزيل
            </a>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="btn text-[11px] py-1 px-2 justify-center text-red-600 hover:bg-red-50 disabled:opacity-50"
            title="حذف"
          >
            <IconTrash className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Grid of existing attachments with preview + delete. */
export function ExistingAttachments({ attachments, onChange }: { attachments?: Attachment[]; onChange: () => void }) {
  if (!attachments || attachments.length === 0) {
    return <p className="text-xs text-slate-400">لا توجد مرفقات حالية.</p>;
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {attachments.map((att) => (
        <AttachmentCard key={att.id} att={att} onDeleted={onChange} />
      ))}
    </div>
  );
}
