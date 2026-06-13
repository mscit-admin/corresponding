# 🚀 دليل التشغيل السريع - GSDMS

دليل خطوة بخطوة لتشغيل المشروع على جهازك في **15 دقيقة**.

---

## 📋 المتطلبات

قبل البدء، تأكد من تثبيت:

- ✅ **Node.js 24+** - [تحميل](https://nodejs.org)
- ✅ **MySQL 10+** - يُنصح بـ [XAMPP](https://www.apachefriends.org/) لأسهل تثبيت
- ✅ **Git** - [تحميل](https://git-scm.com)

---

## 1️⃣ استنساخ المشروع

```bash
git clone https://github.com/YOUR_USERNAME/gsdms.git
cd gsdms
```

---

## 2️⃣ تشغيل MySQL

افتح **XAMPP Control Panel** وشغّل MySQL.

ثم أنشئ قاعدة البيانات:

```bash
# على Windows (PowerShell)
$env:Path += ";C:\xampp\mysql\bin"
mysql -u root -e "CREATE DATABASE gsdms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

```bash
# على Linux/Mac
mysql -u root -e "CREATE DATABASE gsdms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

---

## 3️⃣ إعداد Backend

```bash
cd backend
npm install
```

⏳ استنى 2-3 دقايق لحد ما يخلص.

أنشئ ملف `.env`:

```bash
# على Windows
copy .env.example .env

# على Linux/Mac
cp .env.example .env
```

**هام**: عدّل `.env` إذا كان MySQL عندك بكلمة سر مختلفة.

ثم نفّذ:

```bash
npm run prisma:generate
npm run prisma:migrate
# عند السؤال "Enter a name for the new migration:" اكتب: init
npm run prisma:seed
npm run start:dev
```

✅ Backend شغّال على: **http://localhost:3100**

📚 **توثيق الـ API**: http://localhost:3100/api/docs

---

## 4️⃣ إعداد Frontend

افتح نافذة طرفية **جديدة** (مع ترك Backend شغّال):

```bash
cd frontend
npm install
```

⏳ استنى 3-5 دقايق.

أنشئ ملف `.env.local`:

```bash
# على Windows
copy .env.local.example .env.local

# على Linux/Mac
cp .env.local.example .env.local
```

ثم شغّل:

```bash
npm run dev
```

✅ Frontend شغّال على: **http://localhost:3200**

---

## 5️⃣ افتح المتصفح

روح على:

```
http://localhost:3200
```

سجّل دخول بـ:

- **اسم المستخدم**: `admin`
- **كلمة المرور**: `Admin@1234`

🎉 **مبروك! النظام شغّال**

---

## 🔧 استكشاف الأخطاء

### ❓ خطأ "Cannot connect to database"

تأكد من:
1. MySQL شغّال في XAMPP
2. `DATABASE_URL` في `.env` صحيح

### ❓ خطأ "Port 3100 already in use"

```bash
# أوقف العمليات على البورت
# Windows
netstat -ano | findstr :3100
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3100
kill -9 <PID>
```

### ❓ Frontend يطلع 404 على كل الصفحات

```bash
cd frontend
rm -rf .next
npm run dev
```

### ❓ مشكلة بـ Tailwind (الصفحة بدون تنسيق)

تأكد من وجود `postcss.config.js` (وليس `.mjs`).

---

## 📞 المساعدة

إذا واجهت مشكلة، افتح [Issue](https://github.com/YOUR_USERNAME/gsdms/issues) في GitHub.

---

**تطوير سعيد! 🚀**
