'use client';

import { useRef, useState } from 'react';
import { IconUpload, IconFile, IconPhoto, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import { validateFile, formatBytes } from '@/lib/uploads';

interface MultiFileUploadProps {
  files: File[];
  /** append validated files to the parent state */
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  /** optional extra control (e.g. the scanner button) shown under the dropzone */
  scannerSlot?: React.ReactNode;
}

/** Reusable multi-file (PDF/image) picker with drag & drop and a selected-files list. */
export function MultiFileUpload({ files, onAdd, onRemove, scannerSlot }: MultiFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleIncoming = (list: FileList | File[] | null) => {
    if (!list) return;
    const valid: File[] = [];
    for (const f of Array.from(list)) {
      const err = validateFile(f);
      if (err) {
        toast.error(`${f.name}: ${err}`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length) onAdd(valid);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleIncoming(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
        }`}
      >
        <IconUpload className="w-10 h-10 mx-auto text-slate-400 mb-2" />
        <div className="text-sm font-medium text-slate-700">اسحب الملفات هنا أو اضغط للاختيار</div>
        <div className="text-xs text-slate-500 mt-1">يمكنك اختيار أكثر من ملف · PDF, JPG, PNG (حتى 20 ميجا لكل ملف)</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => { handleIncoming(e.target.files); e.currentTarget.value = ''; }}
        />
        {scannerSlot && (
          <div className="mt-3 pt-3 border-t border-slate-200" onClick={(e) => e.stopPropagation()}>
            {scannerSlot}
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-slate-500">المرفقات المختارة: {files.length}</div>
          {files.map((file, i) => {
            const isImage = file.type.startsWith('image/');
            return (
              <div key={`${file.name}-${i}`} className="border border-slate-200 rounded-lg p-3 flex items-center gap-3 bg-slate-50">
                {isImage ? <IconPhoto className="w-7 h-7 text-brand-600 shrink-0" /> : <IconFile className="w-7 h-7 text-brand-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{file.name}</div>
                  <div className="text-xs text-slate-500">{formatBytes(file.size)}</div>
                </div>
                <button type="button" onClick={() => onRemove(i)} className="p-2 text-red-600 hover:bg-red-50 rounded-md" title="إزالة">
                  <IconTrash className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
