/* ============================================================
   Cloudflare Function: POST /api/admin
   إدارة الأكواد والعقود - محمي بكلمة سر
============================================================ */

export async function onRequestPost(context) {
  const { request, env } = context;

  /* ---------------------------------------------
     1. قراءة البيانات
  --------------------------------------------- */
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

  /* ---------------------------------------------
     2. التحقق من كلمة السر
  --------------------------------------------- */
  if (!password) {
    return jsonResponse({
      success: false,
      error: 'missing_password',
      message: 'كلمة المرور مطلوبة',
    }, 401);
  }

  const adminPassword = env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return jsonResponse({
      success: false,
      error: 'server_misconfigured',
      message: 'خطأ في إعداد الخادم',
    }, 500);
  }

  if (password !== adminPassword) {
    return jsonResponse({
      success: false,
      error: 'wrong_password',
      message: 'كلمة المرور خاطئة',
    }, 401);
  }

  /* ---------------------------------------------
     3. تنفيذ Action
  --------------------------------------------- */
  switch (action) {
    case 'login':
      return await handleLogin(env);

    case 'list':
      return await handleList(env);

    case 'generate':
      return await handleGenerate(env);

    case 'delete':
      return await handleDelete(env, body.code);

    case 'view':
      return await handleView(env, body.code);

    default:
      return jsonResponse({
        success: false,
        error: 'unknown_action',
        message: 'إجراء غير معروف',
      }, 400);
  }
}

/* ============================================================
   Action: login
============================================================ */
async function handleLogin(env) {
  return jsonResponse({
    success: true,
    message: 'تم تسجيل الدخول',
  }, 200);
}

/* ============================================================
   Action: list - عرض كل الأكواد وحالتها
============================================================ */
async function handleList(env) {
  try {
    const codesRaw = await env.CONTRACT_KV.get('codes');
    if (!codesRaw) {
      return jsonResponse({
        success: true,
        codes: [],
        contracts: [],
      }, 200);
    }

    const codes = JSON.parse(codesRaw);
    const contracts = [];

    for (const code of codes) {
      const finished = await env.CONTRACT_KV.get(`contract_${code}_finished`);

      /* جلب أسماء الأطراف للعرض */
      const partySummary = {};
      const partyKeys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

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

      contracts.push({
        code: code,
        finished: finished === 'true',
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
   Action: generate - توليد 5 أكواد جديدة
============================================================ */
async function handleGenerate(env) {
  try {
    /* توليد 5 أكواد فريدة */
    const newCodes = [];
    const used = new Set();

    while (newCodes.length < 5) {
      const code = generateRandomCode();
      if (!used.has(code)) {
        used.add(code);
        newCodes.push(code);
      }
    }

    /* حذف كل العقود القديمة والمسودات */
    const listResult = await env.CONTRACT_KV.list({ prefix: 'contract_' });
    const deletes = listResult.keys.map(k => env.CONTRACT_KV.delete(k.name));

    /* حذف قائمة الأكواد القديمة */
    deletes.push(env.CONTRACT_KV.delete('codes'));

    await Promise.all(deletes);

    /* كتابة الأكواد الجديدة */
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
   Action: delete - حذف عقد واحد
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
    /* التحقق أن الكود موجود في القائمة */
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

    /* حذف كل بيانات العقد */
    const partyKeys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];
    const deletes = [];

    for (const key of partyKeys) {
      deletes.push(env.CONTRACT_KV.delete(`contract_${code}_${key}`));
    }
    deletes.push(env.CONTRACT_KV.delete(`contract_${code}_finished`));
    deletes.push(env.CONTRACT_KV.delete(`contract_${code}_finished_at`));

    /* إزالة الكود من القائمة */
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
   Action: view - عرض بيانات عقد واحد
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
      parties: {},
    };

    const partyKeys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

    for (const key of partyKeys) {
      const raw = await env.CONTRACT_KV.get(`contract_${code}_${key}`);
      if (raw) {
        try {
          contract.parties[key] = JSON.parse(raw);
        } catch (e) {
          contract.parties[key] = null;
        }
      } else {
        contract.parties[key] = null;
      }
    }

    const finished = await env.CONTRACT_KV.get(`contract_${code}_finished`);
    contract.finished = finished === 'true';

    const finishedAt = await env.CONTRACT_KV.get(`contract_${code}_finished_at`);
    contract.finishedAt = finishedAt || null;

    return jsonResponse({
      success: true,
      contract: contract,
    }, 200);

  } catch (err) {
    console.error('handleView error:', err);
    return jsonResponse({
      success: false,
      error: 'kv_error',
      message: 'فشل في القراءة',
    }, 500);
  }
}

/* ============================================================
   توليد كود عشوائي (6 خانات)
============================================================ */
function generateRandomCode() {
  /* بدون I, O, 0, 1 لتجنب الالتباس */
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/* ============================================================
   رفض باقي الطرق
============================================================ */
export async function onRequestGet() {
  return jsonResponse({
    error: 'method_not_allowed',
    message: 'استخدم POST فقط',
  }, 405);
}

/* ============================================================
   دالة مساعدة
============================================================ */
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
