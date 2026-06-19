'use client';

// تكامل التعرّف على الوجه عبر face-api.js (@vladmandic/face-api).
// تُحمَّل المكتبة وأوزان النماذج من رابط قابل للضبط (CDN افتراضياً، أو استضافة
// ذاتية للأنظمة المغلقة عبر متغيّرات البيئة NEXT_PUBLIC_FACE_*).

const FACE_API_URL =
  process.env.NEXT_PUBLIC_FACE_API_URL ||
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js';
const MODELS_URL =
  process.env.NEXT_PUBLIC_FACE_MODELS_URL ||
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

let loadPromise: Promise<any> | null = null;

/** يحمّل مكتبة face-api وأوزان النماذج مرّة واحدة. */
export async function loadFaceApi(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('بيئة غير متصفّح');
  const w = window as any;
  if (w.faceapi && w.__faceModelsLoaded) return w.faceapi;
  if (!loadPromise) {
    loadPromise = (async () => {
      if (!w.faceapi) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = FACE_API_URL;
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('تعذّر تحميل مكتبة التعرّف على الوجه'));
          document.head.appendChild(s);
        });
      }
      const faceapi = w.faceapi;
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL);
      w.__faceModelsLoaded = true;
      return faceapi;
    })().catch((e) => {
      loadPromise = null; // اسمح بإعادة المحاولة
      throw e;
    });
  }
  return loadPromise;
}

export interface FaceDetection {
  descriptor: number[];
  ear: number; // نسبة فتح العين (للكشف عن الرمشة)
  score: number;
}

/** يكشف وجهاً واحداً ويُرجع متّجه الوصف ونسبة فتح العين. */
export async function detectFace(video: HTMLVideoElement): Promise<FaceDetection | null> {
  const w = window as any;
  const faceapi = w.faceapi;
  if (!faceapi) return null;
  const det = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!det) return null;
  const ear = (earOfEye(det.landmarks.getLeftEye()) + earOfEye(det.landmarks.getRightEye())) / 2;
  return {
    descriptor: Array.from(det.descriptor as Float32Array),
    ear,
    score: det.detection?.score ?? 0,
  };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** نسبة فتح العين (Eye Aspect Ratio) من 6 نقاط لعين واحدة. */
function earOfEye(eye: { x: number; y: number }[]): number {
  if (!eye || eye.length < 6) return 1;
  const v = dist(eye[1], eye[5]) + dist(eye[2], eye[4]);
  const h = 2 * dist(eye[0], eye[3]);
  return h === 0 ? 1 : v / h;
}
