/* ============================================================
   Print Contract - JS V13 (Final)
   - V12 Design Approved
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
   Date Formatter
============================================================ */
function formatDate(input) {
  if (!input) return '—';

  const str = String(input).trim();
  if (!str || str === '—' || str === 'undefined' || str === 'undefined.00.01') {
    return '—';
  }

  let day, month, year;

  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(str)) {
    const p = str.split('.');
    day = p[0]; month = p[1]; year = p[2];
  }
  else if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(str)) {
    const p = str.split('.');
    year = p[0]; month = p[1]; day = p[2];
  }
  else if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
    const p = str.split('T')[0].split('-');
    year = p[0]; month = p[1]; day = p[2];
  }
  else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const p = str.split('/');
    day = p[0]; month = p[1]; year = p[2];
  }
  else {
    return str;
  }

  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);

  if (!d || !m || !y || d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) {
    return '—';
  }

  return `${pad2(d)}.${pad2(m)}.${y}`;
}

function birthDate(p) {
  if (!p) return '—';
  if (!p.birthDay || !p.birthMonth || !p.birthYear) return '—';
  return `${pad2(p.birthDay)}.${pad2(p.birthMonth)}.${p.birthYear}`;
}

function birthPlace(p) {
  if (!p) return '';
  const parts = [p.birthRegion, p.birthCountry].filter(Boolean);
  return parts.join(', ');
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
    <!-- ============ HEADER ============ -->
    <div class="cert-header">

      <div class="cert-header-photo">
        <div class="cert-photo-box">
          ${groomHasPhoto
            ? `<img src="${g.photo}" alt="Groom">`
            : 'صورة<br>الزوج'
          }
        </div>
      </div>

      <div class="cert-header-center">
        <div class="cert-logo">
          <img src="${printState.logoPath}" alt="Arresalah"
               onerror="this.style.display='none'; this.parentElement.textContent='☪'">
        </div>
        <div class="cert-header-title-de">Islamische Eheschließungsurkunde</div>
        <div class="cert-header-title-ar">شهادة عقد زواج إسلامي</div>
      </div>

      <div class="cert-header-photo">
        <div class="cert-photo-box">
          ${brideHasPhoto
            ? `<img src="${b.photo}" alt="Bride">`
            : 'صورة<br>الزوجة'
          }
        </div>
      </div>

    </div>

    <!-- ============ INFO STRIP ============ -->
    <div class="cert-info-strip">

      <div class="cert-info-cell">
        <div class="info-line">
          <span class="label-de">Turnstraße 83, 10551 Berlin</span>
          <span class="label-ar">عنوان المركز</span>
        </div>
      </div>

      <div class="cert-info-cell">
        <div class="info-line">
          <span class="label-de">Ort</span>
          <span class="label-ar">مكان</span>
          <span class="value">Arresalah e.V.</span>
        </div>
      </div>

      <div class="cert-info-cell">
        <div class="info-line">
          <span class="label-de">Datum der Eheschließung</span>
          <span class="label-ar">تاريخ عقد الزواج</span>
          <span class="value">${escapeHtml(contractDate)}</span>
        </div>
      </div>

    </div>

    <!-- ============ GROOM & BRIDE ============ -->
    <div class="cert-two-cols">

      <!-- Bride -->
      <div class="cert-col">
        <div class="cert-col-title">
          <span>Ehefrau</span>
          <span class="ar">الزوجة</span>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Name</span>
          </div>
          <div class="v-value">${escapeHtml(b.nameDe || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-ar">الاسم</span>
          </div>
          <div class="v-value v-ar">${escapeHtml(b.nameAr || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Geburtsdatum, Ort</span>
            <span class="cv-label-ar">الميلاد</span>
          </div>
          <div class="v-value">${birthDate(b)} — ${escapeHtml(birthPlace(b)) || '—'}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Ihre Mutter</span>
            <span class="cv-label-ar">اسم الأم</span>
          </div>
          <div class="v-value">${escapeHtml(b.motherNameDe || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-ar">اسم الأم</span>
          </div>
          <div class="v-value v-ar">${escapeHtml(b.motherNameAr || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Personalausweis</span>
            <span class="cv-label-ar">رقم الهوية</span>
          </div>
          <div class="v-value">${escapeHtml(b.idNumber || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Anschrift</span>
            <span class="cv-label-ar">العنوان</span>
          </div>
          <div class="v-value">${escapeHtml(fullAddress(b))}</div>
        </div>
      </div>

      <!-- Groom -->
      <div class="cert-col">
        <div class="cert-col-title">
          <span>Ehemann</span>
          <span class="ar">الزوج</span>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Name</span>
          </div>
          <div class="v-value">${escapeHtml(g.nameDe || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-ar">الاسم</span>
          </div>
          <div class="v-value v-ar">${escapeHtml(g.nameAr || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Geburtsdatum, Ort</span>
            <span class="cv-label-ar">الميلاد</span>
          </div>
          <div class="v-value">${birthDate(g)} — ${escapeHtml(birthPlace(g)) || '—'}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Seine Mutter</span>
            <span class="cv-label-ar">اسم الأم</span>
          </div>
          <div class="v-value">${escapeHtml(g.motherNameDe || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-ar">اسم الأم</span>
          </div>
          <div class="v-value v-ar">${escapeHtml(g.motherNameAr || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Personalausweis</span>
            <span class="cv-label-ar">رقم الهوية</span>
          </div>
          <div class="v-value">${escapeHtml(g.idNumber || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Anschrift</span>
            <span class="cv-label-ar">العنوان</span>
          </div>
          <div class="v-value">${escapeHtml(fullAddress(g))}</div>
        </div>
      </div>

    </div>

    <!-- ============ WALI + DOWRY ============ -->
    <div class="cert-wali-dowry">
      <div class="wali-dowry-grid">

        <!-- Right column (RTL first) = Wali details -->
        <div class="wali-dowry-col">

          <div class="wd-row">
            <div class="wd-label">
              <span class="wd-label-de">Name Der Wali:</span>
              <span class="wd-label-ar">اسم الولي</span>
            </div>
            <div class="wd-value">
              <span class="wd-value-de">${waliIsBride ? '—' : escapeHtml(w.nameDe || '—')}</span>
              <span class="wd-value-ar">${waliIsBride ? '—' : escapeHtml(w.nameAr || '—')}</span>
            </div>
          </div>

          <div class="wd-row">
            <div class="wd-label">
              <span class="wd-label-de">Geburtsdatum, Ort:</span>
              <span class="wd-label-ar">تاريخ ومكان الميلاد</span>
            </div>
            <div class="wd-value">
              <span class="wd-value-de">${waliIsBride ? '—' : birthDate(w)}</span>
              <span class="wd-value-ar">${waliIsBride ? '—' : escapeHtml(birthPlace(w))}</span>
            </div>
          </div>

          <div class="wd-row">
            <div class="wd-label">
              <span class="wd-label-de">Anschrift:</span>
              <span class="wd-label-ar">العنوان</span>
            </div>
            <div class="wd-value">
              <span class="wd-value-de">${waliIsBride ? '—' : escapeHtml(fullAddress(w))}</span>
            </div>
          </div>

        </div>

        <!-- Left column (RTL second) = Wali designation + Mahr -->
        <div class="wali-dowry-col">

          <div class="wd-row">
            <div class="wd-label">
              <span class="wd-label-de">Vertreter der Braut (Wali):</span>
              <span class="wd-label-ar">ولي الزوجة</span>
            </div>
            <div class="wd-value">
              <span class="wd-value-de">${waliIsBride ? 'Bride herself' : 'Wali present'}</span>
              <span class="wd-value-ar">${waliIsBride ? 'الزوجة نفسها' : 'ولي معين'}</span>
            </div>
          </div>

          <div class="wd-row">
            <div class="wd-label">
              <span class="wd-label-de">Brautgabe:</span>
              <span class="wd-label-ar">المهر</span>
            </div>
            <div class="wd-value wd-gold">
              <span class="wd-value-de">${escapeHtml(g.dowryAdvance || '0')} €</span>
            </div>
          </div>

        </div>

      </div>
    </div>

    <!-- ============ WITNESSES ============ -->
    <div class="cert-witness-box">

      <div class="cert-witness-col">
        <div class="cert-witness-title">
          <span>Zeuge 1</span>
          <span class="ar">الشاهد الأول</span>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Name</span>
            <span class="cv-label-ar">الاسم</span>
          </div>
          <div class="v-value">${w1IsCenter ? 'مركز الرسالة' : escapeHtml(w1.nameDe || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Geburtsdatum</span>
            <span class="cv-label-ar">الميلاد</span>
          </div>
          <div class="v-value">${w1IsCenter ? '—' : birthDate(w1)}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Personalausweis</span>
            <span class="cv-label-ar">الهوية</span>
          </div>
          <div class="v-value">${w1IsCenter ? '—' : escapeHtml(w1.idNumber || '—')}</div>
        </div>
      </div>

      <div class="cert-witness-col">
        <div class="cert-witness-title">
          <span>Zeuge 2</span>
          <span class="ar">الشاهد الثاني</span>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Name</span>
            <span class="cv-label-ar">الاسم</span>
          </div>
          <div class="v-value">${w2IsCenter ? 'مركز الرسالة' : escapeHtml(w2.nameDe || '—')}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Geburtsdatum</span>
            <span class="cv-label-ar">الميلاد</span>
          </div>
          <div class="v-value">${w2IsCenter ? '—' : birthDate(w2)}</div>
        </div>

        <div class="cv-row">
          <div class="cv-label">
            <span class="cv-label-de">Personalausweis</span>
            <span class="cv-label-ar">الهوية</span>
          </div>
          <div class="v-value">${w2IsCenter ? '—' : escapeHtml(w2.idNumber || '—')}</div>
        </div>
      </div>

    </div>

    <!-- ============ PARTY SIGNATURES ============ -->
    <div class="cert-party-signatures">
      <div class="party-signatures-title">
        <span>Unterschriften der Parteien</span>
        <span class="ar">إمضاءات الأطراف</span>
      </div>
      <div class="party-signatures-grid">
        <div class="party-sig-cell"><div class="sig-label">الزوج<small>Ehemann</small></div><div class="sig-line"></div></div>
        <div class="party-sig-cell"><div class="sig-label">الزوجة<small>Ehefrau</small></div><div class="sig-line"></div></div>
        <div class="party-sig-cell"><div class="sig-label">الولي<small>Wali</small></div><div class="sig-line"></div></div>
        <div class="party-sig-cell"><div class="sig-label">الشاهد الأول<small>Zeuge 1</small></div><div class="sig-line"></div></div>
        <div class="party-sig-cell"><div class="sig-label">الشاهد الثاني<small>Zeuge 2</small></div><div class="sig-line"></div></div>
      </div>
    </div>

    <!-- ============ FOOTER ============ -->
    <div class="cert-footer">

      <div class="cert-footer-sign">
        <div class="sign-box"><div class="sign-box-inner"></div></div>
        <div class="sign-label-bottom">إدارة المركز</div>
        <div class="sign-line"></div>
        <div class="sign-caption">التوقيع / Unterschrift</div>
      </div>

      <div class="cert-footer-text">
        <div class="footer-title">صيغة العقد</div>

        <div class="footer-text-ar">
          نشهد نحن الموقعين أدناه أن عقد الزواج قد تم بين الزوجين المذكورين أعلاه،
          وقد تمّ التعريف بهما وبموافقتهما، وتمّ الاتفاق على المهر المذكور أعلاه،
          وأن الزوجة قد رضيت بذلك رضاءً تاماً، وشهد على ذلك الشهود المذكورون أعلاه.
        </div>

        <div class="footer-text-de">
          Dieser Vertrag wurde nach den islamischen Ehevorschriften geschlossen
          und von allen Beteiligten angenommen. Beide Ehepartner bekundeten
          ihr Einverständnis vor Zeugen.
        </div>

        <div class="footer-note-center">
          <strong>ملاحظة:</strong> هذا العقد ليس بديلاً عن التسجيل في الدوائر الألمانية المختصة.
          <em>Dieser Vertrag ist kein Ersatz für eine standesamtliche Erklärung.</em>
        </div>
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
