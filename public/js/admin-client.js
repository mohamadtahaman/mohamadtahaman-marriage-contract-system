/* ============================================================
   Admin Client V3 - With D1 Support & Bug Fixes
============================================================ */

const adminState = {
  password: null,
  codes: [],
  contracts: [],
  filteredContracts: [],
  currentTab: 'codes',
  currentContract: null,
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

// ✅ إصلاح: تحويل أي قيمة إلى String قبل padStart
function pad2(n) {
  if (n === undefined || n === null || n === '') return '—';
  return String(n).padStart(2, '0');
}

function formatBirthDate(p) {
  if (!p) return '—';
  if (!p.birthDay || !p.birthMonth || !p.birthYear) return '—';
  return `${pad2(p.birthDay)}.${pad2(p.birthMonth)}.${p.birthYear}`;
}

/* ============================================================
   Login
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
      body: JSON.stringify({ password, action: 'login' }),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      showMessage('خطأ في استجابة الخادم', 'error');
      btn.disabled = false;
      btn.textContent = 'دخول';
      return;
    }

    if (!response.ok || !data.success) {
      showMessage(data.message || 'فشل الدخول', 'error');
      btn.disabled = false;
      btn.textContent = 'دخول';
      adminState.password = null;
      return;
    }

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
   Show/Hide Panel
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

function logout() {
  adminState.password = null;
  adminState.codes = [];
  adminState.contracts = [];
  adminState.filteredContracts = [];
  sessionStorage.removeItem('admin_password');
  showLogin();
}

/* ============================================================
   API
============================================================ */
async function apiCall(action, extra = {}) {
  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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

  if (tab === 'archive') renderArchive();
  if (tab === 'settings') renderSettings();
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
   Render Codes Table
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
      <td><span class="code-value">${escapeHtml(contract.code)}</span></td>
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

  let html = '<div class="archive-grid">';

  sentContracts.forEach(contract => {
    const groom = contract.parties?.groom;
    const bride = contract.parties?.bride;

    const groomName = groom?.nameDe || groom?.nameAr || '—';
    const brideName = bride?.nameDe || bride?.nameAr || '—';

    html += `
      <div class="archive-item">
        <div class="archive-item-info">
          <div class="archive-item-code">${escapeHtml(contract.code)}</div>
          <div class="archive-item-names">
            <strong>الزوج:</strong> ${escapeHtml(groomName)}<br>
            <strong>الزوجة:</strong> ${escapeHtml(brideName)}
          </div>
          <div class="archive-item-meta">
            ● مُرسل${contract.contractDate ? ' — ' + escapeHtml(contract.contractDate) : ''}
          </div>
        </div>
        <div class="archive-item-actions">
          <button class="btn-action gold" onclick="viewContract('${contract.code}')">معاينة</button>
          <button class="btn-action danger" onclick="deleteContract('${contract.code}')">حذف</button>
        </div>
      </div>
    `;
  });

  html += '</div>';
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

function printContract() {
  window.print();
}

/* ============================================================
   Delete Contract
============================================================ */
async function deleteContract(code) {
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
   Generate New Codes
============================================================ */
async function generateNewCodes() {
  const sentCount = adminState.contracts.filter(c => c.finished).length;

  if (sentCount > 0) {
    if (!confirm(`⚠️ تحذير: يوجد ${sentCount} عقد مُرسل.\n\nتوليد أكواد جديدة سيمسح كل العقود السابقة (من KV و D1).\n\nهل أنت متأكد؟`)) return;
  }

  if (!confirm('⚠️ سيتم حذف الأكواد الحالية وكل العقود المرتبطة بها من قاعدة البيانات.\n\nهل أنت متأكد؟')) return;

  try {
    const data = await apiCall('generate');
    showSystemMessage('✓ ' + (data.message || 'تم توليد 5 أكواد جديدة'), 'success');
    await loadList();
    if (adminState.currentTab === 'archive') renderArchive();
  } catch (err) {
    alert('فشل التوليد: ' + err.message);
  }
}

/* ============================================================
   Clear Local Drafts
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
   Refresh
============================================================ */
async function refreshData() {
  await loadList();
  if (adminState.currentTab === 'archive') renderArchive();
  if (adminState.currentTab === 'settings') renderSettings();
  showSystemMessage('✓ تم التحديث', 'success');
}

/* ============================================================
   Init
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
   Exports
============================================================ */
window.login = login;
window.logout = logout;
window.switchTab = switchTab;
window.refreshData = refreshData;
window.viewContract = viewContract;
window.closeModal = closeModal;
window.printContract = printContract;
window.deleteContract = deleteContract;
window.generateNewCodes = generateNewCodes;
window.clearLocalDrafts = clearLocalDrafts;
window.filterArchive = filterArchive;
