export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), { status: 405 });

  try {
    const body = await request.json();
    const { action, username, password } = body;

    if (username !== 'admin' || (password !== 'admin' && password !== 'admin123' && password !== (env.ADMIN_PASSWORD || 'admin123'))) {
      return new Response(JSON.stringify({ success: false, message: 'بيانات الدخول غير صحيحة' }), { status: 401 });
    }

    const db = env.DB;

    // تحديث الجدول القديم مباشرة لضمان عدم ضياع أي وثيقة
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS divorce_contracts_v3 (
        code TEXT PRIMARY KEY, divorce_date TEXT, divorce_type TEXT,
        bride_name_ar TEXT, bride_name_de TEXT, bride_birth TEXT, bride_mother_ar TEXT, bride_mother_de TEXT, bride_id TEXT, bride_address TEXT,
        groom_name_ar TEXT, groom_name_de TEXT, groom_birth TEXT, groom_mother_ar TEXT, groom_mother_de TEXT, groom_id TEXT, groom_address TEXT,
        wali_is_bride INTEGER, wali_name_ar TEXT, wali_name_de TEXT, wali_birth TEXT, wali_id TEXT, wali_address TEXT, wali_rel_ar TEXT, wali_rel_de TEXT,
        dowry_prompt TEXT, dowry_deferred TEXT, dowry_notes TEXT, children_details TEXT,
        w1_name_ar TEXT, w1_name_de TEXT, w1_birth TEXT, w1_id TEXT, w1_address TEXT,
        w2_name_ar TEXT, w2_name_de TEXT, w2_birth TEXT, w2_id TEXT, w2_address TEXT,
        serial_id INTEGER, is_deleted INTEGER DEFAULT 0, created_at TEXT
      )
    `).run();

    // إضافة الأعمدة الجديدة إذا لم تكن موجودة مسبقاً (يتجاهل الخطأ إذا كانت موجودة)
    try { await db.prepare("ALTER TABLE divorce_contracts_v3 ADD COLUMN serial_id INTEGER").run(); } catch(e){}
    try { await db.prepare("ALTER TABLE divorce_contracts_v3 ADD COLUMN is_deleted INTEGER DEFAULT 0").run(); } catch(e){}
    try { await db.prepare("ALTER TABLE divorce_contracts_v3 ADD COLUMN wali_rel_ar TEXT").run(); } catch(e){}
    try { await db.prepare("ALTER TABLE divorce_contracts_v3 ADD COLUMN wali_rel_de TEXT").run(); } catch(e){}

    // توليد أرقام تسلسلية للوثائق القديمة التي ليس لها رقم
    const unnumbered = await db.prepare("SELECT code FROM divorce_contracts_v3 WHERE serial_id IS NULL ORDER BY created_at ASC").all();
    if (unnumbered && unnumbered.results && unnumbered.results.length > 0) {
      let maxSerialObj = await db.prepare("SELECT MAX(serial_id) as max_id FROM divorce_contracts_v3").first();
      let currentSerial = (maxSerialObj && maxSerialObj.max_id) ? maxSerialObj.max_id + 1 : 1;
      for (const row of unnumbered.results) {
        await db.prepare("UPDATE divorce_contracts_v3 SET serial_id = ? WHERE code = ?").bind(currentSerial, row.code).run();
        currentSerial++;
      }
    }

    if (action === 'login') return new Response(JSON.stringify({ success: true }));

    if (action === 'list') {
      const { results } = await db.prepare("SELECT * FROM divorce_contracts_v3 WHERE is_deleted = 0 ORDER BY serial_id DESC").all();
      return new Response(JSON.stringify({ success: true, contracts: results || [] }));
    }

    if (action === 'list_deleted') {
      const { results } = await db.prepare("SELECT * FROM divorce_contracts_v3 WHERE is_deleted = 1 ORDER BY serial_id DESC").all();
      return new Response(JSON.stringify({ success: true, contracts: results || [] }));
    }

    if (action === 'save') {
      const contractCode = body.code || 'D' + Math.random().toString(36).substring(2, 8).toUpperCase();
      let serial_id = null;
      
      // إذا كان عقداً جديداً، قم بتعيين رقم تسلسلي جديد
      if (!body.code) {
          const maxObj = await db.prepare("SELECT MAX(serial_id) as max_id FROM divorce_contracts_v3").first();
          serial_id = (maxObj && maxObj.max_id) ? maxObj.max_id + 1 : 1;
      }

      await db.prepare(`
        INSERT INTO divorce_contracts_v3 (
          code, divorce_date, divorce_type, bride_name_ar, bride_name_de, bride_birth, bride_mother_ar, bride_mother_de, bride_id, bride_address,
          groom_name_ar, groom_name_de, groom_birth, groom_mother_ar, groom_mother_de, groom_id, groom_address,
          wali_is_bride, wali_name_ar, wali_name_de, wali_birth, wali_id, wali_address, wali_rel_ar, wali_rel_de,
          dowry_prompt, dowry_deferred, dowry_notes, children_details,
          w1_name_ar, w1_name_de, w1_birth, w1_id, w1_address, w2_name_ar, w2_name_de, w2_birth, w2_id, w2_address, serial_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(code) DO UPDATE SET
          divorce_date=excluded.divorce_date, divorce_type=excluded.divorce_type, bride_name_ar=excluded.bride_name_ar, bride_name_de=excluded.bride_name_de, bride_birth=excluded.bride_birth, bride_mother_ar=excluded.bride_mother_ar, bride_mother_de=excluded.bride_mother_de, bride_id=excluded.bride_id, bride_address=excluded.bride_address,
          groom_name_ar=excluded.groom_name_ar, groom_name_de=excluded.groom_name_de, groom_birth=excluded.groom_birth, groom_mother_ar=excluded.groom_mother_ar, groom_mother_de=excluded.groom_mother_de, groom_id=excluded.groom_id, groom_address=excluded.groom_address,
          wali_is_bride=excluded.wali_is_bride, wali_name_ar=excluded.wali_name_ar, wali_name_de=excluded.wali_name_de, wali_birth=excluded.wali_birth, wali_id=excluded.wali_id, wali_address=excluded.wali_address, wali_rel_ar=excluded.wali_rel_ar, wali_rel_de=excluded.wali_rel_de,
          dowry_prompt=excluded.dowry_prompt, dowry_deferred=excluded.dowry_deferred, dowry_notes=excluded.dowry_notes, children_details=excluded.children_details,
          w1_name_ar=excluded.w1_name_ar, w1_name_de=excluded.w1_name_de, w1_birth=excluded.w1_birth, w1_id=excluded.w1_id, w1_address=excluded.w1_address, w2_name_ar=excluded.w2_name_ar, w2_name_de=excluded.w2_name_de, w2_birth=excluded.w2_birth, w2_id=excluded.w2_id, w2_address=excluded.w2_address
      `).bind(
        contractCode, body.divorce_date, body.divorce_type, body.bride_name_ar, body.bride_name_de, body.bride_birth, body.bride_mother_ar, body.bride_mother_de, body.bride_id, body.bride_address, body.groom_name_ar, body.groom_name_de, body.groom_birth, body.groom_mother_ar, body.groom_mother_de, body.groom_id, body.groom_address,
        body.wali_is_bride ? 1 : 0, body.wali_name_ar, body.wali_name_de, body.wali_birth, body.wali_id, body.wali_address, body.wali_rel_ar, body.wali_rel_de,
        body.dowry_prompt, body.dowry_deferred, body.dowry_notes, body.children_details, body.w1_name_ar, body.w1_name_de, body.w1_birth, body.w1_id, body.w1_address, body.w2_name_ar, body.w2_name_de, body.w2_birth, body.w2_id, body.w2_address, serial_id
      ).run();
      return new Response(JSON.stringify({ success: true, code: contractCode }));
    }

    if (action === 'view') {
      const contract = await db.prepare("SELECT * FROM divorce_contracts_v3 WHERE code = ?").bind(body.code).first();
      return new Response(JSON.stringify({ success: !!contract, contract }));
    }

    if (action === 'soft_delete') {
      await db.prepare("UPDATE divorce_contracts_v3 SET is_deleted = 1 WHERE code = ?").bind(body.code).run();
      return new Response(JSON.stringify({ success: true }));
    }

    if (action === 'restore') {
      await db.prepare("UPDATE divorce_contracts_v3 SET is_deleted = 0 WHERE code = ?").bind(body.code).run();
      return new Response(JSON.stringify({ success: true }));
    }

    if (action === 'hard_delete') {
      await db.prepare("DELETE FROM divorce_contracts_v3 WHERE code = ?").bind(body.code).run();
      return new Response(JSON.stringify({ success: true }));
    }
  } catch (err) { return new Response(JSON.stringify({ success: false, message: err.message }), { status: 500 }); }
}
