/* ============================================================
   Cloudflare Function: POST /api/verify
   التحقق من رقم العقد
============================================================ */

export async function onRequestPost(context) {
  const { request, env } = context;

  /* ---------------------------------------------
     1. قراءة البيانات من الطلب
  --------------------------------------------- */
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

  /* ---------------------------------------------
     2. التحقق الأساسي من الكود
  --------------------------------------------- */
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

  /* ---------------------------------------------
     3. قراءة الأكواد من KV
  --------------------------------------------- */
  let codes;
  try {
    const codesRaw = await env.CONTRACT_KV.get('codes');
    if (!codesRaw) {
      return jsonResponse({
        valid: false,
        error: 'no_codes',
        message: 'لم يتم توليد أكواد بعد. تواصل مع المركز.',
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

  /* ---------------------------------------------
     4. التحقق من وجود الكود في القائمة
  --------------------------------------------- */
  if (!Array.isArray(codes) || !codes.includes(code)) {
    return jsonResponse({
      valid: false,
      error: 'not_found',
      message: 'رقم العقد غير معتمد',
    }, 404);
  }

  /* ---------------------------------------------
     5. التحقق هل العقد تم إرساله مسبقاً
  --------------------------------------------- */
  try {
    const finished = await env.CONTRACT_KV.get(`contract_${code}_finished`);
    if (finished === 'true') {
      return jsonResponse({
        valid: false,
        error: 'already_sent',
        message: 'هذا العقد تم إرساله مسبقاً',
      }, 409);
    }
  } catch (err) {
    console.error('KV read finished error:', err);
    /* لا نوقف العملية — نستمر */
  }

  /* ---------------------------------------------
     6. قراءة حالة كل طرف (مكتمل أم لا)
  --------------------------------------------- */
  const partyStatus = {};
  const partyKeys = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

  try {
    const statuses = await Promise.all(
      partyKeys.map(async (key) => {
        const val = await env.CONTRACT_KV.get(`contract_${code}_${key}`);
        return [key, val !== null];
      })
    );
    statuses.forEach(([key, has]) => {
      partyStatus[key] = has;
    });
  } catch (err) {
    console.error('KV read parties error:', err);
    /* نستمر بحالة فارغة */
    partyKeys.forEach(key => { partyStatus[key] = false; });
  }

  /* ---------------------------------------------
     7. النجاح
  --------------------------------------------- */
  return jsonResponse({
    valid: true,
    code: code,
    partyStatus: partyStatus,
    timestamp: Date.now(),
  }, 200);
}

/* ============================================================
   رفض باقي طرق HTTP
============================================================ */
export async function onRequestGet() {
  return jsonResponse({
    error: 'method_not_allowed',
    message: 'استخدم POST فقط',
  }, 405);
}

export async function onRequest(context) {
  return jsonResponse({
    error: 'method_not_allowed',
    message: 'استخدم POST فقط',
  }, 405);
}

/* ============================================================
   دالة مساعدة: إرجاع JSON
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
