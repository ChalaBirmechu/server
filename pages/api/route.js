// ...existing code...
export async function POST(request) {
  const data = await request.json();
  // handle contact
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' }});
}

export function GET() {
  return new Response('Use POST', { status: 405 });
}