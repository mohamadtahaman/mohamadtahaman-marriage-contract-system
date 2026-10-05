/* ============================================================
   Admin Client V11 - Final with Print Support
============================================================ */

const adminState = {
  password: null,
  username: 'admin',
  role: null,
  codes: [],
  contracts: [],
  filteredContracts: [],
  currentTab: 'codes',
  currentContract: null,
};

const ICONS = {
  eye: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  pencil: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  print: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
};

/* ============================================================
   Helpers
============================================================ */
function $(id) { return document.getElementById(id); }

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
    setTimeout(() => msg.classList.add('hidden'), 3500);
  }
}

function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pad2(n) {
  if (n === undefined || n === null || n === '') return '—';
  return String(n).padStart(2, '0');
}

function pad2num(n) {
  return String(n).padStart(2, '0');
}

function formatBirthDate(p) {
  if (!p) return '—';
  if (!p.birthDay || !p.birthMonth || !p.birthYear) return '—';
  return `${pad2(p.birthDay)}.${pad2(p.birthMonth)}.${p.birthYear}`;
}

function resetLoginButton() {
  const btn = $('loginBtn');
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'دخول';
  }
}

/* ============================================================
   Permissions
============================================================ */
function can(permission) {
  const role = adminState.role || 'viewer';
  const permissions = {
    view:   ['admin', 'manager', 'user', 'viewer'],
    edit:   ['admin', 'manager'],
    delete: ['admin', 'manager'],
    export: ['admin', 'manager'],
    manage_users: ['admin'],
    generate_codes: ['admin'],
  };
  return (permissions[permission] || []).includes(role);
}

/* ============================================================
   Login
============================================================ */
async function login() {
  const userInput = $('usernameInput');
  const input = $('passwordInput');
  const btn = $('loginBtn');
  const username = (userInput?.value || 'admin').trim().toLowerCase();
  const password = input.value.trim();

  hideMessage();

  if (!password) {
    showMessage('أدخل كلمة المرور', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'جارٍ التحقق...';

  try {
    const response = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, action: 'login' }),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      showMessage('خطأ في استجابة الخادم', 'error');
      resetLoginButton();
      return;
    }

    if (!response.ok || !data.success) {
      showMessage(data.message || 'فشل الدخول', 'error');
      resetLoginButton();
      return;
    }

    adminState.password = password;
    adminState.username = username;
    adminState.role = data.user?.role || 'user';

    sessionStorage.setItem('admin_password', password);
    sessionStorage.setItem('admin_username', username);
    sessionStorage.setItem('admin_role', adminState.role);

    showPanel();
    await loadList();
    resetLoginButton();

  } catch (err) {
    showMessage('خطأ في الاتصال: ' + err.message, 'error');
    resetLoginButton();
  }
}

/* ============================================================
   Show/Hide
============================================================ */
function showPanel() {
  $('loginScreen').classList.add('hidden');
  $('adminPanel').classList.remove('hidden');
  applyRoleRestrictions();
}

function showLogin() {
  $('loginScreen').classList.remove('hidden');
  $('adminPanel').classList.add('hidden');
  $('passwordInput').value = '';
  hideMessage();
  resetLoginButton();
}

function logout() {
  adminState.password = null;
  adminState.username = 'admin';
  adminState.role = null;
  adminState.codes = [];
  adminState.contracts = [];
  adminState.filteredContracts = [];
  sessionStorage.removeItem('admin_password');
  sessionStorage.removeItem('admin_username');
  sessionStorage.removeItem('admin_role');
  showLogin();
}

function applyRoleRestrictions() {
  const settingsTab = document.querySelector('.admin-tab[data-tab="settings"]');
  if (settingsTab) {
    settingsTab.classList.toggle('hidden', !can('manage_users'));
  }

  const generateBtn = document.querySelector('button[onclick="generateNewCodes()"]');
  if (generateBtn) {
    const card = generateBtn.closest('.card');
    if (card) card.classList.toggle('hidden', !can('generate_codes'));
  }

  const dangerCard = document.querySelector('.card-danger');
  if (dangerCard) {
    dangerCard.classList.toggle('hidden', !can('generate_codes'));
  }
}

/* ============================================================
   API
============================================================ */
async function apiCall(action, extra = {}) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: adminState.username,
      password: adminState.password,
      action,
      ...extra,
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('استجابة غير صالحة');
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
   Tabs
============================================================ */
function switchTab(tab) {
  adminState.currentTab = tab;

  document.querySelectorAll('.admin-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.add('hidden');
  });

  const target = $('tab-' + tab);
  if (target) target.classList.remove('hidden');

  if (tab === 'archive') loadArchiveFromD1();
  if (tab === 'settings') {
    renderSettings();
    loadUsers();
  }
}

/* ✅ جلب الأرشيف من D1 مباشرة */
async function loadArchiveFromD1() {
  const container = $('archiveBody');
  if (!container) return;

  container.innerHTML = '<div class="loading-cell">جارٍ التحميل...</div>';

  try {
    const data = await apiCall('archive');
    adminState.archiveContracts = data.contracts || [];
    adminState.filteredContracts = [...adminState.archiveContracts];
    updateArchiveCount();
    renderArchive();
  } catch (err) {
    container.innerHTML = `<div class="loading-cell" style="color:#c0392b;">
      خطأ: ${escapeHtml(err.message)}
    </div>`;
  }
}

/* ============================================================
   Load List
============================================================ */
async function loadList() {
  const tbody = $('codesBody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">جارٍ التحميل...</td></tr>';

  try {
    const data = await apiCall('list');
    adminState.codes = data.codes || [];
    adminState.contracts = data.contracts || [];
    adminState.filteredContracts = [...adminState.contracts];
    renderTable();
    updateArchiveCount();
  } catch (err) {
    tbody.innerHTML = `
      <tr><td colspan="4" class="loading-cell" style="color:#c0392b;">
        خطأ: ${escapeHtml(err.message)}
      </td></tr>`;
  }
}

/* ============================================================
   Codes Table
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
      : `<span class="status-available">○ متاح (${contract.savedCount || 0}/5)</span>`;

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><span class="code-value">${escapeHtml(contract.code)}</span></td>
      <td>${statusHtml}</td>
      <td class="action-icons">
        <button class="icon-btn view" title="معاينة" onclick="viewContract('${contract.code}')">
          ${ICONS.eye}
        </button>
        <button class="icon-btn print" title="طباعة" onclick="printContractByCode('${contract.code}')">
          ${ICONS.print}
        </button>
        ${contract.inD1 ? `
          <button class="icon-btn edit" title="تعديل" onclick="editContract('${contract.code}')">
            ${ICONS.pencil}
          </button>` : ''}
        ${contract.finished && can('delete') ? `
          <button class="icon-btn delete" title="حذف" onclick="deleteContract('${contract.code}')">
            ${ICONS.trash}
          </button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ============================================================
   Archive
============================================================ */
function updateArchiveCount() {
  const sentCount = adminState.contracts.filter(c => c.finished).length;
  const el = $('archiveCount');
  if (el) el.textContent = sentCount;
}

function renderArchive() {
  const container = $('archiveBody');
  if (!container) return;

  const sentContracts = adminState.filteredContracts.filter(c => c.finished);

  if (sentContracts.length === 0) {
    container.innerHTML = `<div class="loading-cell">لا توجد عقود مُرسلة بعد.</div>`;
    return;
  }

  let html = `
    <table class="archive-table">
      <thead>
        <tr>
          <th style="width:70px; text-align:center;">#</th>
          <th>الزوج</th>
          <th>الزوجة</th>
          <th style="width:140px;">تاريخ العقد</th>
          <th style="width:180px;">إجراءات</th>
        </tr>
      </thead>
      <tbody>
  `;

  sentContracts.forEach((contract, idx) => {
    const groom = contract.parties?.groom;
    const bride = contract.parties?.bride;

    const groomName = groom?.nameDe || groom?.nameAr || '—';
    const brideName = bride?.nameDe || bride?.nameAr || '—';
    const contractDate = contract.contractDate || '—';

    html += `
      <tr>
        <td class="serial-cell">
          <span class="serial-num">${pad2num(idx + 1)}</span>
          <span class="code-sub">${escapeHtml(contract.code)}</span>
        </td>
        <td class="name-cell">${escapeHtml(groomName)}</td>
        <td class="name-cell">${escapeHtml(brideName)}</td>
        <td class="date-cell">${escapeHtml(contractDate)}</td>
        <td class="action-icons">
          <button class="icon-btn view" title="معاينة" onclick="viewContract('${contract.code}')">
            ${ICONS.eye}
          </button>
          <button class="icon-btn print" title="طباعة" onclick="printContractByCode('${contract.code}')">
            ${ICONS.print}
          </button>
          ${can('edit') ? `
            <button class="icon-btn edit" title="تعديل" onclick="editContract('${contract.code}')">
              ${ICONS.pencil}
            </button>` : ''}
          ${can('delete') ? `
            <button class="icon-btn delete" title="حذف" onclick="deleteContract('${contract.code}')">
              ${ICONS.trash}
            </button>` : ''}
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function filterArchive() {
  const query = ($('archiveSearch')?.value || '').trim().toLowerCase();
  const statusFilter = $('archiveFilterStatus')?.value || 'all';

  adminState.filteredContracts = adminState.contracts.filter(contract => {
    if (statusFilter === 'sent' && !contract.finished) return false;
    if (statusFilter === 'pending' && contract.finished) return false;

    if (!query) return true;

    if (contract.code.toLowerCase().includes(query)) return true;

    const parties = contract.parties || {};
    for (const key of Object.keys(parties)) {
      const p = parties[key];
      if (!p) continue;
      if (p.nameDe && String(p.nameDe).toLowerCase().includes(query)) return true;
      if (p.nameAr && String(p.nameAr).toLowerCase().includes(query)) return true;
    }

    return false;
  });

  renderArchive();
}

/* ============================================================
   Settings
============================================================ */
function renderSettings() {
  const sentCount = adminState.contracts.filter(c => c.finished).length;
  const codesCountEl = $('infoCodesCount');
  const sentCountEl = $('infoSentCount');
  if (codesCountEl) codesCountEl.textContent = adminState.codes.length;
  if (sentCountEl) sentCountEl.textContent = sentCount;
}

/* ============================================================
   Change Password
============================================================ */
async function changePassword() {
  const oldPw = $('oldPassword').value.trim();
  const newPw = $('newPassword').value.trim();
  const confirm = $('confirmPassword').value.trim();

  if (!oldPw || !newPw || !confirm) {
    showSystemMessage('جميع الحقول مطلوبة', 'error');
    return;
  }
  if (newPw !== confirm) {
    showSystemMessage('كلمتا المرور غير متطابقتين', 'error');
    return;
  }
  if (newPw.length < 6) {
    showSystemMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
    return;
  }

  try {
    await apiCall('change_password', {
      old_password: oldPw,
      new_password: newPw,
      confirm_password: confirm,
    });
    showSystemMessage('✓ تم تغيير كلمة المرور بنجاح', 'success');
    $('oldPassword').value = '';
    $('newPassword').value = '';
    $('confirmPassword').value = '';
    adminState.password = newPw;
    sessionStorage.setItem('admin_password', newPw);
  } catch (err) {
    showSystemMessage('فشل: ' + err.message, 'error');
  }
}

/* ============================================================
   Users
============================================================ */
async function loadUsers() {
  const tbody = $('usersBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">جارٍ التحميل...</td></tr>';

  try {
    const data = await apiCall('list_users');
    const users = data.users || [];

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">لا يوجد مستخدمون</td></tr>';
      return;
    }

    const roleLabels = {
      admin: 'مشرف',
      manager: 'مدير',
      user: 'مستخدم',
      viewer: 'مشاهدة',
    };

    tbody.innerHTML = '';
    users.forEach(user => {
      const tr = document.createElement('tr');
      const isAdmin = user.username === 'admin';

      tr.innerHTML = `
        <td><code style="font-family:'Courier New',monospace; font-weight:700; color:#2d6a4f;">${escapeHtml(user.username)}</code></td>
        <td>${escapeHtml(user.full_name || '—')}</td>
        <td>${roleLabels[user.role] || user.role}</td>
        <td>${user.is_active ? '<span style="color:#2d6a4f;">✓ نشط</span>' : '<span style="color:#c0392b;">✗ معطّل</span>'}</td>
        <td>
          ${!isAdmin
            ? `<button class="icon-btn delete" title="حذف" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">${ICONS.trash}</button>`
            : '<span style="color:#999;font-size:12px;">محمي</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-cell" style="color:#c0392b;">خطأ: ${escapeHtml(err.message)}</td></tr>`;
  }
}

async function createUser() {
  const username = $('newUsername').value.trim().toLowerCase();
  const password = $('newUserPassword').value.trim();
  const fullName = $('newFullName').value.trim();
  const role = $('newRole').value;

  if (!username || !password) {
    showSystemMessage('اسم المستخدم وكلمة المرور مطلوبان', 'error');
    return;
  }

  try {
    await apiCall('create_user', {
      user_username: username,
      user_password: password,
      full_name: fullName,
      role: role,
    });
    showSystemMessage('✓ تم إنشاء المستخدم', 'success');
    $('newUsername').value = '';
    $('newUserPassword').value = '';
    $('newFullName').value = '';
    $('newRole').value = 'manager';
    await loadUsers();
  } catch (err) {
    showSystemMessage('فشل: ' + err.message, 'error');
  }
}

async function deleteUser(userId, username) {
  if (!confirm(`حذف المستخدم "${username}"؟`)) return;
  try {
    await apiCall('delete_user', { user_id: userId });
    showSystemMessage('✓ تم الحذف', 'success');
    await loadUsers();
  } catch (err) {
    showSystemMessage('فشل: ' + err.message, 'error');
  }
}

/* ============================================================
   Export
============================================================ */
async function exportBackup() {
  try {
    const data = await apiCall('export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contracts-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSystemMessage(`✓ تم تصدير ${data.total} عقد`, 'success');
  } catch (err) {
    showSystemMessage('فشل: ' + err.message, 'error');
  }
}

/* ============================================================
   View Contract
============================================================ */
async function viewContract(code) {
  try {
    const data = await apiCall('view', { code });
    adminState.currentContract = data.contract;
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

  html += `
    <div class="contract-block">
      <div class="contract-block-title">معلومات العقد</div>
      <div class="contract-block-body">
        <div class="contract-row"><strong>الكود:</strong><span>${escapeHtml(contract.code)}</span></div>
        <div class="contract-row"><strong>الحالة:</strong><span>${contract.finished ? 'مُرسل' : 'قيد الانتظار'}</span></div>
        ${contract.contractDate ? `<div class="contract-row"><strong>تاريخ العقد:</strong><span>${escapeHtml(contract.contractDate)}</span></div>` : ''}
        ${contract.finishedAt ? `<div class="contract-row"><strong>تاريخ الإرسال:</strong><span>${new Date(contract.finishedAt).toLocaleString('de-DE')}</span></div>` : ''}
      </div>
    </div>`;

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

  const groom = contract.parties.groom;
  if (groom && (groom.dowryAdvance || groom.dowryDeferred || groom.dowryNotes)) {
    html += `<div class="contract-block gold">
      <div class="contract-block-title">المهر (Brautgabe)</div>
      <div class="contract-block-body">
        <div class="contract-row"><strong>المقدم:</strong><span>${escapeHtml(groom.dowryAdvance || '—')} €</span></div>
        <div class="contract-row"><strong>المؤخر:</strong><span>${escapeHtml(groom.dowryDeferred || '—')} €</span></div>
        <div class="contract-row"><strong>ملاحظات:</strong><span>${escapeHtml(groom.dowryNotes || '—')}</span></div>
      </div>
    </div>`;
  }

  $('modalContent').innerHTML = html;
  $('viewModal').classList.remove('hidden');
}

function renderPartyFields(p, key) {
  const idType = p.idType === 'passport' ? 'جواز سفر' : 'بطاقة هوية';
  const birth = formatBirthDate(p);

  let html = '';
  html += `<div class="contract-row"><strong>الاسم (DE):</strong><span>${escapeHtml(p.nameDe || '—')}</span></div>`;
  html += `<div class="contract-row"><strong>الاسم (AR):</strong><span>${escapeHtml(p.nameAr || '—')}</span></div>`;
  html += `<div class="contract-row"><strong>الميلاد:</strong><span>${birth}</span></div>`;
  html += `<div class="contract-row"><strong>مكان الميلاد:</strong><span>${escapeHtml(p.birthRegion || '—')}, ${escapeHtml(p.birthCountry || '—')}</span></div>`;
  html += `<div class="contract-row"><strong>الهوية:</strong><span>${idType} — ${escapeHtml(p.idNumber || '—')}</span></div>`;
  html += `<div class="contract-row"><strong>العنوان:</strong><span>${escapeHtml(p.addressStreet || '')} ${escapeHtml(p.addressNumber || '')}, ${escapeHtml(p.postalCode || '')} ${escapeHtml(p.city || '')}</span></div>`;

  if (key === 'groom' || key === 'bride') {
    html += `<div class="contract-row"><strong>الأم (DE):</strong><span>${escapeHtml(p.motherNameDe || '—')}</span></div>`;
    html += `<div class="contract-row"><strong>الأم (AR):</strong><span>${escapeHtml(p.motherNameAr || '—')}</span></div>`;
  }

  return html;
}

function closeModal() {
  $('viewModal').classList.add('hidden');
  adminState.currentContract = null;
}

/* ============================================================
   ⭐ PRINT CONTRACT - الطريقة الجديدة
============================================================ */
function printContract() {
  if (!adminState.currentContract) {
    alert('لا يوجد عقد مفتوح');
    return;
  }

  const code = adminState.currentContract.code;
  if (!code) {
    alert('رقم العقد غير معروف');
    return;
  }

  printContractByCode(code);
}

function printContractByCode(code) {
  if (!code) {
    alert('رقم العقد مطلوب');
    return;
  }

  window.open(
    './print-contract.html?code=' + encodeURIComponent(code),
    '_blank'
  );
}

/* ============================================================
   Edit Contract
============================================================ */
async function editContract(code) {
  if (!can('edit')) {
    alert('ليس لديك صلاحية التعديل');
    return;
  }

  window.location.href = `./admin-edit.html?code=${encodeURIComponent(code)}`;
}

/* ============================================================
   Delete
============================================================ */
async function deleteContract(code) {
  if (!can('delete')) {
    alert('ليس لديك صلاحية الحذف');
    return;
  }

  if (!confirm('حذف العقد ' + code + ' نهائياً؟\n\nلا يمكن التراجع.')) return;

  try {
    await apiCall('delete', { code });
    showSystemMessage('✓ تم حذف العقد', 'success');
    await loadList();
    if (adminState.currentTab === 'archive') renderArchive();
  } catch (err) {
    alert('فشل الحذف: ' + err.message);
  }
}

/* ============================================================
   Generate Codes
============================================================ */
async function generateNewCodes() {
  const sentCount = adminState.contracts.filter(c => c.finished).length;
  const pendingCount = adminState.contracts.filter(c => !c.finished && c.savedCount > 0).length;

  // تحذير إذا كانت هناك مسودات غير مكتملة
  if (pendingCount > 0) {
    if (!confirm(
      `⚠️ تنبيه\n\n` +
      `يوجد ${pendingCount} عقد قيد التعبئة (لم يُرسل بعد).\n\n` +
      `إذا ولّدت أكواداً جديدة الآن، ستفقد الوصول لهذه العقود.\n\n` +
      `هل تريد المتابعة؟`
    )) return;
  }

  const msg = sentCount > 0
    ? `توليد 5 أكواد جديدة؟\n\n✅ العقود المُرسلة (${sentCount}) ستبقى في الأرشيف\n✅ الأكواد القديمة لن تعمل بعد الآن`
    : `توليد 5 أكواد جديدة؟\n\n✅ الأكواد القديمة لن تعمل بعد الآن`;

  if (!confirm(msg)) return;

  try {
    const data = await apiCall('generate');
    showSystemMessage('✓ ' + data.message, 'success');
    await loadList();
    if (adminState.currentTab === 'archive') renderArchive();
  } catch (err) {
    alert('فشل التوليد: ' + err.message);
  }
}
/* ============================================================
   Clear Drafts
============================================================ */
async function clearDraftForCode() {
  const input = $('clearDraftCode');
  if (!input) return;

  const code = input.value.trim().toUpperCase();

  if (!code) {
    showSystemMessage('أدخل رقم العقد', 'error');
    return;
  }

  if (!/^[A-Z0-9]{6}$/.test(code)) {
    showSystemMessage('رقم العقد يجب أن يكون 6 خانات بالضبط', 'error');
    return;
  }

  if (!confirm(`مسح كل مسودات العقد ${code}؟\n\n(لن يُحذف العقد إن كان مُرسلاً)`)) return;

  try {
    const data = await apiCall('clear_drafts', { code: code });
    showSystemMessage('✓ ' + data.message, 'success');
    input.value = '';
    await loadList();
  } catch (err) {
    showSystemMessage('فشل: ' + err.message, 'error');
  }
}

async function clearAllDrafts() {
  if (!confirm('⚠️ تحذير خطير\n\nمسح كل المسودات من السيرفر؟\n\n(لن تُحذف العقود المُرسلة)\n\nهل أنت متأكد؟')) return;
  if (!confirm('تأكيد نهائي: مسح كل المسودات؟')) return;

  try {
    const data = await apiCall('clear_drafts', { all: true });
    showSystemMessage('✓ ' + data.message, 'success');
    await loadList();
  } catch (err) {
    showSystemMessage('فشل: ' + err.message, 'error');
  }
}

/* ============================================================
   Refresh
============================================================ */
async function refreshData() {
  await loadList();
  if (adminState.currentTab === 'archive') renderArchive();
  if (adminState.currentTab === 'settings') {
    renderSettings();
    loadUsers();
  }
  showSystemMessage('✓ تم التحديث', 'success');
}

/* ============================================================
   Init
============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  const savedPassword = sessionStorage.getItem('admin_password');
  const savedUsername = sessionStorage.getItem('admin_username') || 'admin';
  const savedRole = sessionStorage.getItem('admin_role');

  if (savedUsername) {
    adminState.username = savedUsername;
    const userInput = $('usernameInput');
    if (userInput) userInput.value = savedUsername;
  }

  if (savedPassword) {
    adminState.password = savedPassword;
    adminState.role = savedRole;

    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: savedUsername,
          password: savedPassword,
          action: 'login',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        adminState.role = data.user?.role || savedRole || 'user';
        sessionStorage.setItem('admin_role', adminState.role);
        showPanel();
        await loadList();
        return;
      }
    } catch (err) {
      console.warn('Auto-login failed:', err);
    }

    sessionStorage.removeItem('admin_password');
    sessionStorage.removeItem('admin_username');
    sessionStorage.removeItem('admin_role');
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
   Exports
============================================================ */
window.login = login;
window.logout = logout;
window.switchTab = switchTab;
window.refreshData = refreshData;
window.viewContract = viewContract;
window.closeModal = closeModal;
window.printContract = printContract;
window.printContractByCode = printContractByCode;
window.editContract = editContract;
window.deleteContract = deleteContract;
window.generateNewCodes = generateNewCodes;
window.clearDraftForCode = clearDraftForCode;
window.clearAllDrafts = clearAllDrafts;
window.filterArchive = filterArchive;
window.changePassword = changePassword;
window.loadUsers = loadUsers;
window.createUser = createUser;
window.deleteUser = deleteUser;
window.exportBackup = exportBackup;
