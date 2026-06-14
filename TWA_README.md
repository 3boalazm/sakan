# سكن — TWA (Trusted Web Activity)

## ما هو TWA؟
APK حقيقي يتثبّت على الأندرويد عادي زي أي تطبيق —
بدون Google Play، بدون Android Studio، بدون متصفح.

## المتطلبات (مرة واحدة بس)

### 1. Node.js 18+
https://nodejs.org

### 2. Java 17
https://adoptium.net  ← اختر "Temurin 17 LTS"

---

## الخطوة الأولى: إنشاء Keystore (مرة واحدة بس)

```bash
keytool -genkey -v \
  -keystore sakan.keystore \
  -alias sakan \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -dname "CN=Mustafa, O=Sakan, C=SA"
```

احفظ الباسوورد اللي هتدخله — محتاجه في الخطوة التانية.

---

## الخطوة التانية: بناء APK

```bash
# ثبّت Bubblewrap
npm install -g @bubblewrap/cli

# أنشئ المشروع (بيجيب manifest من الموقع تلقائياً)
bubblewrap init --manifest=https://sakan-md.vercel.app/manifest.json

# ابنِ الـ APK
bubblewrap build
```

بيسألك على:
- **Keystore path**: `./sakan.keystore`
- **Keystore password**: الباسوورد اللي اخترته
- **Key alias**: `sakan`
- **Key password**: نفس الباسوورد

---

## الخطوة التالتة: ثبّت على الموبايل

انقل ملف `app-release-signed.apk` للموبايل وافتحه — بيتثبّت مباشرةً.

أو عن طريق USB:
```bash
adb install app-release-signed.apk
```

---

## ملاحظة مهمة: Digital Asset Links

عشان التطبيق ميفتحش في متصفح، لازم تضيف fingerprint الـ keystore على السيرفر.

بعد ما تعمل الـ keystore، شغّل:
```bash
keytool -list -v -keystore sakan.keystore -alias sakan
```

خد الـ SHA-256 fingerprint وأضفه في `assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "app.sakan.md",
    "sha256_cert_fingerprints": [
      "XX:XX:XX:... (fingerprint هنا)"
    ]
  }
}]
```

بعدين ارفع الملف دا على:
`https://sakan-md.vercel.app/.well-known/assetlinks.json`

---

## نتيجة

- ✅ تطبيق يظهر في قائمة التطبيقات باللوجو
- ✅ بيفتح بدون شريط المتصفح
- ✅ Splash Screen خضراء
- ✅ بيتحدّث تلقائياً مع كل تحديث للموقع
- ✅ نفس الـ token ونفس الـ session

