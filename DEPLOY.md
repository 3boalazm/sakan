# نشر Sakan — كود واحد لـ Vercel و Railway، وقاعدة البيانات Firebase

نفس الكود ده بيشتغل على الاتنين:
- على Vercel كـ serverless function (الملف api/[...path].js).
- على Railway كسيرفر عادي (الملف server.js عن طريق npm start).
قاعدة البيانات Firebase (Firestore) — بتشتغل من أي مكان، فمفيش مشكلة تخزين زي قبل.

## 1) جهّز Firebase (مرة واحدة)
1. Firebase Console ← مشروعك (أو أنشئ مشروع جديد).
2. Build ← Firestore Database ← Create database ← اختر "Native mode".
3. Project Settings ← Service accounts ← Generate new private key ← هينزّل ملف JSON.
4. (أمان) Firestore ← Rules ← خليها ترفض أي وصول من المتصفح، لأننا بنستخدم Admin SDK من السيرفر:
       rules_version = '2';
       service cloud.firestore {
         match /databases/{db}/documents { match /{document=**} { allow read, write: if false; } }
       }

## 2) متغيّر البيئة (نفسه على Vercel و Railway)
- الاسم: FIREBASE_SERVICE_ACCOUNT
- القيمة: محتوى ملف الـ JSON كله (تقدر تلزقه زي ما هو في سطر واحد).
- لو الـ JSON اتلخبط بسبب الأسطر، اعمله Base64 وألزق الناتج (الكود بيفهم الاتنين):
       # على لينكس/ماك:
       base64 -w0 service-account.json

## 3-أ) نشر على Vercel
1. Import repo 3boalazm/sakan. سيب Root Directory = ./
2. Environment Variables ← ضيف FIREBASE_SERVICE_ACCOUNT.
3. Deploy.
4. المسارات تحت /api ، مثال:
       curl -X POST https://YOUR-APP.vercel.app/api/pair -H 'content-type: application/json' -d '{"email":"m@x","displayName":"مصطفى"}'

## 3-ب) نشر على Railway
1. New Project ← Deploy from GitHub repo ← اختر الريبو. (بيشغّل npm start تلقائياً.)
2. Variables ← ضيف FIREBASE_SERVICE_ACCOUNT.
3. مش محتاج Volume (الداتا في Firebase). Generate Domain من Settings.
4. المسارات تشتغل بـ /api/... أو من غير /api ، مثال:
       curl -X POST https://YOUR-APP.up.railway.app/pair -H 'content-type: application/json' -d '{"email":"m@x","displayName":"مصطفى"}'

## ملاحظات مهمة
- الرد المتوقع من /pair فيه pairCode و token. استخدم الـ token في باقي الطلبات: -H 'authorization: Bearer <token>'.
- ده باك-إند فقط (API). الواجهة العربية خطوة لاحقة.
- المنطق والـ state machine متجرّبين بالكامل محلياً (23/23). الجزء الوحيد اللي مش متجرّب عندي هو ربط Firebase الحقيقي (محتاج مفاتيحك) — لو طلع خطأ بعد النشر، 99% بيكون في متغيّر FIREBASE_SERVICE_ACCOUNT أو إن Firestore مش متفعّل. ابعتلي رسالة الخطأ من Logs وأظبّطها.
- ملف test/ وfakeFirestore.js للاختبار المحلي فقط ومالهومش أي تأثير على الإنتاج.
