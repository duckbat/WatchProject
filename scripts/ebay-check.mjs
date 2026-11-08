// Checks the eBay keys in .dev.vars without printing them: npm run ebay:check
import { readFile } from 'node:fs/promises';

const vars = Object.fromEntries((await readFile(new URL('../.dev.vars', import.meta.url), 'utf8')).split('\n')
  .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]));
const marketplace = vars.EBAY_MARKETPLACE || 'EBAY_DE';

async function check(label, host, id, secret) {
  if (!id || !secret) return console.log(`${label}: keys not set`);
  const token = await fetch(`https://${host}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });
  const auth = await token.json().catch(() => ({}));
  if (!auth.access_token) {
    console.log(`${label}: login rejected (HTTP ${token.status} ${auth.error || ''}: ${auth.error_description || ''})`);
    if (auth.error === 'invalid_client' && label === 'Production') console.log('  → The production keyset is disabled until Marketplace Account Deletion is handled on developer.ebay.com (see MARKETPLACES.md), or the Cert ID does not belong to this App ID.');
    return;
  }
  const search = await fetch(`https://${host}/buy/browse/v1/item_summary/search?q=Rolex%20124060&category_ids=31387&limit=3`, { headers: { Authorization: `Bearer ${auth.access_token}`, 'X-EBAY-C-MARKETPLACE-ID': marketplace } });
  const data = await search.json().catch(() => ({}));
  console.log(`${label}: login OK; Browse search HTTP ${search.status}, ${data.total ?? 0} results on ${marketplace}${label === 'Sandbox' ? ' (test data, never used as prices)' : ''}`);
}

await check('Production', 'api.ebay.com', vars.EBAY_CLIENT_ID, vars.EBAY_CLIENT_SECRET);
await check('Sandbox', 'api.sandbox.ebay.com', vars.EBAY_SANDBOX_CLIENT_ID, vars.EBAY_SANDBOX_CLIENT_SECRET);
console.log(`The app uses: ${vars.EBAY_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production'} (EBAY_ENVIRONMENT)`);
