/* ============================================================
   Cloudflare Function: POST /api/party
   حفظ واسترجاع بيانات كل طرف على السيرفر
============================================================ */

const VALID_ROLES = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

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

  const code = (body.code || '').trim().toUpperCase();
  const role = (body.role || '').trim();
  const action = (body.action || 'save').trim();
  const data = body.data || null;

  // التحقق من الكود
  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    return jsonResponse({
      success: false,
      error: 'invalid_code',
      message: 'رقم العقد غير صالح',
    }, 400);
  }

  // التحقق من وجود الكود في KV
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
        message: 'الكود غير معتمد',
      }, 404);
    }
  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'kv_error',
      message: 'خطأ في القراءة',
    }, 500);
  }

  // التحقق من أن العقد لم يُرسل
  try {
    const finished = await env.CONTRACT_KV.get(`contract_${code}_finished`);
    if (finished === 'true') {
      return jsonResponse({
        success: false,
        error: 'already_sent',
        message: 'تم إرسال العقد مسبقاً',
      }, 409);
    }
  } catch (e) { /* تجاهل */ }

  /* ============================================================
     Action: status - حالة كل الأطراف
  ============================================================ */
  if (action === 'status') {
    const status = {};
    const savedAt = {};

    for (const r of VALID_ROLES) {
      const raw = await env.CONTRACT_KV.get(`contract_${code}_${r}`);
      const time = await env.CONTRACT_KV.get(`contract_${code}_saved_${r}`);
      status[r] = !!raw;
      savedAt[r] = time || null;
    }

    return jsonResponse({
      success: true,
      status,
      savedAt,
    }, 200);
  }

  /* ============================================================
     Action: get - جلب بيانات طرف معين
  ============================================================ */
  if (action === 'get') {
    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({
        success: false,
        error: 'invalid_role',
        message: 'الطرف غير صحيح',
      }, 400);
    }

    try {
      const raw = await env.CONTRACT_KV.get(`contract_${code}_${role}`);
      return jsonResponse({
        success: true,
        data: raw ? JSON.parse(raw) : null,
      }, 200);
    } catch (err) {
      return jsonResponse({
        success: false,
        error: 'kv_error',
        message: 'فشل القراءة',
      }, 500);
    }
  }

  /* ============================================================
     Action: get_all - جلب كل الأطراف (للإرسال النهائي)
  ============================================================ */
  if (action === 'get_all') {
    const parties = {};
    const missing = [];

    for (const r of VALID_ROLES) {
      const raw = await env.CONTRACT_KV.get(`contract_${code}_${r}`);
      if (raw) {
        try {
          parties[r] = JSON.parse(raw);
        } catch (e) {
          parties[r] = null;
          missing.push(r);
        }
      } else {
        parties[r] = null;
        missing.push(r);
      }
    }

    return jsonResponse({
      success: true,
      parties,
      missing,
      allSaved: missing.length === 0,
    }, 200);
  }

  /* ============================================================
     Action: save - حفظ بيانات طرف
  ============================================================ */
  if (action === 'save') {
    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({
        success: false,
        error: 'invalid_role',
        message: 'الطرف غير صحيح',
      }, 400);
    }

    if (!data || typeof data !== 'object') {
      return jsonResponse({
        success: false,
        error: 'no_data',
        message: 'لا توجد بيانات',
      }, 400);
    }

    // التحقق من الحقول الإلزامية
    const isWali = role === 'wali';
    const isWitness = role === 'witness1' || role === 'witness2';
    const isSpouse = role === 'groom' || role === 'bride';

    const skipValidation = (isWali && data.waliIsBride) ||
                           (isWitness && data.witnessIsCenter);

    if (!skipValidation) {
      if (!data.nameDe || !String(data.nameDe).trim()) {
        return jsonResponse({
          success: false,
          error: 'missing_name',
          message: 'الاسم بالألمانية مطلوب',
        }, 400);
      }

      if (isSpouse && (!data.motherNameDe || !String(data.motherNameDe).trim())) {
        return jsonResponse({
          success: false,
          error: 'missing_mother',
          message: 'اسم الأم بالألمانية مطلوب',
        }, 400);
      }

      if (!data.birthDay || !data.birthMonth || !data.birthYear) {
        return jsonResponse({
          success: false,
          error: 'missing_birth',
          message: 'تاريخ الميلاد مطلوب',
        }, 400);
      }

      if (!data.birthCountry || !String(data.birthCountry).trim() ||
          !data.birthRegion || !String(data.birthRegion).trim()) {
        return jsonResponse({
          success: false,
          error: 'missing_birthplace',
          message: 'مكان الميلاد مطلوب',
        }, 400);
      }

      if (!data.idNumber || !String(data.idNumber).trim()) {
        return jsonResponse({
          success: false,
          error: 'missing_id',
          message: 'رقم الهوية مطلوب',
        }, 400);
      }
    }

    // الحفظ في KV
    try {
      await env.CONTRACT_KV.put(
        `contract_${code}_${role}`,
        JSON.stringify(data)
      );

      await env.CONTRACT_KV.put(
        `contract_${code}_saved_${role}`,
        new Date().toISOString()
      );

      return jsonResponse({
        success: true,
        message: 'تم حفظ البيانات',
      }, 200);

    } catch (err) {
      console.error('Save party error:', err);
      return jsonResponse({
        success: false,
        error: 'kv_error',
        message: 'فشل الحفظ',
      }, 500);
    }
  }

  /* ============================================================
     Action: delete - حذف بيانات طرف (قبل الإرسال)
  ============================================================ */
  if (action === 'delete') {
    if (!VALID_ROLES.includes(role)) {
      return jsonResponse({
        success: false,
        error: 'invalid_role',
        message: 'الطرف غير صحيح',
      }, 400);
    }

    try {
      await env.CONTRACT_KV.delete(`contract_${code}_${role}`);
      await env.CONTRACT_KV.delete(`contract_${code}_saved_${role}`);

      return jsonResponse({
        success: true,
        message: 'تم الحذف',
      }, 200);
    } catch (err) {
      return jsonResponse({
        success: false,
        error: 'kv_error',
        message: 'فشل الحذف',
      }, 500);
    }
  }

  return jsonResponse({
    success: false,
    error: 'unknown_action',
    message: 'إجراء غير معروف',
  }, 400);
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
