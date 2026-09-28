/* ============================================================
   Marriage Contract System - Main App
   Arresalah Zentrum Berlin
============================================================ */

/* ============================================================
   الحالة العامة
============================================================ */
const state = {
  currentContractCode: null,
  currentPartyIndex: 0,
  contractData: {},
  contractCodes: [],
  saving: false,
};

/* ============================================================
   تعريف الأطراف
============================================================ */
const PARTY_DEFS = [
  { key: 'groom',    labelKey: 'groom',    icon: '👨', isSpouse: true, isGroom: true },
  { key: 'bride',    labelKey: 'bride',    icon: '👩', isSpouse: true, isGroom: false },
  { key: 'wali',     labelKey: 'wali',     icon: '🧔', isWali: true },
  { key: 'witness1', labelKey: 'witness1', icon: '👤', isWitness: true },
  { key: 'witness2', labelKey: 'witness2', icon: '👤', isWitness: true },
];

const PARTIES_COUNT = 5;

/* ============================================================
   كائن فارغ للطرف
============================================================ */
function emptyParty() {
  return {
    nameDe: '',
    nameAr: '',
    birthDay: '',
    birthMonth: '',
    birthYear: '',
    birthCountry: '',
    birthRegion: '',
    idNumber: '',
    idType: 'id',
    addressNumber: '',
    addressStreet: '',
    postalCode: '',
    city: '',
    motherNameDe: '',
    motherNameAr: '',
    dowryAdvance: '',
    dowryDeferred: '',
    dowryNotes: '',
    waliIsBride: false,
    witnessIsCenter: false,
  };
}

/* ============================================================
   أدوات مساعدة
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
  }, 2700);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getBirthDate(p) {
  const d = (p.birthDay || '').padStart(2, '0');
  const m = (p.birthMonth || '').padStart(2, '0');
  const y = p.birthYear || '';
  if (!d || !m || !y) return '—';
  return `${d}.${m}.${y}`;
}

function isValidDate(day, month, year) {
  if (!day || !month || !year) return true;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) return false;
  const date = new Date(y, m - 1, d);
  return date.getDate() === d && date.getMonth() === m - 1 && date.getFullYear() === y;
}

/* ============================================================
   الحفظ المحلي (Draft)
============================================================ */
function saveDraft() {
  if (!state.currentContractCode) return;
  try {
    localStorage.setItem(
      'draft_' + state.currentContractCode,
      JSON.stringify(state.contractData)
    );
  } catch (e) {
    console.warn('Save draft failed:', e);
  }
}

function restoreDraft() {
  if (!state.currentContractCode) return false;
  try {
    const raw = localStorage.getItem('draft_' + state.currentContractCode);
    if (raw) {
      const saved = JSON.parse(raw);
      PARTY_DEFS.forEach(def => {
        if (saved[def.key]) {
          state.contractData[def.key] = { ...emptyParty(), ...saved[def.key] };
        }
      });
      return true;
    }
  } catch (e) {
    console.warn('Restore draft failed:', e);
  }
  return false;
}

function clearDraft() {
  if (!state.currentContractCode) return;
  localStorage.removeItem('draft_' + state.currentContractCode);
}

/* ============================================================
   إدارة النافذة (Screen Manager)
============================================================ */
function showScreen(name) {
  ['verifyScreen', 'roleScreen', 'inputScreen'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== name);
  });
  scrollToTop();
}

/* ============================================================
   شاشة التحقق
============================================================ */
async function verifyCode() {
  const input = document.getElementById('contractCodeInput');
  const btn = document.getElementById('verifyBtn');
  const code = input.value.trim().toUpperCase();

  /* التحقق الأساسي */
  if (!code) {
    return toast(t('requiredField'), 'error');
  }
  if (code.length !== 6) {
    return toast(t('invalidCode'), 'error');
  }
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return toast(t('invalidChars'), 'error');
  }

  /* قفل الزر */
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

      if (data.error === 'already_sent') {
        return toast(t('codeAlreadySent'), 'error');
      }
      if (data.error === 'not_found') {
        return toast(t('codeNotApproved'), 'error');
      }
      return toast(data.message || t('codeNotApproved'), 'error');
    }

    /* نجاح التحقق */
    state.currentContractCode = code;
    state.currentPartyIndex = 0;
    state.contractData = {};
    PARTY_DEFS.forEach(def => {
      state.contractData[def.key] = emptyParty();
    });

    /* استرجاع المسودة */
    const restored = restoreDraft();
    if (restored) {
      toast(t('codeRestored'), 'success');
    }

    /* الانتقال للشاشة التالية */
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
   شاشة اختيار الأطراف
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
   التحقق من اكتمال طرف
============================================================ */
function isPartyComplete(p, def) {
  if (!p) return false;

  /* الولي: مكتمل إذا فعّل "الولي هي الزوجة نفسها" */
  if (def.isWali && p.waliIsBride) return true;

  /* الشاهد: مكتمل إذا فعّل "الشاهد طرف المركز" */
  if (def.isWitness && p.witnessIsCenter) return true;

  /* الاسم بالألمانية إلزامي */
  if (!p.nameDe || !p.nameDe.trim()) return false;

  /* اسم الأم إلزامي للزوجين */
  if (def.isSpouse && (!p.motherNameDe || !p.motherNameDe.trim())) return false;

  /* التحقق من التاريخ */
  if (p.birthDay || p.birthMonth || p.birthYear) {
    if (!isValidDate(p.birthDay, p.birthMonth, p.birthYear)) return false;
  }

  return true;
}

/* ============================================================
   تحديث المؤشر الدائري
============================================================ */
function updateProgress() {
  const done = PARTY_DEFS.filter(d =>
    isPartyComplete(state.contractData[d.key], d)
  ).length;

  const pct = Math.round((done / PARTIES_COUNT) * 100);

  const circle = document.getElementById('progressCircleRole');
  if (circle) {
    circle.style.background = `conic-gradient(var(--green-dark) ${pct}%, #e0e0e0 ${pct}%)`;
  }

  const text = document.getElementById('progressTextRole');
  if (text) text.textContent = pct + '%';

  const sub = document.getElementById('progressSubtextRole');
  if (sub) sub.textContent = `${done} / ${PARTIES_COUNT}`;
}

/* ============================================================
   التحقق من اكتمال الكل
============================================================ */
function checkAllDone() {
  const allDone = PARTY_DEFS.every(d =>
    isPartyComplete(state.contractData[d.key], d)
  );
  const sendArea = document.getElementById('sendArea');
  if (sendArea) sendArea.classList.toggle('hidden', !allDone);
}

/* ============================================================
   نموذج الطرف
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
   بناء نموذج الطرف
============================================================ */
function buildPartyForm(def, p) {
  const spouse = def.isSpouse;
  const groom = def.isGroom;
  const isWali = def.isWali;
  const isWitness = def.isWitness;

  /* حالة خاصة: الولي = الزوجة */
  if (isWali && p.waliIsBride) {
    return `
      <div class="form-grid">
        <div class="section-title">${t('wali')}</div>
        <div class="special-box">
          <input type="checkbox" id="waliIsBrideCheck" checked>
          <label for="waliIsBrideCheck">${t('waliIsBride')}</label>
        </div>
        <div class="special-info-box">✓ ${t('waliIsBrideText')}</div>
      </div>
      <div class="save-btn-wrap">
        <button class="btn save-btn complete" onclick="savePartyAndReturn()">
          ${t('saveComplete')}
        </button>
        <div class="save-hint">${t('readyToSave')}</div>
      </div>`;
  }

  /* حالة خاصة: الشاهد = طرف المركز */
  if (isWitness && p.witnessIsCenter) {
    return `
      <div class="form-grid">
        <div class="section-title">${t(def.labelKey)}</div>
        <div class="special-box">
          <input type="checkbox" id="witnessIsCenterCheck" checked>
          <label for="witnessIsCenterCheck">${t('witnessIsCenter')}</label>
        </div>
        <div class="special-info-box">✓ ${t('witnessIsCenterText')}</div>
      </div>
      <div class="save-btn-wrap">
        <button class="btn save-btn complete" onclick="savePartyAndReturn()">
          ${t('saveComplete')}
        </button>
        <div class="save-hint">${t('readyToSave')}</div>
      </div>`;
  }

  /* النموذج العادي */
  let html = `<div class="form-grid">
    <div class="section-title">${def.icon} ${t(def.labelKey)}</div>

    <div class="field">
      <label>${t('nameDe')} <span class="req">*</span></label>
      <input type="text" data-k="nameDe" value="${esc(p.nameDe)}" autocomplete="off">
    </div>
    <div class="field">
      <label>${t('nameAr')}</label>
      <input type="text" data-k="nameAr" value="${esc(p.nameAr)}" autocomplete="off">
    </div>

    <div class="field full">
      <label>${t('birthDate')}</label>
      <div class="date-inputs">
        <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2"
               placeholder="${t('day')}" data-k="birthDay" value="${esc(p.birthDay)}">
        <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2"
               placeholder="${t('month')}" data-k="birthMonth" value="${esc(p.birthMonth)}">
        <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4"
               placeholder="${t('year')}" data-k="birthYear" value="${esc(p.birthYear)}">
      </div>
    </div>

    <div class="field">
      <label>${t('birthCountry')}</label>
      <input type="text" data-k="birthCountry" value="${esc(p.birthCountry)}" autocomplete="off">
    </div>
    <div class="field">
      <label>${t('birthRegion')}</label>
      <input type="text" data-k="birthRegion" value="${esc(p.birthRegion)}" autocomplete="off">
    </div>

    <div class="field">
      <label>${t('idType')}</label>
      <select data-k="idType">
        <option value="id" ${p.idType === 'id' ? 'selected' : ''}>${t('idCard')}</option>
        <option value="passport" ${p.idType === 'passport' ? 'selected' : ''}>${t('passport')}</option>
      </select>
    </div>
    <div class="field">
      <label>${t('idNumber')}</label>
      <input type="text" data-k="idNumber" value="${esc(p.idNumber)}"
             autocomplete="off" spellcheck="false">
    </div>

    <div class="section-title">${t('address')}</div>
    <div class="address-sub">
      <div class="field">
        <label>${t('addressNumber')}</label>
        <input type="text" data-k="addressNumber" value="${esc(p.addressNumber)}" autocomplete="off">
      </div>
      <div class="field">
        <label>${t('addressStreet')}</label>
        <input type="text" data-k="addressStreet" value="${esc(p.addressStreet)}" autocomplete="off">
      </div>
    </div>
    <div class="address-sub2">
      <div class="field">
        <label>${t('postalCode')}</label>
        <input type="text" inputmode="numeric" pattern="[0-9]*"
               data-k="postalCode" value="${esc(p.postalCode)}" autocomplete="off">
      </div>
      <div class="field">
        <label>${t('city')}</label>
        <input type="text" data-k="city" value="${esc(p.city)}" autocomplete="off">
      </div>
    </div>
  `;

  /* قسم الأم (للزوجين) */
  if (spouse) {
    html += `
      <div class="section-title">${t('motherData')}</div>
      <div class="field">
        <label>${t('motherNameDe')} <span class="req">*</span></label>
        <input type="text" data-k="motherNameDe" value="${esc(p.motherNameDe)}" autocomplete="off">
      </div>
      <div class="field">
        <label>${t('motherNameAr')}</label>
        <input type="text" data-k="motherNameAr" value="${esc(p.motherNameAr)}" autocomplete="off">
      </div>
    `;
  }

  /* قسم المهر (للزوج فقط) */
  if (groom) {
    html += `
      <div class="dowry-box">
        <div class="dowry-box-title">💰 ${t('dowryTitle')}</div>
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

  /* خيار الولي */
  if (isWali) {
    html += `
      <div class="special-box">
        <input type="checkbox" id="waliIsBrideCheck" ${p.waliIsBride ? 'checked' : ''}>
        <label for="waliIsBrideCheck">${t('waliIsBride')}</label>
      </div>
    `;
  }

  /* خيار الشاهد */
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
   منع الأحرف في الحقول الرقمية + ربط الأحداث
============================================================ */
function attachFormHandlers(partyKey) {
  const party = state.contractData[partyKey];

  document.querySelectorAll('#partyFormWrap [data-k]').forEach(inp => {
    const key = inp.dataset.k;

    /* منع الأحرف في الحقول الرقمية */
    if (inp.inputMode === 'numeric' || inp.pattern === '[0-9]*') {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/[^0-9]/g, '');
      });
    }

    /* ربط الإدخال */
    inp.addEventListener('input', () => {
      party[key] = inp.value;
      saveDraft();
      updateSaveButtonState(PARTY_DEFS[state.currentPartyIndex], party);
    });
  });

  /* الولي */
  const waliCheck = document.getElementById('waliIsBrideCheck');
  if (waliCheck) {
    waliCheck.addEventListener('change', () => {
      party.waliIsBride = waliCheck.checked;
      saveDraft();
      renderPartyForm();
    });
  }

  /* الشاهد */
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
   تحديث حالة زر الحفظ
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
   حفظ الطرف والعودة
============================================================ */
function savePartyAndReturn() {
  const def = PARTY_DEFS[state.currentPartyIndex];
  const party = state.contractData[def.key];

  if (!isPartyComplete(party, def)) {
    toast('❌ ' + t('incomplete'), 'error');
    return;
  }

  saveDraft();
  toast('✓ ' + t(def.labelKey) + ' — ✓', 'success');

  showScreen('roleScreen');
  renderRolePicker();
}

/* ============================================================
   الإرسال النهائي
============================================================ */
async function submitAllParties() {
  const btn = document.getElementById('submitAllBtn');

  /* التحقق من كل الأطراف */
  const errors = [];
  for (const def of PARTY_DEFS) {
    const p = state.contractData[def.key];
    if (def.isWali && p.waliIsBride) continue;
    if (def.isWitness && p.witnessIsCenter) continue;

    if (!p.nameDe || !p.nameDe.trim()) {
      errors.push(t(def.labelKey) + ': ' + t('nameDe'));
    }
    if (def.isSpouse && (!p.motherNameDe || !p.motherNameDe.trim())) {
      errors.push(t(def.labelKey) + ': ' + t('motherNameDe'));
    }
    if (p.birthDay || p.birthMonth || p.birthYear) {
      if (!isValidDate(p.birthDay, p.birthMonth, p.birthYear)) {
        errors.push(t(def.labelKey) + ': ' + t('invalidDate'));
      }
    }
  }

  if (errors.length) {
    toast('❌ ' + errors.length + ' ' + t('incomplete'), 'error');
    setTimeout(() => alert(errors.join('\n')), 300);
    return;
  }

  btn.disabled = true;
  btn.textContent = t('submitting');

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: state.currentContractCode,
        data: state.contractData,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Submit failed');
    }

    /* نجاح */
    toast(t('submitSuccess'), 'success');
    clearDraft();

    /* شاشة النجاح */
    document.getElementById('roleScreen').innerHTML = `
      <div class="success-box">
        <span class="big-check">✓</span>
        ${t('submitSuccess')}
        <small>${state.currentContractCode}</small>
        <div style="margin-top:25px;">
          <button class="btn gold small" onclick="location.reload()">
            ${t('verifyBtn')}
          </button>
        </div>
      </div>`;
    scrollToTop();

  } catch (err) {
    console.error('Submit error:', err);
    toast(t('submitFailed'), 'error');
    btn.disabled = false;
    btn.textContent = '📨 ' + t('sendContract');
  }
}

/* ============================================================
   المساعدة
============================================================ */
function showHelp() {
  document.getElementById('helpModal').classList.remove('hidden');
}

function closeHelpModal() {
  document.getElementById('helpModal').classList.add('hidden');
}

/* ============================================================
   ربط الأحداث الأولية
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  /* زر التحقق */
  const verifyBtn = document.getElementById('verifyBtn');
  if (verifyBtn) verifyBtn.addEventListener('click', verifyCode);

  /* Enter في حقل الكود */
  const codeInput = document.getElementById('contractCodeInput');
  if (codeInput) {
    codeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') verifyCode();
    });
    /* تحويل تلقائي لحروف كبيرة */
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
  }

  /* زر المساعدة */
  const helpBtn = document.getElementById('helpBtn');
  if (helpBtn) helpBtn.addEventListener('click', showHelp);

  /* زر الإرسال */
  const submitBtn = document.getElementById('submitAllBtn');
  if (submitBtn) submitBtn.addEventListener('click', submitAllParties);
});

/* ============================================================
   Hook لتغيير اللغة (من i18n.js)
============================================================ */
window.onLanguageChanged = function(lang) {
  /* إعادة رسم النموذج إن كان مفتوحاً */
  if (!document.getElementById('inputScreen').classList.contains('hidden')) {
    renderPartyForm();
  }
  /* إعادة رسم قائمة الأطراف */
  if (!document.getElementById('roleScreen').classList.contains('hidden')) {
    renderRolePicker();
  }
};

/* ============================================================
   تصدير الدوال للاستخدام في onclick
============================================================ */
window.verifyCode = verifyCode;
window.savePartyAndReturn = savePartyAndReturn;
window.submitAllParties = submitAllParties;
window.showHelp = showHelp;
window.closeHelpModal = closeHelpModal;
