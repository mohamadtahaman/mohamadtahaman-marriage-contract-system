/* ============================================================
   Admin Client - Simple & Debuggable
============================================================ */

const adminState = {
  password: null,
  codes: [],
  contracts: [],
};

/* ============================================================
   أدوات مساعدة
============================================================ */
function $(id) {
  return document.getElementById(id);
}

function showMessage(text, type) {
  const msg = $('loginMessage');
  if (!msg) return;
  msg.textContent = text;
  msg.className = 'message ' + type;
  msg.classList.remove('hidden');
}

function hideMessage() {
  const msg = $('loginMessage');
  if (msg) msg.classList.add('hidden');
}

function showSystemMessage(text, type) {
  const msg = $('systemMessage');
  if (!msg) return;
  msg.textContent = text;
  msg.className = 'system-message ' + type;
  msg.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => msg.classList.add('hidden'), 3000);
  }
}

/* ============================================================
   تسجيل الدخول
============================================================ */
async function login() {
  const input = $('passwordInput');
  const btn = $('loginBtn');
  const password = input.value.trim();

  hideMessage();

  if (!password) {
    showMessage('أدخل كلمة المرور', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'جارٍ التحقق...';
  adminState.password = password;

  try {
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: password,
        action: 'login',
      }),
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      showMessage('خطأ: الخادم لم يُرجع JSON صالح. الرد: ' + text.substring(0, 100), 'error');
      btn.disabled = false;
      btn.textContent = 'دخول';
      return;
    }

    if (!response.ok || !data.success) {
      showMessage(data.message || 'فشل الدخول (كود ' + response.status + ')', 'error');
      btn.disabled = false;
      btn.textContent = 'دخول';
      adminState.password = null;
      return;
    }

    /* نجاح */
    sessionStorage.setItem('admin_password', password);
    showPanel();
    await loadList();

  } catch (err) {
    showMessage('خطأ في الاتصال: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'دخول';
  }
}

/* ============================================================
   العرض
============================================================ */
function showPanel() {
  $('loginScreen').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
}

function showLogin() {
  $('loginScreen').classList.remove('hidden');
  $('adminPanel').classList.add('hidden');
  $('passwordInput').value = '';
  hideMessage();
}

/* ============================================================
   خروج
============================================================ */
function logout() {
  adminState.password = null;
  adminState.codes = [];
  adminState.contracts = [];
  sessionStorage.removeItem('admin_password');
  showLogin();
}

/* ============================================================
   الاتصال بالـ API
============================================================ */
async function apiCall(action, extra = {}) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: adminState.password,
      action: action,
      ...extra,
    }),
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('رد غير صالح من الخادم: ' + text.substring(0, 100));
  }

  if (!response.ok || !data.success) {
    if (data.error === 'wrong_password' || data.error === 'missing_password') {
      logout();
    }
    throw new Error(data.message || 'خطأ ' + response.status);
  }

  return data;
}

/* ============================================================
   تحميل قائمة الأكواد
============================================================ */
async function loadList() {
  const tbody = $('codesBody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">جارٍ التحميل...</td></tr>';

  try {
    const data = await apiCall('list');
    adminState.codes = data.codes || [];
    adminState.contracts = data.contracts || [];
    renderTable();
  } catch (err) {
    tbody.innerHTML = `
      <tr><td colspan="4" class="loading-cell" style="color:#a8332a;">
        خطأ: ${err.message}
      </td></tr>`;
  }
}

/* ============================================================
   رسم الجدول
============================================================ */
function renderTable() {
  const tbody = $('codesBody');
  tbody.innerHTML = '';

  if (!adminState.contracts || adminState.contracts.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="4" class="loading-cell">
        لا توجد أكواد. اضغط "توليد 5 أكواد جديدة".
      </td></tr>`;
    return;
  }

  adminState.contracts.forEach((contract, idx) => {
    const tr = document.createElement('tr');

    const statusHtml = contract.finished
      ? '<span class="status-sent">● مُرسل</span>'
      : '<span class="status-available">○ متاح</span>';

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><span class="code-value">${contract.code}</span></td>
      <td>${statusHtml}</td>
      <td>
        <button class="btn-action" onclick="viewContract('${contract.code}')">معاينة</button>
        ${contract.finished ? `<button class="btn-action danger" onclick="deleteContract('${contract.code}')">حذف</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ============================================================
   عرض عقد
============================================================ */
async function viewContract(code) {
  try {
    const data = await apiCall('view', { code });
    renderContractModal(data.contract);
  } catch (err) {
    alert('فشل العرض: ' + err.message);
  }
}

function renderContractModal(contract) {
  $('modalTitle').textContent = 'تفاصيل العقد: ' + contract.code;

  const partyLabels = {
    groom: 'الزوج',
    bride: 'الزوجة',
    wali: 'الولي',
    witness1: 'الشاهد الأول',
    witness2: 'الشاهد الثاني',
  };

  let html = '';

  /* معلومات العقد */
  html += `<div class="contract-block">
    <div class="contract-block-title">معلومات العقد</div>
    <div class="contract-block-body">
      <div class="contract-row"><strong>الكود:</strong><span>${contract.code}</span></div>
      <div class="contract-row"><strong>الحالة:</strong><span>${contract.finished ? 'مُرسل' : 'قيد الانتظار'}</span></div>
      ${contract.finishedAt ? `<div class="contract-row"><strong>تاريخ الإرسال:</strong><span>${new Date(contract.finishedAt).toLocaleString('de-DE')}</span></div>` : ''}
    </div>
  </div>`;

  /* الأطراف */
  ['groom', 'bride', 'wali', 'witness1', 'witness2'].forEach(key => {
    const p = contract.parties[key];

    html += `<div class="contract-block">
      <div class="contract-block-title">${partyLabels[key]}</div>
      <div class="contract-block-body">`;

    if (!p) {
      html += `<div style="color:#999;font-style:italic;">لم يُعبّأ بعد</div>`;
    } else if (key === 'wali' && p.waliIsBride) {
      html += `<div class="contract-row"><strong>الحالة:</strong><span>الولي هي الزوجة نفسها</span></div>`;
    } else if ((key === 'witness1' || key === 'witness2') && p.witnessIsCenter) {
      html += `<div class="contract-row"><strong>الحالة:</strong><span>الشاهد طرف المركز</span></div>`;
    } else {
      html += renderPartyFields(p, key);
    }

    html += `</div></div>`;
  });

  /* المهر */
  const groom = contract.parties.groom;
  if (groom && (groom.dowryAdvance || groom.dowryDeferred || groom.dowryNotes)) {
    html += `<div class="contract-block">
      <div class="contract-block-title">المهر (Brautgabe)</div>
      <div class="contract-block-body">
        <div class="contract-row"><strong>المقدم:</strong><span>${groom.dowryAdvance || '—'} €</span></div>
        <div class="contract-row"><strong>المؤخر:</strong><span>${groom.dowryDeferred || '—'} €</span></div>
        <div class="contract-row"><strong>ملاحظات:</strong><span>${groom.dowryNotes || '—'}</span></div>
      </div>
    </div>`;
  }

  $('modalContent').innerHTML = html;
  $('viewModal').classList.remove('hidden');
}

function renderPartyFields(p, key) {
  const idType = p.idType === 'passport' ? 'جواز سفر' : 'بطاقة هوية';
  const birth = ((p.birthDay || '').padStart(2, '0')) + '.' +
                ((p.birthMonth || '').padStart(2, '0')) + '.' +
                (p.birthYear || '');

  let html = '';
  html += `<div class="contract-row"><strong>الاسم (DE):</strong><span>${p.nameDe || '—'}</span></div>`;
  html += `<div class="contract-row"><strong>الاسم (AR):</strong><span>${p.nameAr || '—'}</span></div>`;
  html += `<div class="contract-row"><strong>الميلاد:</strong><span>${birth === '..' ? '—' : birth}</span></div>`;
  html += `<div class="contract-row"><strong>مكان الميلاد:</strong><span>${p.birthRegion || '—'}, ${p.birthCountry || '—'}</span></div>`;
  html += `<div class="contract-row"><strong>الهوية:</strong><span>${idType} — ${p.idNumber || '—'}</span></div>`;
  html += `<div class="contract-row"><strong>العنوان:</strong><span>${p.addressStreet || ''} ${p.addressNumber || ''}, ${p.postalCode || ''} ${p.city || ''}</span></div>`;

  if (key === 'groom' || key === 'bride') {
    html += `<div class="contract-row"><strong>الأم (DE):</strong><span>${p.motherNameDe || '—'}</span></div>`;
    html += `<div class="contract-row"><strong>الأم (AR):</strong><span>${p.motherNameAr || '—'}</span></div>`;
  }

  return html;
}

function closeModal() {
  $('viewModal').classList.add('hidden');
}

/* ============================================================
   حذف عقد
============================================================ */
async function deleteContract(code) {
  if (!confirm('حذف العقد ' + code + ' نهائياً؟')) return;

  try {
    await apiCall('delete', { code });
    showSystemMessage('تم حذف العقد بنجاح', 'success');
    await loadList();
  } catch (err) {
    alert('فشل الحذف: ' + err.message);
  }
}

/* ============================================================
   توليد أكواد جديدة
============================================================ */
async function generateNewCodes() {
  if (!confirm('سيتم حذف الأكواد الحالية وكل العقود المرتبطة بها.\n\nهل أنت متأكد؟')) {
    return;
  }

  try {
    const data = await apiCall('generate');
    showSystemMessage('✓ ' + (data.message || 'تم توليد 5 أكواد جديدة'), 'success');
    await loadList();
  } catch (err) {
    alert('فشل التوليد: ' + err.message);
  }
}

/* ============================================================
   مسح المسودات المحلية
============================================================ */
function clearLocalDrafts() {
  if (!confirm('مسح المسودات المحفوظة على هذا المتصفح؟')) return;

  let count = 0;
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('draft_')) {
      localStorage.removeItem(k);
      count++;
    }
  });

  showSystemMessage('✓ تم مسح ' + count + ' مسودة', 'success');
}

/* ============================================================
   تحديث
============================================================ */
async function refreshData() {
  await loadList();
  showSystemMessage('✓ تم التحديث', 'success');
}

/* ============================================================
   التهيئة
============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const savedPassword = sessionStorage.getItem('admin_password');

  if (savedPassword) {
    adminState.password = savedPassword;
    try {
      await apiCall('login');
      showPanel();
      await loadList();
      return;
    } catch (err) {
      adminState.password = null;
      sessionStorage.removeItem('admin_password');
    }
  }

  showLogin();

  const input = $('passwordInput');
  const btn = $('loginBtn');

  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') login();
    });
  }
  if (btn) {
    btn.addEventListener('click', login);
  }
});

/* ============================================================
   تصدير
============================================================ */
window.login = login;
window.logout = logout;
window.refreshData = refreshData;
window.viewContract = viewContract;
window.closeModal = closeModal;
window.deleteContract = deleteContract;
window.generateNewCodes = generateNewCodes;
window.clearLocalDrafts = clearLocalDrafts;
