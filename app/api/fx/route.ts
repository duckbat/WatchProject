import { getFx } from '../../../lib/fx';

export async function GET() {
  const rates = await getFx();
  if (!rates) return Response.json({ error: 'Exchange rates unavailable' }, { status: 503 });
  return Response.json({ ...rates.fx, source: rates.source }, { headers: { 'Cache-Control': 'public, max-age=3600' } });
}
