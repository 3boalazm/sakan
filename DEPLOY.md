# نشر Sakan (الـ J1 backend) على استضافة Node

النسخة دي بتستخدم SQLite المدمج في Node (`node:sqlite`) — من غير أي مكتبات native
ولا خطوة build. بتشتغل على أي استضافة بتشغّل Node server دائم (Railway / Render / VPS).
مش بتشتغل على Vercel serverless (ده سبب الكراش الأصلي).

## مهم جداً: التخزين
الداتا بتتخزن في ملف SQLite. لازم تحط الملف على قرص دائم (persistent disk)،
وإلا الداتا هتتمسح مع كل redeploy. بتظبط ده عن طريق متغير البيئة:

    SAKAN_DB=/data/sakan.db

## Railway (الأسهل)
1. railway.app → New Project → Deploy from GitHub repo → اختر الريبو.
2. Railway هيكتشف Node ويشغّل `npm start` تلقائياً (السكربت فيه الفلاج المطلوب).
3. Variables: ضيف  SAKAN_DB = /data/sakan.db
4. Volumes: أضف Volume و mount path = /data
5. Deploy. الرابط بيطلع من Settings → Networking → Generate Domain.

## Render
1. render.com → New → Web Service → اربط GitHub repo.
2. Runtime: Node. Build Command: (سيبه فاضي). Start Command: npm start
3. Environment: SAKAN_DB = /data/sakan.db
4. Disks: أضف Disk، Mount Path = /data، الحجم 1GB كفاية.
5. Create Web Service.

## اختبار سريع بعد النشر
استبدل URL برابطك:

    curl -X POST https://YOUR_URL/pair -H 'content-type: application/json' \
      -d '{"email":"mustafa@x","displayName":"مصطفى"}'

المفروض يرجّع pairCode و token.

## ملاحظة
ده باك-إند J1 فقط (API). الواجهة العربية (frontend) خطوة منفصلة.
للإنتاج الكامل على Vercel: النسخة دي بتتحول لـ Next.js API + Postgres (Supabase) + RLS.
