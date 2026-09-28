/* ============================================================
   Marriage Contract System - i18n (Translations)
   Arresalah Zentrum Berlin
============================================================ */

/* ============================================================
   كائن الترجمات الكامل
============================================================ */
const TRANSLATIONS = {
  ar: {
    /* الهيدر */
    brandName: 'Arresalah Zentrum',
    brandSub: 'ISLAMISCHES ZENTRUM BERLIN',

    /* الهيرو */
    bismillah: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    heroTitle: 'نظام تسجيل بيانات عقد الزواج',
    heroSub: 'منصة إلكترونية لتسجيل بيانات أطراف العقد بسهولة ودقة',

    /* شاشة التحقق */
    verifyTitle: 'التحقق من رقم العقد',
    verifySub: 'أدخل رقم العقد للبدء في تعبئة بيانات الأطراف',
    helperText: 'رقم العقد يُمنح لكم من المركز عند تسجيل العقد',
    verifyBtn: 'متابعة ←',
    helpBtn: 'كيف أحصل على رقم العقد؟',

    /* المساعدة */
    helpTitle: 'كيف أحصل على رقم العقد؟',
    helpPhone: 'اتصل بالمركز: +49 30 XXXXXXX',
    helpWhats: 'أو راسلنا عبر واتساب',
    helpEmail: 'أو راسلنا على البريد الإلكتروني',
    helpNote: 'رقم العقد مكوّن من 6 أحرف/أرقام إنجليزية، مثال: A7K9P2',
    close: 'إغلاق',

    /* شاشة اختيار الأطراف */
    progressTitle: 'اكتمال بيانات العقد',
    chooseRole: 'اختر الطرف لتعبئة بياناته',
    chooseRoleSub: 'اضغط على أي طرف لبدء التعبئة',
    allComplete: 'اكتملت بيانات جميع الأطراف',
    sendContract: 'إرسال العقد إلى المركز',

    /* الأطراف */
    groom: 'الزوج',
    bride: 'الزوجة',
    wali: 'الولي',
    witness1: 'الشاهد الأول',
    witness2: 'الشاهد الثاني',

    /* أزرار الحفظ */
    save: '💾 حفظ ومتابعة',
    saveComplete: '✅ حفظ ومتابعة',
    incomplete: 'أكمل الحقول الإلزامية',
    readyToSave: 'جاهز للحفظ - اضغط للمتابعة',

    /* الحقول الأساسية */
    nameDe: 'الاسم بالكامل بالألمانية',
    nameAr: 'الاسم بالعربي',
    birthDate: 'تاريخ الميلاد',
    day: 'يوم',
    month: 'شهر',
    year: 'سنة',
    birthCountry: 'مكان الميلاد - البلد',
    birthRegion: 'مكان الميلاد - المنطقة',
    idType: 'نوع الهوية',
    idCard: 'بطاقة هوية',
    passport: 'جواز سفر',
    idNumber: 'رقم الهوية',

    /* العنوان */
    address: 'العنوان الحالي',
    addressNumber: 'رقم الشارع',
    addressStreet: 'اسم الشارع',
    postalCode: 'الرمز البريدي',
    city: 'المدينة',

    /* الأم */
    motherData: 'بيانات الأم',
    motherNameDe: 'اسم الأم بالألمانية',
    motherNameAr: 'اسم الأم بالعربي',

    /* المهر */
    dowryTitle: 'تفاصيل المهر (Brautgabe)',
    dowryAdvance: 'المهر المقدم (€)',
    dowryDeferred: 'المهر المؤخر (€)',
    dowryNotes: 'ملاحظات حول المهر',
    dowryNotesPH: 'اكتب أي ملاحظات إضافية هنا...',

    /* خيارات خاصة */
    waliIsBride: 'الولي هي الزوجة نفسها',
    waliIsBrideText: 'الولي هي الزوجة نفسها',
    witnessIsCenter: 'الشاهد طرف مركز الرسالة',
    witnessIsCenterText: 'الشاهد طرف مركز الرسالة',

    /* الرسائل */
    invalidCode: 'رقم العقد يجب أن يكون 6 خانات بالضبط',
    invalidChars: 'رقم العقد يجب أن يحتوي على أحرف وأرقام إنجليزية فقط',
    codeNotApproved: 'رقم العقد غير معتمد. تأكد من الكود الذي أعطاك إياه المركز.',
    codeAlreadySent: 'هذا العقد تم إرساله مسبقاً',
    codeRestored: 'تم استرجاع البيانات المحفوظة',
    codeNotFound: 'الكود غير موجود',
    networkError: 'فشل الاتصال بالخادم. تحقق من الإنترنت.',
    submitSuccess: '✓ تم إرسال العقد بنجاح',
    submitFailed: 'فشل الإرسال، حاول مجدداً',
    submitting: '⏳ جارٍ الإرسال...',
    verifying: '⏳ جارٍ التحقق...',
    loading: 'جارٍ التحميل...',
    invalidNumber: 'يجب إدخال أرقام فقط',
    invalidDate: 'تاريخ غير صحيح',
    requiredField: 'هذا الحقل إلزامي',
    dataRestored: 'تم استرجاع بياناتك السابقة',
    confirmCancel: 'هل تريد إلغاء العقد والعودة؟ ستفقد البيانات المدخلة.',
  },

  de: {
    /* Header */
    brandName: 'Arresalah Zentrum',
    brandSub: 'ISLAMISCHES ZENTRUM BERLIN',

    /* Hero */
    bismillah: 'Im Namen Allahs, des Allerbarmers, des Barmherzigen',
    heroTitle: 'Eheschließungs-Registrierungssystem',
    heroSub: 'Eine elektronische Plattform zur einfachen und präzisen Registrierung',

    /* Verify Screen */
    verifyTitle: 'Vertragsnummer bestätigen',
    verifySub: 'Geben Sie die Vertragsnummer ein, um mit der Erfassung zu beginnen',
    helperText: 'Die Vertragsnummer erhalten Sie vom Zentrum bei der Registrierung',
    verifyBtn: 'Weiter →',
    helpBtn: 'Wie bekomme ich die Nummer?',

    /* Help */
    helpTitle: 'Wie bekomme ich die Vertragsnummer?',
    helpPhone: 'Rufen Sie uns an: +49 30 XXXXXXX',
    helpWhats: 'Oder via WhatsApp',
    helpEmail: 'Oder per E-Mail',
    helpNote: 'Die Nummer besteht aus 6 Zeichen, z.B. A7K9P2',
    close: 'Schließen',

    /* Role Screen */
    progressTitle: 'Vertragsfortschritt',
    chooseRole: 'Wählen Sie die Partei zur Erfassung',
    chooseRoleSub: 'Klicken Sie auf eine Partei, um zu beginnen',
    allComplete: 'Alle Parteien vollständig',
    sendContract: 'Vertrag an das Zentrum senden',

    /* Parties */
    groom: 'Ehemann',
    bride: 'Ehefrau',
    wali: 'Wali (Vormund)',
    witness1: 'Zeuge 1',
    witness2: 'Zeuge 2',

    /* Save Buttons */
    save: '💾 Speichern & Weiter',
    saveComplete: '✅ Speichern & Weiter',
    incomplete: 'Pflichtfelder ausfüllen',
    readyToSave: 'Bereit zum Speichern',

    /* Basic Fields */
    nameDe: 'Vollständiger Name auf Deutsch',
    nameAr: 'Name auf Arabisch',
    birthDate: 'Geburtsdatum',
    day: 'Tag',
    month: 'Monat',
    year: 'Jahr',
    birthCountry: 'Geburtsort - Land',
    birthRegion: 'Geburtsort - Region',
    idType: 'Ausweistyp',
    idCard: 'Personalausweis',
    passport: 'Reisepass',
    idNumber: 'Ausweisnummer',

    /* Address */
    address: 'Aktuelle Adresse',
    addressNumber: 'Hausnummer',
    addressStreet: 'Straßenname',
    postalCode: 'Postleitzahl',
    city: 'Stadt',

    /* Mother */
    motherData: 'Angaben zur Mutter',
    motherNameDe: 'Name der Mutter auf Deutsch',
    motherNameAr: 'Name der Mutter auf Arabisch',

    /* Dowry */
    dowryTitle: 'Brautgabe-Details',
    dowryAdvance: 'Vorauszahlung (€)',
    dowryDeferred: 'Aufgeschoben (€)',
    dowryNotes: 'Anmerkungen zur Brautgabe',
    dowryNotesPH: 'Zusätzliche Anmerkungen hier schreiben...',

    /* Special Options */
    waliIsBride: 'Die Braut selbst ist der Wali',
    waliIsBrideText: 'Die Braut ist ihr eigener Wali',
    witnessIsCenter: 'Zeuge vom Zentrum',
    witnessIsCenterText: 'Zeuge vom Zentrum',

    /* Messages */
    invalidCode: 'Die Nummer muss genau 6 Zeichen haben',
    invalidChars: 'Nur englische Buchstaben und Zahlen erlaubt',
    codeNotApproved: 'Nummer nicht anerkannt. Prüfen Sie den Code vom Zentrum.',
    codeAlreadySent: 'Dieser Vertrag wurde bereits gesendet',
    codeRestored: 'Gespeicherte Daten wiederhergestellt',
    codeNotFound: 'Code nicht gefunden',
    networkError: 'Verbindung fehlgeschlagen. Prüfen Sie das Internet.',
    submitSuccess: '✓ Vertrag erfolgreich gesendet',
    submitFailed: 'Senden fehlgeschlagen, bitte erneut versuchen',
    submitting: '⏳ Wird gesendet...',
    verifying: '⏳ Wird überprüft...',
    loading: 'Wird geladen...',
    invalidNumber: 'Nur Zahlen erlaubt',
    invalidDate: 'Ungültiges Datum',
    requiredField: 'Dieses Feld ist erforderlich',
    dataRestored: 'Ihre vorherigen Daten wurden wiederhergestellt',
    confirmCancel: 'Vertrag abbrechen? Eingegebene Daten gehen verloren.',
  },

  en: {
    /* Header */
    brandName: 'Arresalah Zentrum',
    brandSub: 'ISLAMIC CENTER BERLIN',

    /* Hero */
    bismillah: 'In the name of Allah, the Most Gracious, the Most Merciful',
    heroTitle: 'Marriage Contract Registration System',
    heroSub: 'An electronic platform for easy and accurate registration of contract parties',

    /* Verify Screen */
    verifyTitle: 'Verify Contract Number',
    verifySub: 'Enter the contract number to begin filling in the parties data',
    helperText: 'The contract number is given by the center upon registration',
    verifyBtn: 'Continue →',
    helpBtn: 'How do I get the number?',

    /* Help */
    helpTitle: 'How do I get the contract number?',
    helpPhone: 'Call us: +49 30 XXXXXXX',
    helpWhats: 'Or via WhatsApp',
    helpEmail: 'Or by email',
    helpNote: 'The number has 6 characters, e.g. A7K9P2',
    close: 'Close',

    /* Role Screen */
    progressTitle: 'Contract Completion',
    chooseRole: 'Choose a party to fill their data',
    chooseRoleSub: 'Click on any party to begin',
    allComplete: 'All parties completed',
    sendContract: 'Send Contract to Center',

    /* Parties */
    groom: 'Groom',
    bride: 'Bride',
    wali: 'Wali (Guardian)',
    witness1: 'Witness 1',
    witness2: 'Witness 2',

    /* Save Buttons */
    save: '💾 Save & Continue',
    saveComplete: '✅ Save & Continue',
    incomplete: 'Fill required fields',
    readyToSave: 'Ready to save - click to continue',

    /* Basic Fields */
    nameDe: 'Full Name in German',
    nameAr: 'Name in Arabic',
    birthDate: 'Date of Birth',
    day: 'Day',
    month: 'Month',
    year: 'Year',
    birthCountry: 'Place of Birth - Country',
    birthRegion: 'Place of Birth - Region',
    idType: 'ID Type',
    idCard: 'ID Card',
    passport: 'Passport',
    idNumber: 'ID Number',

    /* Address */
    address: 'Current Address',
    addressNumber: 'Street Number',
    addressStreet: 'Street Name',
    postalCode: 'Postal Code',
    city: 'City',

    /* Mother */
    motherData: "Mother's Information",
    motherNameDe: "Mother's Name in German",
    motherNameAr: "Mother's Name in Arabic",

    /* Dowry */
    dowryTitle: 'Dowry Details',
    dowryAdvance: 'Advance Dowry (€)',
    dowryDeferred: 'Deferred Dowry (€)',
    dowryNotes: 'Notes about the Dowry',
    dowryNotesPH: 'Write any additional notes here...',

    /* Special Options */
    waliIsBride: 'The bride herself is the Wali',
    waliIsBrideText: 'The bride is her own Wali',
    witnessIsCenter: 'Witness from the Center',
    witnessIsCenterText: 'Witness from the Center',

    /* Messages */
    invalidCode: 'The code must be exactly 6 characters',
    invalidChars: 'Only English letters and numbers allowed',
    codeNotApproved: 'Code not recognized. Check the code from the center.',
    codeAlreadySent: 'This contract has already been sent',
    codeRestored: 'Saved data restored',
    codeNotFound: 'Code not found',
    networkError: 'Connection failed. Check your internet.',
    submitSuccess: '✓ Contract sent successfully',
    submitFailed: 'Send failed, please try again',
    submitting: '⏳ Sending...',
    verifying: '⏳ Verifying...',
    loading: 'Loading...',
    invalidNumber: 'Numbers only',
    invalidDate: 'Invalid date',
    requiredField: 'This field is required',
    dataRestored: 'Your previous data was restored',
    confirmCancel: 'Cancel contract? Entered data will be lost.',
  }
};

/* ============================================================
   الحالة العامة
============================================================ */
let currentLang = localStorage.getItem('lang') || 'ar';

/* ============================================================
   دالة الترجمة
============================================================ */
function t(key) {
  return TRANSLATIONS[currentLang][key] || key;
}

/* ============================================================
   تغيير اللغة
============================================================ */
function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;

  currentLang = lang;
  localStorage.setItem('lang', lang);

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  /* تحديث كل العناصر التي فيها data-i18n */
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });

  /* تحديث أزرار اللغة */
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  /* إعادة رسم الأجزاء التي تحتاج إعادة بناء */
  if (typeof window.onLanguageChanged === 'function') {
    window.onLanguageChanged(lang);
  }
}

/* ============================================================
   التهيئة عند التحميل
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);
});

/* ============================================================
   تصدير للاستخدام في ملفات أخرى
============================================================ */
window.TRANSLATIONS = TRANSLATIONS;
window.t = t;
window.setLanguage = setLanguage;
window.getCurrentLang = () => currentLang;
