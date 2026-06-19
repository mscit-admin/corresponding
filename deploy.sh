#!/usr/bin/env bash
# =====================================================================
# GSDMS — سكربت النشر على السيرفر (Ubuntu + Docker)
#
#   الاستخدام (من جذر المشروع على السيرفر):
#       ./deploy.sh                 # ينشر الفرع الافتراضي
#       ./deploy.sh main            # ينشر فرعاً محدّداً
#       DEPLOY_BRANCH=xxx ./deploy.sh
#
# ماذا يفعل: يجلب أحدث كود، يبني الحاويات ويشغّلها. تطبيق مخطّط قاعدة
# البيانات (prisma db push) والـseed يتمّان تلقائياً داخل حاوية backend.
# لا يحذف أي بيانات (لا يستخدم down -v).
# =====================================================================
set -euo pipefail

# ----- إعدادات قابلة للتعديل -----
BRANCH="${1:-${DEPLOY_BRANCH:-claude/tender-darwin-vozfdx}}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
APP_PORT="${APP_PORT:-8096}"

# الانتقال إلى مجلّد السكربت (جذر المشروع)
cd "$(dirname "$0")"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$1"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ----- 1) فحوصات أولية -----
say "فحص المتطلّبات"
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  die "Docker Compose غير مثبّت. ثبّت Docker Engine + plugin compose أولاً."
fi
docker info >/dev/null 2>&1 || die "تعذّر الاتصال بـDocker. شغّل السكربت بـsudo أو أضف مستخدمك لمجموعة docker."
[ -f "$COMPOSE_FILE" ] || die "$COMPOSE_FILE غير موجود — شغّل السكربت من جذر المشروع."
command -v git >/dev/null 2>&1 || die "git غير مثبّت."
ok "Docker و Compose و git جاهزة ($DC)"

# ----- 2) سلامة شجرة العمل -----
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  warn "توجد تعديلات غير محفوظة على ملفات متتبَّعة. للأسرار استخدم ملف .env بدل تعديل ملفات Git."
  die  "أوقف النشر: نفّذ 'git stash' أو 'git commit' ثم أعد المحاولة (تفادياً لتعارض الدمج)."
fi

# ----- 3) جلب أحدث كود -----
say "جلب أحدث كود من الفرع: $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
ok "الكود مُحدَّث ($(git rev-parse --short HEAD))"

# ----- 4) تنبيه إعدادات البريد -----
if [ ! -f .env ] || ! grep -q '^SMTP_HOST=.\+' .env 2>/dev/null; then
  warn "SMTP غير مضبوط في .env — رموز التحقّق ستُسجَّل في سجلّ الخادم ولن تُرسَل بريداً فعلياً."
  warn "أنشئ .env بجوار $COMPOSE_FILE وضع فيه: SMTP_HOST / SMTP_USER / SMTP_PASS / SMTP_FROM"
fi

# ----- 5) البناء والتشغيل -----
say "بناء الحاويات وتشغيلها (قد يستغرق عدّة دقائق في أوّل مرّة)"
$DC -f "$COMPOSE_FILE" up -d --build
ok "أُطلقت الحاويات"

# ----- 6) فحص الجاهزية -----
say "انتظار إقلاع الـbackend وتطبيق مخطّط قاعدة البيانات تلقائياً"
fetch() { if command -v curl >/dev/null 2>&1; then curl -fsS "$1" >/dev/null 2>&1; \
          elif command -v wget >/dev/null 2>&1; then wget -qO- "$1" >/dev/null 2>&1; \
          else return 2; fi; }
ready=0
for _ in $(seq 1 60); do
  if fetch "http://localhost:${APP_PORT}/api/docs"; then ready=1; break; fi
  rc=$?; [ "$rc" = 2 ] && { warn "curl/wget غير متوفّر — تخطّي فحص الجاهزية"; break; }
  sleep 3
done
if [ "$ready" = 1 ]; then
  ok "النظام يعمل على المنفذ ${APP_PORT}"
else
  warn "لم يستجب النظام بعد. راجع السجلّات:"
  $DC -f "$COMPOSE_FILE" logs --tail=40 backend || true
fi

# ----- 7) حالة الحاويات + تذكير الإعدادات -----
say "حالة الحاويات"
$DC -f "$COMPOSE_FILE" ps

cat <<'NOTE'

──────────────────────────────────────────────────────────────
تمّ النشر. خطوات إلزامية بعد أوّل تشغيل:

  1) ادخل كـ admin → «الوصول والشبكة» واضبط نطاقات شبكة المؤسسة (CIDR)
     وإلا تُعدّ كل الأجهزة خارجية ويُحجب غير المدراء بانتظار الموافقة.

  2) للبريد (رمز اعتماد المعاملات والدخول الخارجي): اضبط SMTP في .env
     أو غيّر طريقة الاعتماد إلى «بصمة الوجه» من نفس الشاشة.

  3) غيّر JWT_SECRET و ADMIN_PASSWORD قبل التشغيل الحقيقي.

أوامر مفيدة:
  docker compose -f docker-compose.prod.yml logs -f backend
  docker compose -f docker-compose.prod.yml ps
──────────────────────────────────────────────────────────────
NOTE
