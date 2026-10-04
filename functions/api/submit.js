/* ============================================================
   Cloudflare Function: POST /api/submit (v2)
   يكمل العملية: يحول status إلى 'sent' + يرسل البريد
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

  const code = (body.code || '').trim().toUpperCase();
  const contractDate = (body.contractDate || '').trim();

  if (!code || code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code)) {
    return jsonResponse({
      success: false,
      error: 'invalid_code',
      message: 'رقم العقد غير صالح',
    }, 400);
  }

  if (!contractDate) {
    return jsonResponse({
      success: false,
      error: 'missing_contract_date',
      message: 'تاريخ العقد مطلوب',
    }, 400);
  }

  // التحقق من الكود
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
        message: 'رقم العقد غير معتمد',
      }, 404);
    }
  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'kv_error',
      message: 'خطأ في القراءة',
    }, 500);
  }

  // التحقق من عدم الإرسال المسبق
  try {
    const finished = await env.CONTRACT_KV.get(`contract_${code}_finished`);
    if (finished === 'true') {
      return jsonResponse({
        success: false,
        error: 'already_sent',
        message: 'تم إرسال هذا العقد مسبقاً',
      }, 409);
    }
  } catch (e) { /* تجاهل */ }

  /* ============================================================
     1. جلب بيانات الأطراف (من KV — كنسخة أساسية)
  ============================================================ */
  const roles = ['groom', 'bride', 'wali', 'witness1', 'witness2'];
  const data = {};
  const missing = [];

  for (const role of roles) {
    try {
      const raw = await env.CONTRACT_KV.get(`contract_${code}_${role}`);
      if (raw) {
        data[role] = JSON.parse(raw);
      } else {
        missing.push(role);
      }
    } catch (e) {
      missing.push(role);
    }
  }

  if (missing.length > 0) {
    return jsonResponse({
      success: false,
      error: 'missing_parties',
      message: 'لم يكتمل جميع الأطراف',
      missing: missing,
    }, 400);
  }

  /* ============================================================
     2. تحديث العقد في D1 → status = 'sent'
  ============================================================ */
  let contractId;

  try {
    // هل العقد موجود في D1؟
    const contractRow = await env.DB.prepare(
      'SELECT id, status FROM contracts WHERE code = ?'
    ).bind(code).first();

    if (!contractRow) {
      // لم يُنشأ بعد → أنشئه كاملاً
      const insertResult = await env.DB.prepare(
        `INSERT INTO contracts (code, contract_date, status, sent_at)
         VALUES (?, ?, 'sent', ?)`
      ).bind(
        code,
        contractDate,
        Math.floor(Date.now() / 1000)
      ).run();

      contractId = insertResult.meta.last_row_id;

      // أضف كل الأطراف
      for (const role of roles) {
        const p = data[role];
        if (!p) continue;

        await env.DB.prepare(
          `INSERT INTO parties (
            contract_id, role,
            name_de, name_ar,
            birth_day, birth_month, birth_year,
            birth_country, birth_region,
            id_type, id_number,
            address_number, address_street, postal_code, city,
            mother_name_de, mother_name_ar,
            wali_is_bride, witness_is_center
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          contractId, role,
          p.nameDe || null, p.nameAr || null,
          p.birthDay ? parseInt(p.birthDay, 10) : null,
          p.birthMonth ? parseInt(p.birthMonth, 10) : null,
          p.birthYear ? parseInt(p.birthYear, 10) : null,
          p.birthCountry || null, p.birthRegion || null,
          p.idType || null, p.idNumber || null,
          p.addressNumber || null, p.addressStreet || null,
          p.postalCode || null, p.city || null,
          p.motherNameDe || null, p.motherNameAr || null,
          p.waliIsBride ? 1 : 0, p.witnessIsCenter ? 1 : 0
        ).run();
      }

      // المهر
      const groom = data.groom || {};
      if (groom.dowryAdvance || groom.dowryDeferred || groom.dowryNotes) {
        await env.DB.prepare(
          `INSERT INTO dowries (contract_id, amount_advance, amount_deferred, notes)
           VALUES (?, ?, ?, ?)`
        ).bind(
          contractId,
          groom.dowryAdvance ? parseFloat(groom.dowryAdvance) : null,
          groom.dowryDeferred ? parseFloat(groom.dowryDeferred) : null,
          groom.dowryNotes || null
        ).run();
      }

    } else {
      // موجود → حدّث فقط
      contractId = contractRow.id;

      // تحديث الحالة
      await env.DB.prepare(
        `UPDATE contracts SET status = 'sent', sent_at = ?, contract_date = ?
         WHERE id = ?`
      ).bind(
        Math.floor(Date.now() / 1000),
        contractDate,
        contractId
      ).run();

      // تحديث كل الأطراف (احتياطياً — قد تكون حديثة)
      for (const role of roles) {
        const p = data[role];
        if (!p) continue;

        // احذف القديم
        await env.DB.prepare(
          'DELETE FROM parties WHERE contract_id = ? AND role = ?'
        ).bind(contractId, role).run();

        // أضف الجديد
        await env.DB.prepare(
          `INSERT INTO parties (
            contract_id, role,
            name_de, name_ar,
            birth_day, birth_month, birth_year,
            birth_country, birth_region,
            id_type, id_number,
            address_number, address_street, postal_code, city,
            mother_name_de, mother_name_ar,
            wali_is_bride, witness_is_center
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          contractId, role,
          p.nameDe || null, p.nameAr || null,
          p.birthDay ? parseInt(p.birthDay, 10) : null,
          p.birthMonth ? parseInt(p.birthMonth, 10) : null,
          p.birthYear ? parseInt(p.birthYear, 10) : null,
          p.birthCountry || null, p.birthRegion || null,
          p.idType || null, p.idNumber || null,
          p.addressNumber || null, p.addressStreet || null,
          p.postalCode || null, p.city || null,
          p.motherNameDe || null, p.motherNameAr || null,
          p.waliIsBride ? 1 : 0, p.witnessIsCenter ? 1 : 0
        ).run();
      }

      // المهر
      await env.DB.prepare(
        'DELETE FROM dowries WHERE contract_id = ?'
      ).bind(contractId).run();

      const groom = data.groom || {};
      if (groom.dowryAdvance || groom.dowryDeferred || groom.dowryNotes) {
        await env.DB.prepare(
          `INSERT INTO dowries (contract_id, amount_advance, amount_deferred, notes)
           VALUES (?, ?, ?, ?)`
        ).bind(
          contractId,
          groom.dowryAdvance ? parseFloat(groom.dowryAdvance) : null,
          groom.dowryDeferred ? parseFloat(groom.dowryDeferred) : null,
          groom.dowryNotes || null
        ).run();
      }
    }

    // Audit log
    try {
      await env.DB.prepare(
        `INSERT INTO audit_log (action, entity_type, entity_id, details)
         VALUES ('submit', 'contract', ?, ?)`
      ).bind(contractId, `Contract ${code} finalized`).run();
    } catch (e) { /* تجاهل */ }

  } catch (err) {
    console.error('D1 update error:', err);
    return jsonResponse({
      success: false,
      error: 'db_error',
      message: 'فشل تحديث قاعدة البيانات',
      details: err.message,
    }, 500);
  }

  /* ============================================================
     3. إرسال البريد
  ============================================================ */
  try {
    const emailResult = await sendEmailViaEmailJS(env, code, data, contractDate);
    if (!emailResult.success) {
      console.error('EmailJS failed:', emailResult);
    }
  } catch (err) {
    console.error('Email error:', err);
  }

  /* ============================================================
     4. وضع علامة "finished" في KV
  ============================================================ */
  try {
    await env.CONTRACT_KV.put(`contract_${code}_finished`, 'true');
    await env.CONTRACT_KV.put(`contract_${code}_finished_at`, new Date().toISOString());
    await env.CONTRACT_KV.put(`contract_${code}_date`, contractDate);
  } catch (e) { /* تجاهل */ }

  return jsonResponse({
    success: true,
    code: code,
    contractId: contractId,
    message: 'تم استلام العقد بنجاح',
    timestamp: Date.now(),
  }, 200);
}

/* ============================================================
   EmailJS
============================================================ */
async function sendEmailViaEmailJS(env, code, data, contractDate) {
  const serviceId = env.EMAILJS_SERVICE_ID;
  const templateId = env.EMAILJS_TEMPLATE_ID;
  const publicKey = env.EMAILJS_PUBLIC_KEY;
  const privateKey = env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey) {
    return { success: false, error: 'missing_emailjs_config' };
  }

  const params = buildEmailParams(code, data, contractDate);

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: params,
  };

  if (privateKey) payload.accessToken = privateKey;

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: text, status: response.status };
  }

  return { success: true };
}

function buildEmailParams(code, data, contractDate) {
  const g = data.groom || {};
  const b = data.bride || {};
  const w = data.wali || {};
  const w1 = data.witness1 || {};
  const w2 = data.witness2 || {};

  const waliIsBride = !!w.waliIsBride;
  const w1IsCenter = !!w1.witnessIsCenter;
  const w2IsCenter = !!w2.witnessIsCenter;

  const idType = (type) => type === 'passport' ? 'Passport' : 'ID';
  const birthDate = (p) => {
    const d = (p.birthDay || '').padStart(2, '0');
    const m = (p.birthMonth || '').padStart(2, '0');
    const y = p.birthYear || '';
    if (!d || !m || !y) return '—';
    return `${d}.${m}.${y}`;
  };

  return {
    contract_code: code,
    contract_date: contractDate || '—',
    sent_at: new Date().toLocaleString('de-DE'),

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
    groom_dowry_advance: g.dowryAdvance || '—',
    groom_dowry_deferred: g.dowryDeferred || '—',
    groom_dowry_notes: g.dowryNotes || '—',

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
