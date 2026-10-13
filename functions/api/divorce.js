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

    // التحقق من صلاحيات المدير
    if (username !== 'admin' || password !== (env.ADMIN_PASSWORD || 'admin123')) {
      return new Response(JSON.stringify({ success: false, message: 'بيانات الدخول غير صحيحة' }), {
        status: 401, headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = env.DB;

    // 1. تسجيل الدخول للإدارة
    if (action === 'login') {
      return new Response(JSON.stringify({ success: true, message: 'تم الدخول بنجاح' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. جلب قائمة وثائق الطلاق
    if (action === 'list') {
      const { results } = await db.prepare("SELECT * FROM divorce_contracts ORDER BY created_at DESC").all();
      return new Response(JSON.stringify({ success: true, contracts: results || [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. البحث عن الشاهد مسبقاً (لتسهيل اختيار الشهود المترددين على المركز)
    if (action === 'search_witness') {
      const { query } = body;
      const { results } = await db.prepare(
        "SELECT DISTINCT witness_name, witness_id, witness_address FROM divorce_witnesses WHERE witness_name LIKE ? LIMIT 5"
      ).bind(`%${query}%`).all();
      return new Response(JSON.stringify({ success: true, witnesses: results || [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. حفظ أو إصدار عقد طلاق جديد مباشرة من الإدارة
    if (action === 'save') {
      const { 
        code, divorce_date, divorce_type, 
        groom_name, groom_birth, groom_mother, groom_id, groom_address,
        bride_name, bride_birth, bride_mother, bride_id, bride_address,
        wali_name, wali_status, dowry_prompt, dowry_deferred,
        witness1_name, witness1_birth, witness1_id, witness1_address,
        witness2_name, witness2_birth, witness2_id, witness2_address
      } = body;

      const contractCode = code || 'D' + Math.random().toString(36).substring(2, 8).toUpperCase();

      await db.prepare(`
        INSERT INTO divorce_contracts (
          code, divorce_date, divorce_type,
          groom_name, groom_birth, groom_mother, groom_id, groom_address,
          bride_name, bride_birth, bride_mother, bride_id, bride_address,
          wali_name, wali_status, dowry_prompt, dowry_deferred,
          witness1_name, witness1_birth, witness1_id, witness1_address,
          witness2_name, witness2_birth, witness2_id, witness2_address,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(code) DO UPDATE SET
          divorce_date=excluded.divorce_date, divorce_type=excluded.divorce_type,
          groom_name=excluded.groom_name, groom_birth=excluded.groom_birth, groom_mother=excluded.groom_mother, groom_id=excluded.groom_id, groom_address=excluded.groom_address,
          bride_name=excluded.bride_name, bride_birth=excluded.bride_birth, bride_mother=excluded.bride_mother, bride_id=excluded.bride_id, bride_address=excluded.bride_address,
          wali_name=excluded.wali_name, wali_status=excluded.wali_status, dowry_prompt=excluded.dowry_prompt, dowry_deferred=excluded.dowry_deferred,
          witness1_name=excluded.witness1_name, witness1_birth=excluded.witness1_birth, witness1_id=excluded.witness1_id, witness1_address=excluded.witness1_address,
          witness2_name=excluded.witness2_name, witness2_birth=excluded.witness2_birth, witness2_id=excluded.witness2_id, witness2_address=excluded.witness2_address
      `).bind(
        contractCode, divorce_date, divorce_type,
        groom_name, groom_birth, groom_mother, groom_id, groom_address,
        bride_name, bride_birth, bride_mother, bride_id, bride_address,
        wali_name, wali_status, dowry_prompt, dowry_deferred,
        witness1_name, witness1_birth, witness1_id, witness1_address,
        witness2_name, witness2_birth, witness2_id, witness2_address
      ).run();

      // حفظ الشهود في جدول الذاكرة للبحث المستقبلي
      if (witness1_name) {
        await db.prepare("INSERT OR IGNORE INTO divorce_witnesses (witness_name, witness_id, witness_address) VALUES (?, ?, ?)").bind(witness1_name, witness1_id, witness1_address).run();
      }
      if (witness2_name) {
        await db.prepare("INSERT OR IGNORE INTO divorce_witnesses (witness_name, witness_id, witness_address) VALUES (?, ?, ?)").bind(witness2_name, witness2_id, witness2_address).run();
      }

      return new Response(JSON.stringify({ success: true, message: 'تم حفظ وثيقة الطلاق بنجاح', code: contractCode }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. عرض تفاصيل عقد طلاق محدد
    if (action === 'view') {
      const { code } = body;
      const contract = await db.prepare("SELECT * FROM divorce_contracts WHERE code = ?").bind(code).first();
      if (!contract) {
        return new Response(JSON.stringify({ success: false, message: 'وثيقة الطلاق غير موجودة' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true, contract }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. حذف وثيقة طلاق
    if (action === 'delete') {
      const { code } = body;
      await db.prepare("DELETE FROM divorce_contracts WHERE code = ?").bind(code).run();
      return new Response(JSON.stringify({ success: true, message: 'تم الحذف بنجاح' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, message: 'إجراء غير معروف' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
