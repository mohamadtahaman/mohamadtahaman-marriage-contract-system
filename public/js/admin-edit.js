/* ============================================================
   Admin Edit Page — JS (matched to admin-edit.html)
   يقرأ ويعرض ويحفظ بيانات العقد عبر /api/admin
============================================================ */

const editState = {
  password: null,
  username: null,
  role: null,
  contractCode: null,
  contract: null,
  original: null,
  changes: {},
  saving: false,
};

// خريطة: الدور → id الفورم في HTML
const ROLE_FORMS = {
  groom: 'groomForm',
  bride: 'brideForm',
  wali: 'waliForm',
  witness1: 'witness1Form',
  witness2: 'witness2Form',
};

// أسماء حقول المهر في HTML → أسماء الحقول المتوقعة في API
const DOWRY_FIELD_MAP = {
  amountAdvance: 'dowryAdvance',
  amountDeferred: 'dowryDeferred',
  notes: 'dowryNotes',
};

function $(id) { return document.getElementById(id); }

function toast(msg, type = 'success') {
  const box = $('alertBox');
  if (!box) return;
  const cls = type === 'error' ? 'alert-danger'
           : type === 'warning' ? 'alert-warning'
           : 'alert-success';
  box.innerHTML = `<div class="alert ${cls} alert-dismissible fade show">${msg}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
  clearTimeout(box._timer);
  box._timer = setTimeout(() => { box.innerHTML = ''; }, 4500);
}

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
  try { data = JSON.parse(text); }
  catch (e) { throw new Error('استجابة غير صالحة من الخادم'); }
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'خطأ ' + response.status);
  }
  return data;
}

function recordChange(role, key, value) {
  if (!editState.changes[role]) editState.changes[role] = {};
  editState.changes[role][key] = value;
}

function collectPartyData(role) {
  const form = $(ROLE_FORMS[role]);
  const data = {};
  if (form) {
    form.querySelectorAll('[data-field]').forEach(inp => {
      data[inp.dataset.field] = inp.value;
    });
  }
  // نحافظ على قيم waliIsBride/witnessIsCenter من البيانات الأصلية
  // (لا يوجد حقول لتعديلها في HTML الحالي)
  const original =
    (editState.original && editState.original.parties && editState.original.parties[role]) || {};
  data.waliIsBride = !!original.waliIsBride;
  data.witnessIsCenter = !!original.witnessIsCenter;
  return data;
}

function collectGroomDataWithDowry() {
  const data = collectPartyData('groom');
  const dowryForm = $('dowryForm');
  if (dowryForm) {
    dowryForm.querySelectorAll('[data-field]').forEach(inp => {
      const apiKey = DOWRY_FIELD_MAP[inp.dataset.field] || inp.dataset.field;
      data[apiKey] = inp.value;
    });
  }
  return data;
}

function fillForm() {
  const c = editState.contract;
  if (!c) return;

  // كود العقد
  const codeInput = $('contractCode');
  if (codeInput) codeInput.value = c.code || '';

  // تاريخ العقد: API يرجع "DD.MM.YYYY" — HTML يحتاج "YYYY-MM-DD"
  const dateInput = $('contractDate');
  if (dateInput && c.contractDate && typeof c.contractDate === 'string') {
    const parts = c.contractDate.split('.');
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      dateInput.value =
        `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // الحالة
  const statusSelect = $('contractStatus');
  if (statusSelect) statusSelect.value = c.finished ? 'sent' : 'draft';

  // ملء فورمز الأطراف
  Object.keys(ROLE_FORMS).forEach(role => {
    const form = $(ROLE_FORMS[role]);
    if (!form) return;
    const party = (c.parties && c.parties[role]) || {};
    form.querySelectorAll('[data-field]').forEach(inp => {
      const v = party[inp.dataset.field];
      inp.value = (v !== undefined && v !== null) ? v : '';
    });
  });

  // ملء فورم المهر (من بيانات الزوج)
  const groom = (c.parties && c.parties.groom) || {};
  const dowryForm = $('dowryForm');
  if (dowryForm) {
    dowryForm.querySelectorAll('[data-field]').forEach(inp => {
      const apiKey = DOWRY_FIELD_MAP[inp.dataset.field] || inp.dataset.field;
      const v = groom[apiKey];
      inp.value = (v !== undefined && v !== null) ? v : '';
    });
  }
}

function attachListeners() {
  // حقول الأطراف
  Object.keys(ROLE_FORMS).forEach(role => {
    const form = $(ROLE_FORMS[role]);
    if (!form) return;
    form.querySelectorAll('[data-field]').forEach(inp => {
      inp.addEventListener('input', () => recordChange(role, inp.dataset.field, inp.value));
    });
  });

  // حقول المهر
  const dowryForm = $('dowryForm');
  if (dowryForm) {
    dowryForm.querySelectorAll('[data-field]').forEach(inp => {
      inp.addEventListener('input', () => {
        const apiKey = DOWRY_FIELD_MAP[inp.dataset.field] || inp.dataset.field;
        recordChange('dowry', apiKey, inp.value);
      });
    });
  }

  // تاريخ العقد والحالة
  const dateInput = $('contractDate');
  if (dateInput) {
    dateInput.addEventListener('change', () =>
      recordChange('contract', 'date', dateInput.value)
    );
  }
  const statusSelect = $('contractStatus');
  if (statusSelect) {
    statusSelect.addEventListener('change', () =>
      recordChange('contract', 'status', statusSelect.value)
    );
  }

  // زر الحفظ
  const saveBtn = $('saveAllBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveAllChanges);
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1. جلسة الأدمن
  const password = sessionStorage.getItem('admin_password');
  const username = sessionStorage.getItem('admin_username');
  const role = sessionStorage.getItem('admin_role');

  if (!password || !username) {
    toast('يجب تسجيل الدخول للوصول لهذه الصفحة', 'error');
    setTimeout(() => { window.location.href = './admin.html'; }, 1500);
    return;
  }

  if (!['admin', 'manager'].includes(role)) {
    toast('هذه الصفحة متاحة للمشرف والمدير فقط', 'error');
    setTimeout(() => { window.location.href = './admin.html'; }, 1500);
    return;
  }

  editState.password = password;
  editState.username = username;
  editState.role = role;

  // 2. كود العقد من URL
  const params = new URLSearchParams(window.location.search);
  const code = (params.get('code') || '').trim().toUpperCase();

  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    toast('رقم العقد مفقود أو غير صحيح', 'error');
    setTimeout(() => { window.location.href = './admin.html'; }, 1500);
    return;
  }
  editState.contractCode = code;

  // 3. تحميل العقد
  try {
    const data = await apiCall('view', { code });
    if (!data.contract) throw new Error('العقد غير موجود');

    editState.contract = data.contract;
    editState.original = JSON.parse(JSON.stringify(data.contract));

    fillForm();
    attachListeners();
  } catch (err) {
    console.error(err);
    toast('فشل التحميل: ' + err.message, 'error');
  }
});

async function saveAllChanges() {
  if (editState.saving) return;

  const changeKeys = Object.keys(editState.changes);
  if (changeKeys.length === 0) {
    toast('لا توجد تعديلات للحفظ', 'warning');
    return;
  }

  editState.saving = true;
  const btn = $('saveAllBtn');
  const originalHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>جارٍ الحفظ...';
  }

  try {
    // الأطراف اللي اتغيرت (ماعدا contract و dowry)
    const rolesToSave = new Set(
      changeKeys.filter(k => k !== 'contract' && k !== 'dowry')
    );

    // لو المهر اتغير → يُحفظ مع بيانات الزوج في نفس الطلب
    if (editState.changes.dowry) rolesToSave.add('groom');

    for (const role of rolesToSave) {
      const data = role === 'groom'
        ? collectGroomDataWithDowry()
        : collectPartyData(role);

      await apiCall('update_party', {
        code: editState.contractCode,
        role,
        data,
      });
    }

    // حفظ تاريخ العقد + الحالة
    if (editState.changes.contract) {
      const dateVal = $('contractDate') ? $('contractDate').value : '';
      let contractDate = null;
      if (dateVal) {
        const [y, m, d] = dateVal.split('-');
        if (y && m && d) contractDate = `${d}.${m}.${y}`;
      }

      const newStatus = $('contractStatus') ? $('contractStatus').value : undefined;

      await apiCall('update_contract', {
        code: editState.contractCode,
        contract_date: contractDate,
        status: newStatus,
      });
    }

    toast('✓ تم حفظ التعديلات بنجاح', 'success');
    editState.changes = {};

    // إعادة تحميل البيانات من الخادم للتأكد من التطابق
    try {
      const refreshed = await apiCall('view', { code: editState.contractCode });
      if (refreshed.contract) {
        editState.contract = refreshed.contract;
        editState.original = JSON.parse(JSON.stringify(refreshed.contract));
      }
    } catch (e) { /* تجاهل */ }
  } catch (err) {
    console.error(err);
    toast('فشل الحفظ: ' + err.message, 'error');
  } finally {
    editState.saving = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }
}

// تصدير للاستخدام في console أو من HTML
window.saveAllChanges = saveAllChanges;
