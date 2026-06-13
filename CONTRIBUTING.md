# 🤝 دليل المساهمة - Contributing Guide

شكراً لاهتمامك بالمساهمة في GSDMS! 

## كيف تساهم

### 🐛 الإبلاغ عن مشاكل

افتح [Issue](https://github.com/YOUR_USERNAME/gsdms/issues) وتأكد من تضمين:

- وصف واضح للمشكلة
- خطوات لإعادة إنتاج المشكلة
- السلوك المتوقع مقابل السلوك الفعلي
- لقطات شاشة إذا أمكن
- نسخة Node.js و OS

### ✨ اقتراح ميزات

افتح [Discussion](https://github.com/YOUR_USERNAME/gsdms/discussions) لمناقشة الميزة قبل البدء.

### 🔀 Pull Requests

1. Fork المشروع
2. أنشئ branch جديد: `git checkout -b feature/your-feature`
3. اعمل تعديلاتك
4. اكتب commit messages واضحة
5. ارفع لـ branch: `git push origin feature/your-feature`
6. افتح Pull Request

## معايير الكود

### Backend (NestJS)

- استخدم TypeScript strict mode
- اتبع NestJS conventions (Module, Controller, Service)
- أضف JSDoc للدوال المعقدة
- استخدم Prisma للوصول لقاعدة البيانات

### Frontend (Next.js)

- استخدم TypeScript
- اتبع React Hooks rules
- استخدم Tailwind CSS للتصميم
- تأكد من دعم RTL في كل الواجهات

## Commit Messages

استخدم [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: إضافة ميزة جديدة
fix: إصلاح خطأ
docs: تحديث التوثيق
style: تعديلات تصميمية
refactor: إعادة هيكلة الكود
test: إضافة اختبارات
chore: مهام صيانة
```

أمثلة:
- `feat: add outgoing correspondence module`
- `fix: incoming form validation error`
- `docs: update API documentation`

## شكراً لك! 🙏
