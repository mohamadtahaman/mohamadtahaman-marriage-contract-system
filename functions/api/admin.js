export async function onRequestPost(context) {
  try {
    const { password } = await context.request.json();
    const ADMIN_PASSWORD = context.env.ADMIN_PASSWORD;

    if (password === ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ authorized: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ authorized: false, message: 'كلمة المرور غير صحيحة' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}


