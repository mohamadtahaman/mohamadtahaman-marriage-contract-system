/* ============================================================
   Cloudflare Function: POST /api/party (v3)
   يحفظ في KV + D1 فوراً + يدعم الصور الشخصية
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
  const contractDate = (body.contractDate || '').trim();

  if (!code || !/^[A-Z0-9]{6}$/.test(code)) {
    return jsonResponse({
      success: false,
      error: 'invalid_code',
      message: 'رقم العقد غير صالح',
    }, 400);
  }

  // التحقق من الكود في KV
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

  // هل تم إرسال العقد النهائي؟
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
     Action: status
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

    return jsonResponse({ success: true, status, savedAt }, 200);
  }

  /* ============================================================
     Action: get
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
     Action: get_all
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
     Action: save - الحفظ في KV + D1
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

    // التحقق من حجم الصورة (إن وُجدت)
    let photoData = null;
    if (isSpouse && data.photo) {
      const photoSize = Math.round((data.photo.length - 'data:image/jpeg;base64,'.length) * 0.75);
      const MAX_PHOTO_SIZE = 500 * 1024; // 500 KB

      if (photoSize > MAX_PHOTO_SIZE) {
        return jsonResponse({
          success: false,
          error: 'photo_too_large',
          message: `الصورة كبيرة جداً (${Math.round(photoSize / 1024)} KB). الحد الأقصى 500 KB.`,
        }, 400);
      }

      photoData = data.photo;
    }

    /* ============================================
       1. حفظ في KV (draft)
    ============================================ */
    try {
      await env.CONTRACT_KV.put(
        `contract_${code}_${role}`,
        JSON.stringify(data)
      );

      await env.CONTRACT_KV.put(
        `contract_${code}_saved_${role}`,
        new Date().toISOString()
      );
    } catch (err) {
      console.error('KV save error:', err);
      return jsonResponse({
        success: false,
        error: 'kv_error',
        message: 'فشل الحفظ في KV',
      }, 500);
    }

    /* ============================================
       2. إضافة/تحديث في D1
    ============================================ */
    try {
      // 2.1 احصل على العقد من D1 أو أنشئه
      let contractRow = await env.DB.prepare(
        'SELECT id FROM contracts WHERE code = ?'
      ).bind(code).first();

      let contractId;

      if (!contractRow) {
        const insertResult = await env.DB.prepare(
          `INSERT INTO contracts (code, contract_date, status, sent_at)
           VALUES (?, ?, 'draft', ?)`
        ).bind(
          code,
          contractDate || null,
          Math.floor(Date.now() / 1000)
        ).run();

        contractId = insertResult.meta.last_row_id;
      } else {
        contractId = contractRow.id;
      }

      if (!contractId) {
        throw new Error('Failed to get contract id');
      }

      // 2.2 احذف الطرف القديم (إن وُجد)
      await env.DB.prepare(
        'DELETE FROM parties WHERE contract_id = ? AND role = ?'
      ).bind(contractId, role).run();

      // 2.3 أضف الطرف الجديد
      await env.DB.prepare(
        `INSERT INTO parties (
          contract_id, role,
          name_de, name_ar,
          birth_day, birth_month, birth_year,
          birth_country, birth_region,
          id_type, id_number,
          address_number, address_street, postal_code, city,
          mother_name_de, mother_name_ar,
          wali_is_bride, witness_is_center,
          photo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        contractId, role,
        data.nameDe || null, data.nameAr || null,
        data.birthDay ? parseInt(data.birthDay, 10) : null,
        data.birthMonth ? parseInt(data.birthMonth, 10) : null,
        data.birthYear ? parseInt(data.birthYear, 10) : null,
        data.birthCountry || null, data.birthRegion || null,
        data.idType || null, data.idNumber || null,
        data.addressNumber || null, data.addressStreet || null,
        data.postalCode || null, data.city || null,
        data.motherNameDe || null, data.motherNameAr || null,
        data.waliIsBride ? 1 : 0, data.witnessIsCenter ? 1 : 0,
        photoData
      ).run();

      // 2.4 المهر (للزوج فقط)
      if (role === 'groom') {
        await env.DB.prepare(
          'DELETE FROM dowries WHERE contract_id = ?'
        ).bind(contractId).run();

        if (data.dowryAdvance || data.dowryDeferred || data.dowryNotes) {
          await env.DB.prepare(
            `INSERT INTO dowries (contract_id, amount_advance, amount_deferred, notes)
             VALUES (?, ?, ?, ?)`
          ).bind(
            contractId,
            data.dowryAdvance ? parseFloat(data.dowryAdvance) : null,
            data.dowryDeferred ? parseFloat(data.dowryDeferred) : null,
            data.dowryNotes || null
          ).run();
        }
      }

      // 2.5 تسجيل في audit_log
      try {
        await env.DB.prepare(
          `INSERT INTO audit_log (action, entity_type, entity_id, details)
           VALUES ('party_save', 'party', ?, ?)`
        ).bind(
          contractId,
          `Saved ${role} for contract ${code}${photoData ? ' (with photo)' : ''}`
        ).run();
      } catch (e) { /* تجاهل */ }

      // 2.6 هل اكتمل الجميع؟
      const countResult = await env.DB.prepare(
        'SELECT COUNT(*) as cnt FROM parties WHERE contract_id = ?'
      ).bind(contractId).first();

      const savedCount = countResult?.cnt || 0;

      return jsonResponse({
        success: true,
        message: 'تم حفظ البيانات في قاعدة البيانات',
        savedCount: savedCount,
        total: 5,
        allSaved: savedCount >= 5,
      }, 200);

    } catch (err) {
      console.error('D1 save error:', err);
      return jsonResponse({
        success: false,
        error: 'db_error',
        message: 'حُفظ في KV لكن فشل الحفظ في D1',
        details: err.message,
      }, 500);
    }
  }

  /* ============================================================
     Action: delete
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

      try {
        const contractRow = await env.DB.prepare(
          'SELECT id FROM contracts WHERE code = ?'
        ).bind(code).first();

        if (contractRow) {
          await env.DB.prepare(
            'DELETE FROM parties WHERE contract_id = ? AND role = ?'
          ).bind(contractRow.id, role).run();

          if (role === 'groom') {
            await env.DB.prepare(
              'DELETE FROM dowries WHERE contract_id = ?'
            ).bind(contractRow.id).run();
          }
        }
      } catch (e) { /* تجاهل */ }

      return jsonResponse({ success: true, message: 'تم الحذف' }, 200);
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
