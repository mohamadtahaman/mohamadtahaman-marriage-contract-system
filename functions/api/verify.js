/* ============================================================
   Cloudflare Function: POST /api/verify
   التحقق من رقم العقد + جلب حالة الأطراف
============================================================ */

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({
      valid: false,
      error: 'invalid_json',
      message: 'طلب غير صالح',
    }, 400);
  }

  const code = (body.code || '').trim().toUpperCase();

  // التحقق الأساسي
  if (!code) {
    return jsonResponse({
      valid: false,
      error: 'missing_code',
      message: 'رقم العقد مطلوب',
    }, 400);
  }

  if (code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code)) {
    return jsonResponse({
      valid: false,
      error: 'invalid_format',
      message: 'رقم العقد يجب أن يكون 6 أحرف/أرقام إنجليزية',
    }, 400);
  }

  // قراءة الأكواد
  let codes;
  try {
    const codesRaw = await env.CONTRACT_KV.get('codes');
    if (!codesRaw) {
      return jsonResponse({
        valid: false,
        error: 'no_codes',
        message: 'لم يتم توليد أكواد بعد',
      }, 404);
    }
    codes = JSON.parse(codesRaw);
  } catch (err) {
    console.error('KV read error:', err);
    return jsonResponse({
      valid: false,
      error: 'kv_error',
      message: 'خطأ في قراءة البيانات',
    }, 500);
  }

  // التحقق من وجود الكود
  if (!Array.isArray(codes) || !codes.includes(code)) {
    return jsonResponse({
      valid: false,
      error: 'not_found',
      message: 'رقم العقد غير معتمد',
    }, 404);
  }

  // هل تم إرسال العقد؟
  try {
    const finished = await env.CONTRACT_KV.get(`contract_${code}_finished`);
    if (finished === 'true') {
      return jsonResponse({
        valid: false,
        error: 'already_sent',
        message: 'هذا العقد تم إرساله مسبقاً',
      }, 409);
    }
  } catch (e) { /* تجاهل */ }

  // ✅ حالة كل طرف (هل حفظ بياناته على السيرفر؟)
  const partyStatus = {};
  const partySavedAt = {};
  const partyKeys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

  try {
    const results = await Promise.all(
      partyKeys.map(async (key) => {
        const val = await env.CONTRACT_KV.get(`contract_${code}_${key}`);
        const time = await env.CONTRACT_KV.get(`contract_${code}_saved_${key}`);
        return { key, has: val !== null, time };
      })
    );

    results.forEach(({ key, has, time }) => {
      partyStatus[key] = has;
      partySavedAt[key] = time || null;
    });
  } catch (err) {
    console.error('KV parties error:', err);
    partyKeys.forEach(key => {
      partyStatus[key] = false;
      partySavedAt[key] = null;
    });
  }

  const savedCount = Object.values(partyStatus).filter(Boolean).length;

  return jsonResponse({
    valid: true,
    code: code,
    partyStatus: partyStatus,
    partySavedAt: partySavedAt,
    savedCount: savedCount,
    totalParties: 5,
    allSaved: savedCount === 5,
    timestamp: Date.now(),
  }, 200);
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
