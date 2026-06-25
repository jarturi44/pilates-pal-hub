// Shared-secret check for cron/job hook endpoints under /api/public/hooks/*.
// Returns a 401 Response if the request lacks the correct x-cron-secret header.
export function verifyCronSecret(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return Response.json({ error: 'Server config error: CRON_SECRET not set' }, { status: 500 });
  }
  const provided = request.headers.get('x-cron-secret') ?? '';
  // Constant-ish-time compare
  if (provided.length !== expected.length) {
    return new Response('Unauthorized', { status: 401 });
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) {
    return new Response('Unauthorized', { status: 401 });
  }
  return null;
}
