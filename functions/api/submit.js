export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    
    const ADMIN_EMAIL = context.env.ADMIN_EMAIL;
    const EMAILJS_KEY = context.env.EMAILJS_PRIVATE_KEY;

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Data recorded successfully',
      contractCode: data.contractCode,
      role: data.role 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}


