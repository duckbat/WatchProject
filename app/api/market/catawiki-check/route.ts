import { safeFetch } from '../../../../lib/collectors';

// Temporary owner-only deployment check: one fixed public search, no visitor data.
export async function GET() {
  try {
    const html = await safeFetch('https://www.catawiki.com/en/s?q=Rolex%20126200', { headers: { 'User-Agent': 'WatchLedger/1.0 (watch price tracker)', Accept: 'text/html' } });
    const script = html.match(/<script\b(?=[^>]*\bid=["']__NEXT_DATA__["'])[^>]*>([\s\S]*?)<\/script>/)?.[1];
    const props = script ? JSON.parse(script).props?.pageProps : undefined;
    return Response.json({ reachable: true, bytes: html.length, props: props ? Object.keys(props) : [], lots: props?.searchLots?.lots?.slice(0, 4).map((l: any) => ({ id: l.id, title: l.title, url: l.url, live: l.live })) || [] });
  } catch (e) {
    return Response.json({ reachable: false, error: e instanceof Error ? e.message : 'Fetch failed' });
  }
}
