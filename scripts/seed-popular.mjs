// Collects market data for widely traded references so "Most tracked watches" and search ranking have data to go on.
// Usage: node scripts/seed-popular.mjs [base URL, default http://127.0.0.1:5173]. Spaced out to stay polite to the sources.
const base = process.argv[2] || 'http://127.0.0.1:5173';
const queries = [
  'Rolex 124060', 'Rolex 126610LN', 'Rolex 126610LV', 'Rolex 126710BLRO', 'Rolex 126710BLNR', 'Rolex 126500LN', 'Rolex 116500LN', 'Rolex 126200', 'Rolex 126300', 'Rolex 126334', 'Rolex 124300', 'Rolex 124270', 'Rolex 116610LN', 'Rolex 114060', 'Rolex 16610', 'Rolex 116900', 'Rolex 126000',
  'Omega 310.30.42.50.01.001', 'Omega 311.30.42.30.01.005', 'Omega 210.30.42.20.03.001', 'Omega 210.30.42.20.01.001', 'Omega 220.10.41.21.01.001',
  'Tudor 79030N', 'Tudor 79230N', 'Tudor 79230R', 'Tudor M7941A1A0RU', 'Tudor 25600TN',
  'Cartier WSSA0029', 'Cartier WSSA0018', 'Cartier WSTA0029',
  'Seiko SPB143', 'Seiko SRPD55', 'Grand Seiko SBGA211', 'Audemars Piguet 15500ST', 'Patek Philippe 5711/1A', 'Tissot T137.407.11.041.00', 'Hamilton H70455533', 'Breitling AB0138211B1A1', 'TAG Heuer CBN2A1B', 'Longines L3.781.4.56.6',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const q of queries) {
  const found = await fetch(`${base}/api/catalog?${new URLSearchParams({ q, limit: '1' })}`).then((r) => r.json()).catch(() => null);
  const model = found?.items?.[0];
  if (!model) { console.log(`- ${q}: not in catalog`); continue; }
  const r = await fetch(`${base}/api/market/refresh?${new URLSearchParams({ modelId: model.id })}`, { method: 'POST' });
  const d = await r.json().catch(() => ({}));
  console.log(`${r.ok ? '✓' : '✗'} ${q} → ${model.brand} ${model.reference}: ${d.count ?? d.error} listings${d.partial ? ' (partial)' : ''}`);
  await sleep(5000);
}
