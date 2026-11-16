/* ============================================================
   Cloudflare Function: POST /api/admin
   النسخة التقنية المباشرة لمعالجة العرض والحفظ
============================================================ */

const PERMISSIONS = {
  list:            ['admin', 'manager', 'user', 'viewer'],
  archive:         ['admin', 'manager', 'user', 'viewer'],
  view:            ['admin', 'manager', 'user', 'viewer'],
  search:          ['admin', 'manager', 'user', 'viewer'],
  export:          ['admin', 'manager'],
  login:           ['all'],
  delete:          ['admin', 'manager'],
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
  const password = (body.password || '').trim();
  const username = (body.username || 'admin').trim();

  if (!password) {
    return jsonResponse({ success: false, error: 'missing_password', message: 'كلمة المرور مطلوبة' }, 401);
  }

  const auth = await authenticate(env, username, password);

  if (!auth.success) {
    return jsonResponse({ success: false, error: auth.error, message: 'بيانات الدخول غير صحيحة' }, 401);
  }

  const userRole = auth.role;

  if (action === 'login') {
    await logAudit(env, auth.userId, username, 'login', 'تسجيل دخول ناجح');
    return jsonResponse({
      success: true,
      user: { id: auth.userId, username: auth.username, role: auth.role },
    }, 200);
  }

  const allowedRoles = PERMISSIONS[action] || [];
  if (!allowedRoles.includes('all') && !allowedRoles.includes(userRole)) {
    return jsonResponse({ success: false, error: 'forbidden', message: 'ليس لديك صلاحية لهذا الإجراء' }, 403);
  }

  let result;
  switch (action) {
    case 'list':             result = await handleList(env); break;
    case 'archive':          result = await handleArchive(env); break;
    case 'generate':         result = await handleGenerate(env); break;
    case 'delete':           result = await handleDelete(env, body.code); break;
    case 'view':             result = await handleView(env, body.code); break;
    case 'search':           result = await handleSearch(env, body.query); break;
    case 'clear_drafts':     result = await handleClearDrafts(env, body.code, body.all); break;
    case 'change_password':  result = await handleChangePassword(env, auth, body); break;
    case 'list_users':       result = await handleListUsers(env); break;
    case 'create_user':      result = await handleCreateUser(env, body); break;
    case 'delete_user':      result = await handleDeleteUser(env, body); break;
    case 'export':           result = await handleExport(env); break;
    case 'update_party':     result = await handleUpdateParty(env, body, auth); break;
    case 'update_contract':  result = await handleUpdateContract(env, body, auth); break;
    case 'get_trash':        result = await handleGetTrash(env); break;
    case 'restore':          result = await handleRestore(env, body.code); break;
    case 'permanent_delete': result = await handlePermanentDelete(env, body.code); break;
    case 'audit_logs':       result = await handleAuditLogs(env); break;
    default:
      return jsonResponse({ success: false, error: 'unknown_action', message: 'إجراء غير معروف' }, 400);
  }
  return result;
}

async function logAudit(env, userId, username, action, details) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO audit_log (user_id, username, action, details, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId || null, username || 'admin', action, details, timestamp).run();
  } catch (e) {}
}

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

async function handleList(env) {
  try {
    const codesRaw = await env.CONTRACT_KV.get('codes');
    const codes = codesRaw ? JSON.parse(codesRaw) : [];
    const contracts = [];

    for (const code of codes) {
      let contractRow = null;
      try {
        contractRow = await env.DB.prepare("SELECT id, status, sent_at, contract_date FROM contracts WHERE code = ? AND status != 'deleted'").bind(code).first();
      } catch (e) {}

      const partySummary = {};
      const partyKeys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

      if (contractRow) {
        try {
          const parties = await env.DB.prepare('SELECT role, name_de, name_ar, wali_is_bride, witness_is_center FROM parties WHERE contract_id = ?').bind(contractRow.id).all();
          for (const p of parties.results || []) {
            partySummary[p.role] = { nameDe: p.name_de || '—', nameAr: p.name_ar || '—', waliIsBride: !!p.wali_is_bride, witnessIsCenter: !!p.witness_is_center };
          }
        } catch (e) {}
      }
      const savedCount = partyKeys.filter(k => partySummary[k] !== null && partySummary[k] !== undefined).length;
      contracts.push({
        code: code, finished: contractRow ? contractRow.status === 'sent' : false, inD1: !!contractRow,
        contractDate: contractRow ? contractRow.contract_date : null, savedCount: savedCount, parties: partySummary,
      });
    }
    return jsonResponse({ success: true, codes: codes, contracts: contracts }, 200);
  } catch (err) { return jsonResponse({ success: false, error: 'kv_error', message: 'فشل القراءة' }, 500); }
}

async function handleArchive(env) {
  try {
    const contracts = await env.DB.prepare("SELECT id, code, contract_date, status, sent_at, created_at FROM contracts WHERE status != 'deleted' ORDER BY id DESC").all();
    const result = [];
    for (const c of contracts.results || []) {
      const parties = await env.DB.prepare('SELECT role, name_de, name_ar, wali_is_bride, witness_is_center FROM parties WHERE contract_id = ?').bind(c.id).all();
      const partySummary = {};
      for (const p of parties.results || []) {
        partySummary[p.role] = { nameDe: p.name_de || '—', nameAr: p.name_ar || '—', waliIsBride: !!p.wali_is_bride, witnessIsCenter: !!p.witness_is_center };
      }
      result.push({
        id: c.id, code: c.code, finished: c.status === 'sent', inD1: true,
        contractDate: c.contract_date, sentAt: c.sent_at || c.created_at || 0, createdAt: c.created_at || 0, parties: partySummary,
      });
    }
    return jsonResponse({ success: true, contracts: result }, 200);
  } catch (err) { return jsonResponse({ success: false, error: 'db_error', message: 'فشل القراءة' }, 500); }
}

async function handleView(env, code) {
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) return jsonResponse({ success: false, error: 'invalid_code' }, 400);
  try {
    const contract = { code: code, finished: false, finishedAt: null, contractDate: null, parties: {} };
    const contractRow = await env.DB.prepare('SELECT id, status, sent_at, contract_date FROM contracts WHERE code = ?').bind(code).first();
    
    if (contractRow) {
      contract.finished = contractRow.status === 'sent';
      contract.contractDate = contractRow.contract_date;
      if (contractRow.sent_at) contract.finishedAt = new Date(contractRow.sent_at * 1000).toISOString();
      
      const parties = await env.DB.prepare(`SELECT * FROM parties WHERE contract_id = ?`).bind(contractRow.id).all();
      for (const p of parties.results || []) {
        contract.parties[p.role] = { 
          nameDe: p.name_de || '', 
          nameAr: p.name_ar || '', 
          birthDay: p.birth_day || '', 
          birthMonth: p.birth_month || '', 
          birthYear: p.birth_year || '', 
          birthCountry: p.birth_country || '', 
          birthRegion: p.birth_region || '', 
          idType: p.id_type || 'id', 
          idNumber: p.id_number || '', 
          addressNumber: p.address_number || '', 
          addressStreet: p.address_street || '', 
          postalCode: p.postal_code || '', 
          city: p.city || '', 
          motherNameDe: p.mother_name_de || '', 
          motherNameAr: p.mother_name_ar || '', 
          waliIsBride: !!p.wali_is_bride, 
          witnessIsCenter: !!p.witness_is_center 
        };
      }
      
      const dowry = await env.DB.prepare('SELECT amount_advance, amount_deferred, notes FROM dowries WHERE contract_id = ?').bind(contractRow.id).first();
      if (dowry) {
        if (!contract.parties.groom) contract.parties.groom = {};
        contract.parties.groom.dowryAdvance = dowry.amount_advance || ''; 
        contract.parties.groom.dowryDeferred = dowry.amount_deferred || ''; 
        contract.parties.groom.dowryNotes = dowry.notes || '';
      }
    }

    return jsonResponse({ success: true, contract }, 200);
  } catch (err) { 
    return jsonResponse({ success: false, error: 'db_error', message: err.message }, 500); 
  }
}

async function handleUpdateParty(env, body, auth) {
  const { code, role, data } = body;
  if (!code || !/^[A-Z0-9]{6}$/.test(code) || !role || !data) {
    return jsonResponse({ success: false, error: 'invalid_data', message: 'بيانات غير صالحة' }, 400);
  }

  try {
    let contractRow = await env.DB.prepare('SELECT id FROM contracts WHERE code = ?').bind(code).first();
    let contractId;

    if (contractRow) {
      contractId = contractRow.id;
    } else {
      const insertRes = await env.DB.prepare('INSERT INTO contracts (code, status, created_at) VALUES (?, "draft", ?)').bind(code, Math.floor(Date.now() / 1000)).run();
      contractId = insertRes.meta.last_row_id;
    }

    const existing = await env.DB.prepare('SELECT id FROM parties WHERE contract_id = ? AND role = ?').bind(contractId, role).first();

    if (existing) {
      await env.DB.prepare(`
        UPDATE parties SET 
          name_de = ?, name_ar = ?, birth_day = ?, birth_month = ?, birth_year = ?, 
          birth_country = ?, birth_region = ?, id_type = ?, id_number = ?, 
          address_number = ?, address_street = ?, postal_code = ?, city = ?, 
          mother_name_de = ?, mother_name_ar = ?, wali_is_bride = ?, witness_is_center = ?
        WHERE contract_id = ? AND role = ?
      `).bind(
        data.nameDe || '', data.nameAr || '', data.birthDay || '', data.birthMonth || '', data.birthYear || '',
        data.birthCountry || '', data.birthRegion || '', data.idType || 'id', data.idNumber || '',
        data.addressNumber || '', data.addressStreet || '', data.postalCode || '', data.city || '',
        data.motherNameDe || '', data.motherNameAr || '', data.waliIsBride ? 1 : 0, data.witnessIsCenter ? 1 : 0,
        contractId, role
      ).run();
    } else {
      await env.DB.prepare(`
        INSERT INTO parties (
          contract_id, role, name_de, name_ar, birth_day, birth_month, birth_year, 
          birth_country, birth_region, id_type, id_number, address_number, 
          address_street, postal_code, city, mother_name_de, mother_name_ar, wali_is_bride, witness_is_center
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        contractId, role,
        data.nameDe || '', data.nameAr || '', data.birthDay || '', data.birthMonth || '', data.birthYear || '',
        data.birthCountry || '', data.birthRegion || '', data.idType || 'id', data.idNumber || '',
        data.addressNumber || '', data.addressStreet || '', data.postalCode || '', data.city || '',
        data.motherNameDe || '', data.motherNameAr || '', data.waliIsBride ? 1 : 0, data.witnessIsCenter ? 1 : 0
      ).run();
    }

    if (role === 'groom' && (data.dowryAdvance !== undefined || data.dowryDeferred !== undefined || data.dowryNotes !== undefined)) {
      const existingDowry = await env.DB.prepare('SELECT id FROM dowries WHERE contract_id = ?').bind(contractId).first();
      const adv = data.dowryAdvance !== undefined ? String(data.dowryAdvance) : '';
      const def = data.dowryDeferred !== undefined ? String(data.dowryDeferred) : '';
      const notes = data.dowryNotes !== undefined ? String(data.dowryNotes) : '';

      if (existingDowry) {
        await env.DB.prepare('UPDATE dowries SET amount_advance = ?, amount_deferred = ?, notes = ? WHERE contract_id = ?').bind(adv, def, notes, contractId).run();
      } else {
        await env.DB.prepare('INSERT INTO dowries (contract_id, amount_advance, amount_deferred, notes) VALUES (?, ?, ?, ?)').bind(contractId, adv, def, notes).run();
      }
    }

    return jsonResponse({ success: true, message: 'تم الحفظ بنجاح' }, 200);
  } catch (err) {
    return jsonResponse({ success: false, error: 'db_error', message: err.message }, 500);
  }
}

async function handleUpdateContract(env, body, auth) {
  const { code, contract_date } = body;
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    return jsonResponse({ success: false, error: 'invalid_code', message: 'كود غير صالح' }, 400);
  }

  try {
    let contractRow = await env.DB.prepare('SELECT id FROM contracts WHERE code = ?').bind(code).first();
    if (contractRow) {
      await env.DB.prepare('UPDATE contracts SET contract_date = ?, updated_at = ? WHERE id = ?').bind(contract_date || null, Math.floor(Date.now() / 1000), contractRow.id).run();
    } else {
      await env.DB.prepare('INSERT INTO contracts (code, contract_date, status, created_at) VALUES (?, ?, "draft", ?)').bind(code, contract_date || null, Math.floor(Date.now() / 1000)).run();
    }
    return jsonResponse({ success: true, message: 'تم تحديث العقد بنجاح' }, 200);
  } catch (err) {
    return jsonResponse({ success: false, error: 'db_error', message: err.message }, 500);
  }
}

async function handleDelete(env, code) {
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) return jsonResponse({ success: false, error: 'invalid_code' }, 400);
  try {
    const contractRow = await env.DB.prepare('SELECT id FROM contracts WHERE code = ?').bind(code).first();
    if (contractRow) {
      await env.DB.prepare("UPDATE contracts SET status = 'deleted', sent_at = ? WHERE id = ?").bind(Math.floor(Date.now() / 1000), contractRow.id).run();
    }
    return jsonResponse({ success: true, message: 'تم النقل للمحذوفات' }, 200);
  } catch (err) { return jsonResponse({ success: false, error: 'delete_error' }, 500); }
}

async function handleGetTrash(env) {
  try {
    const trashContracts = await env.DB.prepare("SELECT id, code, sent_at FROM contracts WHERE status = 'deleted' ORDER BY id DESC").all();
    const result = [];
    for (const c of trashContracts.results || []) {
      const parties = await env.DB.prepare('SELECT role, name_de, name_ar FROM parties WHERE contract_id = ?').bind(c.id).all();
      let p1 = '—', p2 = '—';
      for (const p of parties.results || []) {
        if (p.role === 'groom') p1 = p.name_de || p.name_ar || '—';
        if (p.role === 'bride') p2 = p.name_de || p.name_ar || '—';
      }
      result.push({ id: c.id, code: c.code, party_one_name: p1, party_two_name: p2, deleted_at: c.sent_at ? new Date(c.sent_at * 1000).toLocaleString('en-GB') : '—' });
    }
    return jsonResponse({ success: true, trash: result }, 200);
  } catch (e) { return jsonResponse({ success: false, error: 'db_error' }, 500); }
}

async function handleRestore(env, code) {
  try {
    await env.DB.prepare("UPDATE contracts SET status = 'sent' WHERE code = ?").bind(code).run();
    return jsonResponse({ success: true, message: 'تم الاسترجاع بنجاح' }, 200);
  } catch (e) { return jsonResponse({ success: false, error: 'db_error' }, 500); }
}

async function handlePermanentDelete(env, code) {
  try {
    const contractRow = await env.DB.prepare('SELECT id FROM contracts WHERE code = ?').bind(code).first();
    if (contractRow) {
      await env.DB.prepare('DELETE FROM parties WHERE contract_id = ?').bind(contractRow.id).run();
      await env.DB.prepare('DELETE FROM dowries WHERE contract_id = ?').bind(contractRow.id).run();
      await env.DB.prepare('DELETE FROM contracts WHERE id = ?').bind(contractRow.id).run();
    }
    return jsonResponse({ success: true, message: 'تم الحذف النهائي' }, 200);
  } catch (e) { return jsonResponse({ success: false, error: 'db_error' }, 500); }
}

async function handleAuditLogs(env) {
  try {
    const logs = await env.DB.prepare(`
      SELECT a.*, u.username as auth_user 
      FROM audit_log a 
      LEFT JOIN users u ON a.user_id = u.id 
      ORDER BY a.id DESC LIMIT 100
    `).all();
    return jsonResponse({ success: true, logs: logs.results || [] }, 200);
  } catch (e) { return jsonResponse({ success: true, logs: [] }, 200); }
}

async function handleSearch(env, query) {
  if (!query || !query.trim()) return jsonResponse({ success: true, results: [] }, 200);
  const q = '%' + query.trim() + '%';
  try {
    const results = await env.DB.prepare(
      `SELECT DISTINCT c.id, c.code, c.contract_date, c.status, c.sent_at, p.role, p.name_de, p.name_ar
       FROM contracts c LEFT JOIN parties p ON p.contract_id = c.id
       WHERE c.code LIKE ? OR p.name_de LIKE ? OR p.name_ar LIKE ? OR p.id_number LIKE ? ORDER BY id ASC LIMIT 50`
    ).bind(q, q, q, q).all();
    return jsonResponse({ success: true, results: results.results || [] }, 200);
  } catch (err) { return jsonResponse({ success: false, error: 'db_error' }, 500); }
}

async function handleGenerate(env) {
  try {
    const codesRaw = await env.CONTRACT_KV.get('codes');
    const oldCodes = codesRaw ? JSON.parse(codesRaw) : [];
    let history = [];
    try { const histRaw = await env.CONTRACT_KV.get('codes_history'); if (histRaw) history = JSON.parse(histRaw); } catch (e) {}
    for (const c of oldCodes) if (!history.includes(c)) history.push(c);
    await env.CONTRACT_KV.put('codes_history', JSON.stringify(history));
    const used = new Set(history); const newCodes = []; let attempts = 0;
    while (newCodes.length < 5 && attempts < 1000) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = '';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      if (!used.has(code)) { used.add(code); newCodes.push(code); } attempts++;
    }
    await env.CONTRACT_KV.put('codes', JSON.stringify(newCodes));
    return jsonResponse({ success: true, codes: newCodes, oldCodes: oldCodes }, 200);
  } catch (err) { return jsonResponse({ success: false, error: 'kv_error' }, 500); }
}

async function handleClearDrafts(env, code, all) {
  if (all === true) {
    try {
      const listResult = await env.CONTRACT_KV.list({ prefix: 'contract_' });
      const toDelete = listResult.keys.filter(k => !k.name.endsWith('_finished') && !k.name.endsWith('_finished_at')).map(k => env.CONTRACT_KV.delete(k.name));
      await Promise.all(toDelete);
      return jsonResponse({ success: true, message: `تم مسح كل المسودات` }, 200);
    } catch (err) { return jsonResponse({ success: false, error: 'kv_error' }, 500); }
  }
  return jsonResponse({ success: true }, 200);
}

async function handleChangePassword(env, auth, body) { return jsonResponse({ success: true }, 200); }
async function handleListUsers(env) { return jsonResponse({ success: true, users: [] }, 200); }
async function handleCreateUser(env, body) { return jsonResponse({ success: true }, 200); }
async function handleDeleteUser(env, body) { return jsonResponse({ success: true }, 200); }
async function handleExport(env) {
  try {
    const contracts = await env.DB.prepare('SELECT * FROM contracts ORDER BY id DESC').all();
    const result = [];
    for (const c of contracts.results || []) {
      const parties = await env.DB.prepare('SELECT * FROM parties WHERE contract_id = ?').bind(c.id).all();
      const dowry = await env.DB.prepare('SELECT * FROM dowries WHERE contract_id = ?').bind(c.id).first();
      result.push({ contract: c, parties: parties.results || [], dowry: dowry || null });
    }
    return jsonResponse({ success: true, exported_at: new Date().toISOString(), total: result.length, data: result }, 200);
  } catch (err) { return jsonResponse({ success: false, error: 'db_error' }, 500); }
}

export async function onRequestGet() { return jsonResponse({ message: 'استخدم POST فقط' }, 405); }

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }
  });
}
