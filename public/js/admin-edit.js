/* ============================================================
   Admin Edit Page - JS
   تعديل بيانات العقد في D1
============================================================ */

const editState = {
  password: null,
  username: null,
  role: null,
  contractCode: null,
  contract: null,
  original: null,
  currentTab: 'groom',
  changes: {},
  saving: false,
};

const PARTY_LABELS = {
  groom: 'الزوج',
  bride: 'الزوجة',
  wali: 'الولي',
  witness1: 'الشاهد الأول',
  witness2: 'الشاهد الثاني',
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
  return String(n || '').padStart(2, '0');
}

function toast(msg, type = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3000);
}

function showError(title, msg) {
  $('loadingScreen').classList.add('hidden');
  $('editScreen').classList.add('hidden');
  $('errorScreen').classList.remove('hidden');
  $('errorTitle').textContent = title;
  $('errorMessage').textContent = msg;
}

function confirmDialog(title, msg) {
  return new Promise((resolve) => {
    $('confirmTitle').textContent = title;
    $('confirmMessage').textContent = msg;
    $('confirmModal').classList.remove('hidden');

    const yes = $('confirmYes');
    const no = $('confirmNo');

    const cleanup = () => {
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      $('confirmModal').classList.add('hidden');
    };

    const onYes = () => { cleanup(); resolve(true); };
    const onNo = () => { cleanup(); resolve(false); };

    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
  });
}

/* ============================================================
   API Call
============================================================ */
async function apiCall(action, extra = {}) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: editState.username,
      password: editState.password,
      action,
      ...extra,
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('استجابة غير صالحة من الخادم');
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'خطأ ' + response.status);
  }

  return data;
}

/* ============================================================
   Init
============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. جلب بيانات الجلسة
  const password = sessionStorage.getItem('admin_password');
  const username = sessionStorage.getItem('admin_username');
  const role = sessionStorage.getItem('admin_role');

  if (!password || !username) {
    showError('يجب تسجيل الدخول', 'يجب تسجيل الدخول للوصول لهذه الصفحة');
    setTimeout(() => {
      window.location.href = './admin.html';
    }, 2000);
    return;
  }

  editState.password = password;
  editState.username = username;
  editState.role = role;

  // 2. التحقق من الصلاحية
  if (!['admin', 'manager'].includes(role)) {
    showError('صلاحيات غير كافية', 'هذه الصفحة متاحة للمشرف والمدير فقط');
    setTimeout(() => {
      window.location.href = './admin.html';
    }, 2000);
    return;
  }

  // 3. جلب كود العقد من URL
  const params = new URLSearchParams(window.location.search);
  const code = (params.get('code') || '').trim().toUpperCase();

  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    showError('كود غير صالح', 'رقم العقد مفقود أو غير صحيح');
    setTimeout(() => {
      window.location.href = './admin.html';
    }, 2000);
    return;
  }

  editState.contractCode = code;

  // 4. تحميل العقد
  try {
    const data = await apiCall('view', { code });

    if (!data.contract) {
      throw new Error('العقد غير موجود');
    }

    editState.contract = JSON.parse(JSON.stringify(data.contract));
    editState.original = JSON.parse(JSON.stringify(data.contract));

    // عرض الصفحة
    $('loadingScreen').classList.add('hidden');
    $('editScreen').classList.remove('hidden');

    // تحديث الهيدر
    $('editCode').textContent = code;
    const statusEl = $('editStatus');
    if (editState.contract.finished) {
      statusEl.textContent = '● مُرسل';
      statusEl.classList.add('sent');
    } else {
      statusEl.textContent = '○ قيد الانتظار';
    }

    // عرض التبويب الأول
    renderCurrentTab();

  } catch (err) {
    console.error(err);
    showError('فشل التحميل', err.message);
  }
});

/* ============================================================
   Switch Tab
============================================================ */
function switchEditTab(tab) {
  editState.currentTab = tab;

  document.querySelectorAll('.edit-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  renderCurrentTab();
}

/* ============================================================
   Render Current Tab
============================================================ */
function renderCurrentTab() {
  const tab = editState.currentTab;
  const content = $('editContent');

  if (tab === 'dowry') {
    content.innerHTML = renderDowryForm();
  } else if (tab === 'contract') {
    content.innerHTML = renderContractForm();
  } else {
    content.innerHTML = renderPartyForm(tab);
  }

  attachFormHandlers();
  updateSaveButton();
}

/* ============================================================
   Render Party Form
============================================================ */
function renderPartyForm(role) {
  const party = editState.contract.parties[role] || emptyParty();

  const isWali = role === 'wali';
  const isWitness = role === 'witness1' || role === 'witness2';
  const isSpouse = role === 'groom' || role === 'bride';

  // الولي = الزوجة
  if (isWali && party.waliIsBride) {
    return `
      <div class="edit-special-box">
        <input type="checkbox" id="editWaliIsBride" checked>
        <label for="editWaliIsBride">الولي هي الزوجة نفسها</label>
      </div>
      <div class="edit-empty">
        <p>✓ الولي هي الزوجة نفسها</p>
        <p style="font-size:12px; margin-top:10px;">لا توجد بيانات إضافية مطلوبة</p>
      </div>
    `;
  }

  // الشاهد = طرف المركز
  if (isWitness && party.witnessIsCenter) {
    return `
      <div class="edit-special-box">
        <input type="checkbox" id="editWitnessIsCenter" checked>
        <label for="editWitnessIsCenter">الشاهد طرف مركز الرسالة</label>
      </div>
      <div class="edit-empty">
        <p>✓ الشاهد طرف المركز</p>
        <p style="font-size:12px; margin-top:10px;">لا توجد بيانات إضافية مطلوبة</p>
      </div>
    `;
  }

  let html = `<div class="edit-section-title">👤 بيانات ${PARTY_LABELS[role]}</div>`;

  html += `<div class="edit-grid">`;

  // الأسماء
  html += `
    <div class="edit-field" data-field="nameDe">
      <label>الاسم بالألمانية <span class="req">*</span></label>
      <input type="text" data-k="nameDe" value="${escapeHtml(party.nameDe || '')}">
    </div>
    <div class="edit-field" data-field="nameAr">
      <label>الاسم بالعربي</label>
      <input type="text" data-k="nameAr" value="${escapeHtml(party.nameAr || '')}">
    </div>
  `;

  // تاريخ الميلاد
  html += `
    <div class="edit-field full" data-field="birthDate">
      <label>تاريخ الميلاد <span class="req">*</span></label>
      <div class="edit-date-selects">
        <select data-k="birthDay">${buildDayOptions(party.birthDay)}</select>
        <select data-k="birthMonth">${buildMonthOptions(party.birthMonth)}</select>
        <select data-k="birthYear">${buildYearOptions(party.birthYear)}</select>
      </div>
    </div>
  `;

  // مكان الميلاد
  html += `
    <div class="edit-field" data-field="birthCountry">
      <label>مكان الميلاد - البلد <span class="req">*</span></label>
      <input type="text" data-k="birthCountry" value="${escapeHtml(party.birthCountry || '')}">
    </div>
    <div class="edit-field" data-field="birthRegion">
      <label>مكان الميلاد - المنطقة <span class="req">*</span></label>
      <input type="text" data-k="birthRegion" value="${escapeHtml(party.birthRegion || '')}">
    </div>
  `;

  // الهوية
  html += `
    <div class="edit-field" data-field="idType">
      <label>نوع الهوية</label>
      <select data-k="idType">
        <option value="id" ${party.idType === 'id' ? 'selected' : ''}>بطاقة هوية</option>
        <option value="passport" ${party.idType === 'passport' ? 'selected' : ''}>جواز سفر</option>
      </select>
    </div>
    <div class="edit-field" data-field="idNumber">
      <label>رقم الهوية <span class="req">*</span></label>
      <input type="text" data-k="idNumber" value="${escapeHtml(party.idNumber || '')}">
    </div>
  `;

  // العنوان
  html += `
    <div class="edit-field" data-field="addressNumber">
      <label>رقم الشارع</label>
      <input type="text" data-k="addressNumber" value="${escapeHtml(party.addressNumber || '')}">
    </div>
    <div class="edit-field" data-field="addressStreet">
      <label>اسم الشارع</label>
      <input type="text" data-k="addressStreet" value="${escapeHtml(party.addressStreet || '')}">
    </div>
    <div class="edit-field" data-field="postalCode">
      <label>الرمز البريدي</label>
      <input type="text" data-k="postalCode" value="${escapeHtml(party.postalCode || '')}">
    </div>
    <div class="edit-field" data-field="city">
      <label>المدينة</label>
      <input type="text" data-k="city" value="${escapeHtml(party.city || '')}">
    </div>
  `;

  // الأم (للزوجين)
  if (isSpouse) {
    html += `
      <div class="edit-field" data-field="motherNameDe">
        <label>اسم الأم بالألمانية <span class="req">*</span></label>
        <input type="text" data-k="motherNameDe" value="${escapeHtml(party.motherNameDe || '')}">
      </div>
      <div class="edit-field" data-field="motherNameAr">
        <label>اسم الأم بالعربي</label>
        <input type="text" data-k="motherNameAr" value="${escapeHtml(party.motherNameAr || '')}">
      </div>
    `;
  }

  html += `</div>`; // end edit-grid

  // خيارات خاصة
  if (isWali) {
    html += `
      <div class="edit-special-box" style="margin-top:20px;">
        <input type="checkbox" id="editWaliIsBride" ${party.waliIsBride ? 'checked' : ''}>
        <label for="editWaliIsBride">الولي هي الزوجة نفسها</label>
      </div>
    `;
  }

  if (isWitness) {
    html += `
      <div class="edit-special-box" style="margin-top:20px;">
        <input type="checkbox" id="editWitnessIsCenter" ${party.witnessIsCenter ? 'checked' : ''}>
        <label for="editWitnessIsCenter">الشاهد طرف مركز الرسالة</label>
      </div>
    `;
  }

  return html;
}

/* ============================================================
   Render Dowry Form
============================================================ */
function renderDowryForm() {
  const groom = editState.contract.parties.groom || {};

  return `
    <div class="edit-section-title">💰 تفاصيل المهر (Brautgabe)</div>
    <div class="edit-grid">
      <div class="edit-field" data-field="dowryAdvance">
        <label>المهر المقدم (€)</label>
        <input type="number" min="0" step="1" data-k="dowryAdvance" value="${escapeHtml(groom.dowryAdvance || '')}" placeholder="0">
      </div>
      <div class="edit-field" data-field="dowryDeferred">
        <label>المهر المؤخر (€)</label>
        <input type="number" min="0" step="1" data-k="dowryDeferred" value="${escapeHtml(groom.dowryDeferred || '')}" placeholder="0">
      </div>
      <div class="edit-field full" data-field="dowryNotes">
        <label>ملاحظات المهر</label>
        <textarea data-k="dowryNotes" placeholder="أي ملاحظات إضافية...">${escapeHtml(groom.dowryNotes || '')}</textarea>
      </div>
    </div>
  `;
}

/* ============================================================
   Render Contract Form (Date + status)
============================================================ */
function renderContractForm() {
  const date = editState.contract.contractDate || '';
  let day = '', month = '', year = '';

  if (date && date.includes('.')) {
    const parts = date.split('.');
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  return `
    <div class="edit-section-title">📋 بيانات العقد</div>

    <div class="edit-grid">
      <div class="edit-field full" data-field="contractDate">
        <label>تاريخ العقد <span class="req">*</span></label>
        <div class="edit-date-selects">
          <select data-k="contractDay">${buildDayOptions(day)}</select>
          <select data-k="contractMonth">${buildMonthOptions(month)}</select>
          <select data-k="contractYear" data-type="contract">${buildYearOptions(year, false)}</select>
        </div>
      </div>

      <div class="edit-field full">
        <label>حالة العقد</label>
        <input type="text" value="${editState.contract.finished ? 'مُرسل' : 'قيد الانتظار'}" disabled style="background:#f5f5f5; cursor:not-allowed;">
      </div>

      ${editState.contract.finishedAt ? `
        <div class="edit-field full">
          <label>تاريخ الإرسال</label>
          <input type="text" value="${new Date(editState.contract.finishedAt).toLocaleString('de-DE')}" disabled style="background:#f5f5f5; cursor:not-allowed;">
        </div>
      ` : ''}
    </div>
  `;
}

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
   Date Dropdowns
============================================================ */
function buildDayOptions(selected) {
  let html = '<option value="">اليوم</option>';
  for (let d = 1; d <= 31; d++) {
    html += `<option value="${d}" ${String(d) === String(selected) ? 'selected' : ''}>${d}</option>`;
  }
  return html;
}

function buildMonthOptions(selected) {
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  let html = '<option value="">الشهر</option>';
  months.forEach((name, i) => {
    const m = i + 1;
    html += `<option value="${m}" ${String(m) === String(selected) ? 'selected' : ''}>${name}</option>`;
  });
  return html;
}

function buildYearOptions(selected, isBirth = true) {
  const currentYear = new Date().getFullYear();
  let min, max;
  if (isBirth) {
    max = currentYear - 18;
    min = currentYear - 100;
  } else {
    min = currentYear - 5;
    max = currentYear + 1;
  }
  let html = '<option value="">السنة</option>';
  for (let y = max; y >= min; y--) {
    html += `<option value="${y}" ${String(y) === String(selected) ? 'selected' : ''}>${y}</option>`;
  }
  return html;
}

/* ============================================================
   Attach Handlers
============================================================ */
function attachFormHandlers() {
  // حقول عادية
  document.querySelectorAll('#editContent [data-k]').forEach(inp => {
    const key = inp.dataset.k;

    inp.addEventListener('input', () => {
      recordChange(key, inp.value);
      markFieldAsChanged(inp);
    });

    inp.addEventListener('change', () => {
      recordChange(key, inp.value);
      markFieldAsChanged(inp);
    });
  });

  // خيار الولي
  const waliCheck = $('editWaliIsBride');
  if (waliCheck) {
    waliCheck.addEventListener('change', () => {
      const role = editState.currentTab;
      if (!editState.contract.parties[role]) {
        editState.contract.parties[role] = emptyParty();
      }
      editState.contract.parties[role].waliIsBride = waliCheck.checked;
      markChanged(role);
      renderCurrentTab();
    });
  }

  // خيار الشاهد
  const witnessCheck = $('editWitnessIsCenter');
  if (witnessCheck) {
    witnessCheck.addEventListener('change', () => {
      const role = editState.currentTab;
      if (!editState.contract.parties[role]) {
        editState.contract.parties[role] = emptyParty();
      }
      editState.contract.parties[role].witnessIsCenter = witnessCheck.checked;
      markChanged(role);
      renderCurrentTab();
    });
  }
}

/* ============================================================
   Record Change
============================================================ */
function recordChange(key, value) {
  const tab = editState.currentTab;

  if (tab === 'dowry') {
    if (!editState.changes.dowry) editState.changes.dowry = {};
    editState.changes.dowry[key] = value;

    if (!editState.contract.parties.groom) {
      editState.contract.parties.groom = emptyParty();
    }
    editState.contract.parties.groom[key] = value;

  } else if (tab === 'contract') {
    if (!editState.changes.contract) editState.changes.contract = {};

    if (key === 'contractDay') editState.changes.contract.day = value;
    if (key === 'contractMonth') editState.changes.contract.month = value;
    if (key === 'contractYear') editState.changes.contract.year = value;

  } else {
    // طرف عادي
    if (!editState.contract.parties[tab]) {
      editState.contract.parties[tab] = emptyParty();
    }
    editState.contract.parties[tab][key] = value;

    if (!editState.changes[tab]) editState.changes[tab] = {};
    editState.changes[tab][key] = value;
  }

  updateSaveButton();
}

function markFieldAsChanged(inp) {
  const wrapper = inp.closest('.edit-field');
  if (wrapper) wrapper.classList.add('changed');
}

function markChanged(tab) {
  const tabEl = document.querySelector(`.edit-tab[data-tab="${tab}"]`);
  if (tabEl) tabEl.classList.add('changed');

  if (!editState.changes[tab]) editState.changes[tab] = {};
  updateSaveButton();
}

/* ============================================================
   Update Save Button
============================================================ */
function updateSaveButton() {
  const hasChanges = Object.keys(editState.changes).some(k => {
    const val = editState.changes[k];
    return val && typeof val === 'object' && Object.keys(val).length > 0;
  });

  const btn = $('saveBtn');
  btn.disabled = !hasChanges || editState.saving;
}

/* ============================================================
   Save All Changes
============================================================ */
async function saveAllChanges() {
  if (editState.saving) return;

  const hasChanges = Object.keys(editState.changes).some(k => {
    const val = editState.changes[k];
    return val && typeof val === 'object' && Object.keys(val).length > 0;
  });

  if (!hasChanges) {
    toast('لا توجد تعديلات', 'warning');
    return;
  }

  const ok = await confirmDialog(
    'حفظ التعديلات',
    'هل تريد حفظ كل التعديلات في قاعدة البيانات؟'
  );

  if (!ok) return;

  editState.saving = true;
  const btn = $('saveBtn');
  btn.disabled = true;
  btn.textContent = '⏳ جارٍ الحفظ...';

  try {
    const changes = editState.changes;
    const roleChanges = [];
    let contractDateChange = null;

    // جمع الأطراف المتغيرة
    for (const key of Object.keys(changes)) {
      if (key === 'contract') {
        contractDateChange = changes[key];
      } else if (key === 'dowry') {
        // سيُحفظ مع الزوج
      } else {
        // طرف
        roleChanges.push({ role: key, data: editState.contract.parties[key] });
      }
    }

    // إذا يوجد تغييرات في المهر → أضفها إلى الزوج
    if (changes.dowry) {
      const groomData = editState.contract.parties.groom || emptyParty();
      roleChanges.push({ role: 'groom', data: groomData });
    }

    // حفظ الأطراف
    for (const { role, data } of roleChanges) {
      await apiCall('update_party', {
        code: editState.contractCode,
        role,
        data,
      });
    }

    // حفظ تاريخ العقد
    if (contractDateChange) {
      const { day, month, year } = contractDateChange;
      const contractDate = `${pad2(day)}.${pad2(month)}.${year}`;

      await apiCall('update_contract', {
        code: editState.contractCode,
        contract_date: contractDate,
      });
    }

    toast('✓ تم حفظ التعديلات بنجاح', '');
    editState.changes = {};

    // إزالة علامات التغيير
    document.querySelectorAll('.edit-tab').forEach(t => t.classList.remove('changed'));
    document.querySelectorAll('.edit-field.changed').forEach(f => f.classList.remove('changed'));

    updateSaveButton();

  } catch (err) {
    console.error(err);
    toast('فشل الحفظ: ' + err.message, 'error');
  } finally {
    editState.saving = false;
    btn.textContent = '💾 حفظ كل التعديلات';
    updateSaveButton();
  }
}

/* ============================================================
   Exports
============================================================ */
window.switchEditTab = switchEditTab;
window.saveAllChanges = saveAllChanges;
