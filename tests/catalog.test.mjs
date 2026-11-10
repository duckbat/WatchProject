import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const files=(await readdir('data/catalog/shards')).filter(f=>f.endsWith('.json')).sort();
const rows=(await Promise.all(files.map(f=>readFile('data/catalog/shards/'+f,'utf8').then(JSON.parse)))).flat();
assert(rows.length>40000);assert.equal(new Set(rows.map(m=>m.id)).size,rows.length);
assert.equal(new Set(rows.map(m=>`${m.brand.toLowerCase()}|${m.reference.toLowerCase()}`)).size,rows.length);
assert(rows.every(m=>m.brand&&m.name&&m.reference&&m.sourceUrl.startsWith('https://timepiecepedia.com/')));
assert(rows.some(m=>m.brand==='Rolex'));assert(rows.some(m=>m.brand==='Omega'));assert(rows.some(m=>m.brand==='Seiko'));
assert(rows.every(m=>!('price' in m)));assert(rows.every(m=>!m.imageUrl||m.imageUrl.startsWith('https://')));
assert.equal(rows.filter(m=>m.imageUrl.startsWith('https://cdn.watchbase.com/')).length,39883);
assert(rows.every(m=>!m.imageUrl.includes('timepiecepedia.com/watches/')));
console.log(`Catalog checks passed: ${rows.length.toLocaleString()} unique references; ${new Set(rows.map(m=>m.brand)).size} brands; stable IDs, source links and no fabricated prices.`);

// Numeric Rolex/Tudor references whose lettered form is a separate catalog model must match their letters exactly.
{
  const { lib } = await import('./helpers/lib.mjs');
  const { DISTINCT_LETTERED_REFERENCES } = await lib('collectors/matching/classify');
  const { baseReference } = await lib('collectors/matching/reference');
  const bases = new Set(rows.filter((m) => /^(rolex|tudor)$/i.test(m.brand)).map((m) => baseReference(m.reference).toLowerCase()));
  const distinct = [...bases].filter((b) => /^\d{5,6}$/.test(b) && [...bases].some((x) => x !== b && new RegExp(`^${b}[a-z]+$`).test(x))).sort();
  assert.deepEqual(distinct, [...DISTINCT_LETTERED_REFERENCES].sort());
  console.log('Lettered-reference exceptions match the catalog.');
}
