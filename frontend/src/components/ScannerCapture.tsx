'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconScan, IconCamera, IconX, IconRefresh, IconCheck, IconAlertTriangle,
} from '@tabler/icons-react';

interface ScannerCaptureProps {
  /** يُستدعى عند التقاط مستند، ويُمرّر الملف الناتج (صورة JPEG) لأرشفته */
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * مكوّن مسح/أرشفة المستندات عن طريق الكاميرا (السكانر).
 * المتصفحات لا تتيح الوصول المباشر لأجهزة السكانر (TWAIN)، لذا نستخدم
 * كاميرا الجهاز (ويب كام أو كاميرا الجوال) لتصوير المستند وأرشفته كصورة.
 */
export function ScannerCapture({ onCapture, onClose }: ScannerCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const capturedBlobRef = useRef<Blob | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    setIsReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('unsupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
      }
    } catch (e: any) {
      if (e?.message === 'unsupported') {
        setError('المتصفح لا يدعم الوصول للكاميرا. استخدم رفع ملف بدلاً من ذلك.');
      } else if (e?.name === 'NotAllowedError') {
        setError('تم رفض إذن الكاميرا. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح.');
      } else if (e?.name === 'NotFoundError') {
        setError('لم يتم العثور على كاميرا متصلة بالجهاز.');
      } else {
        setError('تعذّر تشغيل الكاميرا. تأكد من توصيلها وحاول مرة أخرى.');
      }
    }
  }, []);

  useEffect(() => {
    startStream();
    return () => stopStream();
  }, [startStream, stopStream]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        capturedBlobRef.current = blob;
        setPreview(URL.createObjectURL(blob));
        stopStream();
      },
      'image/jpeg',
      0.92,
    );
  };

  const handleRetake = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    capturedBlobRef.current = null;
    startStream();
  };

  const handleConfirm = () => {
    const blob = capturedBlobRef.current;
    if (!blob) return;
    const fileName = `scan-${Date.now()}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    if (preview) URL.revokeObjectURL(preview);
    onCapture(file);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <IconScan className="w-4 h-4 text-brand-600" /> مسح المستند عن طريق السكانر
          </h3>
          <button
            type="button"
            onClick={() => { stopStream(); onClose(); }}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md"
            aria-label="إغلاق"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-800 flex gap-2">
              <IconAlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium mb-1">تعذّر الوصول للكاميرا</div>
                <div className="text-xs leading-relaxed">{error}</div>
              </div>
            </div>
          ) : (
            <div className="relative bg-slate-900 rounded-md overflow-hidden aspect-[4/3] flex items-center justify-center">
              {/* معاينة الالتقاط */}
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="المستند الممسوح" className="w-full h-full object-contain" />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  {!isReady && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm">
                      جارٍ تشغيل الكاميرا...
                    </div>
                  )}
                  {/* إطار إرشادي للمستند */}
                  {isReady && (
                    <div className="pointer-events-none absolute inset-4 border-2 border-dashed border-white/40 rounded" />
                  )}
                </>
              )}
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {!error && (
            <p className="text-xs text-slate-500 text-center">
              ضع المستند داخل الإطار وتأكد من وضوح الإضاءة، ثم اضغط التقاط.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
          {error ? (
            <>
              <button type="button" onClick={startStream} className="btn text-sm">
                <IconRefresh className="w-4 h-4" /> إعادة المحاولة
              </button>
              <button type="button" onClick={() => { stopStream(); onClose(); }} className="btn text-sm">
                <IconX className="w-4 h-4" /> إغلاق
              </button>
            </>
          ) : preview ? (
            <>
              <button type="button" onClick={handleRetake} className="btn text-sm">
                <IconRefresh className="w-4 h-4" /> إعادة المسح
              </button>
              <button type="button" onClick={handleConfirm} className="btn-primary text-sm">
                <IconCheck className="w-4 h-4" /> اعتماد وأرشفة
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleCapture}
              disabled={!isReady}
              className="btn-primary text-sm"
            >
              <IconCamera className="w-4 h-4" /> التقاط المستند
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
