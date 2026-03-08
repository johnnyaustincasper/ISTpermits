// Server-side PIN verification — PINs stored as Vercel env vars
// PIN_JOHNNY, PIN_JORDAN, PIN_SKIP

export async function POST(req) {
  const { user, pin } = await req.json();
  if (!user || !pin) return Response.json({ ok: false, error: 'Missing fields' }, { status: 400 });

  const key = `PIN_${user.toUpperCase()}`;
  const stored = process.env[key];

  if (!stored) {
    // No PIN set yet — this is first-time setup, accept and save is handled client-side
    // We can't dynamically set env vars, so for first setup we just validate format
    return Response.json({ ok: false, needsSetup: true });
  }

  return Response.json({ ok: stored === pin });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const user = searchParams.get('user');
  if (!user) return Response.json({ hasPin: false });

  const key = `PIN_${user.toUpperCase()}`;
  const stored = process.env[key];
  return Response.json({ hasPin: !!stored });
}
