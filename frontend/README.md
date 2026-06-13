# نظام الأرشفة الإلكترونية الذكي - Frontend

Frontend بـ Next.js 14 لنظام GSDMS، يتكامل مع الـ Backend عبر REST API.

## التقنيات

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** مع دعم RTL طبيعي
- **TanStack Query** لإدارة البيانات والـ caching
- **Zustand** لإدارة الحالة (JWT, user)
- **react-hook-form + zod** للنماذج والتحقق
- **Tabler Icons** للأيقونات
- **Sonner** للإشعارات (toasts)

## البدء السريع

```bash
# 1. تثبيت المكتبات
npm install

# 2. إعداد متغيرات البيئة
copy .env.local.example .env.local

# 3. تشغيل التطوير
npm run dev
```

يعمل على: **http://localhost:3200**

## ⚠️ المتطلب الأساسي

**الـ Backend لازم يكون شغّال على:** `http://localhost:3100`

## بيانات الدخول التجريبية

- المستخدم: `admin`
- كلمة المرور: `Admin@1234`

## الشاشات المتاحة

- `/login` - تسجيل الدخول
- `/dashboard` - الصفحة الرئيسية مع الإحصائيات
- `/inbox` - صندوق الوارد
- `/inbox/[id]` - تفاصيل المراسلة
- `/inbox/new` - تسجيل وارد جديد

## الميزات القادمة

- [ ] رفع المرفقات
- [ ] التحويلات
- [ ] الطباعة الآمنة (Modal)
- [ ] التعليقات الداخلية
- [ ] البحث المتقدم
- [ ] التقارير والإحصائيات
