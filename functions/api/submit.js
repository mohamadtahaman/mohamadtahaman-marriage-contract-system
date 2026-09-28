/* ============================================================
   Cloudflare Function: POST /api/submit
   استقبال بيانات العقد + إرسال بريد عبر EmailJS
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

  const code = (body.code || '').trim().toUpperCase();
  const data = body.data || {};

  /* ---------------------------------------------
     2. التحقق من الكود
  --------------------------------------------- */
  if (!code || code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code)) {
    return jsonResponse({
      success: false,
      error: 'invalid_code',
      message: 'رقم العقد غير صالح',
    }, 400);
  }

  /* ---------------------------------------------
     3. التحقق من وجود الكود في KV
  --------------------------------------------- */
  try {
    const codesRaw = await env.CONTRACT_KV.get('codes');
    if (!codesRaw) {
      return jsonResponse({
        success: false,
        error: 'no_codes',
        message: 'لا توجد أكواد معتمدة',
      }, 404);
    }
    const codes = JSON.parse(codesRaw);
    if (!Array.isArray(codes) || !codes.includes(code)) {
      return jsonResponse({
        success: false,
        error: 'not_found',
        message: 'رقم العقد غير معتمد',
      }, 404);
    }
  } catch (err) {
    console.error('KV codes read error:', err);
    return jsonResponse({
      success: false,
      error: 'kv_error',
      message: 'خطأ في القراءة',
    }, 500);
  }

  /* ---------------------------------------------
     4. التحقق أن العقد لم يُرسل مسبقاً
  --------------------------------------------- */
  try {
    const finished = await env.CONTRACT_KV.get(`contract_${code}_finished`);
    if (finished === 'true') {
      return jsonResponse({
        success: false,
        error: 'already_sent',
        message: 'تم إرسال هذا العقد مسبقاً',
      }, 409);
    }
  } catch (err) {
    console.error('KV finished read error:', err);
  }

  /* ---------------------------------------------
     5. التحقق من اكتمال البيانات
  --------------------------------------------- */
  const requiredParties = ['groom', 'bride', 'wali', 'witness1', 'witness2'];
  const missing = [];

  for (const key of requiredParties) {
    const p = data[key];
    if (!p) {
      missing.push(key);
      continue;
    }

    /* الولي: يكفي "ولي هي الزوجة" */
    if (key === 'wali' && p.waliIsBride) continue;

    /* الشاهد: يكفي "طرف المركز" */
    if ((key === 'witness1' || key === 'witness2') && p.witnessIsCenter) continue;

    /* الاسم بالألمانية إلزامي */
    if (!p.nameDe || !p.nameDe.trim()) {
      missing.push(key);
      continue;
    }

    /* اسم الأم إلزامي للزوجين */
    if ((key === 'groom' || key === 'bride') &&
        (!p.motherNameDe || !p.motherNameDe.trim())) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    return jsonResponse({
      success: false,
      error: 'incomplete_data',
      message: 'بيانات ناقصة',
      missing: missing,
    }, 400);
  }

  /* ---------------------------------------------
     6. حفظ كل طرف في KV
  --------------------------------------------- */
  try {
    const saves = [];
    for (const key of requiredParties) {
      const partyData = JSON.stringify(data[key]);
      saves.push(env.CONTRACT_KV.put(`contract_${code}_${key}`, partyData));
    }
    await Promise.all(saves);
  } catch (err) {
    console.error('KV save error:', err);
    return jsonResponse({
      success: false,
      error: 'kv_save_error',
      message: 'فشل حفظ البيانات',
    }, 500);
  }

  /* ---------------------------------------------
     7. إرسال البريد عبر EmailJS
  --------------------------------------------- */
  try {
    const emailSent = await sendEmailViaEmailJS(env, code, data);
    if (!emailSent.success) {
      console.error('EmailJS failed:', emailSent);
      /* لا نوقف العملية — البيانات محفوظة، البريد يمكن إعادة إرساله */
    }
  } catch (err) {
    console.error('Email error:', err);
    /* نستمر — البيانات محفوظة */
  }

  /* ---------------------------------------------
     8. وضع علامة "مكتمل"
  --------------------------------------------- */
  try {
    await env.CONTRACT_KV.put(`contract_${code}_finished`, 'true');
    await env.CONTRACT_KV.put(`contract_${code}_finished_at`,
      new Date().toISOString());
  } catch (err) {
    console.error('KV finish error:', err);
    /* استمر — البيانات محفوظة على أي حال */
  }

  /* ---------------------------------------------
     9. النجاح
  --------------------------------------------- */
  return jsonResponse({
    success: true,
    code: code,
    message: 'تم استلام العقد بنجاح',
    timestamp: Date.now(),
  }, 200);
}

/* ============================================================
   إرسال البريد عبر EmailJS
============================================================ */
async function sendEmailViaEmailJS(env, code, data) {
  const serviceId = env.EMAILJS_SERVICE_ID;
  const templateId = env.EMAILJS_TEMPLATE_ID;
  const publicKey = env.EMAILJS_PUBLIC_KEY;
  const privateKey = env.EMAILJS_PRIVATE_KEY; /* اختياري */

  if (!serviceId || !templateId || !publicKey) {
    return { success: false, error: 'missing_emailjs_config' };
  }

  /* تجهيز المتغيرات */
  const params = buildEmailParams(code, data);

  /* جسم الطلب */
  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: params,
  };

  /* إذا كان Private Key متوفراً (للأمان الأعلى) */
  if (privateKey) {
    payload.accessToken = privateKey;
  }

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: text, status: response.status };
  }

  return { success: true };
}

/* ============================================================
   تجهيز متغيرات قالب البريد
============================================================ */
function buildEmailParams(code, data) {
  const g = data.groom || {};
  const b = data.bride || {};
  const w = data.wali || {};
  const w1 = data.witness1 || {};
  const w2 = data.witness2 || {};

  const waliIsBride = !!w.waliIsBride;
  const w1IsCenter = !!w1.witnessIsCenter;
  const w2IsCenter = !!w2.witnessIsCenter;

  const idType = (t) => t === 'passport' ? 'Passport' : 'ID';
  const birthDate = (p) => {
    const d = (p.birthDay || '').padStart(2, '0');
    const m = (p.birthMonth || '').padStart(2, '0');
    const y = p.birthYear || '';
    if (!d || !m || !y) return '—';
    return `${d}.${m}.${y}`;
  };

  return {
    /* العقد */
    contract_code: code,
    sent_at: new Date().toLocaleString('de-DE'),

    /* الزوج */
    groom_name_de: g.nameDe || '—',
    groom_name_ar: g.nameAr || '—',
    groom_birth: birthDate(g),
    groom_birth_region: g.birthRegion || '—',
    groom_birth_country: g.birthCountry || '—',
    groom_id_type: idType(g.idType),
    groom_id_number: g.idNumber || '—',
    groom_address: `${g.addressStreet || ''} ${g.addressNumber || ''}`.trim() || '—',
    groom_postal: g.postalCode || '—',
    groom_city: g.city || '—',
    groom_mother_de: g.motherNameDe || '—',
    groom_mother_ar: g.motherNameAr || '—',

    /* المهر */
    groom_dowry_advance: g.dowryAdvance || '—',
    groom_dowry_deferred: g.dowryDeferred || '—',
    groom_dowry_notes: g.dowryNotes || '—',

    /* الزوجة */
    bride_name_de: b.nameDe || '—',
    bride_name_ar: b.nameAr || '—',
    bride_birth: birthDate(b),
    bride_birth_region: b.birthRegion || '—',
    bride_birth_country: b.birthCountry || '—',
    bride_id_type: idType(b.idType),
    bride_id_number: b.idNumber || '—',
    bride_address: `${b.addressStreet || ''} ${b.addressNumber || ''}`.trim() || '—',
    bride_postal: b.postalCode || '—',
    bride_city: b.city || '—',
    bride_mother_de: b.motherNameDe || '—',
    bride_mother_ar: b.motherNameAr || '—',

    /* الولي */
    wali_status: waliIsBride ? 'Bride is her own Wali' : 'Wali present',
    wali_name_de: waliIsBride ? '—' : (w.nameDe || '—'),
    wali_name_ar: waliIsBride ? '—' : (w.nameAr || '—'),
    wali_birth: waliIsBride ? '—' : birthDate(w),
    wali_birth_region: waliIsBride ? '—' : (w.birthRegion || '—'),
    wali_birth_country: waliIsBride ? '—' : (w.birthCountry || '—'),
    wali_id_type: waliIsBride ? '—' : idType(w.idType),
    wali_id_number: waliIsBride ? '—' : (w.idNumber || '—'),
    wali_address: waliIsBride ? '—' : `${w.addressStreet || ''} ${w.addressNumber || ''}`.trim() || '—',
    wali_postal: waliIsBride ? '—' : (w.postalCode || '—'),
    wali_city: waliIsBride ? '—' : (w.city || '—'),

    /* الشاهد الأول */
    w1_status: w1IsCenter ? 'Center Witness' : 'Witness present',
    w1_name_de: w1IsCenter ? '—' : (w1.nameDe || '—'),
    w1_name_ar: w1IsCenter ? '—' : (w1.nameAr || '—'),
    w1_birth: w1IsCenter ? '—' : birthDate(w1),
    w1_birth_region: w1IsCenter ? '—' : (w1.birthRegion || '—'),
    w1_birth_country: w1IsCenter ? '—' : (w1.birthCountry || '—'),
    w1_id_type: w1IsCenter ? '—' : idType(w1.idType),
    w1_id_number: w1IsCenter ? '—' : (w1.idNumber || '—'),
    w1_address: w1IsCenter ? '—' : `${w1.addressStreet || ''} ${w1.addressNumber || ''}`.trim() || '—',
    w1_postal: w1IsCenter ? '—' : (w1.postalCode || '—'),
    w1_city: w1IsCenter ? '—' : (w1.city || '—'),

    /* الشاهد الثاني */
    w2_status: w2IsCenter ? 'Center Witness' : 'Witness present',
    w2_name_de: w2IsCenter ? '—' : (w2.nameDe || '—'),
    w2_name_ar: w2IsCenter ? '—' : (w2.nameAr || '—'),
    w2_birth: w2IsCenter ? '—' : birthDate(w2),
    w2_birth_region: w2IsCenter ? '—' : (w2.birthRegion || '—'),
    w2_birth_country: w2IsCenter ? '—' : (w2.birthCountry || '—'),
    w2_id_type: w2IsCenter ? '—' : idType(w2.idType),
    w2_id_number: w2IsCenter ? '—' : (w2.idNumber || '—'),
    w2_address: w2IsCenter ? '—' : `${w2.addressStreet || ''} ${w2.addressNumber || ''}`.trim() || '—',
    w2_postal: w2IsCenter ? '—' : (w2.postalCode || '—'),
    w2_city: w2IsCenter ? '—' : (w2.city || '—'),
  };
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
