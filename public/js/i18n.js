const TRANSLATIONS = {
  ar: {
    selectLanguage: 'اختر اللغة / Select Language:',
    brandName: 'مركز الرسالة ببرلين',
    brandSub: 'ISLAMISCHES ZENTRUM BERLIN',
    bismillah: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    heroTitle: 'نظام تسجيل بيانات عقود الزواج',
    heroSub: 'منصة إلكترونية آمنة ومخصصة لتسجيل بيانات أطراف العقد',
    verifyTitle: 'التحقق من كود العقد',
    verifySub: 'يرجى إدخال كود العقد المكون من 6 أرقام للبدء',
    contractCodeLabel: 'كود العقد (6 أرقام):',
    verifyBtn: 'تحقق والبدء',
    roleTitle: 'تحديد الصفة',
    roleSub: 'اختر الطرف الذي تقوم بتعبئة البيانات له',
    roleHusband: '👤 بيانات الزوج',
    roleWife: '👤 بيانات الزوجة',
    roleGuardian: '👤 بيانات الولي',
    roleWitness1: '👤 الشاهد الأول',
    roleWitness2: '👤 الشاهد الثاني',
    backBtn: '← العودة لتحديد الصفة',
    fullName: 'الاسم الكامل (حسب الوثيقة الرسمية):',
    idNumber: 'رقم الهوية / الجواز:',
    phone: 'رقم الهاتف:',
    address: 'العنوان الحالي:',
    saveBtn: 'حفظ وإرسال البيانات',
    adminLink: 'لوحة الإدارة',
    codeError: 'يرجى إدخال كود عقد صحيح مكون من 6 أرقام',
    successSubmit: 'تم حفظ البيانات بنجاح'
  },
  de: {
    selectLanguage: 'Sprache wählen / Select Language:',
    brandName: 'Arresalah Zentrum Berlin',
    brandSub: 'ISLAMISCHES ZENTRUM BERLIN',
    bismillah: 'Im Namen des allmächtigen Gottes',
    heroTitle: 'Eheschließung Datenregistrierung',
    heroSub: 'Sichere Plattform zur Erfassung von Vertragsparteien',
    verifyTitle: 'Vertragscode überprüfen',
    verifySub: 'Bitte geben Sie den 6-stelligen Vertragscode ein',
    contractCodeLabel: 'Vertragscode (6 Ziffern):',
    verifyBtn: 'Überprüfen und Starten',
    roleTitle: 'Rolle auswählen',
    roleSub: 'Wählen Sie die Partei aus, für die Sie Daten eingeben',
    roleHusband: '👤 Daten des Ehemanns',
    roleWife: '👤 Daten der Ehefrau',
    roleGuardian: '👤 Daten des Vormunds (Wali)',
    roleWitness1: '👤 Erster Zeuge',
    roleWitness2: '👤 Zweiter Zeuge',
    backBtn: '← Zurück zur Rollenauswahl',
    fullName: 'Vollständiger Name (laut Ausweis):',
    idNumber: 'Ausweis- / Passnummer:',
    phone: 'Telefonnummer:',
    address: 'Aktuelle Adresse:',
    saveBtn: 'Daten speichern und senden',
    adminLink: 'Admin-Bereich',
    codeError: 'Bitte geben Sie einen gültigen 6-stelligen Code ein',
    successSubmit: 'Daten erfolgreich gespeichert'
  },
  en: {
    selectLanguage: 'Select Language / اختر اللغة:',
    brandName: 'Arresalah Zentrum Berlin',
    brandSub: 'ISLAMISCHES ZENTRUM BERLIN',
    bismillah: 'In the name of Allah, the Beneficent, the Merciful',
    heroTitle: 'Marriage Contract Data Entry',
    heroSub: 'Secure platform for recording marriage contract details',
    verifyTitle: 'Verify Contract Code',
    verifySub: 'Please enter the 6-digit contract code to proceed',
    contractCodeLabel: 'Contract Code (6 digits):',
    verifyBtn: 'Verify & Proceed',
    roleTitle: 'Select Role',
    roleSub: 'Select the party you are entering data for',
    roleHusband: '👤 Husband Details',
    roleWife: '👤 Wife Details',
    roleGuardian: '👤 Guardian (Wali) Details',
    roleWitness1: '👤 First Witness',
    roleWitness2: '👤 Second Witness',
    backBtn: '← Back to Role Selection',
    fullName: 'Full Name (as per Official ID):',
    idNumber: 'ID / Passport Number:',
    phone: 'Phone Number:',
    address: 'Current Address:',
    saveBtn: 'Save & Submit Data',
    adminLink: 'Admin Panel',
    codeError: 'Please enter a valid 6-digit contract code',
    successSubmit: 'Data saved successfully'
  }
};

let currentLang = localStorage.getItem('lang') || 'ar';

function t(key) {
  return TRANSLATIONS[currentLang]?.[key] || key;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (TRANSLATIONS[lang][key]) {
      el.textContent = TRANSLATIONS[lang][key];
    }
  });

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${lang}'`));
  });
}

document.addEventListener('DOMContentLoaded', () => setLanguage(currentLang));


