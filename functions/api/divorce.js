/* ============================================================
   Cloudflare Function: POST /api/divorce
   نظام عقود الطلاق - Backend منفصل ومستقل
============================================================ */

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ success: false, error: 'invalid_json', message: 'طلب غير صالح' }, 400);
  }

  const action = (body.action || '').trim();
  const password = (body.password || '').trim();
  const username = (body.username || 'admin').trim();

  if (!password) {
    return jsonResponse({ success: false, error: 'missing_password', message: 'كلمة المرور مطلوبة' }, 401);
  }

  // التحقق من المصادقة باستخدام نفس بيانات المشرف/المستخدمين
  const auth = await authenticate(env, username, password);
  if (!auth.success) {
    return jsonResponse({ success: false, error: auth.error, message: 'بيانات الدخول غير صحيحة' }, 401);
  }

  let result;
  switch (action) {
    case 'login':
      result = jsonResponse({ success: true, user: { username: auth.username, role: auth.role } }, 200);
      break;
    case 'list':
      result = await handleListDivorce(env);
      break;
    case 'save':
      result = await handleSaveDivorce(env, body);
      break;
    case 'view':
      result = await handleViewDivorce(env, body.code);
      break;
    case 'delete':
      result = await handleDeleteDivorce(env, body.code);
      break;
    default:
      result = jsonResponse({ success: false, error: 'unknown_action', message: 'إجراء غير معروف' }, 400);
  }

  return result;
}

/* ============================================================
   Authentications & Helpers
============================================================ */
async function authenticate(env, username, password) {
  username = username.toLowerCase();
  try {
    const user = await env.DB.prepare('SELECT id, username, password_hash, role, is_active FROM users WHERE username = ?').bind(username).first();
    if (user) {
      if (!user.is_active) return { success: false, error: 'inactive' };
      if (user.password_hash !== password) return { success: false, error: 'wrong_password' };
      return { success: true, username: user.username, role: user.role };
    }
  } catch (e) {}

  if (username === 'admin' && password === env.ADMIN_PASSWORD) {
    return { success: true, username: 'admin', role: 'admin' };
  }
  return { success: false, error: 'not_found' };
}

/* ============================================================
   دوال معالجة عقود الطلاق المستقلة
============================================================ */
async function handleListDivorce(env) {
  try {
    // التأكد من وجود الجدول أو إنشاؤه تلقائياً لضمان عدم حدوث أي خطأ
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS divorce_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        marriage_code TEXT,
        divorce_type TEXT,
        children_status TEXT,
        created_at INTEGER,
        status TEXT
      )
    `).run();

    const list = await env.DB.prepare("SELECT * FROM divorce_contracts ORDER BY id DESC").all();
    return jsonResponse({ success: true, contracts: list.results || [] }, 200);
  } catch (e) {
    return jsonResponse({ success: true, contracts: [] }, 200);
  }
}

async function handleSaveDivorce(env, body) {
  try {
    const code = 'D' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const marriageCode = (body.marriageCode || '').trim().toUpperCase();
    const divorceType = body.divorceType || 'اتفاقي';
    const childrenStatus = body.childrenStatus || 'لا توجد';
    const timestamp = Math.floor(Date.now() / 1000);

    // التحقق من جدول عقود الطلاق أولاً
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS divorce_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        marriage_code TEXT,
        divorce_type TEXT,
        children_status TEXT,
        created_at INTEGER,
        status TEXT
      )
    `).run();

    await env.DB.prepare(`
      INSERT INTO divorce_contracts (code, marriage_code, divorce_type, children_status, created_at, status)
      VALUES (?, ?, ?, ?, ?, 'sent')
    `).bind(code, marriageCode, divorceType, childrenStatus, timestamp).run();

    return jsonResponse({ success: true, message: 'تم توثيق وحفظ عقد الطلاق بنجاح', code }, 200);
  } catch (e) {
    return jsonResponse({ success: false, error: 'db_error', message: 'فشل حفظ عقد الطلاق: ' + e.message }, 500);
  }
}

async function handleViewDivorce(env, code) {
  try {
    const contract = await env.DB.prepare("SELECT * FROM divorce_contracts WHERE code = ?").bind(code).first();
    if (!contract) return jsonResponse({ success: false, error: 'not_found', message: 'وثيقة الطلاق غير موجودة' }, 404);
    
    let parties = {};
    let marriageDate = '—';
    
    // جلب بيانات الزوجين والبيانات المرتبطة من جدول عقود الزواج الأصلي باستخدام كود عقد الزواج
    const marriageRow = await env.DB.prepare("SELECT id, contract_date FROM contracts WHERE code = ?").bind(contract.marriage_code).first();
    if (marriageRow) {
      marriageDate = marriageRow.contract_date || '—';
      const pRows = await env.DB.prepare("SELECT * FROM parties WHERE contract_id = ?").bind(marriageRow.id).all();
      for (const p of pRows.results || []) {
        parties[p.role] = p;
      }
    }

    return jsonResponse({ 
      success: true, 
      contract: {
        code: contract.code,
        marriageCode: contract.marriage_code,
        marriageDate: marriageDate,
        divorceType: contract.divorce_type,
        childrenStatus: contract.children_status,
        parties: parties
      } 
    }, 200);
  } catch (e) {
    return jsonResponse({ success: false, error: 'db_error', message: 'خطأ في جلب تفاصيل الطلاق' }, 500);
  }
}

async function handleDeleteDivorce(env, code) {
  try {
    await env.DB.prepare("DELETE FROM divorce_contracts WHERE code = ?").bind(code).run();
    return jsonResponse({ success: true, message: 'تم حذف وثيقة الطلاق بنجاح' }, 200);
  } catch (e) {
    return jsonResponse({ success: false, error: 'db_error', message: 'فشل الحذف' }, 500);
  }
}

export async function onRequestGet() { 
  return jsonResponse({ message: 'استخدم طلب POST فقط' }, 405); 
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, 
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }
  });
}
