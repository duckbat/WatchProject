import { watchPhotos } from '../../../lib/market';

// Same-origin copies of catalog watch photos, so the page can cut the watch out of its white background on a canvas
// (the image hosts send no CORS headers). Only known photo hosts are fetched; nothing user-supplied.
const HOSTS = new Set(['cdn.watchbase.com', ...Object.values(watchPhotos).map((p) => new URL(p.url).hostname)]);
const MAX_BYTES = 3_000_000;

export async function GET(req: Request) {
  let src: URL;
  try {
    src = new URL(new URL(req.url).searchParams.get('url') || '');
  } catch {
    return new Response('Invalid photo URL', { status: 400 });
  }
  if (src.protocol !== 'https:' || !HOSTS.has(src.hostname)) return new Response('Photo host not allowed', { status: 400 });
  const upstream = await fetch(src.href, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'WatchLedger/1.0 (watch price tracker)' } }).catch(() => null);
  const type = upstream?.headers.get('content-type') || '';
  if (!upstream?.ok || !/^image\/(jpeg|png|webp)$/.test(type.split(';')[0])) return new Response('Photo unavailable', { status: 502 });
  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response('Photo too large', { status: 502 });
  return new Response(body, { headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=604800, immutable', 'X-Content-Type-Options': 'nosniff' } });
}
