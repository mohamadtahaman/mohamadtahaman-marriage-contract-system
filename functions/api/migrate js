/* ============================================================
   Cloudflare Function: POST /api/migrate
   نقل البيانات من KV إلى D1 (مرة واحدة)
============================================================ */

export async function onRequestPost(context) {
  const { request, env } = context;

  /* ---------------------------------------------
     1. التحقق من كلمة السر
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
  if (!password || password !== env.ADMIN_PASSWORD) {
    return jsonResponse({
      success: false,
      error: 'unauthorized',
      message: 'كلمة المرور غير صحيحة',
    }, 401);
  }

  /* ---------------------------------------------
     2. قراءة الأكواد من KV
  --------------------------------------------- */
  let codes;
  try {
    const codesRaw = await env.CONTRACT_KV.get('codes');
    if (!codesRaw) {
      return jsonResponse({
        success: false,
        error: 'no_codes',
        message: 'لا توجد أكواد في KV',
      }, 404);
    }
    codes = JSON.parse(codesRaw);
  } catch (err) {
    console.error('KV read error:', err);
    return jsonResponse({
      success: false,
      error: 'kv_error',
      message: 'فشل قراءة الأكواد',
    }, 500);
  }

  /* ---------------------------------------------
     3. التقرير
  --------------------------------------------- */
  const report = {
    total: codes.length,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  /* ---------------------------------------------
     4. لكل عقد: نقل من KV إلى D1
  --------------------------------------------- */
  const roles = ['groom', 'bride', 'wali', 'witness1', 'witness2'];

  for (const code of codes) {
    try {
      /* تحقق: هل العقد موجود مسبقاً في D1؟ */
      const existing = await env.DB.prepare(
        'SELECT id FROM contracts WHERE code = ?'
      ).bind(code).first();

      if (existing) {
        report.skipped++;
        continue;
      }

      /* قراءة البيانات من KV */
      const finished = await env.CONTRACT_KV.get(`contract_${code}_finished`);
      const finishedAt = await env.CONTRACT_KV.get(`contract_${code}_finished_at`);
      const contractDate = await env.CONTRACT_KV.get(`contract_${code}_date`);

      /* تحديد حالة العقد */
      const status = finished === 'true' ? 'sent' : 'draft';

      /* تحويل التاريخ */
      let sentAt = null;
      if (finishedAt) {
        try {
          sentAt = Math.floor(new Date(finishedAt).getTime() / 1000);
        } catch (e) {
          sentAt = null;
        }
      }

      /* إدراج في جدول contracts */
      await env.DB.prepare(
        `INSERT INTO contracts (code, contract_date, status, sent_at)
         VALUES (?, ?, ?, ?)`
      ).bind(
        code,
        contractDate || null,
        status,
        sentAt
      ).run();

      /* احصل على id العقد */
      const contractRow = await env.DB.prepare(
        'SELECT id FROM contracts WHERE code = ?'
      ).bind(code).first();

      if (!contractRow) {
        report.errors.push({ code, error: 'failed to get contract id' });
        continue;
      }

      const contractId = contractRow.id;

      /* نقل الأطراف الخمسة */
      for (const role of roles) {
        const partyRaw = await env.CONTRACT_KV.get(`contract_${code}_${role}`);

        if (!partyRaw) continue;

        let p;
        try {
          p = JSON.parse(partyRaw);
        } catch (e) {
          report.errors.push({ code, role, error: 'invalid JSON' });
          continue;
        }

        /* إدراج في parties */
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
          contractId,
          role,
          p.nameDe || null,
          p.nameAr || null,
          p.birthDay ? parseInt(p.birthDay, 10) : null,
          p.birthMonth ? parseInt(p.birthMonth, 10) : null,
          p.birthYear ? parseInt(p.birthYear, 10) : null,
          p.birthCountry || null,
          p.birthRegion || null,
          p.idType || null,
          p.idNumber || null,
          p.addressNumber || null,
          p.addressStreet || null,
          p.postalCode || null,
          p.city || null,
          p.motherNameDe || null,
          p.motherNameAr || null,
          p.waliIsBride ? 1 : 0,
          p.witnessIsCenter ? 1 : 0
        ).run();

        /* المهر: للزوج فقط */
        if (role === 'groom') {
          const hasDowry = p.dowryAdvance || p.dowryDeferred || p.dowryNotes;
          if (hasDowry) {
            await env.DB.prepare(
              `INSERT INTO dowries (contract_id, amount_advance, amount_deferred, notes)
               VALUES (?, ?, ?, ?)`
            ).bind(
              contractId,
              p.dowryAdvance ? parseFloat(p.dowryAdvance) : null,
              p.dowryDeferred ? parseFloat(p.dowryDeferred) : null,
              p.dowryNotes || null
            ).run();
          }
        }
      }

      /* تسجيل في audit_log */
      await env.DB.prepare(
        `INSERT INTO audit_log (action, entity_type, entity_id, details)
         VALUES (?, ?, ?, ?)`
      ).bind(
        'migrate',
        'contract',
        contractId,
        `Migrated from KV: ${code}`
      ).run();

      report.migrated++;

    } catch (err) {
      console.error('Migration error for', code, err);
      report.errors.push({
        code,
        error: err.message,
      });
    }
  }

  /* ---------------------------------------------
     5. إرجاع التقرير
  --------------------------------------------- */
  return jsonResponse({
    success: true,
    message: 'تمت عملية النقل',
    report,
  }, 200);
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
   Helper
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
