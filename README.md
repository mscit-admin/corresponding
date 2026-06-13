# 📚 GSDMS - Government Smart Document Management System

<div align="center">

**نظام الأرشفة الإلكترونية الذكي للجهات الحكومية**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-24%2B-green.svg)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org)
[![MySQL](https://img.shields.io/badge/MySQL-10.4-orange.svg)](https://www.mysql.com)

نظام متكامل لإدارة المراسلات الواردة والصادرة للجهات الحكومية بواجهة عربية كاملة

</div>

---

## 🌟 نظرة عامة

GSDMS هو نظام أرشفة إلكتروني ذكي مصمم للجهات الحكومية الليبية والعربية، يدعم:

- 📥 إدارة الواردات والصادرات
- 🔐 نظام صلاحيات متقدم (RBAC + ABAC)
- 📎 رفع المرفقات (PDF, صور)
- 🖨️ الطباعة الآمنة بـ QR Code (قريباً)
- 🤖 الذكاء الاصطناعي للتصنيف والـ OCR (قريباً)
- 🌐 واجهة عربية كاملة (RTL) بخط Cairo

---

## 🏗️ المعمارية

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js 14    │────▶│   NestJS 10     │────▶│   MySQL 10.4    │
│   (Port 3200)   │     │   (Port 3100)   │     │   (Port 3306)   │
│   Frontend      │     │   Backend API   │     │   Database      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 🛠️ التقنيات المستخدمة

### Backend
- **NestJS 10** - إطار العمل
- **TypeScript 5** - لغة البرمجة
- **Prisma 5** - ORM
- **MySQL 10.4** - قاعدة البيانات
- **JWT + Bcrypt** - المصادقة
- **Multer** - رفع الملفات
- **Swagger** - توثيق الـ API

### Frontend
- **Next.js 14** (App Router)
- **React 18** + **TypeScript 5**
- **Tailwind CSS 3** - التصميم (RTL)
- **TanStack Query** - إدارة البيانات
- **Zustand** - إدارة الحالة
- **React Hook Form + Zod** - النماذج والتحقق

---

## 🚀 التشغيل المحلي

### المتطلبات

- Node.js 24+ ([تحميل](https://nodejs.org))
- MySQL 10.4+ (يُنصح بـ [XAMPP](https://www.apachefriends.org/))
- npm 10+

### 1️⃣ استنساخ المشروع

```bash
git clone https://github.com/YOUR_USERNAME/gsdms.git
cd gsdms
```

### 2️⃣ إعداد قاعدة البيانات

تأكد أن MySQL يعمل على البورت 3306، ثم:

```bash
# إنشاء قاعدة البيانات
mysql -u root -e "CREATE DATABASE gsdms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3️⃣ إعداد Backend

```bash
cd backend
npm install
copy .env.example .env    # على Windows
# أو: cp .env.example .env  # على Linux/Mac

# عدّل DATABASE_URL في .env إذا لزم الأمر
# المثال الافتراضي: mysql://root:@localhost:3306/gsdms

npm run prisma:generate
npm run prisma:migrate    # عند السؤال، اكتب: init
npm run prisma:seed
npm run start:dev
```

✅ Backend شغّال على: **http://localhost:3100**
📚 Swagger Docs: **http://localhost:3100/api/docs**

### 4️⃣ إعداد Frontend

في نافذة طرفية جديدة:

```bash
cd frontend
npm install
copy .env.local.example .env.local    # على Windows
# أو: cp .env.local.example .env.local  # على Linux/Mac

npm run dev
```

✅ Frontend شغّال على: **http://localhost:3200**

### 5️⃣ تسجيل الدخول

- **اسم المستخدم**: `admin`
- **كلمة المرور**: `Admin@1234`

---

## 📂 هيكل المشروع

```
gsdms/
├── backend/                    # NestJS Backend
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/          # المصادقة (JWT)
│   │   │   ├── users/         # المستخدمين
│   │   │   ├── correspondence/# المراسلات
│   │   │   ├── attachments/   # المرفقات
│   │   │   └── prisma/        # Prisma Service
│   │   ├── common/            # Decorators, Filters
│   │   ├── config/            # الإعدادات
│   │   └── main.ts            # نقطة البداية
│   ├── prisma/
│   │   ├── schema.prisma      # نموذج قاعدة البيانات
│   │   ├── seed.ts            # البيانات الأولية
│   │   └── migrations-sql/    # SQL migrations
│   └── package.json
│
├── frontend/                   # Next.js Frontend
│   ├── src/
│   │   ├── app/               # App Router (Pages)
│   │   │   ├── login/
│   │   │   ├── dashboard/
│   │   │   └── inbox/
│   │   ├── components/        # المكونات
│   │   ├── lib/              # أدوات مساعدة
│   │   ├── store/            # Zustand stores
│   │   └── types/            # TypeScript types
│   └── package.json
│
├── docs/                      # التوثيق
│   └── الوثيقة_التقنية_الشاملة.docx
│
├── README.md                  # هذا الملف
├── LICENSE                    # رخصة MIT
└── .gitignore
```

---

## 🎯 الميزات الحالية

- ✅ تسجيل دخول آمن بـ JWT
- ✅ Dashboard مع إحصائيات
- ✅ صندوق الوارد مع فلاتر
- ✅ تسجيل مراسلة واردة جديدة
- ✅ رفع المرفقات (PDF, JPG, PNG)
- ✅ عرض تفاصيل المراسلة مع Timeline
- ✅ توليد رقم تسلسلي تلقائي
- ✅ Audit Logs (سجل تدقيق)
- ✅ واجهة عربية RTL كاملة

## 🔮 الميزات القادمة

- [ ] إدارة الصادرات
- [ ] التحويلات بين الموظفين
- [ ] الطباعة الآمنة بـ QR Code
- [ ] OCR للنصوص العربية
- [ ] التصنيف الذكي (AI)
- [ ] إشعارات حية (WebSocket)
- [ ] إدارة المستخدمين والأدوار
- [ ] التقارير والإحصائيات
- [ ] LDAP / Active Directory
- [ ] دعم Docker للنشر

---

## 📊 قاعدة البيانات

النظام يستخدم **18 جدول** منظمة في 4 مجموعات:

1. **Identity & Access**: users, roles, permissions, departments
2. **Correspondence**: incoming/outgoing_correspondence, attachments, categories, external_entities
3. **Workflow**: workflow_definitions/instances, transfers, comments, tasks
4. **Printing & Audit**: print_logs, print_templates, audit_logs

---

## 🔐 الأمان

- ✅ JWT Authentication
- ✅ Bcrypt password hashing (rounds: 12)
- ✅ Helmet security headers
- ✅ Input validation (class-validator + Zod)
- ✅ SQL injection protection (Prisma)
- ✅ Audit logs (immutable)
- ✅ CORS configuration
- ✅ Rate limiting (planned)

---

## 🤝 المساهمة

المساهمات مرحب بها! يرجى:

1. Fork المشروع
2. أنشئ branch جديد (`git checkout -b feature/AmazingFeature`)
3. Commit التغييرات (`git commit -m 'Add some AmazingFeature'`)
4. Push إلى Branch (`git push origin feature/AmazingFeature`)
5. افتح Pull Request

---

## 📄 الترخيص

هذا المشروع مرخّص تحت رخصة MIT - راجع ملف [LICENSE](LICENSE) للتفاصيل.

---

## 👤 المطوّر

**Yahia** - مطوّر برمجيات من طرابلس، ليبيا 🇱🇾

---

## 🙏 شكر وتقدير

- [NestJS](https://nestjs.com) - إطار العمل الرائع
- [Next.js](https://nextjs.org) - أفضل React framework
- [Tailwind CSS](https://tailwindcss.com) - التصميم بسرعة
- [Prisma](https://www.prisma.io) - ORM رائع
- [Tabler Icons](https://tabler-icons.io) - الأيقونات الجميلة

---

<div align="center">

**صُنع بكل ❤️ في ليبيا 🇱🇾**

⭐ إذا أعجبك المشروع، لا تنسَ النجمة!

</div>
