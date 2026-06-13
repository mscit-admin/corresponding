# نظام الأرشفة الإلكترونية الذكي - Backend

Government Smart Document Management System (GSDMS) - REST API

## 📋 المحتويات

- [التقنيات المستخدمة](#التقنيات-المستخدمة)
- [البدء السريع](#البدء-السريع)
- [هيكل المشروع](#هيكل-المشروع)
- [أوامر شائعة](#أوامر-شائعة)
- [API Endpoints](#api-endpoints)
- [التطوير](#التطوير)

## التقنيات المستخدمة

- **NestJS 10** - إطار العمل الخلفي
- **TypeScript 5** - أمان الأنواع
- **Prisma 5** - ORM وتوليد الـ Migrations
- **MySQL 8** - قاعدة البيانات الرئيسية
- **Redis 7** - الكاش وقوائم الانتظار
- **MinIO** - تخزين الملفات
- **Elasticsearch 8** - البحث المتقدم
- **JWT + Passport** - المصادقة
- **Swagger** - توثيق الـ API

## البدء السريع

### 1. الإعداد المبدئي

```bash
# نسخ متغيرات البيئة
cp .env.example .env

# تثبيت الـ dependencies
npm install
```

### 2. تشغيل الخدمات (MySQL + Redis + MinIO + Elasticsearch)

```bash
docker-compose up -d mysql redis minio elasticsearch
```

انتظر حتى تجهز قاعدة البيانات (10-20 ثانية).

### 3. تشغيل Migrations وإدخال بيانات أولية

```bash
# توليد Prisma Client
npm run prisma:generate

# تشغيل الـ migrations
npm run prisma:migrate

# إدخال البيانات الأولية (الأدوار، الصلاحيات، مستخدم admin)
npm run prisma:seed
```

### 4. تشغيل الـ API

```bash
npm run start:dev
```

الخادم يعمل الآن على: `http://localhost:3000`

- **Swagger Docs**: http://localhost:3000/api/docs
- **MinIO Console**: http://localhost:9001 (admin/minioadmin)
- **Prisma Studio**: `npm run prisma:studio`

## بيانات الدخول الافتراضية

| المستخدم | اسم المستخدم | كلمة المرور | الدور |
|---------|-------------|------------|------|
| مدير النظام | admin | Admin@1234 | super_admin |
| موظف | ahmed.mohamed | Admin@1234 | dept_manager |

⚠️ **مهم**: غيّر كلمات المرور قبل النشر في الإنتاج.

## هيكل المشروع

```
src/
├── main.ts                          # نقطة البدء
├── app.module.ts                    # الموديول الرئيسي
├── config/
│   └── configuration.ts             # إعدادات التطبيق
├── common/                          # مكونات مشتركة
│   ├── decorators/                  # @CurrentUser, @Public
│   ├── filters/                     # معالج الأخطاء العام
│   ├── guards/                      # حراس الصلاحيات
│   └── interceptors/                # interceptors
├── modules/
│   ├── prisma/                      # Prisma service (global)
│   ├── auth/                        # المصادقة و JWT
│   │   ├── strategies/jwt.strategy.ts
│   │   ├── guards/jwt-auth.guard.ts
│   │   ├── dto/login.dto.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   └── auth.module.ts
│   ├── users/                       # إدارة المستخدمين
│   └── correspondence/              # المراسلات (نموذجي للوارد)
└── prisma/
    ├── schema.prisma                # نموذج قاعدة البيانات (18 جدول)
    └── seed.ts                      # البيانات الأولية
```

## أوامر شائعة

```bash
# التطوير
npm run start:dev              # تشغيل مع reload تلقائي
npm run start:debug            # تشغيل مع debugger

# البناء والإنتاج
npm run build                  # بناء للإنتاج
npm run start:prod             # تشغيل البناء

# Prisma
npm run prisma:generate        # توليد Prisma Client
npm run prisma:migrate         # إنشاء وتطبيق migration
npm run prisma:migrate:prod    # تطبيق migrations في الإنتاج
npm run prisma:studio          # واجهة GUI لقاعدة البيانات
npm run prisma:seed            # إدخال البيانات الأولية

# الجودة
npm run lint                   # فحص الكود
npm run format                 # تنسيق الكود
npm test                       # تشغيل الاختبارات
npm run test:cov               # تشغيل مع تغطية
```

## API Endpoints

### Auth (لا تحتاج JWT)

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin@1234"
}
```

### Users

```http
GET  /api/v1/users/me            # بيانات المستخدم الحالي
GET  /api/v1/users               # قائمة المستخدمين
GET  /api/v1/users/:id           # بيانات مستخدم
```

### Incoming Correspondence

```http
POST /api/v1/correspondence/incoming     # تسجيل وارد جديد
GET  /api/v1/correspondence/incoming     # قائمة الواردات (مع فلاتر)
GET  /api/v1/correspondence/incoming/:id # تفاصيل مراسلة
```

استخدم Swagger في `/api/docs` لكل التفاصيل التفاعلية.

## التطوير

### إضافة موديول جديد

```bash
# مثال: موديول الجهات الخارجية
nest g module modules/external-entities
nest g service modules/external-entities --no-spec
nest g controller modules/external-entities --no-spec
```

اتبع نمط موديول `correspondence` الموجود.

### إضافة Migration

```bash
# عدّل prisma/schema.prisma ثم:
npm run prisma:migrate -- --name your_migration_name
```

### الميزات القادمة (Roadmap)

- [ ] رفع الملفات إلى MinIO
- [ ] خدمة OCR للعربية
- [ ] محرك سير العمل
- [ ] الإشعارات الفورية (WebSocket)
- [ ] التكامل مع Active Directory
- [ ] خدمة الطباعة الآمنة
- [ ] البحث الدلالي (Elasticsearch)

## المساهمة

كل تغيير يجب أن:
1. يمر على `npm run lint` بدون أخطاء
2. يحتوي على tests للكود الجديد
3. يحدّث Swagger annotations
4. يحدّث Audit log لكل عملية حساسة

## الترخيص

UNLICENSED - مشروع مؤسسي حكومي
