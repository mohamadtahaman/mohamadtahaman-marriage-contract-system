export async function onRequestPost(context) {
  try {
    const { code } = await context.request.json();
    
    if (code && code.length === 6) {
      return new Response(JSON.stringify({ valid: true, code }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ valid: false, message: 'كود العقد غير صحيح' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}


