# سكن — فيز ١ (موقع متعدّد الصفحات)

صفحات منفصلة حقيقية (روابط، مش تابات)، بهوية «زاد» + جلو وأنيميشن:
home.html · library.html · resource.html?id= · dialogue.html · decisions.html · settings.html
ملفات مشتركة: sakan.css (الثيم + الإيفكتس) · app.js (المتجر + التنقّل + الشاشات).

## التشغيل
البيانات بتتخزّن في localStorage (بديل تجريبي عن Firestore). عشان تتشارك بين
الصفحات بثبات، شغّلها من خادم (مش بفتح الملف مباشرة):
  cd sakan-pages && python3 -m http.server 8080
وافتح http://localhost:8080/home.html

## الربط بالإنتاج (Next.js/Firebase أو SPA الموحّد)
- كل صفحة .html هنا = route مقابل (app/home/page.js …) لو هاجرت Next.js.
- state.* في app.js → Firestore collections تحت couples/{coupleId}/...
- canReveal → يُفرض في firestore.rules (موجود في الريبو) لا في الواجهة.
- مبدّل «مصطفى/ضحى» → auth.currentUser.
