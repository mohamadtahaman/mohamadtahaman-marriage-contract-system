/* ============================================================
   Marriage Contract System V2 - i18n
   Arresalah Zentrum Berlin
============================================================ */

const TRANSLATIONS = {
  ar: {
    brandName: 'Arresalah Zentrum',
    brandSub: 'Islamisches Zentrum Berlin',
    bismillah: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    heroTitle: 'نظام تسجيل بيانات عقد الزواج',
    heroSub: 'منصة إلكترونية لتسجيل بيانات أطراف العقد بسهولة ودقة',

    verifyTitle: 'التحقق من رقم العقد',
    verifySub: 'أدخل رقم العقد للبدء في تعبئة بيانات الأطراف',
    helperText: 'رقم العقد يُمنح لكم من المركز عند تسجيل العقد',
    verifyBtn: 'متابعة',
    helpBtn: 'كيف أحصل على رقم العقد؟',

    helpTitle: 'كيف أحصل على رقم العقد؟',
    helpPhone: 'اتصل بالمركز: +49 30 XXXXXXX',
    helpWhats: 'أو راسلنا عبر واتساب',
    helpEmail: 'أو راسلنا على البريد الإلكتروني',
    helpNote: 'رقم العقد مكوّن من 6 أحرف/أرقام إنجليزية، مثال: A7K9P2',
    close: 'إغلاق',

    progressTitle: 'اكتمال بيانات العقد',
    chooseRole: 'اختر الطرف لتعبئة بياناته',
    chooseRoleSub: 'اضغط على أي طرف لبدء التعبئة',
    allComplete: 'اكتملت بيانات جميع الأطراف',
    sendContract: 'إرسال العقد إلى المركز',

    adminAccess: 'دخول الإدارة',

    groom: 'الزوج',
    bride: 'الزوجة',
    wali: 'الولي',
    witness1: 'الشاهد الأول',
    witness2: 'الشاهد الثاني',

    save: 'حفظ ومتابعة',
    saveComplete: 'حفظ ومتابعة',
    incomplete: 'أكمل الحقول الإلزامية',
    readyToSave: 'جاهز للحفظ - اضغط للمتابعة',

    nameDe: 'الاسم بالكامل بالألمانية',
    nameAr: 'الاسم بالعربي',
    birthDate: 'تاريخ الميلاد',
    birthCountry: 'مكان الميلاد - البلد',
    birthRegion: 'مكان الميلاد - المنطقة',
    idType: 'نوع الهوية',
    idCard: 'بطاقة هوية',
    passport: 'جواز سفر',
    idNumber: 'رقم الهوية',

    address: 'العنوان الحالي',
    addressNumber: 'رقم الشارع',
    addressStreet: 'اسم الشارع',
    postalCode: 'الرمز البريدي',
    city: 'المدينة',

    motherData: 'بيانات الأم',
    motherNameDe: 'اسم الأم بالألمانية',
    motherNameAr: 'اسم الأم بالعربي',

    dowryTitle: 'تفاصيل المهر (Brautgabe)',
    dowryAdvance: 'المهر المقدم (€)',
    dowryDeferred: 'المهر المؤخر (€)',
    dowryNotes: 'ملاحظات حول المهر',
    dowryNotesPH: 'اكتب أي ملاحظات إضافية هنا...',

    waliIsBride: 'الولي هي الزوجة نفسها',
    waliIsBrideText: 'الولي هي الزوجة نفسها',
    witnessIsCenter: 'الشاهد طرف مركز الرسالة',
    witnessIsCenterText: 'الشاهد طرف مركز الرسالة',

    contractDateTitle: 'تاريخ العقد',
    selectDay: 'اليوم',
    selectMonth: 'الشهر',
    selectYear: 'السنة',
    monthName_1: 'يناير',
    monthName_2: 'فبراير',
    monthName_3: 'مارس',
    monthName_4: 'أبريل',
    monthName_5: 'مايو',
    monthName_6: 'يونيو',
    monthName_7: 'يوليو',
    monthName_8: 'أغسطس',
    monthName_9: 'سبتمبر',
    monthName_10: 'أكتوبر',
    monthName_11: 'نوفمبر',
    monthName_12: 'ديسمبر',

    invalidCode: 'رقم العقد يجب أن يكون 6 خانات بالضبط',
    invalidChars: 'رقم العقد يجب أن يحتوي على أحرف وأرقام إنجليزية فقط',
    codeNotApproved: 'رقم العقد غير معتمد. تأكد من الكود الذي أعطاك إياه المركز.',
    codeAlreadySent: 'هذا العقد تم إرساله مسبقاً',
    codeRestored: 'تم استرجاع البيانات المحفوظة',
    networkError: 'فشل الاتصال بالخادم. تحقق من الإنترنت.',
    submitSuccess: 'تم إرسال العقد بنجاح',
    submitFailed: 'فشل الإرسال، حاول مجدداً',
    submitting: 'جارٍ الإرسال...',
    verifying: 'جارٍ التحقق...',
    invalidBirthDate: 'تاريخ الميلاد غير صحيح',
    invalidContractDate: 'تاريخ العقد غير صحيح',
    invalidGerman: 'هذا الحقل يقبل الأحرف الألمانية فقط',
    invalidArabic: 'هذا الحقل يقبل الأحرف العربية فقط',
    requiredField: 'هذا الحقل إلزامي',
    newContract: 'تسجيل عقد جديد',
  },

  de: {
    brandName: 'Arresalah Zentrum',
    brandSub: 'Islamisches Zentrum Berlin',
    bismillah: 'Im Namen Allahs, des Allerbarmers, des Barmherzigen',
    heroTitle: 'Eheschließungs-Registrierungssystem',
    heroSub: 'Eine elektronische Plattform zur einfachen und präzisen Registrierung',

    verifyTitle: 'Vertragsnummer bestätigen',
    verifySub: 'Geben Sie die Vertragsnummer ein, um mit der Erfassung zu beginnen',
    helperText: 'Die Vertragsnummer erhalten Sie vom Zentrum bei der Registrierung',
    verifyBtn: 'Weiter',
    helpBtn: 'Wie bekomme ich die Nummer?',

    helpTitle: 'Wie bekomme ich die Vertragsnummer?',
    helpPhone: 'Rufen Sie uns an: +49 30 XXXXXXX',
    helpWhats: 'Oder via WhatsApp',
    helpEmail: 'Oder per E-Mail',
    helpNote: 'Die Nummer besteht aus 6 Zeichen, z.B. A7K9P2',
    close: 'Schließen',

    progressTitle: 'Vertragsfortschritt',
    chooseRole: 'Wählen Sie die Partei zur Erfassung',
    chooseRoleSub: 'Klicken Sie auf eine Partei, um zu beginnen',
    allComplete: 'Alle Parteien vollständig',
    sendContract: 'Vertrag an das Zentrum senden',

    adminAccess: 'Admin-Zugang',

    groom: 'Ehemann',
    bride: 'Ehefrau',
    wali: 'Wali (Vormund)',
    witness1: 'Zeuge 1',
    witness2: 'Zeuge 2',

    save: 'Speichern & Weiter',
    saveComplete: 'Speichern & Weiter',
    incomplete: 'Pflichtfelder ausfüllen',
    readyToSave: 'Bereit zum Speichern',

    nameDe: 'Vollständiger Name auf Deutsch',
    nameAr: 'Name auf Arabisch',
    birthDate: 'Geburtsdatum',
    birthCountry: 'Geburtsort - Land',
    birthRegion: 'Geburtsort - Region',
    idType: 'Ausweistyp',
    idCard: 'Personalausweis',
    passport: 'Reisepass',
    idNumber: 'Ausweisnummer',

    address: 'Aktuelle Adresse',
    addressNumber: 'Hausnummer',
    addressStreet: 'Straßenname',
    postalCode: 'Postleitzahl',
    city: 'Stadt',

    motherData: 'Angaben zur Mutter',
    motherNameDe: 'Name der Mutter auf Deutsch',
    motherNameAr: 'Name der Mutter auf Arabisch',

    dowryTitle: 'Brautgabe-Details',
    dowryAdvance: 'Vorauszahlung (€)',
    dowryDeferred: 'Aufgeschoben (€)',
    dowryNotes: 'Anmerkungen zur Brautgabe',
    dowryNotesPH: 'Zusätzliche Anmerkungen hier schreiben...',

    waliIsBride: 'Die Braut selbst ist der Wali',
    waliIsBrideText: 'Die Braut ist ihr eigener Wali',
    witnessIsCenter: 'Zeuge vom Zentrum',
    witnessIsCenterText: 'Zeuge vom Zentrum',

    contractDateTitle: 'Datum des Ehevertrags',
    selectDay: 'Tag',
    selectMonth: 'Monat',
    selectYear: 'Jahr',
    monthName_1: 'Januar',
    monthName_2: 'Februar',
    monthName_3: 'März',
    monthName_4: 'April',
    monthName_5: 'Mai',
    monthName_6: 'Juni',
    monthName_7: 'Juli',
    monthName_8: 'August',
    monthName_9: 'September',
    monthName_10: 'Oktober',
    monthName_11: 'November',
    monthName_12: 'Dezember',

    invalidCode: 'Die Nummer muss genau 6 Zeichen haben',
    invalidChars: 'Nur englische Buchstaben und Zahlen erlaubt',
    codeNotApproved: 'Nummer nicht anerkannt. Prüfen Sie den Code vom Zentrum.',
    codeAlreadySent: 'Dieser Vertrag wurde bereits gesendet',
    codeRestored: 'Gespeicherte Daten wiederhergestellt',
    networkError: 'Verbindung fehlgeschlagen. Prüfen Sie das Internet.',
    submitSuccess: 'Vertrag erfolgreich gesendet',
    submitFailed: 'Senden fehlgeschlagen, bitte erneut versuchen',
    submitting: 'Wird gesendet...',
    verifying: 'Wird überprüft...',
    invalidBirthDate: 'Ungültiges Geburtsdatum',
    invalidContractDate: 'Ungültiges Vertragsdatum',
    invalidGerman: 'Nur deutsche Buchstaben erlaubt',
    invalidArabic: 'Nur arabische Buchstaben erlaubt',
    requiredField: 'Dieses Feld ist erforderlich',
    newContract: 'Neuen Vertrag erstellen',
  },

  en: {
    brandName: 'Arresalah Zentrum',
    brandSub: 'Islamic Center Berlin',
    bismillah: 'In the name of Allah, the Most Gracious, the Most Merciful',
    heroTitle: 'Marriage Contract Registration System',
    heroSub: 'An electronic platform for easy and accurate registration of contract parties',

    verifyTitle: 'Verify Contract Number',
    verifySub: 'Enter the contract number to begin filling in the parties data',
    helperText: 'The contract number is given by the center upon registration',
    verifyBtn: 'Continue',
    helpBtn: 'How do I get the number?',

    helpTitle: 'How do I get the contract number?',
    helpPhone: 'Call us: +49 30 XXXXXXX',
    helpWhats: 'Or via WhatsApp',
    helpEmail: 'Or by email',
    helpNote: 'The number has 6 characters, e.g. A7K9P2',
    close: 'Close',

    progressTitle: 'Contract Completion',
    chooseRole: 'Choose a party to fill their data',
    chooseRoleSub: 'Click on any party to begin',
    allComplete: 'All parties completed',
    sendContract: 'Send Contract to Center',

    adminAccess: 'Admin Access',

    groom: 'Groom',
    bride: 'Bride',
    wali: 'Wali (Guardian)',
    witness1: 'Witness 1',
    witness2: 'Witness 2',

    save: 'Save & Continue',
    saveComplete: 'Save & Continue',
    incomplete: 'Fill required fields',
    readyToSave: 'Ready to save - click to continue',

    nameDe: 'Full Name in German',
    nameAr: 'Name in Arabic',
    birthDate: 'Date of Birth',
    birthCountry: 'Place of Birth - Country',
    birthRegion: 'Place of Birth - Region',
    idType: 'ID Type',
    idCard: 'ID Card',
    passport: 'Passport',
    idNumber: 'ID Number',

    address: 'Current Address',
    addressNumber: 'Street Number',
    addressStreet: 'Street Name',
    postalCode: 'Postal Code',
    city: 'City',

    motherData: "Mother's Information",
    motherNameDe: "Mother's Name in German",
    motherNameAr: "Mother's Name in Arabic",

    dowryTitle: 'Dowry Details',
    dowryAdvance: 'Advance Dowry (€)',
    dowryDeferred: 'Deferred Dowry (€)',
    dowryNotes: 'Notes about the Dowry',
    dowryNotesPH: 'Write any additional notes here...',

    waliIsBride: 'The bride herself is the Wali',
    waliIsBrideText: 'The bride is her own Wali',
    witnessIsCenter: 'Witness from the Center',
    witnessIsCenterText: 'Witness from the Center',

    contractDateTitle: 'Contract Date',
    selectDay: 'Day',
    selectMonth: 'Month',
    selectYear: 'Year',
    monthName_1: 'January',
    monthName_2: 'February',
    monthName_3: 'March',
    monthName_4: 'April',
    monthName_5: 'May',
    monthName_6: 'June',
    monthName_7: 'July',
    monthName_8: 'August',
    monthName_9: 'September',
    monthName_10: 'October',
    monthName_11: 'November',
    monthName_12: 'December',

    invalidCode: 'The code must be exactly 6 characters',
    invalidChars: 'Only English letters and numbers allowed',
    codeNotApproved: 'Code not recognized. Check the code from the center.',
    codeAlreadySent: 'This contract has already been sent',
    codeRestored: 'Saved data restored',
    networkError: 'Connection failed. Check your internet.',
    submitSuccess: 'Contract sent successfully',
    submitFailed: 'Send failed, please try again',
    submitting: 'Sending...',
    verifying: 'Verifying...',
    invalidBirthDate: 'Invalid birth date',
    invalidContractDate: 'Invalid contract date',
    invalidGerman: 'Only German characters allowed',
    invalidArabic: 'Only Arabic characters allowed',
    requiredField: 'This field is required',
    newContract: 'Create New Contract',
  }
};

let currentLang = localStorage.getItem('lang') || 'ar';

function t(key) {
  return TRANSLATIONS[currentLang][key] || key;
}

function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;

  currentLang = lang;
  localStorage.setItem('lang', lang);

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  if (typeof window.onLanguageChanged === 'function') {
    window.onLanguageChanged(lang);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);
});

window.TRANSLATIONS = TRANSLATIONS;
window.t = t;
window.setLanguage = setLanguage;
window.getCurrentLang = () => currentLang;
