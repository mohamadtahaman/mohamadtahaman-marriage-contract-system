/* ============================================================
   Print Contract - JS V5
   - Arial Font Everywhere
   - Husband photo top-left, Wife top-right
   - Logo centered
   - Labels left, Values right
   - Fixed Date Issue
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

/* ============================================================
   Date Formatter - handles all formats
============================================================ */
function formatDate(input) {
  if (!input) return '—';

  const str = String(input).trim();
  if (!str || str === '—' || str === 'undefined' || str === 'undefined.00.01') {
    return '—';
  }

  let day, month, year;

  // Format: DD.MM.YYYY
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(str)) {
    const p = str.split('.');
    day = p[0]; month = p[1]; year = p[2];
  }
  // Format: YYYY.MM.DD
  else if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(str)) {
    const p = str.split('.');
    year = p[0]; month = p[1]; day = p[2];
  }
  // Format: YYYY-MM-DD (ISO)
  else if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
    const p = str.split('T')[0].split('-');
    year = p[0]; month = p[1]; day = p[2];
  }
  // Format: DD/MM/YYYY
  else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const p = str.split('/');
    day = p[0]; month = p[1]; year = p[2];
  }
  else {
    return str;
  }

  // Validate
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  if (!d || !m || !y || d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) {
    return '—';
  }

  return `${pad2(day)}.${pad2(month)}.${year}`;
}

function birthDate(p) {
  if (!p) return '—';
  if (!p.birthDay || !p.birthMonth || !p.birthYear) return '—';
  return `${pad2(p.birthDay)}.${pad2(p.birthMonth)}.${p.birthYear}`;
}

function fullAddress(p) {
  if (!p) return '—';
  const street = [p.addressStreet, p.addressNumber].filter(Boolean).join(' ');
  const city = [p.postalCode, p.city].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ') || '—';
}

function hasPhoto(dataUrl) {
  if (!dataUrl) return false;
  if (typeof dataUrl !== 'string') return false;
  if (dataUrl.length < 100) return false;
  if (!dataUrl.startsWith('data:image')) return false;
  return true;
}

/* ============================================================
   API
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
   ✅ Label-Value Row Helper
============================================================ */
function row(labelDe, labelAr, value, options = {}) {
  const valueClass = options.gold ? 'v-value v-gold' : 'v-value';
  const valueStyle = options.dir ? `direction:${options.dir};` : '';
  return `
    <div class="cv-row">
      <div class="cv-label">
        <span class="cv-label-de">${escapeHtml(labelDe)}</span>
        ${labelAr ? `<span class="cv-label-ar">${escapeHtml(labelAr)}</span>` : ''}
      </div>
      <div class="${valueClass}" style="${valueStyle}">
        ${escapeHtml(value || '—')}
      </div>
    </div>
  `;
}

/* ============================================================
   Build Certificate
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

  const contractDate = formatDate(contract.contractDate);

  const groomHasPhoto = hasPhoto(g.photo);
  const brideHasPhoto = hasPhoto(b.photo);

  return `
    <!-- ============================================================
         HEADER: Husband photo (left) | Logo + Titles (center) | Wife photo (right)
    ============================================================ -->
    <div class="cert-header">

      <!-- Husband photo - top left -->
      <div class="cert-header-photo">
        <div class="cert-photo-box" title="صورة الزوج">
          ${groomHasPhoto
            ? `<img src="${g.photo}" alt="Groom">`
            : '<span>صورة<br>الزوج</span>'
          }
        </div>
      </div>

      <!-- Center: Logo + Titles -->
      <div class="cert-header-center">
        <div class="cert-logo">
          <img src="${printState.logoPath}" alt="Arresalah"
               onerror="this.style.display='none';this.parentElement.innerHTML='<span class=&quot;cert-logo-fallback&quot;>الرسالة</span>'">
        </div>
        <div class="cert-header-title-de">Islamische Eheschließungsurkunde</div>
        <div class="cert-header-title-ar">شهادة عقد زواج إسلامي</div>
      </div>

      <!-- Wife photo - top right -->
      <div class="cert-header-photo">
        <div class="cert-photo-box" title="صورة الزوجة">
          ${brideHasPhoto
            ? `<img src="${b.photo}" alt="Bride">`
            : '<span>صورة<br>الزوجة</span>'
          }
        </div>
      </div>

    </div>

    <!-- ============================================================
         TOP INFO ROW: Date (left) | Place (center) | Address (right)
    ============================================================ -->
    <div class="cert-info-strip">

      <!-- Date - at left -->
      <div class="cert-info-cell">
        <div class="cert-info-labels">
          <span class="label-de">Datum der Eheschließung</span>
          <span class="label-ar">تاريخ عقد الزواج</span>
        </div>
        <div class="cert-info-value">${escapeHtml(contractDate)}</div>
      </div>

      <!-- Place - center -->
      <div class="cert-info-cell">
        <div class="cert-info-labels">
          <span class="label-de">Ort</span>
          <span class="label-ar">مكان</span>
        </div>
        <div class="cert-info-value">Arresalah e.V.</div>
      </div>

      <!-- Address - right -->
      <div class="cert-info-cell">
        <div class="cert-info-labels">
          <span class="label-de">Turnstraße 83, 10551 Berlin</span>
          <span class="label-ar">عنوان المركز</span>
        </div>
      </div>

    </div>

    <!-- ============================================================
         GROOM & BRIDE
    ============================================================ -->
    <div class="cert-two-cols">

      <!-- Groom (left) -->
      <div class="cert-col">
        <div class="cert-col-title">
          <span>Ehemann</span>
          <span class="ar">الزوج</span>
        </div>

        ${row('Name', 'الاسم', g.nameDe || '—', { dir: 'ltr' })}
        ${row('', '', g.nameAr || '—', { dir: 'rtl' })}
        ${row('Geburtsdatum, Ort', '', birthDate(g) + ' — ' + (g.birthRegion || '') + ', ' + (g.birthCountry || ''))}
        ${row('Seine Mutter', 'اسم الأم', g.motherNameDe || '—', { dir: 'ltr' })}
        ${row('', '', g.motherNameAr || '—', { dir: 'rtl' })}
        ${row('Personalausweis', 'رقم الهوية', g.idNumber || '—', { dir: 'ltr' })}
        ${row('Anschrift', 'العنوان', fullAddress(g), { dir: 'ltr' })}
      </div>

      <!-- Bride (right) -->
      <div class="cert-col">
        <div class="cert-col-title">
          <span>Ehefrau</span>
          <span class="ar">الزوجة</span>
        </div>

        ${row('Name', 'الاسم', b.nameDe || '—', { dir: 'ltr' })}
        ${row('', '', b.nameAr || '—', { dir: 'rtl' })}
        ${row('Geburtsdatum, Ort', '', birthDate(b) + ' — ' + (b.birthRegion || '') + ', ' + (b.birthCountry || ''))}
        ${row('Ihre Mutter', 'اسم الأم', b.motherNameDe || '—', { dir: 'ltr' })}
        ${row('', '', b.motherNameAr || '—', { dir: 'rtl' })}
        ${row('Personalausweis', 'رقم الهوية', b.idNumber || '—', { dir: 'ltr' })}
        ${row('Anschrift', 'العنوان', fullAddress(b), { dir: 'ltr' })}
      </div>

    </div>

    <!-- ============================================================
         WALI + DOWRY (single big box)
         Labels on LEFT, Values on RIGHT
    ============================================================ -->
    <div class="cert-wali-box">

      ${row('Vertreter der Braut (Wali)', 'ولي الزوجة', waliIsBride ? 'الزوجة نفسها' : (w.nameDe || '—'))}
      ${row('', 'اسم الولي', waliIsBride ? 'Bride herself' : (w.nameAr || '—'))}
      ${row('Geburtsdatum, Ort', 'تاريخ ومكان الميلاد', waliIsBride ? '—' : birthDate(w), { dir: 'ltr' })}
      ${row('Anschrift', 'العنوان', waliIsBride ? '—' : fullAddress(w), { dir: 'ltr' })}

      <div class="cv-separator"></div>

      ${row('Brautgabe (Mahr) - Vorauszahlung', 'المهر المقدم', (g.dowryAdvance || '0') + ' €', { gold: true })}
      ${row('Brautgabe (Mahr) - Aufgeschoben', 'المهر المؤخر', (g.dowryDeferred || '0') + ' €', { gold: true })}
      ${row('Bemerkungen', 'ملاحظات', g.dowryNotes || '—', { dir: 'rtl' })}

    </div>

    <!-- ============================================================
         WITNESSES
    ============================================================ -->
    <div class="cert-witness-box">

      <div class="cert-witness-col">
        <div class="cert-witness-title">
          <span>Zeuge 1</span>
          <span class="ar">الشاهد الأول</span>
        </div>
        ${row('Name', 'الاسم', w1IsCenter ? 'مركز الرسالة' : (w1.nameDe || '—'))}
        ${row('', '', w1IsCenter ? 'طرف المركز' : (w1.nameAr || '—'))}
        ${row('Geburtsdatum', '', w1IsCenter ? '—' : birthDate(w1))}
        ${row('Personalausweis', '', w1IsCenter ? '—' : (w1.idNumber || '—'))}
        ${row('Anschrift', '', w1IsCenter ? '—' : fullAddress(w1))}
      </div>

      <div class="cert-witness-col">
        <div class="cert-witness-title">
          <span>Zeuge 2</span>
          <span class="ar">الشاهد الثاني</span>
        </div>
        ${row('Name', 'الاسم', w2IsCenter ? 'مركز الرسالة' : (w2.nameDe || '—'))}
        ${row('', '', w2IsCenter ? 'طرف المركز' : (w2.nameAr || '—'))}
        ${row('Geburtsdatum', '', w2IsCenter ? '—' : birthDate(w2))}
        ${row('Personalausweis', '', w2IsCenter ? '—' : (w2.idNumber || '—'))}
        ${row('Anschrift', '', w2IsCenter ? '—' : fullAddress(w2))}
      </div>

    </div>

    <!-- ============================================================
         DOCUMENTS
    ============================================================ -->
    <div class="cert-docs-box">

      <div class="cert-docs-title">
        <span>Identitäts- und Ledigkeitsnachweise: Ausweise/Pässe</span>
        <span class="ar">مستندات إثبات الشخصية والحالة الاجتماعية:</span>
      </div>

      <div class="cert-docs-grid">
        <div class="doc-cell"><b>Ehemann</b><span>الزوج</span></div>
        <div class="doc-cell"><b>Ehefrau</b><span>الزوجة</span></div>
        <div class="doc-cell"><b>Wali</b><span>الولي</span></div>
        <div class="doc-cell"><b>Zeuge 1</b><span>الشاهد الأول</span></div>
        <div class="doc-cell"><b>Zeuge 2</b><span>الشاهد الثاني</span></div>
      </div>

    </div>

    <!-- ============================================================
         FOOTER
         - Right: Signature box (no "الإمام", "إدارة المركز" at bottom)
         - Left: Contract text (compact)
    ============================================================ -->
    <div class="cert-footer">

      <!-- Left: Contract text -->
      <div class="cert-footer-text">
        <div class="footer-title">صيغة العقد</div>
        <p class="ar">
          نشهد نحن الموقعين أدناه أن عقد الزواج قد تم بين الزوجين المذكورين أعلاه،
          وقد تمّ التعريف بهما وبموافقتهما، وتمّ الاتفاق على المهر المذكور أعلاه،
          وأن الزوجة قد رضيت بذلك رضاءً تاماً، وشهد على ذلك الشهود المذكورون أعلاه.
        </p>
        <p class="de">
          Dieser Vertrag wurde nach den islamischen Ehevorschriften geschlossen und von allen
          Beteiligten angenommen. Beide Ehepartner bekundeten ihr Einverständnis vor Zeugen.
        </p>
        <div class="footer-note">
          <strong>ملاحظة:</strong> هذا العقد ليس بديلاً عن التسجيل في الدوائر الألمانية المختصة.<br>
          <em>Dieser Vertrag ist kein Ersatz für eine standesamtliche Erklärung.</em>
        </div>
      </div>

      <!-- Right: Signature box -->
      <div class="cert-footer-sign">
        <div class="sign-box">
          <div class="sign-box-inner"></div>
        </div>
        <div class="sign-label-bottom">إدارة المركز</div>
        <div class="sign-line"></div>
        <div class="sign-caption">التوقيع / Unterschrift</div>
      </div>

    </div>
  `;
}

/* ============================================================
   Render
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
   Download PDF
============================================================ */
function downloadPDF() {
  const originalTitle = document.title;
  const code = printState.contract?.code || 'contract';
  document.title = `Ehevertrag_${code}`;

  setTimeout(() => {
    window.print();
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
