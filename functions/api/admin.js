/* ============================================================
   Cloudflare Function: POST /api/admin (v2 - D1)
============================================================ */

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

  switch (action) {
    case 'login':      return await handleLogin(env);
    case 'list':       return await handleList(env);
    case 'generate':   return await handleGenerate(env);
    case 'delete':     return await handleDelete(env, body.code);
    case 'view':       return await handleView(env, body.code);
    case 'search':     return await handleSearch(env, body.query);
    case 'clear_drafts': return await handleClearDrafts(env);
    default:
      return jsonResponse({
        success: false,
        error: 'unknown_action',
        message: 'إجراء غير معروف',
      }, 400);
  }
}

/* ============================================================
   Login
============================================================ */
async function handleLogin(env) {
  return jsonResponse({ success: true, message: 'تم تسجيل الدخول' }, 200);
}

/* ============================================================
   List - الأكواد من KV + العقود من D1
============================================================ */
async function handleList(env) {
  try {
    const codesRaw = await env.CONTRACT_KV.get('codes');
    const codes = codesRaw ? JSON.parse(codesRaw) : [];

    const contracts = [];

    for (const code of codes) {
      // هل العقد موجود في D1؟
      let contractRow = null;
      try {
        contractRow = await env.DB.prepare(
          'SELECT id, status, sent_at, contract_date FROM contracts WHERE code = ?'
        ).bind(code).first();
      } catch (e) {
        // تجاهل
      }

      // جلب ملخص الأطراف
      const partySummary = {};
      const partyKeys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

      if (contractRow) {
        // من D1
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
        } catch (e) {
          // تجاهل
        }
      } else {
        // من KV (لم يُنقل بعد)
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
   Generate - توليد 5 أكواد جديدة (يمسح كل شيء)
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

    // 1. مسح كل مفاتيح KV
    const listResult = await env.CONTRACT_KV.list({ prefix: 'contract_' });
    const deletes = listResult.keys.map(k => env.CONTRACT_KV.delete(k.name));
    deletes.push(env.CONTRACT_KV.delete('codes'));
    await Promise.all(deletes);

    // 2. مسح العقود من D1 (كل شيء بما فيها المُرسلة)
    try {
      await env.DB.prepare('DELETE FROM audit_log').run();
      await env.DB.prepare('DELETE FROM dowries').run();
      await env.DB.prepare('DELETE FROM parties').run();
      await env.DB.prepare('DELETE FROM contracts').run();
    } catch (e) {
      console.error('D1 clear error:', e);
    }

    // 3. كتابة الأكواد الجديدة
    await env.CONTRACT_KV.put('codes', JSON.stringify(newCodes));

    return jsonResponse({
      success: true,
      codes: newCodes,
      message: 'تم توليد 5 أكواد جديدة وحذف كل العقود السابقة',
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
   Delete - حذف عقد واحد
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

    // حذف من D1
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

    // حذف من KV
    const partyKeys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];
    const deletes = [];
    for (const key of partyKeys) {
      deletes.push(env.CONTRACT_KV.delete(`contract_${code}_${key}`));
    }
    deletes.push(env.CONTRACT_KV.delete(`contract_${code}_finished`));
    deletes.push(env.CONTRACT_KV.delete(`contract_${code}_finished_at`));
    deletes.push(env.CONTRACT_KV.delete(`contract_${code}_date`));

    // إزالة الكود من القائمة
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
   View - عرض عقد من D1
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

    // جلب العقد من D1
    const contractRow = await env.DB.prepare(
      'SELECT id, status, sent_at, contract_date FROM contracts WHERE code = ?'
    ).bind(code).first();

    if (contractRow) {
      contract.finished = contractRow.status === 'sent';
      contract.contractDate = contractRow.contract_date;
      if (contractRow.sent_at) {
        contract.finishedAt = new Date(contractRow.sent_at * 1000).toISOString();
      }

      // جلب الأطراف
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

      // جلب المهر
      const dowry = await env.DB.prepare(
        'SELECT amount_advance, amount_deferred, notes FROM dowries WHERE contract_id = ?'
      ).bind(contractRow.id).first();

      if (dowry) {
        if (contract.parties.groom) {
          contract.parties.groom.dowryAdvance = dowry.amount_advance;
          contract.parties.groom.dowryDeferred = dowry.amount_deferred;
          contract.parties.groom.dowryNotes = dowry.notes;
        }
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
   Search - بحث في D1
============================================================ */
async function handleSearch(env, query) {
  if (!query || !query.trim()) {
    return jsonResponse({
      success: true,
      results: [],
    }, 200);
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
   Clear Drafts - حذف العقود غير المُرسلة
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
   Helper
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
