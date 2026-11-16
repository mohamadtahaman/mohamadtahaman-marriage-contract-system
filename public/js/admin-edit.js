/* ============================================================
   Admin Edit Page — JS (matched to admin-edit.html)
============================================================ */

const editState = {
  password: null, username: null, role: null,
  contractCode: null, contract: null, original: null,
  changes: {}, saving: false,
};

// خريطة: الدور → id الفورم في HTML
const ROLE_FORMS = {
  groom: 'groomForm',
  bride: 'brideForm',
  wali: 'waliForm',
  witness1: 'witness1Form',
  witness2: 'witness2Form',
};

// أسماء حقول المهر في HTML → أسماء الحقول في API
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
      action, ...extra,
    }),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); }
  catch (e) { throw new Error('استجابة غير صالحة من الخادم'); }
  if (!response.ok || !data.success) throw new Error(data.message || 'خطأ ' + response.status);
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
  // (الـ HTML ما فيه حقول لتعديلها، فلو مش موجودة هنمسحها)
  const original = (editState.original && editState.original.parties && editState.original.parties[role]) || {};
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

  $('contractCode').value = c.code || '';

  // API بيرجع التاريخ "DD.MM.YYYY" — HTML محتاج "YYYY-MM-DD"
  if (c.contractDate && typeof c.contractDate === 'string') {
    const parts = c.contractDate.split('.');
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      $('contractDate').value =
        `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  $('contractStatus').value = c.finished ? 'sent' : 'draft';

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
  $('contractDate').addEventListener('change', () => recordChange('contract', 'date', $('contractDate').value));
  $('contractStatus').addEventListener('change', () => recordChange('contract', 'status', $('contractStatus').value));

  // زر الحفظ
  $('saveAllBtn').addEventListener('click', saveAllChanges);
}

document.addEventListener('DOMContentLoaded', async () => {
  const password = sessionStorage.getItem('admin_password');
  const username = sessionStorage.getItem('admin_username');
  const role = sessionStorage.getItem('admin_role');

  if (!password || !username) {
    toast('يجب تسجيل الدخول', 'error');
    setTimeout(() => { window.location.href = './admin.html'; }, 1500);
    return;
  }
  if (!['admin', 'manager'].includes(role)) {
    toast('صلاحيات غير كافية', 'error');
    setTimeout(() => { window.location.href = './admin.html'; }, 1500);
    return;
  }

  editState.password = password;
  editState.username = username;
  editState.role = role;

  const params = new URLSearchParams(window.location.search);
  const code = (params.get('code') || '').trim().toUpperCase();

  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    toast('كود غير صالح', 'error');
    setTimeout(() => { window.location.href = './admin.html'; }, 1500);
    return;
  }
  editState.contractCode = code;

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
    toast('لا توجد تعديلات', 'warning');
    return;
  }

  editState.saving = true;
  const btn = $('saveAllBtn');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>جارٍ الحفظ...';

  try {
    // كل الأدوار اللي اتغيرت (ماعدا contract و dowry)
    const rolesToSave = new Set(
      changeKeys.filter(k => k !== 'contract' && k !== 'dowry')
    );
    // لو المهر اتغير → نضيف groom (بيتبعت مع بعض)
    if (editState.changes.dowry) rolesToSave.add('groom');

    for (const role of rolesToSave) {
      const data = role === 'groom' ? collectGroomDataWithDowry() : collectPartyData(role);
      await apiCall('update_party', {
        code: editState.contractCode,
        role,
        data,
      });
    }

    // حفظ تاريخ العقد + الحالة
    if (editState.changes.contract) {
      const dateVal = $('contractDate').value; // YYYY-MM-DD
      let contractDate = null;
      if (dateVal) {
        const [y, m, d] = dateVal.split('-');
        if (y && m && d) contractDate = `${d}.${m}.${y}`;
      }
      await apiCall('update_contract', {
        code: editState.contractCode,
        contract_date: contractDate,
        status: $('contractStatus').value,
      });
    }

    toast('✓ تم حفظ التعديلات بنجاح', 'success');
    editState.changes = {};

    // إعادة تحميل البيانات للتأكد إن المحفوظ مطابق
    try {
      const refreshed = await apiCall('view', { code: editState.contractCode });
      if (refreshed.contract) {
        editState.contract = refreshed.contract;
        editState.original = JSON.parse(JSON.stringify(refreshed.contract));
      }
    } catch (e) {}
  } catch (err) {
    console.error(err);
    toast('فشل الحفظ: ' + err.message, 'error');
  } finally {
    editState.saving = false;
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}
