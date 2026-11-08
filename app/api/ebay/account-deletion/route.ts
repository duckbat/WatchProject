import { env } from 'cloudflare:workers';

// eBay keeps a new production keyset disabled until the app answers Marketplace Account Deletion notifications.
// WatchLedger stores listing titles, prices and links, never eBay usernames or user IDs, so there is nothing to
// delete: the endpoint only proves ownership (GET challenge) and acknowledges notifications (POST).
// Register EBAY_DELETION_ENDPOINT (this route's public HTTPS URL, exactly) and EBAY_VERIFICATION_TOKEN on
// developer.ebay.com → Alerts & Notifications.
export async function GET(req: Request) {
  const challengeCode = new URL(req.url).searchParams.get('challenge_code');
  const token = env.EBAY_VERIFICATION_TOKEN, endpoint = env.EBAY_DELETION_ENDPOINT;
  if (!token || !endpoint) return Response.json({ error: 'EBAY_VERIFICATION_TOKEN and EBAY_DELETION_ENDPOINT are not configured.' }, { status: 503 });
  if (!challengeCode || challengeCode.length > 256) return Response.json({ error: 'Missing challenge_code.' }, { status: 400 });
  // eBay hashes challengeCode + verificationToken + endpoint, in that order, with SHA-256 (hex).
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(challengeCode + token + endpoint));
  const challengeResponse = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return Response.json({ challengeResponse }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  // eBay's notification is under 1 KB; refuse anything large before reading it.
  if (Number(req.headers.get('content-length') || 0) > 16_384) return Response.json({ error: 'Notification too large.' }, { status: 413 });
  const body = (await req.json().catch(() => null)) as { metadata?: { topic?: string } } | null;
  if (body?.metadata?.topic !== 'MARKETPLACE_ACCOUNT_DELETION') return Response.json({ error: 'Not an account deletion notification.' }, { status: 400 });
  return new Response(null, { status: 204 });
}
