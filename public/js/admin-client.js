/* admin-client.js - Arresalah Zentrum Berlin */

// ==========================================
// الإعدادات العامة والمتغيرات
// ==========================================
const API_URL = '/api/admin'; // مسار الـ API الخاص بـ Cloudflare Worker
let allArchiveData = [];
let allAuditData = [];

// ==========================================
// التهيئة والتحقق من تسجيل الدخول (نسخة الفحص لاكتشاف الخطأ)
// ==========================================
window.onload = async () => {
    const token = localStorage.getItem('adminToken');
    if (token) {
        // إظهار اللوحة أولاً لمنع الاختفاء السريع
        showPanel();
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ action: 'list' })
            });
            
            if (response.status === 401) {
                alert("تحذير: السيرفر لا يقبل جلسة الدخول (401 Unauthorized).\nالسبب إما أن الـ Token تالف، أو أن كود التحقق في ملف Worker يرفضه.");
                // تركنا اللوحة مفتوحة عمداً لترى الخطأ
            } else {
                switchTab('codes');
            }
        } catch(e) {
            console.error("لا يمكن الوصول للسيرفر", e);
            alert("خطأ: لا يمكن الوصول إلى السيرفر. تأكد من أن مسار الـ API يعمل بشكل صحيح.");
        }
    } else {
        showLogin();
    }
};

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
}

function showPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
}

// دالة تسجيل الدخول
async function login() {
    const user = document.getElementById('usernameInput').value;
    const pass = document.getElementById('passwordInput').value;
    const msg = document.getElementById('loginMessage');
    
    if(!user || !pass) {
        msg.textContent = 'الرجاء إدخال اسم المستخدم وكلمة المرور';
        msg.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', username: user, password: pass })
        });
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('adminToken', data.token || 'temp-token');
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

// ربط أزرار تسجيل الدخول
document.getElementById('loginBtn').addEventListener('click', login);
document.getElementById('passwordInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') login();
});

// دالة تسجيل الخروج
function logout() {
    localStorage.removeItem('adminToken');
    showLogin();
}

// ==========================================
// إدارة التبويبات والرسائل النظامية
// ==========================================
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

function refreshData() {
    const activeTab = document.querySelector('.admin-tab.active').getAttribute('data-tab');
    switchTab(activeTab);
    showSystemMessage('تم تحديث البيانات', 'success');
}

function showSystemMessage(text, type = 'success') {
    const msg = document.getElementById('systemMessage');
    msg.textContent = text;
    msg.className = `system-message ${type === 'success' ? 'msg-success' : 'msg-error'}`;
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 3000);
}

// ==========================================
// دالة الاتصال المحدثة (تطبع الخطأ بدلاً من الإخفاء الفوري)
// ==========================================
async function fetchAPI(payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || '')
            },
            body: JSON.stringify(payload)
        });
        
        if(response.status === 401) { 
            console.error("السيرفر يرفض الاتصال بسبب خطأ في التوكن - الحالة 401");
            alert("جلسة الدخول غير صالحة. السيرفر يرفض الاتصال.");
            logout(); 
            throw new Error('Unauthorized'); 
        }
        
        return await response.json();
    } catch (error) {
        console.error("فشل الاتصال بـ API_URL: ", API_URL, error);
        throw error;
    }
}

// ==========================================
// 1. الأكواد الحالية (Codes)
// ==========================================
async function loadCodes() {
    const tbody = document.getElementById('codesBody');
    tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">جارٍ التحميل...</td></tr>';
    
    try {
        const data = await fetchAPI({ action: 'list' });
        if (data.success && data.codes) {
            tbody.innerHTML = '';
            document.getElementById('infoCodesCount').textContent = data.codes.length;
            data.codes.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td style="font-family:monospace; font-weight:bold;">${item.code}</td>
                    <td>${item.status === 'sent' ? '✅ مُرسل' : '⏳ قيد الانتظار'}</td>
                    <td><button onclick="viewContract('${item.code}')" class="btn-secondary" style="padding:4px 8px;font-size:12px;">معاينة</button></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-cell">خطأ في التحميل</td></tr>';
    }
}

async function generateNewCodes() {
    if(!confirm('تأكيد توليد 5 أكواد جديدة؟ (المسودات الحالية ستُمسح)')) return;
    try {
        const data = await fetchAPI({ action: 'generate' });
        if(data.success) {
            showSystemMessage('تم توليد الأكواد بنجاح');
            loadCodes();
        } else {
            showSystemMessage(data.message, 'error');
        }
    } catch(e) {
        showSystemMessage('خطأ في الاتصال', 'error');
    }
}

async function clearDraftForCode() {
    const code = document.getElementById('clearDraftCode').value.trim();
    if(!code) return alert('أدخل الكود أولاً');
    if(!confirm(`تأكيد مسح المسودة للكود ${code}؟`)) return;
    
    try {
        const data = await fetchAPI({ action: 'delete', code: code });
        if(data.success) {
            showSystemMessage('تم المسح بنجاح');
            document.getElementById('clearDraftCode').value = '';
        } else {
            showSystemMessage(data.message, 'error');
        }
    } catch(e) { showSystemMessage('خطأ', 'error'); }
}

async function clearAllDrafts() {
    if(!confirm('⚠️ هل أنت متأكد من مسح جميع المسودات؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try {
        const data = await fetchAPI({ action: 'clear_drafts' });
        if(data.success) showSystemMessage('تم مسح جميع المسودات');
        else showSystemMessage(data.message, 'error');
    } catch(e) { showSystemMessage('خطأ', 'error'); }
}

// ==========================================
// 2. الأرشيف (Archive)
// ==========================================
async function loadArchive() {
    const tbody = document.getElementById('archiveBody');
    tbody.innerHTML = '<div class="loading-cell">جارٍ التحميل...</div>';
    
    try {
        const data = await fetchAPI({ action: 'archive' });
        if (data.success && data.archives) {
            allArchiveData = data.archives;
            
            // ترتيب الأرشيف تنازلياً
            allArchiveData.sort((a, b) => b.id - a.id);
            
            document.getElementById('infoSentCount').textContent = allArchiveData.length;
            renderArchive(allArchiveData);
        }
    } catch (e) {
        tbody.innerHTML = '<div class="loading-cell">خطأ في التحميل</div>';
    }
}

function renderArchive(dataList) {
    const tbody = document.getElementById('archiveBody');
    const count = document.getElementById('archiveCount');
    count.textContent = dataList.length;

    if (dataList.length === 0) {
        tbody.innerHTML = '<div style="padding:20px; text-align:center;">لا يوجد عقود في الأرشيف</div>';
        return;
    }

    let html = '<table class="codes-table"><thead><tr><th>#</th><th>الكود</th><th>الطرف الأول</th><th>الطرف الثاني</th><th>تاريخ الإرسال</th><th>إجراءات</th></tr></thead><tbody>';
    dataList.forEach((item, idx) => {
        html += `
            <tr>
                <td>${idx + 1}</td>
                <td style="font-family:monospace; font-weight:bold;">${item.code}</td>
                <td>${item.party_one_name || '-'}</td>
                <td>${item.party_two_name || '-'}</td>
                <td style="direction:ltr;">${item.created_at || item.contractDate || '-'}</td>
                <td>
                    <button onclick="viewContract('${item.code}')" class="btn-primary" style="padding:4px 8px;font-size:12px;">عرض / طباعة</button>
                </td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    tbody.innerHTML = html;
}

function filterArchive() {
    const search = document.getElementById('archiveSearch').value.toLowerCase();
    const status = document.getElementById('archiveFilterStatus').value;
    
    const filtered = allArchiveData.filter(item => {
        const matchSearch = (item.code || '').toLowerCase().includes(search) || 
                            (item.party_one_name || '').toLowerCase().includes(search) || 
                            (item.party_two_name || '').toLowerCase().includes(search);
        
        let matchStatus = true;
        if(status === 'sent') matchStatus = item.status === 'sent';
        if(status === 'pending') matchStatus = item.status !== 'sent';
        
        return matchSearch && matchStatus;
    });
    
    renderArchive(filtered);
}

// ==========================================
// 3. المحذوفات (Trash & Restore)
// ==========================================
async function loadTrashLogs() {
    const trashBody = document.getElementById('trashBody');
    const trashCount = document.getElementById('trashCount');
    trashBody.innerHTML = '<tr><td colspan="5" class="loading-cell">جارٍ تحميل العقود المحذوفة...</td></tr>';

    try {
        const data = await fetchAPI({ action: 'get_trash' });
        if (data.success) {
            const trashData = data.trash || [];
            trashCount.innerText = trashData.length;

            if (trashData.length === 0) {
                trashBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#777;">سلة المحذوفات فارغة حالياً</td></tr>';
                return;
            }

            trashBody.innerHTML = '';
            trashData.sort((a, b) => b.id - a.id);

            trashData.forEach((item, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td style="font-family:monospace; font-weight:bold;">${item.code || '---'}</td>
                    <td>${item.party_one_name || 'غير محدد'} / ${item.party_two_name || 'غير محدد'}</td>
                    <td style="direction:ltr;">${item.deleted_at || 'غير متوفر'}</td>
                    <td>
                        <button onclick="restoreContract('${item.code}')" class="btn-primary" style="font-size:12px; padding:5px 10px; background-color:#2ecc71;">استرجاع</button>
                        <button onclick="permanentDelete('${item.code}')" class="btn-danger" style="font-size:12px; padding:5px 10px; margin-right:5px;">حذف نهائي</button>
                    </td>
                `;
                trashBody.appendChild(row);
            });
        } else {
            trashBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">خطأ: ${data.message}</td></tr>`;
        }
    } catch (error) {
        trashBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">خطأ في الاتصال</td></tr>';
    }
}

async function restoreContract(code) {
    if (!confirm(`هل أنت متأكد من استرجاع العقد ذو الكود: ${code}؟`)) return;
    try {
        const data = await fetchAPI({ action: 'restore', code: code });
        if (data.success) {
            showSystemMessage('تم استرجاع العقد بنجاح');
            loadTrashLogs();
        } else {
            showSystemMessage('خطأ: ' + data.message, 'error');
        }
    } catch (e) { showSystemMessage('خطأ في الاتصال', 'error'); }
}

async function permanentDelete(code) {
    if (!confirm(`⚠️ تحذير: هل أنت متأكد من الحذف النهائي للعقد ${code}؟ لن يمكنك التراجع.`)) return;
    try {
        const data = await fetchAPI({ action: 'permanent_delete', code: code });
        if (data.success) {
            showSystemMessage('تم الحذف النهائي');
            loadTrashLogs();
        } else {
            showSystemMessage('خطأ: ' + data.message, 'error');
        }
    } catch (e) { showSystemMessage('خطأ في الاتصال', 'error'); }
}

// ==========================================
// 4. سجلات التدقيق (Audit Logs)
// ==========================================
async function loadAuditLogs() {
    const tbody = document.getElementById('auditLogsBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">جارٍ تحميل السجلات...</td></tr>';
    try {
        const data = await fetchAPI({ action: 'audit_logs' });
        if (data.success && data.logs) {
            allAuditData = data.logs;
            allAuditData.sort((a, b) => b.id - a.id); 
            filterAuditLogs();
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد سجلات حالياً</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">خطأ في التحميل</td></tr>';
    }
}

function filterAuditLogs() {
    const checkboxes = document.querySelectorAll('.audit-filter:checked');
    const allowedTypes = Array.from(checkboxes).map(cb => cb.value);
    
    const filtered = allAuditData.filter(log => allowedTypes.includes(log.action_type));
    renderAuditLogs(filtered);
}

function renderAuditLogs(dataList) {
    const tbody = document.getElementById('auditLogsBody');
    if (dataList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد سجلات مطابقة</td></tr>';
        return;
    }
    
    let html = '';
    dataList.forEach(log => {
        let typeBadge = '';
        if(log.action_type === 'login') typeBadge = '🟢 دخول';
        else if(log.action_type === 'security') typeBadge = '🔴 أمان';
        else if(log.action_type === 'auth_fail') typeBadge = '❌ فشل';
        else typeBadge = '🔵 إجراء';

        html += `
            <tr>
                <td style="direction:ltr; text-align:right;">${log.timestamp || '-'}</td>
                <td>${typeBadge}</td>
                <td>${log.username || 'نظام'}</td>
                <td style="font-family:monospace; direction:ltr;">${log.ip_address || '-'}</td>
                <td style="font-size:12px;">${log.details || ''}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ==========================================
// 5. الإعدادات وإدارة المستخدمين
// ==========================================
function loadSettings() {
    loadUsers();
}

async function loadUsers() {
    const tbody = document.getElementById('usersBody');
    tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">جارٍ التحميل...</td></tr>';
    try {
        const data = await fetchAPI({ action: 'list_users' });
        if (data.success && data.users) {
            tbody.innerHTML = '';
            data.users.forEach(u => {
                tbody.innerHTML += `
                    <tr>
                        <td>${u.username}</td>
                        <td>${u.full_name || '-'}</td>
                        <td>${u.role}</td>
                        <td>نشط</td>
                        <td><button onclick="deleteUser('${u.username}')" class="btn-danger" style="padding:4px 8px;font-size:12px;">حذف</button></td>
                    </tr>
                `;
            });
        }
    } catch(e) {}
}

async function createUser() {
    const user = document.getElementById('newUsername').value;
    const pass = document.getElementById('newUserPassword').value;
    const name = document.getElementById('newFullName').value;
    const role = document.getElementById('newRole').value;
    
    if(!user || !pass) return alert('أدخل بيانات المستخدم وكلمة المرور');
    
    try {
        const data = await fetchAPI({ action: 'create_user', username: user, password: pass, full_name: name, role: role });
        if(data.success) {
            showSystemMessage('تم إضافة المستخدم');
            document.getElementById('newUsername').value = '';
            document.getElementById('newUserPassword').value = '';
            loadUsers();
        } else alert(data.message);
    } catch(e) {}
}

async function deleteUser(username) {
    if(!confirm(`هل أنت متأكد من حذف المستخدم ${username}؟`)) return;
    try {
        const data = await fetchAPI({ action: 'delete_user', username: username });
        if(data.success) loadUsers();
    } catch(e) {}
}

async function changePassword() {
    const oldP = document.getElementById('oldPassword').value;
    const newP = document.getElementById('newPassword').value;
    const confP = document.getElementById('confirmPassword').value;
    
    if(newP !== confP) return alert('كلمة المرور غير متطابقة');
    try {
        const data = await fetchAPI({ action: 'change_password', old_password: oldP, new_password: newP });
        if(data.success) {
            showSystemMessage('تم تغيير كلمة المرور بنجاح');
            document.getElementById('oldPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';
        } else alert(data.message);
    } catch(e) {}
}

async function exportBackup() {
    try {
        const data = await fetchAPI({ action: 'export' });
        if (data.success) {
            const jsonStr = JSON.stringify(data.backup, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_arresalah_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        }
    } catch (e) { showSystemMessage('خطأ في تصدير النسخة الاحتياطية', 'error'); }
}

// ==========================================
// 6. النوافذ المنبثقة (Modals) والطباعة
// ==========================================
let viewContractCode = null;

async function viewContract(code) {
    viewContractCode = code;
    document.getElementById('modalTitle').textContent = `معاينة العقد: ${code}`;
    const content = document.getElementById('modalContent');
    content.innerHTML = '<div style="padding:20px;text-align:center;">جارٍ جلب البيانات...</div>';
    document.getElementById('viewModal').classList.remove('hidden');

    try {
        const data = await fetchAPI({ action: 'view', code: code });
        if (data.success && data.contract) {
            content.innerHTML = `
                <div style="background:#f9f9f9; padding:15px; border-radius:8px;">
                    <h3 style="color:#2d6a4f; margin-bottom:10px;">بيانات الطرف الأول</h3>
                    <p>الاسم: ${data.contract.party_one_name || '-'}</p>
                    <p>الجنسية: ${data.contract.party_one_nationality || '-'}</p>
                    <h3 style="color:#2d6a4f; margin-top:15px; margin-bottom:10px;">بيانات الطرف الثاني</h3>
                    <p>الاسم: ${data.contract.party_two_name || '-'}</p>
                    <p>الجنسية: ${data.contract.party_two_nationality || '-'}</p>
                </div>
            `;
        } else {
            content.innerHTML = '<div style="color:red; text-align:center;">حدث خطأ في عرض البيانات</div>';
        }
    } catch (e) {
        content.innerHTML = '<div style="color:red; text-align:center;">خطأ في الاتصال بالخادم</div>';
    }
}

function closeModal() {
    document.getElementById('viewModal').classList.add('hidden');
    viewContractCode = null;
}

function printContract() {
    if (!viewContractCode) return;
    window.open(`print-contract.html?code=${viewContractCode}`, '_blank');
}
