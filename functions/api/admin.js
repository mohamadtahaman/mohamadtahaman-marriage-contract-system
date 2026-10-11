/* ============================================================
   Cloudflare Function: POST /api/admin (v9)
   - Archive with guaranteed sentAt
   - All actions supported
============================================================ */

const PERMISSIONS = {
  list:            ['admin', 'manager', 'user', 'viewer'],
  archive:         ['admin'],
  view:            ['admin', 'manager', 'user', 'viewer'],
  search:          ['admin', 'manager', 'user', 'viewer'],
  export:          ['admin', 'manager'],
  login:           ['all'],
  delete:          ['admin', 'manager'],
  generate:        ['admin'],
  clear_drafts:    ['admin', 'manager'],
  list_users:      ['admin'],
  create_user:     ['admin'],
  delete_user:     ['admin'],
  change_password: ['admin', 'manager', 'user'],
  update_party:    ['admin', 'manager'],
  update_contract: ['admin', 'manager'],
};

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

  const password = (body.password || '').trim();
  const action = (body.action || '').trim();

  if (!password) {
    return jsonResponse({
      success: false,
      error: 'missing_password',
      message: 'كلمة المرور مطلوبة',
    }, 401);
  }

  const auth = await authenticate(env, body.username, password);

  if (!auth.success) {
    return jsonResponse({
      success: false,
      error: auth.error || 'auth_failed',
      message: auth.error === 'inactive'
        ? 'الحساب معطّل'
        : 'بيانات الدخول غير صحيحة',
    }, 401);
  }

  const userRole = auth.role;

  if (action === 'login') {
    return jsonResponse({
      success: true,
      user: {
        id: auth.userId,
        username: auth.username,
        role: auth.role,
      },
    }, 200);
  }

  const allowedRoles = PERMISSIONS[action] || [];

  if (!allowedRoles.includes('all') && !allowedRoles.includes(userRole)) {
    return jsonResponse({
      success: false,
      error: 'forbidden',
      message: 'ليس لديك صلاحية لهذا الإجراء',
    }, 403);
  }

  switch (action) {
    case 'list':             return await handleList(env);
    case 'archive':          return await handleArchive(env);
    case 'generate':         return await handleGenerate(env);
    case 'delete':           return await handleDelete(env, body.code);
    case 'view':             return await handleView(env, body.code);
    case 'search':           return await handleSearch(env, body.query);
    case 'clear_drafts':     return await handleClearDrafts(env, body.code, body.all);
    case 'change_password':  return await handleChangePassword(env, auth, body);
    case 'list_users':       return await handleListUsers(env);
    case 'create_user':      return await handleCreateUser(env, body);
    case 'delete_user':      return await handleDeleteUser(env, body);
    case 'export':           return await handleExport(env);
    case 'update_party':     return await handleUpdateParty(env, body, auth);
    case 'update_contract':  return await handleUpdateContract(env, body, auth);
    default:
      return jsonResponse({
        success: false,
        error: 'unknown_action',
        message: 'إجراء غير معروف',
      }, 400);
  }
}
