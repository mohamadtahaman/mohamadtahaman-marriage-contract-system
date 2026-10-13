export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { action, username, password } = body;

    if (username !== 'admin' || (password !== 'admin' && password !== 'admin123' && password !== (env.ADMIN_PASSWORD || 'admin123'))) {
      return new Response(JSON.stringify({ success: false, message: 'بيانات الدخول غير صحيحة' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = env.DB;

    // بما أن الحقول زادت بشكل كبير، سنقوم بإنشاء الجدول تلقائياً إذا لم يكن موجوداً لتجنب أي أخطاء
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS divorce_contracts (
        code TEXT PRIMARY KEY,
        divorce_date TEXT, divorce_type TEXT,
        bride_name_ar TEXT, bride_name_de TEXT, bride_birth TEXT, bride_mother_ar TEXT, bride_mother_de TEXT, bride_id TEXT, bride_address TEXT,
        groom_name_ar TEXT, groom_name_de TEXT, groom_birth TEXT, groom_mother_ar TEXT, groom_mother_de TEXT, groom_id TEXT, groom_address TEXT,
        wali_is_bride INTEGER, wali_name_ar TEXT, wali_name_de TEXT, wali_birth TEXT, wali_id TEXT, wali_address TEXT,
        dowry_prompt TEXT, dowry_deferred TEXT, dowry_notes TEXT, children_details TEXT,
        w1_name_ar TEXT, w1_name_de TEXT, w1_id TEXT, w1_address TEXT,
        w2_name_ar TEXT, w2_name_de TEXT, w2_id TEXT, w2_address TEXT,
        created_at TEXT
      )
    `).run();

    if (action === 'login') {
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'list') {
      const { results } = await db.prepare("SELECT * FROM divorce_contracts ORDER BY created_at DESC").all();
      return new Response(JSON.stringify({ success: true, contracts: results || [] }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'save') {
      const contractCode = body.code || 'D' + Math.random().toString(36).substring(2, 8).toUpperCase();

      await db.prepare(`
        INSERT INTO divorce_contracts (
          code, divorce_date, divorce_type,
          bride_name_ar, bride_name_de, bride_birth, bride_mother_ar, bride_mother_de, bride_id, bride_address,
          groom_name_ar, groom_name_de, groom_birth, groom_mother_ar, groom_mother_de, groom_id, groom_address,
          wali_is_bride, wali_name_ar, wali_name_de, wali_birth, wali_id, wali_address,
          dowry_prompt, dowry_deferred, dowry_notes, children_details,
          w1_name_ar, w1_name_de, w1_id, w1_address,
          w2_name_ar, w2_name_de, w2_id, w2_address,
          created_at
        ) VALUES (
          ?, ?, ?, 
          ?, ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, ?, ?, 
          ?, ?, ?, ?, 
          ?, ?, ?, ?, 
          ?, ?, ?, ?, 
          datetime('now')
        )
        ON CONFLICT(code) DO UPDATE SET
          divorce_date=excluded.divorce_date, divorce_type=excluded.divorce_type,
          bride_name_ar=excluded.bride_name_ar, bride_name_de=excluded.bride_name_de, bride_birth=excluded.bride_birth, bride_mother_ar=excluded.bride_mother_ar, bride_mother_de=excluded.bride_mother_de, bride_id=excluded.bride_id, bride_address=excluded.bride_address,
          groom_name_ar=excluded.groom_name_ar, groom_name_de=excluded.groom_name_de, groom_birth=excluded.groom_birth, groom_mother_ar=excluded.groom_mother_ar, groom_mother_de=excluded.groom_mother_de, groom_id=excluded.groom_id, groom_address=excluded.groom_address,
          wali_is_bride=excluded.wali_is_bride, wali_name_ar=excluded.wali_name_ar, wali_name_de=excluded.wali_name_de, wali_birth=excluded.wali_birth, wali_id=excluded.wali_id, wali_address=excluded.wali_address,
          dowry_prompt=excluded.dowry_prompt, dowry_deferred=excluded.dowry_deferred, dowry_notes=excluded.dowry_notes, children_details=excluded.children_details,
          w1_name_ar=excluded.w1_name_ar, w1_name_de=excluded.w1_name_de, w1_id=excluded.w1_id, w1_address=excluded.w1_address,
          w2_name_ar=excluded.w2_name_ar, w2_name_de=excluded.w2_name_de, w2_id=excluded.w2_id, w2_address=excluded.w2_address
      `).bind(
        contractCode, body.divorce_date, body.divorce_type,
        body.bride_name_ar, body.bride_name_de, body.bride_birth, body.bride_mother_ar, body.bride_mother_de, body.bride_id, body.bride_address,
        body.groom_name_ar, body.groom_name_de, body.groom_birth, body.groom_mother_ar, body.groom_mother_de, body.groom_id, body.groom_address,
        body.wali_is_bride ? 1 : 0, body.wali_name_ar, body.wali_name_de, body.wali_birth, body.wali_id, body.wali_address,
        body.dowry_prompt, body.dowry_deferred, body.dowry_notes, body.children_details,
        body.w1_name_ar, body.w1_name_de, body.w1_id, body.w1_address,
        body.w2_name_ar, body.w2_name_de, body.w2_id, body.w2_address
      ).run();

      return new Response(JSON.stringify({ success: true, code: contractCode }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'view') {
      const contract = await db.prepare("SELECT * FROM divorce_contracts WHERE code = ?").bind(body.code).first();
      return new Response(JSON.stringify({ success: !!contract, contract }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'delete') {
      await db.prepare("DELETE FROM divorce_contracts WHERE code = ?").bind(body.code).run();
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
