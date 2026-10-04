/* ============================================================
   Print Contract - JS
   يجلب بيانات العقد ويعرضها في الشهادة
============================================================ */

const printState = {
  code: null,
  contract: null,
  logoPath: './images/logo.webp',
};

/* ============================================================
   Helpers
============================================================ */
function $(id) { return document.getElementById(id); }

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pad2(n) {
  if (n === undefined || n === null || n === '') return '';
  return String(n).padStart(2, '0');
}

function showError(title, msg) {
  $('loadingScreen').classList.add('hidden');
  $('toolbar').classList.add('hidden');
  $('certificateWrap').classList.add('hidden');
  $('errorScreen').classList.remove('hidden');
  $('errorTitle').textContent = title;
  $('errorMessage').textContent = msg;
}

function birthDate(p) {
  if (!p) return '—';
  if (!p.birthDay || !p.birthMonth || !p.birthYear) return '—';
  return `${pad2(p.birthDay)}.${pad2(p.birthMonth)}.${p.birthYear}`;
}

function idTypeLabel(type) {
  return type === 'passport' ? 'Passport / جواز سفر' : 'Personalausweis / هوية';
}

function fullAddress(p) {
  if (!p) return '—';
  const parts = [
    p.addressStreet,
    p.addressNumber
  ].filter(Boolean).join(' ');

  const city = [p.postalCode, p.city].filter(Boolean).join(' ');

  return [parts, city].filter(Boolean).join(', ') || '—';
}

/* ============================================================
   API Call - عام (بدون تسجيل دخول)
============================================================ */
async function fetchContract(code) {
  const response = await fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('استجابة غير صالحة من الخادم');
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'فشل جلب البيانات');
  }

  return data.contract;
}

/* ============================================================
   Build Certificate HTML
============================================================ */
function buildCertificate(contract) {
  const g = contract.parties.groom || {};
  const b = contract.parties.bride || {};
  const w = contract.parties.wali || {};
  const w1 = contract.parties.witness1 || {};
  const w2 = contract.parties.witness2 || {};

  const waliIsBride = !!w.waliIsBride;
  const w1IsCenter = !!w1.witnessIsCenter;
  const w2IsCenter = !!w2.witnessIsCenter;

  const contractDate = contract.contractDate || '—';

  return `
    <!-- Header -->
    <div class="cert-header">
      <div class="cert-logo ar">
        <img src="${printState.logoPath}" alt="Arresalah" onerror="this.style.display='none'">
      </div>

      <div class="cert-header-title-de">
        Islamische Eheschließungsurkunde
      </div>
      <div class="cert-header-title-ar">
        شهادة عقد زواج إسلامي
      </div>

      <div class="cert-logo de">
        <img src="${printState.logoPath}" alt="Arresalah" onerror="this.style.display='none'">
      </div>
    </div>

    <!-- Top Info Row -->
    <div class="cert-top-row">
      <div class="cell">
        <div class="cell-label">Datum der Eheschließung</div>
        <div class="cell-label-ar">تاريخ عقد الزواج</div>
        <div class="cell-value-ar">${escapeHtml(contractDate)}</div>
      </div>
      <div class="cell">
        <div class="cell-label">Ort</div>
        <div class="cell-label-ar">مكان</div>
        <div class="cell-value">Arresalah e.V.</div>
      </div>
      <div class="cell">
        <div class="cell-label">Turnstraße 83, 10551 Berlin</div>
        <div class="cell-label-ar">عنوان المركز</div>
      </div>
    </div>

    <!-- Groom & Bride -->
    <div class="cert-two-cols">
      <!-- Groom -->
      <div class="cert-col">
        <div class="cert-col-title">
          <span>Ehemann:</span>
          <span class="ar">الزوج</span>
        </div>
        <div class="cert-field">
          <span class="key">Name:</span>
          <span class="val">${escapeHtml(g.nameDe || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key-ar">الاسم:</span>
          <span class="val">${escapeHtml(g.nameAr || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Geburtsdatum, Ort:</span>
          <span class="val">${birthDate(g)} — ${escapeHtml(g.birthRegion || '')}, ${escapeHtml(g.birthCountry || '')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Seine Mutter:</span>
          <span class="val">${escapeHtml(g.motherNameDe || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Personalausweis:</span>
          <span class="val">${escapeHtml(g.idNumber || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Anschrift:</span>
          <span class="val">${escapeHtml(fullAddress(g))}</span>
        </div>
      </div>

      <!-- Bride -->
      <div class="cert-col">
        <div class="cert-col-title">
          <span>Ehefrau:</span>
          <span class="ar">الزوجة</span>
        </div>
        <div class="cert-field">
          <span class="key">Name:</span>
          <span class="val">${escapeHtml(b.nameDe || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key-ar">الاسم:</span>
          <span class="val">${escapeHtml(b.nameAr || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Geburtsdatum, Ort:</span>
          <span class="val">${birthDate(b)} — ${escapeHtml(b.birthRegion || '')}, ${escapeHtml(b.birthCountry || '')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Ihre Mutter:</span>
          <span class="val">${escapeHtml(b.motherNameDe || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Personalausweis:</span>
          <span class="val">${escapeHtml(b.idNumber || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Anschrift:</span>
          <span class="val">${escapeHtml(fullAddress(b))}</span>
        </div>
      </div>
    </div>

    <!-- Wali + Dowry -->
    <div class="cert-wali-row">
      <div class="cert-wali-cell">
        <div class="k">Vertreter der Braut (Wali):</div>
        <div class="k-ar">ولي الزوجة</div>
        <div class="v">${waliIsBride ? 'Ihr Vater / أبوها' : escapeHtml(w.nameDe || '—')}</div>
      </div>
      <div class="cert-wali-cell">
        <div class="k">Name Der Wali:</div>
        <div class="k-ar">اسم الولي</div>
        <div class="v">${waliIsBride ? 'الزوجة نفسها' : escapeHtml(w.nameDe || '—')}</div>
      </div>
      <div class="cert-wali-cell">
        <div class="k">Geburtsdatum, Ort:</div>
        <div class="k-ar">تاريخ ومكان الميلاد</div>
        <div class="v">${waliIsBride ? '—' : birthDate(w)}</div>
        <div class="v">${waliIsBride ? '—' : escapeHtml(w.birthCountry || '—')}</div>
      </div>
      <div class="cert-wali-cell">
        <div class="k">Brautgabe:</div>
        <div class="k-ar">المهر</div>
        <div class="v v-gold">${escapeHtml(g.dowryAdvance || '0')} €</div>
      </div>
    </div>

    <!-- Witnesses -->
    <div class="cert-witness-row">
      <!-- Zeuge 1 -->
      <div class="cert-witness-box">
        <div class="cert-witness-title">
          <span>Zeuge 1:</span>
          <span class="ar">الشاهد الأول</span>
        </div>
        <div class="cert-field">
          <span class="key">Name:</span>
          <span class="val">${w1IsCenter ? 'مركز الرسالة' : escapeHtml(w1.nameDe || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key-ar">الاسم:</span>
          <span class="val">${w1IsCenter ? 'طرف المركز' : escapeHtml(w1.nameAr || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Geburtsdatum:</span>
          <span class="val">${w1IsCenter ? '—' : birthDate(w1)}</span>
        </div>
        <div class="cert-field">
          <span class="key">Personalausweis:</span>
          <span class="val">${w1IsCenter ? '—' : escapeHtml(w1.idNumber || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Anschrift:</span>
          <span class="val">${w1IsCenter ? '—' : escapeHtml(fullAddress(w1))}</span>
        </div>
      </div>

      <!-- Zeuge 2 -->
      <div class="cert-witness-box">
        <div class="cert-witness-title">
          <span>Zeuge 2:</span>
          <span class="ar">الشاهد الثاني</span>
        </div>
        <div class="cert-field">
          <span class="key">Name:</span>
          <span class="val">${w2IsCenter ? 'مركز الرسالة' : escapeHtml(w2.nameDe || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key-ar">الاسم:</span>
          <span class="val">${w2IsCenter ? 'طرف المركز' : escapeHtml(w2.nameAr || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Geburtsdatum:</span>
          <span class="val">${w2IsCenter ? '—' : birthDate(w2)}</span>
        </div>
        <div class="cert-field">
          <span class="key">Personalausweis:</span>
          <span class="val">${w2IsCenter ? '—' : escapeHtml(w2.idNumber || '—')}</span>
        </div>
        <div class="cert-field">
          <span class="key">Anschrift:</span>
          <span class="val">${w2IsCenter ? '—' : escapeHtml(fullAddress(w2))}</span>
        </div>
      </div>
    </div>

    <!-- Documents Row -->
    <div class="cert-docs-row">
      <div class="cert-docs-titles">
        <div class="col-de">Identitäts- und Ledigkeitsnachweise:</div>
        <div class="col-ar">مستندات إثبات الشخصية والحالة الاجتماعية:</div>
        <div class="col-de">Ausweise/Pässe</div>
      </div>
      <div class="cert-docs-grid">
        <div class="doc-cell">
          <b>Ehemann</b>
          <span class="ar">الزوج</span>
        </div>
        <div class="doc-cell">
          <b>Ehefrau</b>
          <span class="ar">الزوجة</span>
        </div>
        <div class="doc-cell">
          <b>Wali</b>
          <span class="ar">الولي</span>
        </div>
        <div class="doc-cell">
          <b>Zeuge 1</b>
          <span class="ar">الشاهد الأول</span>
        </div>
        <div class="doc-cell">
          <b>Zeuge 2</b>
          <span class="ar">الشاهد الثاني</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="cert-footer">
      <div class="cert-footer-text">
        <div class="title">صيغة العقد</div>
        <p class="ar">
          نشهد نحن الموقعين أدناه أن عقد الزواج قد تم بين الزوجين المذكورين أعلاه،
          وقد تمّ التعريف بهما وبموافقتهما، وتمّ الاتفاق على المهر المذكور أعلاه،
          وأن الزوجة قد رضيت بذلك رضاءً تاماً، وشهد على ذلك الشهود المذكورون أعلاه.
        </p>
        <p class="de">
          Dieser Vertrag wurde nach den islamischen Ehevorschriften geschlossen
          und von allen Beteiligten angenommen. Beide Ehepartner bekundeten
          ihr Einverständnis vor Zeugen.
        </p>
        <div class="note">
          <strong>ملاحظة:</strong> هذا العقد ليس بديلاً عن التسجيل في الدوائر الألمانية المختصة.<br>
          <em>Dieser Vertrag ist kein Ersatz für eine standesamtliche Erklärung.</em>
        </div>
      </div>
      <div class="cert-footer-sign">
        <div class="sign-title">Vereinsvorstand / إدارة المركز</div>
        <div class="sign-area">الإمام</div>
        <div class="sign-line">التوقيع / Unterschrift</div>
      </div>
    </div>
  `;
}

/* ============================================================
   Render Contract
============================================================ */
function renderContract(contract) {
  const cert = $('certificate');
  cert.innerHTML = buildCertificate(contract);

  $('toolbarCode').textContent = contract.code;
  $('loadingScreen').classList.add('hidden');
  $('toolbar').classList.remove('hidden');
  $('certificateWrap').classList.remove('hidden');
}

/* ============================================================
   Download PDF (Through Browser Print)
============================================================ */
function downloadPDF() {
  // ضبط عنوان الصفحة ليصبح اسم الملف المقترح
  const originalTitle = document.title;
  const code = printState.contract?.code || 'contract';
  document.title = `Ehevertrag_${code}`;

  // استدعاء نافذة الطباعة (المستخدم يختار "حفظ كـ PDF")
  setTimeout(() => {
    window.print();
    // إعادة العنوان الأصلي
    setTimeout(() => {
      document.title = originalTitle;
    }, 100);
  }, 100);
}

/* ============================================================
   Init
============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get('code') || '').trim().toUpperCase();

  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    showError('رقم غير صالح', 'رقم العقد مفقود أو غير صحيح');
    return;
  }

  printState.code = code;

  try {
    const contract = await fetchContract(code);

    if (!contract) {
      throw new Error('العقد غير موجود');
    }

    printState.contract = contract;
    renderContract(contract);

  } catch (err) {
    console.error(err);
    showError('فشل التحميل', err.message);
  }
});

/* ============================================================
   Exports
============================================================ */
window.downloadPDF = downloadPDF;
