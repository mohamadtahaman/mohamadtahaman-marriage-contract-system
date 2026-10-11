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
            if (response.status === 401) { logout(); } else { switchTab('codes'); }
        } catch(e) { console.error("خطأ اتصال", e); }
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
    
    if(!user || !pass) {
        msg.textContent = 'الرجاء إدخال اسم المستخدم وكلمة المرور';
        msg.classList.remove('hidden'); return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', username: user, password: pass })
        });
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('adminToken', data.token);
            showPanel();
            switchTab('codes');
        } else {
            msg.textContent = data.message || 'بيانات الدخول غير صحيحة';
            msg.classList.remove('hidden');
        }
    } catch (err) {
        msg.textContent = 'خطأ في الاتصال بالخادم';
        msg.classList.remove('hidden');
    }
}

document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('passwordInput').addEventListener('keypress', function (e) { if (e.key === 'Enter') login(); });
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
    else if (tabName === 'settings') loadSettings();
}

function showSystemMessage(text, type = 'success') {
    const msg = document.getElementById('systemMessage');
    msg.textContent = text;
    msg.className = `system-message ${type === 'success' ? 'msg-success' : 'msg-error'}`;
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3000);
}

async function fetchAPI(payload) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || '')
        },
        body: JSON.stringify(payload)
    });
    if(response.status === 401) { logout(); throw new Error('Unauthorized'); }
    return await response.json();
}

/* 1. الأكواد الحالية */
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
                    <td style="font-family:monospace; font-weight:bold;">${item.code}</td>
                    <td>${statusHtml}</td>
                    <td><button onclick="viewContract('${item.code}')" class="btn-secondary" style="padding:4px 8px;font-size:12px;">معاينة</button></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) { tbody.innerHTML = '<tr><td colspan="4">خطأ في التحميل</td></tr>'; }
}

/* 2. الأرشيف (يقرأ البيانات بنفس الشكل القديم) */
async function loadArchive() {
    const tbody = document.getElementById('archiveBody');
    tbody.innerHTML = '<div class="loading-cell">جارٍ التحميل...</div>';
    try {
        const data = await fetchAPI({ action: 'archive' });
        if (data.success && data.contracts) {
            allArchiveData = data.contracts;
            document.getElementById('archiveCount').textContent = allArchiveData.length;

            if (allArchiveData.length === 0) {
                tbody.innerHTML = '<div style="padding:20px; text-align:center;">لا يوجد عقود في الأرشيف</div>';
                return;
            }

            let html = '<table class="codes-table"><thead><tr><th>#</th><th>الكود</th><th>الطرف الأول</th><th>الطرف الثاني</th><th>تاريخ الإرسال</th><th>إجراءات</th></tr></thead><tbody>';
            allArchiveData.forEach((item, idx) => {
                let p1Name = '—', p2Name = '—';
                if (item.parties) {
                    if (item.parties.groom) p1Name = item.parties.groom.nameAr || item.parties.groom.nameDe || '—';
                    if (item.parties.bride) p2Name = item.parties.bride.nameAr || item.parties.bride.nameDe || '—';
                }
                const dateStr = item.contractDate || item.sentAt || '—';
                
                html += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td style="font-family:monospace; font-weight:bold;">${item.code}</td>
                        <td>${p1Name}</td>
                        <td>${p2Name}</td>
                        <td style="direction:ltr;">${dateStr}</td>
                        <td><button onclick="viewContract('${item.code}')" class="btn-primary" style="padding:4px 8px;font-size:12px;">عرض</button></td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
            tbody.innerHTML = html;
        }
    } catch (e) { tbody.innerHTML = '<div class="loading-cell">خطأ في التحميل</div>'; }
}

function filterArchive() {
    const search = document.getElementById('archiveSearch').value.toLowerCase();
    const status = document.getElementById('archiveFilterStatus').value;
    
    const filtered = allArchiveData.filter(item => {
        let p1Name = '', p2Name = '';
        if (item.parties) {
            if (item.parties.groom) p1Name = (item.parties.groom.nameAr || '') + (item.parties.groom.nameDe || '');
            if (item.parties.bride) p2Name = (item.parties.bride.nameAr || '') + (item.parties.bride.nameDe || '');
        }

        const matchSearch = (item.code || '').toLowerCase().includes(search) || 
                            p1Name.toLowerCase().includes(search) || p2Name.toLowerCase().includes(search);
        
        let matchStatus = true;
        if(status === 'sent') matchStatus = item.finished === true;
        if(status === 'pending') matchStatus = item.finished === false;
        
        return matchSearch && matchStatus;
    });
    
    // (هنا يمكنك إضافة كود renderArchive(filtered) لعرض النتيجة)
}

/* 3. المحذوفات والاسترجاع */
async function loadTrashLogs() {
    const tbody = document.getElementById('trashBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">جارٍ التحميل...</td></tr>';
    try {
        const data = await fetchAPI({ action: 'get_trash' });
        if (data.success && data.trash) {
            tbody.innerHTML = '';
            document.getElementById('trashCount').innerText = data.trash.length;
            if (data.trash.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">سلة المحذوفات فارغة</td></tr>';
                return;
            }
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
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5">خطأ في الاتصال</td></tr>'; }
}

async function restoreContract(code) {
    if (!confirm(`هل أنت متأكد من استرجاع العقد ${code}؟`)) return;
    const data = await fetchAPI({ action: 'restore', code: code });
    if(data.success) { showSystemMessage('تم الاسترجاع'); loadTrashLogs(); }
}
async function permanentDelete(code) {
    if (!confirm(`تحذير: هل أنت متأكد من الحذف النهائي للعقد ${code}؟`)) return;
    const data = await fetchAPI({ action: 'permanent_delete', code: code });
    if(data.success) { showSystemMessage('تم الحذف النهائي'); loadTrashLogs(); }
}

/* 4. السجلات والتدقيق */
async function loadAuditLogs() {
    const tbody = document.getElementById('auditLogsBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">جارٍ التحميل...</td></tr>';
    try {
        const data = await fetchAPI({ action: 'audit_logs' });
        if (data.success && data.logs && data.logs.length > 0) {
            tbody.innerHTML = '';
            data.logs.forEach(log => {
                const actionText = log.action || 'إجراء';
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
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد سجلات.</td></tr>';
        }
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد سجلات.</td></tr>'; }
}

/* 5. دوال مساعدة ومناطق خطر */
async function generateNewCodes() {
    if(!confirm('تأكيد توليد 5 أكواد جديدة؟')) return;
    const data = await fetchAPI({ action: 'generate' });
    if(data.success) { showSystemMessage('تم التوليد بنجاح'); loadCodes(); }
}
async function clearDraftForCode() {
    const code = document.getElementById('clearDraftCode').value.trim();
    if(!code) return;
    if(!confirm(`تأكيد مسح مسودة ${code}؟ (أو نقله للمحذوفات إذا كان معتمداً)`)) return;
    const data = await fetchAPI({ action: 'delete', code: code });
    if(data.success) { showSystemMessage('تم الإجراء بنجاح'); document.getElementById('clearDraftCode').value = ''; loadCodes(); }
}
async function clearAllDrafts() {
    if(!confirm('تأكيد مسح كافة المسودات؟')) return;
    const data = await fetchAPI({ action: 'clear_drafts', all: true });
    if(data.success) showSystemMessage('تم مسح المسودات');
}
function loadSettings() { document.getElementById('usersBody').innerHTML = '<tr><td colspan="5" class="loading-cell">سيتم التفعيل لاحقاً</td></tr>'; }

let viewContractCode = null;
async function viewContract(code) {
    viewContractCode = code;
    document.getElementById('modalTitle').textContent = `تفاصيل العقد: ${code}`;
    const content = document.getElementById('modalContent');
    content.innerHTML = '<div style="padding:20px;text-align:center;">جارٍ جلب البيانات...</div>';
    document.getElementById('viewModal').classList.remove('hidden');

    try {
        const data = await fetchAPI({ action: 'view', code: code });
        if (data.success && data.contract) {
            let p1Name = '-', p1Nat = '-', p2Name = '-', p2Nat = '-';
            if (data.contract.parties) {
                const p1 = data.contract.parties.groom;
                if (p1) { p1Name = p1.nameAr || p1.name_ar || '-'; p1Nat = p1.birthCountry || p1.birth_country || '-'; }
                const p2 = data.contract.parties.bride;
                if (p2) { p2Name = p2.nameAr || p2.name_ar || '-'; p2Nat = p2.birthCountry || p2.birth_country || '-'; }
            }
            content.innerHTML = `
                <div style="background:#f9f9f9; padding:15px; border-radius:8px; text-align:right;">
                    <h3 style="color:#2d6a4f; margin-bottom:10px;">الطرف الأول</h3>
                    <p>الاسم: ${p1Name}</p>
                    <p>الجنسية: ${p1Nat}</p>
                    <hr style="border:0; border-top:1px solid #ddd; margin:15px 0;">
                    <h3 style="color:#2d6a4f; margin-bottom:10px;">الطرف الثاني</h3>
                    <p>الاسم: ${p2Name}</p>
                    <p>الجنسية: ${p2Nat}</p>
                </div>
            `;
        } else { content.innerHTML = '<div style="color:red; text-align:center;">تعذر عرض البيانات</div>'; }
    } catch (e) { content.innerHTML = '<div style="color:red; text-align:center;">خطأ في الاتصال</div>'; }
}

function closeModal() { document.getElementById('viewModal').classList.add('hidden'); viewContractCode = null; }
function printContract() { if (viewContractCode) window.open(`print-contract.html?code=${viewContractCode}`, '_blank'); }
