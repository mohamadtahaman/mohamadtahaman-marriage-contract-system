/* ============================================================
   Cloudflare Function: POST /api/admin (v5 - Fixed)
============================================================ */

const PERMISSIONS = {
  list:            ['admin', 'manager', 'user', 'viewer'],
  view:            ['admin', 'manager', 'user', 'viewer'],
  search:          ['admin', 'manager', 'user', 'viewer'],
  export:          ['admin', 'manager'],
  login:           ['all'],
  submit:          ['admin', 'manager', 'user'],
  delete:          ['admin', 'manager'],
  generate:        ['admin'],
  clear_drafts:    ['admin'],
  list_users:      ['admin'],
  create_user:     ['admin'],
  delete_user:     ['admin'],
  change_password: ['admin', 'manager', 'user'],
};

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'invalid_json',
      message: 'طلب غير صالح',
    }, 400);
  }

  const password = (body.password || '').trim();
  const action = (body.action || '').trim();

  if (!password) {
    return jsonResponse({
      success: false,
      error: 'missing_password',
      message: 'كلمة المرور مطلوبة',
    }, 401);
  }

  const auth = await authenticate(env, body.username, password);

  if (!auth.success) {
    return jsonResponse({
      success: false,
      error: auth.error || 'auth_failed',
      message: auth.error === 'inactive'
        ? 'الحساب معطّل'
        : 'بيانات الدخول غير صحيحة',
    }, 401);
  }

  const userRole = auth.role;

  if (action === 'login') {
    return jsonResponse({
      success: true,
      user: {
        id: auth.userId,
        username: auth.username,
        role: auth.role,
      },
    }, 200);
  }

  const allowedRoles = PERMISSIONS[action] || [];

  if (!allowedRoles.includes('all') && !allowedRoles.includes(userRole)) {
    return jsonResponse({
      success: false,
      error: 'forbidden',
      message: 'ليس لديك صلاحية لهذا الإجراء',
    }, 403);
  }

  switch (action) {
    case 'list':             return await handleList(env);
    case 'generate':         return await handleGenerate(env);
    case 'delete':           return await handleDelete(env, body.code);
    case 'view':             return await handleView(env, body.code);
    case 'search':           return await handleSearch(env, body.query);
    case 'clear_drafts':     return await handleClearDrafts(env);
    case 'change_password':  return await handleChangePassword(env, auth, body);
    case 'list_users':       return await handleListUsers(env);
    case 'create_user':      return await handleCreateUser(env, body);
    case 'delete_user':      return await handleDeleteUser(env, body);
    case 'export':           return await handleExport(env);
    default:
      return jsonResponse({
        success: false,
        error: 'unknown_action',
        message: 'إجراء غير معروف',
      }, 400);
  }
}

/* ============================================================
   Authentication
============================================================ */
async function authenticate(env, username, password) {
  username = (username || 'admin').trim().toLowerCase();

  try {
    const user = await env.DB.prepare(
      'SELECT id, username, password_hash, role, is_active FROM users WHERE username = ?'
    ).bind(username).first();

    if (user) {
      if (!user.is_active) {
        return { success: false, error: 'inactive' };
      }
      if (user.password_hash !== password) {
        return { success: false, error: 'wrong_password' };
      }

      try {
        await env.DB.prepare(
          'UPDATE users SET last_login = ? WHERE id = ?'
        ).bind(Math.floor(Date.now() / 1000), user.id).run();
      } catch (e) { /* تجاهل */ }

      return {
        success: true,
        userId: user.id,
        username: user.username,
        role: user.role,
      };
    }
  } catch (e) {
    console.error('DB auth error:', e);
  }

  if (username === 'admin' && password === env.ADMIN_PASSWORD) {
    return {
      success: true,
      userId: null,
      username: 'admin',
      role: 'admin',
    };
  }

  return { success: false, error: 'not_found' };
}

/* ============================================================
   List
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
          'SELECT id, status, sent_at, contract_date FROM contracts WHERE code = ?'
        ).bind(code).first();
      } catch (e) { /* تجاهل */ }

      const partySummary = {};
      const partyKeys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

      if (contractRow) {
        try {
          const parties = await env.DB.prepare(
            'SELECT role, name_de, name_ar, wali_is_bride, witness_is_center FROM parties WHERE contract_id = ?'
          ).bind(contractRow.id).all();

          for (const p of parties.results || []) {
            partySummary[p.role] = {
              nameDe: p.name_de || '—',
              nameAr: p.name_ar || '—',
              waliIsBride: !!p.wali_is_bride,
              witnessIsCenter: !!p.witness_is_center,
            };
          }
        } catch (e) { /* تجاهل */ }
      } else {
        for (const key of partyKeys) {
          const partyRaw = await env.CONTRACT_KV.get(`contract_${code}_${key}`);
          if (partyRaw) {
            try {
              const party = JSON.parse(partyRaw);
              partySummary[key] = {
                nameDe: party.nameDe || '—',
                nameAr: party.nameAr || '—',
                waliIsBride: !!party.waliIsBride,
                witnessIsCenter: !!party.witnessIsCenter,
              };
            } catch (e) {
              partySummary[key] = null;
            }
          } else {
            partySummary[key] = null;
          }
        }
      }

      contracts.push({
        code: code,
        finished: contractRow ? contractRow.status === 'sent' : false,
        inD1: !!contractRow,
        contractDate: contractRow ? contractRow.contract_date : null,
        parties: partySummary,
      });
    }

    return jsonResponse({
      success: true,
      codes: codes,
      contracts: contracts,
    }, 200);

  } catch (err) {
    console.error('handleList error:', err);
    return jsonResponse({
      success: false,
      error: 'kv_error',
      message: 'فشل في قراءة البيانات',
    }, 500);
  }
}

/* ============================================================
   Generate
============================================================ */
async function handleGenerate(env) {
  try {
    const newCodes = [];
    const used = new Set();

    while (newCodes.length < 5) {
      const code = generateRandomCode();
      if (!used.has(code)) {
        used.add(code);
        newCodes.push(code);
      }
    }

    const listResult = await env.CONTRACT_KV.list({ prefix: 'contract_' });
    const deletes = listResult.keys.map(k => env.CONTRACT_KV.delete(k.name));
    deletes.push(env.CONTRACT_KV.delete('codes'));
    await Promise.all(deletes);

    try {
      await env.DB.prepare('DELETE FROM audit_log').run();
      await env.DB.prepare('DELETE FROM dowries').run();
      await env.DB.prepare('DELETE FROM parties').run();
      await env.DB.prepare('DELETE FROM contracts').run();
    } catch (e) {
      console.error('D1 clear error:', e);
    }

    await env.CONTRACT_KV.put('codes', JSON.stringify(newCodes));

    return jsonResponse({
      success: true,
      codes: newCodes,
      message: 'تم توليد 5 أكواد جديدة',
    }, 200);

  } catch (err) {
    console.error('handleGenerate error:', err);
    return jsonResponse({
      success: false,
      error: 'kv_error',
      message: 'فشل في توليد الأكواد',
    }, 500);
  }
}

/* ============================================================
   Delete
============================================================ */
async function handleDelete(env, code) {
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    return jsonResponse({
      success: false,
      error: 'invalid_code',
      message: 'رقم العقد غير صالح',
    }, 400);
  }

  try {
    const codesRaw = await env.CONTRACT_KV.get('codes');
    if (!codesRaw) {
      return jsonResponse({
        success: false,
        error: 'no_codes',
        message: 'لا توجد أكواد',
      }, 404);
    }

    const codes = JSON.parse(codesRaw);
    if (!codes.includes(code)) {
      return jsonResponse({
        success: false,
        error: 'not_found',
        message: 'الكود غير موجود',
      }, 404);
    }

    try {
      const contractRow = await env.DB.prepare(
        'SELECT id FROM contracts WHERE code = ?'
      ).bind(code).first();

      if (contractRow) {
        await env.DB.prepare('DELETE FROM parties WHERE contract_id = ?').bind(contractRow.id).run();
        await env.DB.prepare('DELETE FROM dowries WHERE contract_id = ?').bind(contractRow.id).run();
        await env.DB.prepare('DELETE FROM contracts WHERE id = ?').bind(contractRow.id).run();
      }
    } catch (e) {
      console.error('D1 delete error:', e);
    }

    const partyKeys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];
    const deletes = [];
    for (const key of partyKeys) {
      deletes.push(env.CONTRACT_KV.delete(`contract_${code}_${key}`));
    }
    deletes.push(env.CONTRACT_KV.delete(`contract_${code}_finished`));
    deletes.push(env.CONTRACT_KV.delete(`contract_${code}_finished_at`));
    deletes.push(env.CONTRACT_KV.delete(`contract_${code}_date`));

    const newCodes = codes.filter(c => c !== code);
    deletes.push(env.CONTRACT_KV.put('codes', JSON.stringify(newCodes)));

    await Promise.all(deletes);

    return jsonResponse({
      success: true,
      message: 'تم حذف العقد',
    }, 200);

  } catch (err) {
    console.error('handleDelete error:', err);
    return jsonResponse({
      success: false,
      error: 'kv_error',
      message: 'فشل في الحذف',
    }, 500);
  }
}

/* ============================================================
   View
============================================================ */
async function handleView(env, code) {
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    return jsonResponse({
      success: false,
      error: 'invalid_code',
      message: 'رقم العقد غير صالح',
    }, 400);
  }

  try {
    const contract = {
      code: code,
      finished: false,
      finishedAt: null,
      contractDate: null,
      parties: {},
    };

    const contractRow = await env.DB.prepare(
      'SELECT id, status, sent_at, contract_date FROM contracts WHERE code = ?'
    ).bind(code).first();

    if (contractRow) {
      contract.finished = contractRow.status === 'sent';
      contract.contractDate = contractRow.contract_date;
      if (contractRow.sent_at) {
        contract.finishedAt = new Date(contractRow.sent_at * 1000).toISOString();
      }

      const parties = await env.DB.prepare(
        `SELECT role, name_de, name_ar, birth_day, birth_month, birth_year,
                birth_country, birth_region, id_type, id_number,
                address_number, address_street, postal_code, city,
                mother_name_de, mother_name_ar,
                wali_is_bride, witness_is_center
         FROM parties WHERE contract_id = ?`
      ).bind(contractRow.id).all();

      for (const p of parties.results || []) {
        contract.parties[p.role] = {
          nameDe: p.name_de,
          nameAr: p.name_ar,
          birthDay: p.birth_day,
          birthMonth: p.birth_month,
          birthYear: p.birth_year,
          birthCountry: p.birth_country,
          birthRegion: p.birth_region,
          idType: p.id_type,
          idNumber: p.id_number,
          addressNumber: p.address_number,
          addressStreet: p.address_street,
          postalCode: p.postal_code,
          city: p.city,
          motherNameDe: p.mother_name_de,
          motherNameAr: p.mother_name_ar,
          waliIsBride: !!p.wali_is_bride,
          witnessIsCenter: !!p.witness_is_center,
        };
      }

      const dowry = await env.DB.prepare(
        'SELECT amount_advance, amount_deferred, notes FROM dowries WHERE contract_id = ?'
      ).bind(contractRow.id).first();

      if (dowry && contract.parties.groom) {
        contract.parties.groom.dowryAdvance = dowry.amount_advance;
        contract.parties.groom.dowryDeferred = dowry.amount_deferred;
        contract.parties.groom.dowryNotes = dowry.notes;
      }
    }

    return jsonResponse({
      success: true,
      contract: contract,
    }, 200);

  } catch (err) {
    console.error('handleView error:', err);
    return jsonResponse({
      success: false,
      error: 'db_error',
      message: 'فشل في القراءة',
    }, 500);
  }
}

/* ============================================================
   Search
============================================================ */
async function handleSearch(env, query) {
  if (!query || !query.trim()) {
    return jsonResponse({ success: true, results: [] }, 200);
  }

  const q = '%' + query.trim() + '%';

  try {
    const results = await env.DB.prepare(
      `SELECT DISTINCT c.id, c.code, c.contract_date, c.status, c.sent_at,
              p.role, p.name_de, p.name_ar
       FROM contracts c
       LEFT JOIN parties p ON p.contract_id = c.id
       WHERE c.code LIKE ?
          OR p.name_de LIKE ?
          OR p.name_ar LIKE ?
          OR p.id_number LIKE ?
       ORDER BY c.id DESC
       LIMIT 50`
    ).bind(q, q, q, q).all();

    return jsonResponse({
      success: true,
      results: results.results || [],
    }, 200);

  } catch (err) {
    console.error('handleSearch error:', err);
    return jsonResponse({
      success: false,
      error: 'db_error',
      message: 'فشل البحث',
    }, 500);
  }
}

/* ============================================================
   Clear Drafts
============================================================ */
async function handleClearDrafts(env) {
  try {
    await env.DB.prepare("DELETE FROM parties WHERE contract_id IN (SELECT id FROM contracts WHERE status = 'draft')").run();
    await env.DB.prepare("DELETE FROM dowries WHERE contract_id IN (SELECT id FROM contracts WHERE status = 'draft')").run();
    await env.DB.prepare("DELETE FROM contracts WHERE status = 'draft'").run();

    return jsonResponse({
      success: true,
      message: 'تم حذف العقود غير المُرسلة',
    }, 200);
  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'db_error',
      message: 'فشل الحذف',
    }, 500);
  }
}

/* ============================================================
   Change Password
============================================================ */
async function handleChangePassword(env, auth, body) {
  const oldPw = (body.old_password || '').trim();
  const newPw = (body.new_password || '').trim();
  const confirm = (body.confirm_password || '').trim();

  if (!oldPw || !newPw || !confirm) {
    return jsonResponse({
      success: false,
      error: 'missing_fields',
      message: 'جميع الحقول مطلوبة',
    }, 400);
  }

  if (newPw !== confirm) {
    return jsonResponse({
      success: false,
      error: 'mismatch',
      message: 'كلمتا المرور غير متطابقتين',
    }, 400);
  }

  if (newPw.length < 6) {
    return jsonResponse({
      success: false,
      error: 'too_short',
      message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    }, 400);
  }

  try {
    if (!auth.userId) {
      return jsonResponse({
        success: false,
        error: 'env_admin',
        message: 'لتغيير كلمة مرور الأدمن الرئيسي، عدّلها من Cloudflare',
      }, 403);
    }

    const user = await env.DB.prepare(
      'SELECT password_hash FROM users WHERE id = ?'
    ).bind(auth.userId).first();

    if (!user || user.password_hash !== oldPw) {
      return jsonResponse({
        success: false,
        error: 'wrong_old',
        message: 'كلمة المرور القديمة غير صحيحة',
      }, 401);
    }

    await env.DB.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).bind(newPw, auth.userId).run();

    return jsonResponse({
      success: true,
      message: 'تم تغيير كلمة المرور',
    }, 200);
  } catch (err) {
    console.error('changePassword error:', err);
    return jsonResponse({
      success: false,
      error: 'db_error',
      message: 'فشل التغيير',
    }, 500);
  }
}

/* ============================================================
   List Users
============================================================ */
async function handleListUsers(env) {
  try {
    const users = await env.DB.prepare(
      'SELECT id, username, full_name, email, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC'
    ).all();

    return jsonResponse({
      success: true,
      users: users.results || [],
    }, 200);
  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'db_error',
      message: 'فشل جلب المستخدمين',
    }, 500);
  }
}

/* ============================================================
   Create User - ✅ الآن يقرأ user_username وليس username
============================================================ */
async function handleCreateUser(env, body) {
  const username = (body.user_username || '').trim().toLowerCase();
  const password = (body.user_password || '').trim();
  const fullName = (body.full_name || '').trim();
  const email = (body.user_email || '').trim();
  const role = (body.role || 'user').trim();

  if (!username || !password) {
    return jsonResponse({
      success: false,
      error: 'missing',
      message: 'اسم المستخدم وكلمة المرور مطلوبان',
    }, 400);
  }

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return jsonResponse({
      success: false,
      error: 'invalid_username',
      message: 'اسم المستخدم: 3-20 حرف إنجليزي أو رقم',
    }, 400);
  }

  if (password.length < 6) {
    return jsonResponse({
      success: false,
      error: 'too_short',
      message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    }, 400);
  }

  const validRoles = ['admin', 'manager', 'user', 'viewer'];
  if (!validRoles.includes(role)) {
    return jsonResponse({
      success: false,
      error: 'invalid_role',
      message: 'صلاحية غير صحيحة',
    }, 400);
  }

  try {
    await env.DB.prepare(
      'INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)'
    ).bind(username, password, fullName || null, email || null, role).run();

    return jsonResponse({
      success: true,
      message: 'تم إنشاء المستخدم',
    }, 200);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return jsonResponse({
        success: false,
        error: 'duplicate',
        message: 'اسم المستخدم موجود مسبقاً',
      }, 409);
    }
    return jsonResponse({
      success: false,
      error: 'db_error',
      message: 'فشل الإنشاء',
    }, 500);
  }
}

/* ============================================================
   Delete User
============================================================ */
async function handleDeleteUser(env, body) {
  const userId = parseInt(body.user_id, 10);

  if (!userId) {
    return jsonResponse({
      success: false,
      error: 'invalid_id',
      message: 'معرّف المستخدم مطلوب',
    }, 400);
  }

  try {
    const user = await env.DB.prepare(
      'SELECT username FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return jsonResponse({
        success: false,
        error: 'not_found',
        message: 'المستخدم غير موجود',
      }, 404);
    }

    if (user.username === 'admin') {
      return jsonResponse({
        success: false,
        error: 'protected',
        message: 'لا يمكن حذف المشرف الرئيسي',
      }, 403);
    }

    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();

    return jsonResponse({
      success: true,
      message: 'تم حذف المستخدم',
    }, 200);
  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'db_error',
      message: 'فشل الحذف',
    }, 500);
  }
}

/* ============================================================
   Export
============================================================ */
async function handleExport(env) {
  try {
    const contracts = await env.DB.prepare(
      'SELECT * FROM contracts ORDER BY id DESC'
    ).all();

    const result = [];

    for (const c of contracts.results || []) {
      const parties = await env.DB.prepare(
        'SELECT * FROM parties WHERE contract_id = ?'
      ).bind(c.id).all();

      const dowry = await env.DB.prepare(
        'SELECT * FROM dowries WHERE contract_id = ?'
      ).bind(c.id).first();

      result.push({
        contract: c,
        parties: parties.results || [],
        dowry: dowry || null,
      });
    }

    return jsonResponse({
      success: true,
      exported_at: new Date().toISOString(),
      total: result.length,
      data: result,
    }, 200);
  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'db_error',
      message: 'فشل التصدير',
    }, 500);
  }
}

/* ============================================================
   Helpers
============================================================ */
function generateRandomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function onRequestGet() {
  return jsonResponse({
    error: 'method_not_allowed',
    message: 'استخدم POST فقط',
  }, 405);
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
