'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { IconScan, IconX, IconLoader2, IconCircleCheck } from '@tabler/icons-react';
import { loadFaceApi, detectFace } from '@/lib/face';

type Phase = 'loading' | 'searching' | 'blink' | 'capturing' | 'done' | 'error';

const EAR_OPEN = 0.28;
const EAR_CLOSED = 0.2;

/**
 * نافذة التقاط بصمة الوجه مع كشف حياة بسيط (رمشة عين).
 * عند نجاح الالتقاط تستدعي onCapture بمتّجه الوصف (128 رقماً).
 */
export function FaceCapture({
  mode,
  onCapture,
  onClose,
}: {
  mode: 'enroll' | 'verify';
  onCapture: (descriptor: number[]) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const blinkRef = useRef<{ sawOpen: boolean; sawClosed: boolean }>({ sawOpen: false, sawClosed: false });
  const doneRef = useRef(false);
  const phaseRef = useRef<Phase>('loading');

  const [phase, setPhaseState] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);

  // نحدّث المرجع مع الحالة معاً ليقرأ الـloop القيمة الحيّة (لا المجمّدة بالإغلاق)
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const close = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  useEffect(() => {
    let cancelled = false;

    const loop = async () => {
      const video = videoRef.current;
      if (!video || doneRef.current || cancelled) return;
      try {
        const face = await detectFace(video);
        if (cancelled || doneRef.current) return; // أُلغي أثناء الانتظار
        if (face) {
          if (phaseRef.current !== 'blink') setPhase('blink');
          // كشف الحياة: عين مفتوحة ← مغلقة ← مفتوحة (رمشة)
          const b = blinkRef.current;
          if (face.ear > EAR_OPEN) {
            if (b.sawClosed) {
              // اكتملت الرمشة → التقط
              doneRef.current = true;
              setPhase('capturing');
              const finalFace = await detectFace(video);
              if (cancelled) return;
              const descriptor = (finalFace || face).descriptor;
              setPhase('done');
              cleanup();
              onCapture(descriptor);
              return;
            }
            b.sawOpen = true;
          } else if (face.ear < EAR_CLOSED && b.sawOpen) {
            b.sawClosed = true;
          }
        } else if (phaseRef.current !== 'searching') {
          setPhase('searching');
        }
      } catch {
        /* تجاهل إطاراً فاشلاً */
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    const start = async () => {
      try {
        await loadFaceApi();
        if (cancelled) return;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 480, height: 360 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setPhase('searching');
        rafRef.current = requestAnimationFrame(loop);
      } catch (e: any) {
        setError(
          e?.name === 'NotAllowedError'
            ? 'تم رفض الوصول إلى الكاميرا. يرجى السماح بالكاميرا والمحاولة مرة أخرى.'
            : e?.message || 'تعذّر تشغيل الكاميرا أو تحميل نماذج التعرّف على الوجه.',
        );
        setPhase('error');
      }
    };

    void start();
    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint = {
    loading: 'جارٍ تحميل نماذج التعرّف على الوجه…',
    searching: 'ضع وجهك أمام الكاميرا في إضاءة جيدة',
    blink: 'اطرف بعينيك للتأكد من أنك شخص حقيقي',
    capturing: 'جارٍ الالتقاط…',
    done: 'تم التحقّق بنجاح',
    error: 'حدث خطأ',
  }[phase];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <IconScan className="w-5 h-5 text-brand-600" />
            {mode === 'enroll' ? 'تسجيل بصمة الوجه' : 'التحقّق ببصمة الوجه'}
          </h3>
          <button onClick={close} className="p-1 rounded hover:bg-slate-100"><IconX className="w-4 h-4" /></button>
        </div>

        <div className="relative aspect-[4/3] bg-slate-900 rounded-lg overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
          {(phase === 'loading' || phase === 'capturing') && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <IconLoader2 className="w-8 h-8 animate-spin" />
            </div>
          )}
          {phase === 'done' && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-600/70 text-white">
              <IconCircleCheck className="w-12 h-12" />
            </div>
          )}
        </div>

        {phase === 'error' ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <p className="text-sm text-slate-600 text-center">{hint}</p>
        )}

        {phase === 'error' && (
          <button onClick={close} className="btn w-full text-sm">إغلاق</button>
        )}
      </div>
    </div>
  );
}
