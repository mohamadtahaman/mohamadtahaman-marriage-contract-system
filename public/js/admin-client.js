/* admin-client.js - Arresalah Zentrum Berlin */

const API_URL = '/api/admin';
let allArchiveData = [];
let allAuditData = [];

window.onload = async () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
        showPanel();
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ action: 'list' })
            });
            if (response.status === 401) logout();
            else switchTab('codes');
        } catch(e) { console.error(e); }
    } else { showLogin(); }
};

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
}
function showPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
}

async function login() {
    const user = document.getElementById('usernameInput').value;
    const pass = document.getElementById('passwordInput').value;
    const msg = document.getElementById('loginMessage');
    
    if(!user || !pass) { msg.textContent = 'أدخل البيانات'; msg.classList.remove('hidden'); return; }
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', username: user, password: pass })
        });
        const data = await response.json();
        if (data.success) {
            localStorage.setItem('adminToken', data.token);
            showPanel(); switchTab('codes');
        } else {
            msg.textContent = data.message; msg.classList.remove('hidden');
        }
    } catch (err) { msg.textContent = 'خطأ'; msg.classList.remove('hidden'); }
}
document.getElementById('loginBtn').addEventListener('click', login);
function logout() { localStorage.removeItem('adminToken'); showLogin(); }

function switchTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    if (tabName === 'codes') loadCodes();
    else if (tabName === 'archive') loadArchive();
    else if (tabName === 'trash') loadTrashLogs();
    else if (tabName === 'audit') loadAuditLogs();
}

async function fetchAPI(payload) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || '') },
        body: JSON.stringify(payload)
    });
    if(response.status === 401) { logout(); throw new Error('Unauthorized'); }
    return await response.json();
}

// 1. قراءة الأكواد من data.contracts (الهيكل الأصلي)
async function loadCodes() {
    const tbody = document.getElementById('codesBody');
    tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">جارٍ التحميل...</td></tr>';
    try {
        const data = await fetchAPI({ action: 'list' });
        if (data.success && data.contracts) {
            tbody.innerHTML = '';
            document.getElementById('infoCodesCount').textContent = data.contracts.length;
            data.contracts.forEach((item, index) => {
                const tr = document.createElement('tr');
                const statusHtml = item.finished ? '<span style="color:green;font-weight:bold;">✅ مُرسل</span>' : '<span style="color:#d35400;">⏳ قيد الانتظار</span>';
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td style="font-family:monospace; font-weight:bold; font-size:16px;">${item.code}</td>
                    <td>${statusHtml}</td>
                    <td><button onclick="viewContract('${item.code}')" class="btn-secondary" style="padding:4px 8px;font-size:12px;">معاينة</button></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) { tbody.innerHTML = '<tr><td colspan="4">خطأ</td></tr>'; }
}

// 2. قراءة الأرشيف من data.contracts (الهيكل الأصلي)
async function loadArchive() {
    const tbody = document.getElementById('archiveBody');
    tbody.innerHTML = '<div class="loading-cell">جارٍ التحميل...</div>';
    try {
        const data = await fetchAPI({ action: 'archive' });
        if (data.success && data.contracts) {
            allArchiveData = data.contracts;
            document.getElementById('archiveCount').textContent = allArchiveData.length;
            if (allArchiveData.length === 0) {
                tbody.innerHTML = '<div style="padding:20px; text-align:center;">لا يوجد عقود</div>';
                return;
            }
            let html = '<table class="codes-table"><thead><tr><th>#</th><th>الكود</th><th>الطرف الأول</th><th>الطرف الثاني</th><th>تاريخ الإرسال</th><th>إجراءات</th></tr></thead><tbody>';
            allArchiveData.forEach((item, idx) => {
                let p1Name = '—', p2Name = '—';
                if (item.parties) {
                    if (item.parties.groom) p1Name = item.parties.groom.nameAr || item.parties.groom.name_ar || '—';
                    if (item.parties.bride) p2Name = item.parties.bride.nameAr || item.parties.bride.name_ar || '—';
                }
                html += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td style="font-family:monospace; font-weight:bold;">${item.code}</td>
                        <td>${p1Name}</td>
                        <td>${p2Name}</td>
                        <td style="direction:ltr;">${item.contractDate || '—'}</td>
                        <td><button onclick="viewContract('${item.code}')" class="btn-primary" style="padding:4px 8px;font-size:12px;">عرض</button></td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
            tbody.innerHTML = html;
        }
    } catch (e) { tbody.innerHTML = '<div>خطأ في التحميل</div>'; }
}

// 3. المحذوفات
async function loadTrashLogs() {
    const tbody = document.getElementById('trashBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">جارٍ التحميل...</td></tr>';
    try {
        const data = await fetchAPI({ action: 'get_trash' });
        if (data.success && data.trash) {
            tbody.innerHTML = '';
            document.getElementById('trashCount').innerText = data.trash.length;
            data.trash.forEach((item, index) => {
                tbody.innerHTML += `
                    <tr>
                        <td>${index + 1}</td>
                        <td style="font-family:monospace; font-weight:bold;">${item.code}</td>
                        <td>${item.party_one_name} / ${item.party_two_name}</td>
                        <td style="direction:ltr;">${item.deleted_at}</td>
                        <td>
                            <button onclick="restoreContract('${item.code}')" class="btn-primary" style="font-size:12px; padding:5px; background:#2ecc71;">استرجاع</button>
                            <button onclick="permanentDelete('${item.code}')" class="btn-danger" style="font-size:12px; padding:5px;">حذف نهائي</button>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (e) {}
}

async function restoreContract(code) {
    if (!confirm(`استرجاع ${code}؟`)) return;
    const data = await fetchAPI({ action: 'restore', code: code });
    if(data.success) { loadTrashLogs(); }
}
async function permanentDelete(code) {
    if (!confirm(`حذف نهائي لـ ${code}؟`)) return;
    const data = await fetchAPI({ action: 'permanent_delete', code: code });
    if(data.success) { loadTrashLogs(); }
}

// 4. سجلات التدقيق (تعرض الأعمدة الموجودة في قاعدة بياناتك أياً كانت)
async function loadAuditLogs() {
    const tbody = document.getElementById('auditLogsBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">جارٍ التحميل...</td></tr>';
    try {
        const data = await fetchAPI({ action: 'audit_logs' });
        if (data.success && data.logs) {
            tbody.innerHTML = '';
            data.logs.forEach(log => {
                // الكود مرن ليقرأ أي عمود موجود في الـ Table الخاص بك
                const actionText = log.action || log.action_type || 'إجراء';
                const user = log.username || log.user_id || 'نظام';
                const date = log.timestamp || log.created_at || '-';
                const details = log.details || '-';
                const ip = log.ip_address || '-';
                
                tbody.innerHTML += `
                    <tr>
                        <td style="direction:ltr; text-align:right;">${date}</td>
                        <td>${actionText}</td>
                        <td>${user}</td>
                        <td style="font-family:monospace; direction:ltr;">${ip}</td>
                        <td style="font-size:12px;">${details}</td>
                    </tr>
                `;
            });
        }
    } catch (e) {}
}

let viewContractCode = null;
async function viewContract(code) {
    // ... دالة عرض التفاصيل ...
}
function closeModal() { document.getElementById('viewModal').classList.add('hidden'); }
