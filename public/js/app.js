/* ============================================================
   Marriage Contract System V2 - Main App
============================================================ */

const state = {
  currentContractCode: null,
  currentPartyIndex: 0,
  contractData: {},
  contractDate: { day: '', month: '', year: '' },
  contractCodes: [],
};

const PARTY_DEFS = [
  { key: 'groom',    labelKey: 'groom',    icon: '👨', isSpouse: true, isGroom: true },
  { key: 'bride',    labelKey: 'bride',    icon: '👩', isSpouse: true, isGroom: false },
  { key: 'wali',     labelKey: 'wali',     icon: '🧔', isWali: true },
  { key: 'witness1', labelKey: 'witness1', icon: '👤', isWitness: true },
  { key: 'witness2', labelKey: 'witness2', icon: '👤', isWitness: true },
];

const PARTIES_COUNT = 5;

// نطاق العمر: 18 - 100 سنة
const MIN_AGE = 18;
const MAX_AGE = 100;

/* ============================================================
   Language Restriction Patterns
============================================================ */
// الألمانية: لاتيني + الأحرف الألمانية الخاصة + مسافات + شرطات + نقاط + فواصل عليا
const GERMAN_REGEX = /[^a-zA-ZäöüÄÖÜß\s\-\.\',]/g;
// العربية: كل أحرف Unicode العربية + مسافات + شرطات + نقاط + فواصل عليا
const ARABIC_REGEX = /[^\u0600-\u06FF\u0750-\u077F\s\-\.\',]/g;

/* ============================================================
   Empty Party
============================================================ */
function emptyParty() {
  return {
    nameDe: '', nameAr: '',
    birthDay: '', birthMonth: '', birthYear: '',
    birthCountry: '', birthRegion: '',
    idNumber: '', idType: 'id',
    addressNumber: '', addressStreet: '',
    postalCode: '', city: '',
    motherNameDe: '', motherNameAr: '',
    dowryAdvance: '', dowryDeferred: '', dowryNotes: '',
    waliIsBride: false,
    witnessIsCenter: false,
  };
}

/* ============================================================
   Utilities
============================================================ */
function esc(v) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function toast(msg, type = '') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getBirthDate(p) {
  if (!p.birthDay || !p.birthMonth || !p.birthYear) return '—';
  return `${pad2(p.birthDay)}.${pad2(p.birthMonth)}.${p.birthYear}`;
}

function getContractDateStr() {
  const { day, month, year } = state.contractDate;
  if (!day || !month || !year) return '—';
  return `${pad2(day)}.${pad2(month)}.${year}`;
}

/* ============================================================
   Date Validation
============================================================ */
function isValidDate(day, month, year) {
  if (!day || !month || !year) return true;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return false;
  const date = new Date(y, m - 1, d);
  return date.getDate() === d && date.getMonth() === m - 1 && date.getFullYear() === y;
}

function getDaysInMonth(month, year) {
  if (!month) return 31;
  const m = parseInt(month, 10);
  const y = year ? parseInt(year, 10) : 2000;
  return new Date(y, m, 0).getDate();
}

/* ============================================================
   Build Date Dropdowns
============================================================ */
function buildDayOptions(selectedDay, month, year) {
  const maxDays = getDaysInMonth(month, year);
  const dayLabel = (typeof t === 'function' ? t('selectDay') : 'Day');
  let html = `<option value="">${dayLabel}</option>`;
  for (let d = 1; d <= maxDays; d++) {
    html += `<option value="${d}" ${String(d) === String(selectedDay) ? 'selected' : ''}>${d}</option>`;
  }
  return html;
}

function buildMonthOptions(selectedMonth) {
  const monthLabel = (typeof t === 'function' ? t('selectMonth') : 'Month');
  let html = `<option value="">${monthLabel}</option>`;
  for (let m = 1; m <= 12; m++) {
    const name = (typeof t === 'function' ? t('monthName_' + m) : m);
    html += `<option value="${m}" ${String(m) === String(selectedMonth) ? 'selected' : ''}>${name}</option>`;
  }
  return html;
}

function buildYearOptions(selectedYear, isBirth = true) {
  const yearLabel = (typeof t === 'function' ? t('selectYear') : 'Year');
  const currentYear = new Date().getFullYear();
  let min, max;
  if (isBirth) {
    max = currentYear - MIN_AGE;   // أقصى سنة ميلاد (18 سنة)
    min = currentYear - MAX_AGE;   // أقدم سنة ميلاد (100 سنة)
  } else {
    // تاريخ العقد: من 2020 إلى currentYear + 1
    min = currentYear - 5;
    max = currentYear + 1;
  }
  let html = `<option value="">${yearLabel}</option>`;
  for (let y = max; y >= min; y--) {
    html += `<option value="${y}" ${String(y) === String(selectedYear) ? 'selected' : ''}>${y}</option>`;
  }
  return html;
}

/* ============================================================
   Language Restriction - Filter Input
============================================================ */
function applyLanguageFilter(input) {
  const mode = input.dataset.lang;
  if (!mode) return;

  let original = input.value;
  let filtered;

  if (mode === 'de') {
    filtered = original.replace(GERMAN_REGEX, '');
  } else if (mode === 'ar') {
    filtered = original.replace(ARABIC_REGEX, '');
  } else {
    return;
  }

  if (filtered !== original) {
    // احفظ موضع المؤشر
    const pos = input.selectionStart;
    const diff = original.length - filtered.length;
    input.value = filtered;
    input.setSelectionRange(Math.max(0, pos - diff), Math.max(0, pos - diff));
    toast(t(mode === 'de' ? 'invalidGerman' : 'invalidArabic'), 'error');
  }
}

/* ============================================================
   Screen Management
============================================================ */
function showScreen(name) {
  ['verifyScreen', 'roleScreen', 'inputScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== name);
  });
  scrollToTop();
}

/* ============================================================
   Verify Code
============================================================ */
async function verifyCode() {
  const input = document.getElementById('contractCodeInput');
  const btn = document.getElementById('verifyBtn');
  const code = input.value.trim().toUpperCase();

  if (!code) return toast(t('requiredField'), 'error');
  if (code.length !== 6) return toast(t('invalidCode'), 'error');
  if (!/^[A-Z0-9]{6}$/.test(code)) return toast(t('invalidChars'), 'error');

  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = t('verifying');

  try {
    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await response.json();

    if (!response.ok || !data.valid) {
      btn.disabled = false;
      btn.textContent = originalText;
      if (data.error === 'already_sent') return toast(t('codeAlreadySent'), 'error');
      if (data.error === 'not_found') return toast(t('codeNotApproved'), 'error');
      return toast(data.message || t('codeNotApproved'), 'error');
    }

    state.currentContractCode = code;
    state.currentPartyIndex = 0;
    state.contractData = {};
    PARTY_DEFS.forEach(def => { state.contractData[def.key] = emptyParty(); });

    // تاريخ العقد = اليوم افتراضياً
    const today = new Date();
    state.contractDate = {
      day: today.getDate(),
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    };

    const restored = restoreDraft();
    if (restored) toast(t('codeRestored'), 'success');

    showScreen('roleScreen');
    renderRolePicker();

    btn.disabled = false;
    btn.textContent = originalText;

  } catch (err) {
    console.error('Verify error:', err);
    btn.disabled = false;
    btn.textContent = originalText;
    toast(t('networkError'), 'error');
  }
}

/* ============================================================
   Role Picker
============================================================ */
function renderRolePicker() {
  updateProgress();
  const picker = document.getElementById('rolePicker');
  picker.innerHTML = '';

  PARTY_DEFS.forEach((def, idx) => {
    const tab = document.createElement('div');
    tab.className = 'party-tab';
    if (isPartyComplete(state.contractData[def.key], def)) {
      tab.classList.add('done');
    }
    tab.innerHTML = `<span class="tab-icon">${def.icon}</span>${t(def.labelKey)}`;
    tab.onclick = () => {
      state.currentPartyIndex = idx;
      showScreen('inputScreen');
      renderPartyForm();
    };
    picker.appendChild(tab);
  });

  checkAllDone();
}

/* ============================================================
   Party Completion Check
============================================================ */
function isPartyComplete(p, def) {
  if (!p) return false;

  if (def.isWali && p.waliIsBride) return true;
  if (def.isWitness && p.witnessIsCenter) return true;

  // الحقول الإلزامية
  if (!p.nameDe || !p.nameDe.trim()) return false;
  if (def.isSpouse && (!p.motherNameDe || !p.motherNameDe.trim())) return false;
  if (!p.birthDay || !p.birthMonth || !p.birthYear) return false;
  if (!isValidDate(p.birthDay, p.birthMonth, p.birthYear)) return false;
  if (!p.birthCountry || !p.birthCountry.trim()) return false;
  if (!p.birthRegion || !p.birthRegion.trim()) return false;
  if (!p.idNumber || !p.idNumber.trim()) return false;

  return true;
}

/* ============================================================
   Progress
============================================================ */
function updateProgress() {
  const done = PARTY_DEFS.filter(d =>
    isPartyComplete(state.contractData[d.key], d)
  ).length;

  const pct = Math.round((done / PARTIES_COUNT) * 100);

  const circle = document.getElementById('progressCircleRole');
  if (circle) circle.style.background = `conic-gradient(var(--green) ${pct}%, var(--green-pale) ${pct}%)`;

  const text = document.getElementById('progressTextRole');
  if (text) text.textContent = pct + '%';

  const sub = document.getElementById('progressSubtextRole');
  if (sub) sub.textContent = `${done} / ${PARTIES_COUNT}`;
}

/* ============================================================
   Check All Done
============================================================ */
function checkAllDone() {
  const allDone = PARTY_DEFS.every(d =>
    isPartyComplete(state.contractData[d.key], d)
  );
  const sendArea = document.getElementById('sendArea');
  if (sendArea) {
    sendArea.classList.toggle('hidden', !allDone);
    if (allDone) {
      renderContractDateDropdowns();
    }
  }
}

/* ============================================================
   Contract Date Dropdowns
============================================================ */
function renderContractDateDropdowns() {
  const { day, month, year } = state.contractDate;

  const dayEl = document.getElementById('contractDay');
  const monthEl = document.getElementById('contractMonth');
  const yearEl = document.getElementById('contractYear');

  if (dayEl) dayEl.innerHTML = buildDayOptions(day, month, year);
  if (monthEl) monthEl.innerHTML = buildMonthOptions(month);
  if (yearEl) yearEl.innerHTML = buildYearOptions(year, false);

  if (dayEl) dayEl.onchange = () => { state.contractDate.day = dayEl.value; saveDraft(); };
  if (monthEl) monthEl.onchange = () => {
    state.contractDate.month = monthEl.value;
    // أعد بناء الأيام (لشهر فبراير)
    dayEl.innerHTML = buildDayOptions(state.contractDate.day, monthEl.value, state.contractDate.year);
    saveDraft();
  };
  if (yearEl) yearEl.onchange = () => {
    state.contractDate.year = yearEl.value;
    dayEl.innerHTML = buildDayOptions(state.contractDate.day, monthEl.value, yearEl.value);
    saveDraft();
  };
}

/* ============================================================
   Party Form
============================================================ */
function renderPartyForm() {
  const def = PARTY_DEFS[state.currentPartyIndex];
  const party = state.contractData[def.key];
  const wrap = document.getElementById('partyFormWrap');
  wrap.innerHTML = buildPartyForm(def, party);
  attachFormHandlers(def.key);
  updateSaveButtonState(def, party);
}

/* ============================================================
   Build Party Form
============================================================ */
function buildPartyForm(def, p) {
  const isWali = def.isWali;
  const isWitness = def.isWitness;

  // الولي = الزوجة
  if (isWali && p.waliIsBride) {
    return `
      <div class="form-grid">
        <div class="section-title">${t('wali')}</div>
        <div class="special-box">
          <input type="checkbox" id="waliIsBrideCheck" checked>
          <label for="waliIsBrideCheck">${t('waliIsBride')}</label>
        </div>
        <div class="special-info-box">${t('waliIsBrideText')}</div>
      </div>
      <div class="save-btn-wrap">
        <button class="btn save-btn complete" onclick="savePartyAndReturn()">
          ${t('saveComplete')}
        </button>
        <div class="save-hint">${t('readyToSave')}</div>
      </div>`;
  }

  // الشاهد = طرف المركز
  if (isWitness && p.witnessIsCenter) {
    return `
      <div class="form-grid">
        <div class="section-title">${t(def.labelKey)}</div>
        <div class="special-box">
          <input type="checkbox" id="witnessIsCenterCheck" checked>
          <label for="witnessIsCenterCheck">${t('witnessIsCenter')}</label>
        </div>
        <div class="special-info-box">${t('witnessIsCenterText')}</div>
      </div>
      <div class="save-btn-wrap">
        <button class="btn save-btn complete" onclick="savePartyAndReturn()">
          ${t('saveComplete')}
        </button>
        <div class="save-hint">${t('readyToSave')}</div>
      </div>`;
  }

  const spouse = def.isSpouse;
  const groom = def.isGroom;

  let html = `<div class="form-grid">
    <div class="section-title">${def.icon} ${t(def.labelKey)}</div>

    <div class="field">
      <label>${t('nameDe')} <span class="req">*</span></label>
      <input type="text" data-k="nameDe" data-lang="de"
             value="${esc(p.nameDe)}" autocomplete="off" spellcheck="false">
    </div>
    <div class="field">
      <label>${t('nameAr')}</label>
      <input type="text" data-k="nameAr" data-lang="ar"
             value="${esc(p.nameAr)}" autocomplete="off" spellcheck="false">
    </div>

    <div class="field full">
      <label>${t('birthDate')} <span class="req">*</span></label>
      <div class="date-selects">
        <select data-k="birthDay" data-type="birth-date">${buildDayOptions(p.birthDay, p.birthMonth, p.birthYear)}</select>
        <select data-k="birthMonth" data-type="birth-date">${buildMonthOptions(p.birthMonth)}</select>
        <select data-k="birthYear" data-type="birth-date">${buildYearOptions(p.birthYear, true)}</select>
      </div>
    </div>

    <div class="field">
      <label>${t('birthCountry')} <span class="req">*</span></label>
      <input type="text" data-k="birthCountry" data-lang="auto"
             value="${esc(p.birthCountry)}" autocomplete="off">
    </div>
    <div class="field">
      <label>${t('birthRegion')} <span class="req">*</span></label>
      <input type="text" data-k="birthRegion" data-lang="auto"
             value="${esc(p.birthRegion)}" autocomplete="off">
    </div>

    <div class="field">
      <label>${t('idType')}</label>
      <select data-k="idType">
        <option value="id" ${p.idType === 'id' ? 'selected' : ''}>${t('idCard')}</option>
        <option value="passport" ${p.idType === 'passport' ? 'selected' : ''}>${t('passport')}</option>
      </select>
    </div>
    <div class="field">
      <label>${t('idNumber')} <span class="req">*</span></label>
      <input type="text" data-k="idNumber" data-lang="auto"
             value="${esc(p.idNumber)}" autocomplete="off" spellcheck="false">
    </div>

    <div class="section-title">${t('address')}</div>
    <div class="address-sub">
      <div class="field">
        <label>${t('addressNumber')}</label>
        <input type="text" data-k="addressNumber" data-lang="auto"
               value="${esc(p.addressNumber)}" autocomplete="off">
      </div>
      <div class="field">
        <label>${t('addressStreet')}</label>
        <input type="text" data-k="addressStreet" data-lang="auto"
               value="${esc(p.addressStreet)}" autocomplete="off">
      </div>
    </div>
    <div class="address-sub2">
      <div class="field">
        <label>${t('postalCode')}</label>
        <input type="text" data-k="postalCode" data-lang="auto"
               value="${esc(p.postalCode)}" autocomplete="off">
      </div>
      <div class="field">
        <label>${t('city')}</label>
        <input type="text" data-k="city" data-lang="auto"
               value="${esc(p.city)}" autocomplete="off">
      </div>
    </div>
  `;

  // الأم للزوجين
  if (spouse) {
    html += `
      <div class="section-title">${t('motherData')}</div>
      <div class="field">
        <label>${t('motherNameDe')} <span class="req">*</span></label>
        <input type="text" data-k="motherNameDe" data-lang="de"
               value="${esc(p.motherNameDe)}" autocomplete="off" spellcheck="false">
      </div>
      <div class="field">
        <label>${t('motherNameAr')}</label>
        <input type="text" data-k="motherNameAr" data-lang="ar"
               value="${esc(p.motherNameAr)}" autocomplete="off" spellcheck="false">
      </div>
    `;
  }

  // المهر للزوج
  if (groom) {
    html += `
      <div class="dowry-box">
        <div class="dowry-box-title">${t('dowryTitle')}</div>
        <div class="dowry-fields">
          <div class="field">
            <label>${t('dowryAdvance')}</label>
            <input type="text" inputmode="numeric" pattern="[0-9]*"
                   data-k="dowryAdvance" value="${esc(p.dowryAdvance)}" placeholder="0">
          </div>
          <div class="field">
            <label>${t('dowryDeferred')}</label>
            <input type="text" inputmode="numeric" pattern="[0-9]*"
                   data-k="dowryDeferred" value="${esc(p.dowryDeferred)}" placeholder="0">
          </div>
          <div class="field field-full">
            <label>${t('dowryNotes')}</label>
            <textarea data-k="dowryNotes" placeholder="${t('dowryNotesPH')}">${esc(p.dowryNotes)}</textarea>
          </div>
        </div>
      </div>
    `;
  }

  // خيار الولي
  if (isWali) {
    html += `
      <div class="special-box">
        <input type="checkbox" id="waliIsBrideCheck" ${p.waliIsBride ? 'checked' : ''}>
        <label for="waliIsBrideCheck">${t('waliIsBride')}</label>
      </div>
    `;
  }

  // خيار الشاهد
  if (isWitness) {
    html += `
      <div class="special-box">
        <input type="checkbox" id="witnessIsCenterCheck" ${p.witnessIsCenter ? 'checked' : ''}>
        <label for="witnessIsCenterCheck">${t('witnessIsCenter')}</label>
      </div>
    `;
  }

  html += `</div>
    <div class="save-btn-wrap">
      <button class="btn save-btn" id="saveBtn" onclick="savePartyAndReturn()">
        ${t('save')}
      </button>
      <div class="save-hint" id="saveHint">${t('incomplete')}</div>
    </div>`;

  return html;
}

/* ============================================================
   Attach Form Handlers
============================================================ */
function attachFormHandlers(partyKey) {
  const party = state.contractData[partyKey];

  document.querySelectorAll('#partyFormWrap [data-k]').forEach(inp => {
    const key = inp.dataset.k;

    // 1. الحقول الرقمية: منع الأحرف
    if (inp.inputMode === 'numeric' || inp.pattern === '[0-9]*') {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/[^0-9]/g, '');
      });
    }

    // 2. فلتر اللغة
    if (inp.tagName === 'INPUT' && inp.dataset.lang) {
      inp.addEventListener('input', () => applyLanguageFilter(inp));
    }

    // 3. ربط الإدخال
    inp.addEventListener('input', () => {
      party[key] = inp.value;
      // إزالة الإطار الأحمر عند التصحيح
      inp.classList.remove('error');
      saveDraft();
      updateSaveButtonState(PARTY_DEFS[state.currentPartyIndex], party);
    });

    inp.addEventListener('change', () => {
      party[key] = inp.value;
      saveDraft();
      updateSaveButtonState(PARTY_DEFS[state.currentPartyIndex], party);
    });

    // 4. قوائم التاريخ
    if (inp.dataset.type === 'birth-date') {
      if (key === 'birthMonth' || key === 'birthYear') {
        inp.addEventListener('change', () => {
          // أعد بناء قائمة الأيام
          const daySelect = document.querySelector('#partyFormWrap [data-k="birthDay"]');
          if (daySelect) {
            daySelect.innerHTML = buildDayOptions(
              party.birthDay,
              party.birthMonth,
              party.birthYear
            );
          }
        });
      }
    }
  });

  // الولي
  const waliCheck = document.getElementById('waliIsBrideCheck');
  if (waliCheck) {
    waliCheck.addEventListener('change', () => {
      party.waliIsBride = waliCheck.checked;
      saveDraft();
      renderPartyForm();
    });
  }

  // الشاهد
  const witnessCheck = document.getElementById('witnessIsCenterCheck');
  if (witnessCheck) {
    witnessCheck.addEventListener('change', () => {
      party.witnessIsCenter = witnessCheck.checked;
      saveDraft();
      renderPartyForm();
    });
  }
}

/* ============================================================
   Update Save Button
============================================================ */
function updateSaveButtonState(def, party) {
  const btn = document.getElementById('saveBtn');
  const hint = document.getElementById('saveHint');
  if (!btn) return;

  const complete = isPartyComplete(party, def);
  btn.classList.toggle('complete', complete);
  btn.classList.toggle('incomplete', !complete);
  btn.textContent = complete ? t('saveComplete') : t('save');
  if (hint) hint.textContent = complete ? t('readyToSave') : t('incomplete');
}

/* ============================================================
   Save Party
============================================================ */
function savePartyAndReturn() {
  const def = PARTY_DEFS[state.currentPartyIndex];
  const party = state.contractData[def.key];

  // مسح الحالات السابقة
  document.querySelectorAll('#partyFormWrap .error').forEach(el => el.classList.remove('error'));

  // تحقق خاص
  const errors = [];

  if (!party.nameDe || !party.nameDe.trim()) errors.push('nameDe');
  if (def.isSpouse && (!party.motherNameDe || !party.motherNameDe.trim())) errors.push('motherNameDe');
  if (!party.birthDay || !party.birthMonth || !party.birthYear) {
    errors.push('birthDay', 'birthMonth', 'birthYear');
  } else if (!isValidDate(party.birthDay, party.birthMonth, party.birthYear)) {
    errors.push('birthDay', 'birthMonth', 'birthYear');
    toast(t('invalidBirthDate'), 'error');
  }
  if (!party.birthCountry || !party.birthCountry.trim()) errors.push('birthCountry');
  if (!party.birthRegion || !party.birthRegion.trim()) errors.push('birthRegion');
  if (!party.idNumber || !party.idNumber.trim()) errors.push('idNumber');

  if (errors.length > 0) {
    errors.forEach(k => {
      const el = document.querySelector(`#partyFormWrap [data-k="${k}"]`);
      if (el) el.classList.add('error');
    });
    toast('❌ ' + t('incomplete'), 'error');
    return;
  }

  saveDraft();
  toast('✓ ' + t(def.labelKey), 'success');

  showScreen('roleScreen');
  renderRolePicker();
}

/* ============================================================
   Submit All
============================================================ */
async function submitAllParties() {
  const btn = document.getElementById('submitAllBtn');

  // التحقق من تاريخ العقد
  const { day, month, year } = state.contractDate;
  if (!day || !month || !year) {
    toast(t('invalidContractDate'), 'error');
    return;
  }
  if (!isValidDate(day, month, year)) {
    toast(t('invalidContractDate'), 'error');
    return;
  }

  // تحقق نهائي
  for (const def of PARTY_DEFS) {
    if (!isPartyComplete(state.contractData[def.key], def)) {
      toast(t('incomplete') + ': ' + t(def.labelKey), 'error');
      return;
    }
  }

  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.textContent = t('submitting');

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: state.currentContractCode,
        contractDate: getContractDateStr(),
        data: state.contractData,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Submit failed');
    }

    toast(t('submitSuccess'), 'success');
    clearDraft();

    document.getElementById('roleScreen').innerHTML = `
      <div class="success-box">
        <span class="big-check">✓</span>
        <div class="success-title">${t('submitSuccess')}</div>
        <div class="success-code">${state.currentContractCode}</div>
        <small>${t('contractDateTitle')}: ${getContractDateStr()}</small>
        <div style="margin-top:24px;">
          <button class="btn btn-primary btn-small" onclick="location.reload()">
            ${t('newContract')}
          </button>
        </div>
      </div>`;
    scrollToTop();

  } catch (err) {
    console.error('Submit error:', err);
    toast(t('submitFailed'), 'error');
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

/* ============================================================
   Draft Storage
============================================================ */
function saveDraft() {
  if (!state.currentContractCode) return;
  try {
    localStorage.setItem(
      'draft_' + state.currentContractCode,
      JSON.stringify({
        contractData: state.contractData,
        contractDate: state.contractDate,
      })
    );
  } catch (e) {}
}

function restoreDraft() {
  if (!state.currentContractCode) return false;
  try {
    const raw = localStorage.getItem('draft_' + state.currentContractCode);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.contractData) {
        PARTY_DEFS.forEach(def => {
          if (saved.contractData[def.key]) {
            state.contractData[def.key] = { ...emptyParty(), ...saved.contractData[def.key] };
          }
        });
      }
      if (saved.contractDate) {
        state.contractDate = { ...state.contractDate, ...saved.contractDate };
      }
      return true;
    }
  } catch (e) {}
  return false;
}

function clearDraft() {
  if (!state.currentContractCode) return;
  localStorage.removeItem('draft_' + state.currentContractCode);
}

/* ============================================================
   Help Modal
============================================================ */
function showHelp() {
  document.getElementById('helpModal').classList.remove('hidden');
}

function closeHelpModal() {
  document.getElementById('helpModal').classList.add('hidden');
}

/* ============================================================
   Language Changed Hook
============================================================ */
window.onLanguageChanged = function() {
  if (!document.getElementById('inputScreen').classList.contains('hidden')) {
    renderPartyForm();
  }
  if (!document.getElementById('roleScreen').classList.contains('hidden')) {
    renderRolePicker();
    renderContractDateDropdowns();
  }
};

/* ============================================================
   Init
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const verifyBtn = document.getElementById('verifyBtn');
  if (verifyBtn) verifyBtn.addEventListener('click', verifyCode);

  const codeInput = document.getElementById('contractCodeInput');
  if (codeInput) {
    codeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') verifyCode();
    });
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
  }

  const helpBtn = document.getElementById('helpBtn');
  if (helpBtn) helpBtn.addEventListener('click', showHelp);

  const submitBtn = document.getElementById('submitAllBtn');
  if (submitBtn) submitBtn.addEventListener('click', submitAllParties);
});

/* ============================================================
   Exports
============================================================ */
window.verifyCode = verifyCode;
window.savePartyAndReturn = savePartyAndReturn;
window.submitAllParties = submitAllParties;
window.showHelp = showHelp;
window.closeHelpModal = closeHelpModal;
