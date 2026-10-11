export async function onRequestGet(context) {
  try {
    const db = context.env.DB; // قاعدة بيانات Cloudflare D1

    // 1. إنشاء جدول العقود الرئيسي (إذا لم يكن موجوداً) للحفاظ على توافق المشروع الأصلي
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 2. إنشاء جدول سجلات التدقيق (Audit Logs) لتتبع جميع العمليات والإجراءات الإدارية
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        admin_user TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 3. إنشاء جدول المشرفين والصلاحيات (Admins) لإدارة الأمان والدخول
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: "تم تحديث وإنشاء جميع جداول قاعدة بيانات D1 (العقود، التدقيق، والمشرفين) بنجاح تام." 
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
