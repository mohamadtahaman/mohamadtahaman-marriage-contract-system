/* ============================================================
   Cloudflare Function: POST /api/print (v2)
   - جلب بيانات العقد للطباعة
   - ✅ يدعم الصور الشخصية
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

    // البحث في D1
    const contractRow = await env.DB.prepare(
      'SELECT id, status, sent_at, contract_date FROM contracts WHERE code = ?'
    ).bind(code).first();

    if (contractRow) {
      contract.finished = contractRow.status === 'sent';
      contract.contractDate = contractRow.contract_date;

      if (contractRow.sent_at) {
        contract.finishedAt = new Date(contractRow.sent_at * 1000).toISOString();
      }

      // ✅ الأطراف — مع عمود photo
      const parties = await env.DB.prepare(
        `SELECT role,
                name_de, name_ar,
                birth_day, birth_month, birth_year,
                birth_country, birth_region,
                id_type, id_number,
                address_number, address_street, postal_code, city,
                mother_name_de, mother_name_ar,
                wali_is_bride, witness_is_center,
                photo
         FROM parties
         WHERE contract_id = ?`
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
          photo: p.photo || '',  // ✅ الصورة
        };
      }

      // المهر
      const dowry = await env.DB.prepare(
        'SELECT amount_advance, amount_deferred, notes FROM dowries WHERE contract_id = ?'
      ).bind(contractRow.id).first();

      if (dowry && contract.parties.groom) {
        contract.parties.groom.dowryAdvance = dowry.amount_advance;
        contract.parties.groom.dowryDeferred = dowry.amount_deferred;
        contract.parties.groom.dowryNotes = dowry.notes;
      }
    } else {
      // احتياطي: من KV
      const roles = ['groom', 'bride', 'wali', 'witness1', 'witness2'];
      for (const r of roles) {
        const raw = await env.CONTRACT_KV.get(`contract_${code}_${r}`);
        if (raw) {
          try {
            contract.parties[r] = JSON.parse(raw);
          } catch (e) { /* تجاهل */ }
        }
      }

      try {
        const dateFromKv = await env.CONTRACT_KV.get(`contract_${code}_date`);
        if (dateFromKv) contract.contractDate = dateFromKv;
      } catch (e) { /* تجاهل */ }
    }

    const hasAnyParty = Object.keys(contract.parties).length > 0;

    if (!hasAnyParty) {
      return jsonResponse({
        success: false,
        error: 'empty_contract',
        message: 'لا توجد بيانات لهذا العقد',
      }, 404);
    }

    return jsonResponse({
      success: true,
      contract: contract,
    }, 200);

  } catch (err) {
    console.error('handlePrint error:', err);
    return jsonResponse({
      success: false,
      error: 'db_error',
      message: 'فشل في القراءة',
      details: err.message,
    }, 500);
  }
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
