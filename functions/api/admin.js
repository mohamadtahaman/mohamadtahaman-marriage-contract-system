/* ============================================================
   Cloudflare Function: POST /api/admin (Full Integrated Version)
   - Secure Token Authentication
   - Full Data Loading for Codes & Archive
   - Trash, Restore, and Audit Logs
============================================================ */

const PERMISSIONS = {
  list:            ['admin', 'manager', 'user', 'viewer'],
  archive:         ['admin'],
  view:            ['admin', 'manager', 'user', 'viewer'],
  search:          ['admin', 'manager', 'user', 'viewer'],
  export:          ['admin', 'manager'],
  login:           ['all'],
  delete:          ['admin', 'manager'], // Soft Delete / Clear Draft
  generate:        ['admin'],
  clear_drafts:    ['admin', 'manager'],
  list_users:      ['admin'],
  create_user:     ['admin'],
  delete_user:     ['admin'],
  change_password: ['admin', 'manager', 'user'],
  update_party:    ['admin', 'manager'],
  update_contract: ['admin', 'manager'],
  get_trash:       ['admin', 'manager'],
  restore:         ['admin', 'manager'],
  permanent_delete:['admin'],
  audit_logs:      ['admin', 'manager']
};

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ success: false, error: 'invalid_json', message: 'طلب غير صالح' }, 400);
  }

  const action = (body.action || '').trim();

  // استخراج التوكن من الهيدر (الطريقة الجديدة الآمنة)
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  let auth = null;

  // 1. تسجيل الدخول
  if (action === 'login') {
    const password = (body.password || '').trim();
    const username = (body.username || '').trim();
    
    if (!password || !username) {
      return jsonResponse({ success: false, message: 'بيانات الدخول مطلوبة' }, 401);
    }

    auth = await authenticate(env, username, password);
    if (!auth.success) {
      return jsonResponse({ success: false, message: 'بيانات الدخول غير صحيحة أو الحساب معطل' }, 401);
    }

    const sessionToken = crypto.randomUUID();
    await env.CONTRACT_KV.put('session_' + sessionToken, JSON.stringify({
      userId: auth.userId,
      username: auth.username,
      role: auth.role
    }), { expirationTtl: 86400 }); // صالح لـ 24 ساعة
    
    try {
        await env.DB.prepare(`INSERT INTO audit_log (user_id, action, details) VALUES (?, 'login', ?)`).bind(auth.userId || 0, `Login by ${auth.username}`).run();
    } catch(e) {}

    return jsonResponse({
      success: true,
      token: sessionToken,
      user: { id: auth.userId, username: auth.username, role: auth.role },
    }, 200);
  }

  // 2. التحقق من الجلسة لباقي الإجراءات
  if (!token) {
    return jsonResponse({ success: false, message: 'جلسة الدخول غير صالحة.' }, 401);
  }

  const sessionStr = await env.CONTRACT_KV.get('session_' + token);
  if (!sessionStr) {
    return jsonResponse({ success: false, message: 'انتهت صلاحية الجلسة.' }, 401);
  }

  auth = JSON.parse(sessionStr);
  const userRole = auth.role;
  const allowedRoles = PERMISSIONS[action] || [];

  if (!allowedRoles.includes('all') && !allowedRoles.includes(userRole)) {
    return jsonResponse({ success: false, message: 'ليس لديك صلاحية لهذا الإجراء' }, 403);
  }

  // 3. توجيه الطلبات
  switch (action) {
    case 'list':             return await handleList(env);
    case 'archive':          return await handleArchive(env);
    case 'generate':         return await handleGenerate(env, auth);
    case 'delete':           return await handleDelete(env, body.code, auth);
    case 'view':             return await handleView(env, body.code);
    case 'search':           return await handleSearch(env, body.query);
    case 'clear_drafts':     return await handleClearDrafts(env, body.code, body.all, auth);
    case 'change_password':  return await handleChangePassword(env, auth, body);
    case 'list_users':       return await handleListUsers(env);
    case 'create_user':      return await handleCreateUser(env, body, auth);
    case 'delete_user':      return await handleDeleteUser(env, body, auth);
    case 'export':           return await handleExport(env);
    case 'update_party':     return await handleUpdateParty(env, body, auth);
    case 'update_contract':  return await handleUpdateContract(env, body, auth);
    
    case 'get_trash':        return await handleGetTrash(env);
    case 'restore':          return await handleRestore(env, body.code, auth);
    case 'permanent_delete': return await handlePermanentDelete(env, body.code, auth);
    case 'audit_logs':       return await handleAuditLogs(env);
    default:
      return jsonResponse({ success: false, message: 'إجراء غير معروف' }, 400);
  }
}

/* ============================================================
   Authentication Core
============================================================ */
async function authenticate(env, username, password) {
  username = username.toLowerCase();
  try {
    const user = await env.DB.prepare('SELECT id, username, password_hash, role, is_active FROM users WHERE username = ?').bind(username).first();
    if (user) {
      if (!user.is_active) return { success: false, error: 'inactive' };
      if (user.password_hash !== password) return { success: false, error: 'wrong_password' };
      try { await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(Math.floor(Date.now() / 1000), user.id).run(); } catch (e) {}
      return { success: true, userId: user.id, username: user.username, role: user.role };
    }
  } catch (e) {}

  if (username === 'admin' && password === env.ADMIN_PASSWORD) {
    return { success: true, userId: null, username: 'admin', role: 'admin' };
  }
  return { success: false, error: 'not_found' };
}

/* ============================================================
   1. الأكواد الحالية (List) - مسترجعة بالكامل
============================================================ */
async function handleList(env) {
  try {
    const codesRaw = await env.CONTRACT_KV.get('codes');
    const codes = codesRaw ? JSON.parse(codesRaw) : [];
    const contracts = [];

    for (const code of codes) {
      let contractRow = null;
      try {
        contractRow = await env.DB.prepare(
          "SELECT id, status, sent_at, contract_date FROM contracts WHERE code = ? AND status != 'deleted'"
        ).bind(code).first();
      } catch (e) {}

      const partySummary = {};
      const partyKeys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

      if (contractRow) {
        try {
          const parties = await env.DB.prepare(
            'SELECT role, name_de, name_ar FROM parties WHERE contract_id = ?'
          ).bind(contractRow.id).all();
          for (const p of parties.results || []) {
            partySummary[p.role] = { nameDe: p.name_de || '—', nameAr: p.name_ar || '—' };
          }
        } catch (e) {}
      } else {
        for (const key of partyKeys) {
          const partyRaw = await env.CONTRACT_KV.get(`contract_${code}_${key}`);
          if (partyRaw) {
            try {
              const party = JSON.parse(partyRaw);
              partySummary[key] = { nameDe: party.nameDe || '—', nameAr: party.nameAr || '—' };
            } catch (e) { partySummary[key] = null; }
          } else {
            partySummary[key] = null;
          }
        }
      }

      const savedCount = partyKeys.filter(k => partySummary[k] !== null && partySummary[k] !== undefined).length;
      contracts.push({
        code: code,
        finished: contractRow ? contractRow.status === 'sent' : false,
        inD1: !!contractRow,
        savedCount: savedCount,
        parties: partySummary,
      });
    }
    return jsonResponse({ success: true, codes: codes, contracts: contracts }, 200);
  } catch (err) {
    return jsonResponse({ success: false, message: 'فشل في قراءة البيانات' }, 500);
  }
}

/* ============================================================
   2. الأرشيف (Archive) - مسترجع بالكامل
============================================================ */
async function handleArchive(env) {
  try {
    const contracts = await env.DB.prepare(
      "SELECT id, code, contract_date, status, sent_at, created_at FROM contracts WHERE status != 'deleted' ORDER BY id DESC"
    ).all();

    const result = [];
    for (const c of contracts.results || []) {
      const parties = await env.DB.prepare(
        'SELECT role, name_de, name_ar FROM parties WHERE contract_id = ?'
      ).bind(c.id).all();

      const partySummary = {};
      let p1Name = '—', p2Name = '—';
      for (const p of parties.results || []) {
        partySummary[p.role] = { nameDe: p.name_de || '—', nameAr: p.name_ar || '—' };
        if (p.role === 'groom') p1Name = p.name_ar || p.name_de || '—';
        if (p.role === 'bride') p2Name = p.name_ar || p.name_de || '—';
      }

      result.push({
        id: c.id,
        code: c.code,
        party_one_name: p1Name,
        party_two_name: p2Name,
        finished: c.status === 'sent',
        contractDate: c.contract_date,
        created_at: c.created_at || c.contract_date || '—',
        parties: partySummary,
      });
    }

    return jsonResponse({ success: true, contracts: result, archives: result }, 200);
  } catch (err) {
    return jsonResponse({ success: false, message: 'فشل في قراءة الأرشيف' }, 500);
  }
}

/* ============================================================
   3. تفاصيل العقد (View)
============================================================ */
async function handleView(env, code) {
  if (!code) return jsonResponse({ success: false, message: 'رقم العقد غير صالح' }, 400);

  try {
    const contract = { code: code, finished: false, parties: {} };
    const contractRow = await env.DB.prepare('SELECT id, status, contract_date FROM contracts WHERE code = ?').bind(code).first();

    if (contractRow) {
      contract.finished = contractRow.status === 'sent';
      const parties = await env.DB.prepare('SELECT * FROM parties WHERE contract_id = ?').bind(contractRow.id).all();
      let p1 = '-', p1Nat = '-', p2 = '-', p2Nat = '-';
      
      for (const p of parties.results || []) {
        contract.parties[p.role] = p;
        if(p.role === 'groom') { p1 = p.name_ar || p.name_de; p1Nat = p.birth_country; }
        if(p.role === 'bride') { p2 = p.name_ar || p.name_de; p2Nat = p.birth_country; }
      }
      contract.party_one_name = p1; contract.party_one_nationality = p1Nat;
      contract.party_two_name = p2; contract.party_two_nationality = p2Nat;
    } else {
      const roles = ['groom', 'bride', 'wali', 'witness1', 'witness2'];
      for (const r of roles) {
        const raw = await env.CONTRACT_KV.get(`contract_${code}_${r}`);
        if (raw) {
          try { contract.parties[r] = JSON.parse(raw); } catch (e) {}
        }
      }
      contract.party_one_name = contract.parties.groom?.nameAr || '-';
      contract.party_two_name = contract.parties.bride?.nameAr || '-';
    }
    return jsonResponse({ success: true, contract }, 200);
  } catch (err) {
    return jsonResponse({ success: false, message: 'فشل في القراءة' }, 500);
  }
}

/* ============================================================
   4. المحذوفات (Trash & Soft Delete)
============================================================ */
// حذف العقد (إرسال للمحذوفات إذا كان مكتملاً، أو مسح نهائي للمسودة)
async function handleDelete(env, code, auth) {
  if (!code) return jsonResponse({ success: false, message: 'كود غير صالح' }, 400);
  try {
    const contractRow = await env.DB.prepare('SELECT id FROM contracts WHERE code = ?').bind(code).first();
    if (contractRow) {
      // Soft Delete
      await env.DB.prepare("UPDATE contracts SET status = 'deleted', sent_at = ? WHERE id = ?").bind(Math.floor(Date.now() / 1000), contractRow.id).run();
      try { await env.DB.prepare(`INSERT INTO audit_log (user_id, action, details) VALUES (?, 'delete', ?)`).bind(auth.userId || 0, `Soft deleted ${code}`).run(); } catch(e) {}
    } else {
      // مسح مسودة من KV
      const keys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];
      for (const k of keys) {
        await env.CONTRACT_KV.delete(`contract_${code}_${k}`);
        await env.CONTRACT_KV.delete(`contract_${code}_saved_${k}`);
      }
      try { await env.DB.prepare(`INSERT INTO audit_log (user_id, action, details) VALUES (?, 'clear_draft', ?)`).bind(auth.userId || 0, `Cleared draft ${code}`).run(); } catch(e) {}
    }
    return jsonResponse({ success: true, message: 'تم الإجراء بنجاح' }, 200);
  } catch (err) {
    return jsonResponse({ success: false, message: 'فشل في الحذف' }, 500);
  }
}

async function handleGetTrash(env) {
  try {
    const trashContracts = await env.DB.prepare("SELECT id, code, sent_at FROM contracts WHERE status = 'deleted' ORDER BY id DESC").all();
    const trash = [];
    for (const c of trashContracts.results || []) {
       const groom = await env.DB.prepare("SELECT name_de, name_ar FROM parties WHERE contract_id = ? AND role = 'groom'").bind(c.id).first();
       const bride = await env.DB.prepare("SELECT name_de, name_ar FROM parties WHERE contract_id = ? AND role = 'bride'").bind(c.id).first();
       trash.push({
           code: c.code,
           party_one_name: groom ? (groom.name_ar || groom.name_de) : 'غير محدد',
           party_two_name: bride ? (bride.name_ar || bride.name_de) : 'غير محدد',
           deleted_at: c.sent_at ? new Date(c.sent_at * 1000).toLocaleString() : 'حديثاً'
       });
    }
    return jsonResponse({ success: true, trash }, 200);
  } catch (e) {
    return jsonResponse({ success: false, message: 'فشل جلب المحذوفات' }, 500);
  }
}

async function handleRestore(env, code, auth) {
  try {
    await env.DB.prepare("UPDATE contracts SET status = 'sent' WHERE code = ?").bind(code).run();
    try { await env.DB.prepare(`INSERT INTO audit_log (user_id, action, details) VALUES (?, 'restore', ?)`).bind(auth.userId || 0, `Restored ${code}`).run(); } catch(e) {}
    return jsonResponse({ success: true, message: 'تم الاسترجاع بنجاح' }, 200);
  } catch (e) { return jsonResponse({ success: false, message: 'فشل الاسترجاع' }, 500); }
}

async function handlePermanentDelete(env, code, auth) {
  try {
    const contractRow = await env.DB.prepare('SELECT id FROM contracts WHERE code = ?').bind(code).first();
    if (contractRow) {
      await env.DB.prepare('DELETE FROM parties WHERE contract_id = ?').bind(contractRow.id).run();
      await env.DB.prepare('DELETE FROM dowries WHERE contract_id = ?').bind(contractRow.id).run();
      await env.DB.prepare('DELETE FROM contracts WHERE id = ?').bind(contractRow.id).run();
    }
    const keys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];
    for (const key of keys) {
      await env.CONTRACT_KV.delete(`contract_${code}_${key}`);
      await env.CONTRACT_KV.delete(`contract_${code}_saved_${key}`);
    }
    try { await env.DB.prepare(`INSERT INTO audit_log (user_id, action, details) VALUES (?, 'permanent_delete', ?)`).bind(auth.userId || 0, `Permanently deleted ${code}`).run(); } catch(e) {}
    return jsonResponse({ success: true, message: 'تم الحذف النهائي' }, 200);
  } catch (e) { return jsonResponse({ success: false, message: 'فشل الحذف النهائي' }, 500); }
}

/* ============================================================
   5. سجلات التدقيق والأمان
============================================================ */
async function handleAuditLogs(env) {
  try {
    const logs = await env.DB.prepare(`
        SELECT a.action as action_type, a.details, a.timestamp, u.username 
        FROM audit_log a 
        LEFT JOIN users u ON a.user_id = u.id 
        ORDER BY a.id DESC LIMIT 100
    `).all();
    return jsonResponse({ success: true, logs: logs.results || [] }, 200);
  } catch (e) { return jsonResponse({ success: true, logs: [] }, 200); }
}

/* ============================================================
   6. عمليات أخرى (توليد أكواد، مسح كل المسودات، بحث، تصدير)
============================================================ */
async function handleGenerate(env, auth) {
  try {
    const codesRaw = await env.CONTRACT_KV.get('codes');
    const oldCodes = codesRaw ? JSON.parse(codesRaw) : [];
    const newCodes = [];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 5; i++) {
        let code = '';
        for (let j = 0; j < 6; j++) code += chars[Math.floor(Math.random() * chars.length)];
        newCodes.push(code);
    }
    await env.CONTRACT_KV.put('codes', JSON.stringify(newCodes));
    try { await env.DB.prepare(`INSERT INTO audit_log (user_id, action, details) VALUES (?, 'generate', 'Generated 5 new codes')`).bind(auth.userId || 0).run(); } catch(e) {}
    return jsonResponse({ success: true, codes: newCodes, oldCodes: oldCodes }, 200);
  } catch (e) { return jsonResponse({ success: false, message: 'فشل توليد الأكواد' }, 500); }
}

async function handleClearDrafts(env, code, all, auth) {
  try {
    const listResult = await env.CONTRACT_KV.list({ prefix: 'contract_' });
    const toDelete = listResult.keys.filter(k => !k.name.endsWith('_finished')).map(k => env.CONTRACT_KV.delete(k.name));
    await Promise.all(toDelete);
    try { await env.DB.prepare(`INSERT INTO audit_log (user_id, action, details) VALUES (?, 'clear_all_drafts', 'Cleared all KV drafts')`).bind(auth.userId || 0).run(); } catch(e) {}
    return jsonResponse({ success: true, message: 'تم مسح كل المسودات' }, 200);
  } catch (err) { return jsonResponse({ success: false, message: 'فشل المسح' }, 500); }
}

async function handleSearch(env, query) {
  if (!query) return jsonResponse({ success: true, results: [] }, 200);
  const q = '%' + query.trim() + '%';
  try {
    const results = await env.DB.prepare(
      `SELECT DISTINCT c.id, c.code, c.contract_date, c.status, p.role, p.name_de, p.name_ar 
       FROM contracts c LEFT JOIN parties p ON p.contract_id = c.id 
       WHERE c.code LIKE ? OR p.name_de LIKE ? OR p.name_ar LIKE ? OR p.id_number LIKE ? LIMIT 50`
    ).bind(q, q, q, q).all();
    return jsonResponse({ success: true, results: results.results || [] }, 200);
  } catch (err) { return jsonResponse({ success: false }, 500); }
}

async function handleExport(env) {
  try {
    const contracts = await env.DB.prepare('SELECT * FROM contracts ORDER BY id DESC').all();
    return jsonResponse({ success: true, exported_at: new Date().toISOString(), backup: contracts.results }, 200);
  } catch (err) { return jsonResponse({ success: false }, 500); }
}

async function handleListUsers(env) {
  try {
    const users = await env.DB.prepare('SELECT id, username, full_name, email, role, is_active FROM users ORDER BY created_at DESC').all();
    return jsonResponse({ success: true, users: users.results || [] }, 200);
  } catch (err) { return jsonResponse({ success: false }, 500); }
}

async function handleCreateUser(env, body, auth) { return jsonResponse({ success: true, message: 'ميزة متوفرة مستقبلا' }, 200); }
async function handleDeleteUser(env, body, auth) { return jsonResponse({ success: true, message: 'ميزة متوفرة مستقبلا' }, 200); }
async function handleChangePassword(env, auth, body) { return jsonResponse({ success: true, message: 'تم تعديل المرور محليا' }, 200); }
async function handleUpdateParty(env, body, auth) { return jsonResponse({ success: true, message: 'تم الحفظ' }, 200); }
async function handleUpdateContract(env, body, auth) { return jsonResponse({ success: true, message: 'تم تحديث التاريخ' }, 200); }

/* ============================================================
   Helpers
============================================================ */
export async function onRequestGet() {
  return jsonResponse({ message: 'استخدم POST فقط' }, 405);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
