import assert from 'node:assert/strict';
import { lib } from './helpers/lib.mjs';
import {readFile} from 'node:fs/promises';
const {exactMatch,parseTori,parseEbay,safeFetch,collectPrices}=await lib('collectors');
const model={id:'seiko-spb143',brand:'Seiko',reference:'SPB143',name:'Prospex',color:'#000',size:'40.5 mm'};
assert(exactMatch('Seiko Prospex SPB143',model));
assert(!exactMatch('Seiko SPB1430',model));assert(!exactMatch('Seiko SPB259J1',model));assert(!exactMatch('Seiko SPB143 strap',model));
const product={name:'Seiko SPB143',url:'https://www.tori.fi/recommerce/forsale/item/123',offers:{price:'750',priceCurrency:'EUR',availability:'https://schema.org/InStock',itemCondition:'https://schema.org/UsedCondition'}};
const html=(products)=>`<script id="seoStructuredData" type="application/ld+json">${JSON.stringify({mainEntity:{itemListElement:products.map(item=>({item}))}})}</script>`;
const now=new Date('2026-11-07T12:00:00Z');
const xs=parseTori(html([product,product,{...product,name:'Seiko SPB259J1'}]),model,now);assert.equal(xs.length,1);assert.equal(xs[0].price,750);assert.equal(xs[0].sellerType,'unknown');assert.equal(xs[0].country,'FI');assert.equal(xs[0].status,'asking');assert.equal(xs[0].observedAt,'2026-11-07');
assert.equal(parseTori(html([{...product,url:'http://127.0.0.1/'}]),model).length,0);
assert.equal(parseTori(html([{...product,offers:{...product.offers,priceCurrency:'INVALID'}}]),model).length,0);
assert.throws(()=>parseTori('<html>Challenge</html>',model),/structured/);
assert.equal(parseTori(html([]),model).length,0);
const ebay=parseEbay({itemSummaries:[{title:'Seiko SPB143',price:{value:'800',currency:'USD'},itemLocation:{country:'US'},itemWebUrl:'https://www.ebay.com/itm/123?tracking=1',conditionId:'3000'}]},model,now);assert.equal(ebay.length,1);assert.equal(ebay[0].country,'US');assert.equal(ebay[0].url,'https://www.ebay.com/itm/123');
await assert.rejects(()=>collectPrices('ebay',model,{}),/EBAY_CLIENT_ID/);
await assert.rejects(()=>collectPrices('facebook',model,{}),/not connected/);
await assert.rejects(()=>safeFetch('https://www.tori.fi',{},async()=>new Response('',{status:403})),/HTTP 403/);
await assert.rejects(()=>safeFetch('https://www.tori.fi',{},async()=>new Response('x'.repeat(3_000_001))),/limit/);
await assert.rejects(()=>safeFetch('https://www.tori.fi',{},async()=>new Response('',{status:302,headers:{Location:'http://127.0.0.1'}})),/HTTP 302/);
console.log('Collector checks passed: exact matching, duplicates, malformed data, currencies, origin validation, price types, source errors and response limits.');

const japan=parseEbay({itemSummaries:[{title:'Seiko SPB143',price:{value:'90000',currency:'JPY'},itemLocation:{country:'JP'},itemWebUrl:'https://www.ebay.com/itm/321',conditionId:'3000'}]},model,now);assert.equal(japan[0].country,'JP');assert.equal(japan[0].currency,'JPY');assert.equal(japan[0].price,90000);

const {extractPrice,parseRedditListings}=await lib('collectors');
assert.deepEqual(extractPrice('[WTS] Rolex Datejust 126200 - $8,500 shipped'),{price:8500,currency:'USD'});
assert.deepEqual(extractPrice('Price 7.900€'),{price:7900,currency:'EUR'});
assert.deepEqual(extractPrice('£6k or offers'),{price:6000,currency:'GBP'});
assert.deepEqual(extractPrice('EUR 10500'),{price:10500,currency:'EUR'});
assert.equal(extractPrice('36mm, 2021 full set'),null);
const dj={id:'dj',brand:'Rolex',name:'Datejust 36 Stainless Steel',family:'Datejust',reference:'126200-0001',color:'#000',size:'36 mm'};
const post=(o)=>({data:{title:'[WTS] Rolex Datejust 126200-0001 blue dial - $8,200',selftext:'',permalink:'/r/Watchexchange/comments/abc123/x/',created_utc:1767225600,link_flair_text:'',...o}});
const rx=parseRedditListings({data:{children:[post({}),post({permalink:'/r/Watchexchange/comments/def456/y/',link_flair_text:'Sold'}),post({title:'[WTB] Rolex 126200 $8000',permalink:'/r/Watchexchange/comments/ghi/z/'}),post({permalink:'https://evil.example/'}),post({title:'[WTS] Rolex Datejust 36 16200 $6,000',permalink:'/r/Watchexchange/comments/jkl/w/'})]}},dj);
assert.equal(rx.length,3);assert.equal(rx[0].price,8200);assert.equal(rx[0].currency,'USD');assert.equal(rx[0].observedAt,'2026-01-01');assert.equal(rx[0].match,'exact');
assert.equal(rx[1].status,'sold-asking');assert.equal(rx[2].match,'similar');assert(rx.every(r=>r.url.startsWith('https://www.reddit.com/r/Watchexchange/comments/')));
const {feeBreakdown}=await lib('market');
const f=feeBreakdown(10000);assert.equal(Math.round(f.commission),695);assert.equal(Math.round(f.sellerNet),9305);assert.equal(Math.round(f.listToNet),10747);assert.equal(feeBreakdown(100,'tori'),null);
console.log('Reddit parsing, price extraction and Chrono24 fee checks passed.');
const {decodeEntities}=await lib('collectors');
assert.equal(decodeEntities('A &amp;amp; B &#32;&quot;x&quot;'),'A &amp; B  "x"');
const {parseToriItemDate}=await lib('collectors');
assert.equal(parseToriItemDate('x\\"edited\\":\\"2026-11-07T11:33:56.882191+01:00\\",y'),'2026-11-07');
assert.equal(parseToriItemDate('<p>Viimeksi muokattu<!-- -->: <!-- -->7.9.2026 klo 12.33</p>'),'2026-09-07');
assert.equal(parseToriItemDate('<html></html>'),undefined);
console.log('Listing date checks passed.');
assert.deepEqual(parseTori('<script id="seoStructuredData" type="application/ld+json"></script>',model),[]);
console.log('Empty Tori search check passed.');
assert.deepEqual(extractPrice('Myydään Rolex Datejust 126200, 7 500 €'),{price:7500,currency:'EUR'});
assert.deepEqual(extractPrice('hinta 7500e tai paras tarjous'),{price:7500,currency:'EUR'});
assert.deepEqual(extractPrice('Hp. 6900',"EUR"),{price:6900,currency:'EUR'});
assert.equal(extractPrice('Hp. 6900'),null);
assert.deepEqual(extractPrice('9 200 euroa'),{price:9200,currency:'EUR'});
console.log('Finnish/Facebook price formats passed.');
const {parseForumRss,matchForumItems}=await lib('collectors');
const forum=parseForumRss(await readFile('tests/fixtures/watchuseek-sample.rss','utf8'));
assert.equal(forum.length,3);assert.equal(forum[0].id,'5700001');assert.equal(forum[0].date,'2026-11-07');assert(forum[0].text.includes('$8,750'));
const wusDj=matchForumItems(forum,dj,'watchuseek');assert.equal(wusDj.length,1);assert.equal(wusDj[0].price,8750);assert.equal(wusDj[0].country,'US');assert.equal(wusDj[0].listedAt,'2026-11-07');assert.equal(wusDj[0].match,'reference');
const bb={id:'bb',brand:'Tudor',name:'Black Bay Fifty-Eight',reference:'79030N',family:'Black Bay'};
const wusBb=matchForumItems(forum,bb,'watchuseek');assert.equal(wusBb[0].status,'sold-asking');assert.equal(wusBb[0].price,3300);
assert.throws(()=>parseForumRss('<html>blocked</html>'),/RSS/);
console.log('WatchUSeek feed checks passed.');
const {forumItemsNeedingPost}=await lib('collectors');
const op={id:'op',brand:'Rolex',name:'Oyster Perpetual 41',reference:'134300-0001'};
assert.equal(forumItemsNeedingPost([{id:'9',title:'FS: Rolex Oyster Perpetual 41 Ref 134300-0001 Med Blue',url:'https://www.watchuseek.com/threads/op.9/',date:'2026-11-07',text:'Offering my 134300, mint...'}],op).length,1);
assert.equal(forumItemsNeedingPost(forum,dj).length,0);
console.log('WatchUSeek unpriced-thread checks passed.');

const variant={...dj,name:'Datejust 36 Stainless Steel / Domed / Silver / Jubilee'};
assert(!exactMatch('Rolex Datejust 126200 blue dial',variant));
assert(!exactMatch('Rolex Datejust 126200 silver dial Jubilee',variant));
assert(!exactMatch('Rolex Datejust 126200-0002 silver dial',variant));
assert(!exactMatch('Rolex Datejust 126200-00010 silver dial',variant));
assert(exactMatch('Rolex Datejust M126200-0001 silver dial Jubilee',variant));
assert(exactMatch('Rolex Ref.126200-0001',variant,'Blue strap, silver case.'));
assert(!exactMatch('Rolex 126200-0001 blue dial',variant));
assert(!exactMatch('Rolex 126200-0001 blue fluted motif dial',variant));
assert(!exactMatch('Rolex 126200-0001 Dial: Green',variant));
assert(exactMatch('Rolex 126200-0001 silver sunburst dial',variant));
assert(exactMatch('Rolex 126200-0001 grey dial',{...variant,name:'Datejust 36 / Gray / Jubilee'}));
assert(exactMatch('Omega Speedmaster 310.30.42.50.01.001',{brand:'Omega',reference:'310.30.42.50.01.001'}));
const unknown=parseRedditListings({data:{children:[post({title:'[WTS] Rolex Datejust 36 126200 blue dial $8200'})]}},variant);
assert.equal(unknown[0].match,'similar');
const bodyMatch=parseRedditListings({data:{children:[post({title:'[WTS] Rolex Datejust 36 $8200',selftext:'Reference M126200-0001, silver dial, Jubilee.'})]}},variant);
assert.equal(bodyMatch[0].match,'exact');
console.log('Variant matching passed: full suffix, explicit dial conflicts, metal/strap colors, normalized references and post-body evidence.');

const bodyConflict=parseRedditListings({data:{children:[post({title:'[WTS] Rolex Datejust 36 126200-0001 $8200',selftext:'Blue dial with box and papers.'})]}},variant);
assert.equal(bodyConflict[0].match,'similar');
console.log('Explicit conflicting dial in a post body cannot bypass the title match.');

const withBracelet=parseRedditListings({data:{children:[post({title:'[WTS] Rolex Datejust 36 126200-0001 $8200',selftext:'Original steel bracelet, silver dial, box and papers.'})]}},variant);
assert.equal(withBracelet[0].match,'exact');

assert(!exactMatch('Mido M12345',{brand:'Mido',reference:'12345'}));
assert(exactMatch('Mido M12345',{brand:'Mido',reference:'M12345'}));

// Base-reference listings: sellers rarely write Rolex/Tudor variant suffixes.
const {classifyMatch,referenceMatch,parseToriListings,parseWatchRecon,relativeDate,failureStatus,CollectorError}=await lib('collectors');
const silverJub={id:'sj',brand:'Rolex',name:'Datejust 36 Stainless Steel / Domed / Silver / Jubilee',family:'Datejust 36',reference:'126200-0001'};
assert.equal(classifyMatch('Rolex Datejust 36 126200-0001 Jubilee',silverJub),'exact');
assert.equal(classifyMatch('Rolex 36mm datejust Ref.126200',silverJub),'reference');
assert.equal(classifyMatch('Rolex Datejust 36 silver 126200 2024',silverJub),'reference');
assert.equal(classifyMatch('Rolex Datejust 36 126200 Green Ombré 2026 NEW',silverJub),'similar'); // different dial named
assert.equal(classifyMatch('2022 Rolex Datejust 36 126200 Wimbledon',silverJub),'similar'); // nickname for slate
assert.equal(classifyMatch('Rolex Datejust 36 126200 with black box and papers',silverJub),'reference'); // box color is not the dial
assert.equal(classifyMatch('WTB: Rolex Datejust 36 126200',silverJub),null);
assert.equal(classifyMatch('Rolex Datejust 36 126200 Ombre Fullset 2026',silverJub),'similar'); // dial style the variant lacks
assert.equal(classifyMatch('Rolex Datejust 36 126200 Ombré',{...silverJub,reference:'126200-0026',name:'Datejust 36 Stainless Steel - Domed / Green Ombré / Jubilee'}),'reference');
assert.equal(classifyMatch('Rolex Datejust 72800 lenke til Rolex 126234 / 126200',silverJub),null);
assert.equal(classifyMatch('Rolex Datejust 36 1262000',silverJub),'similar');
assert(!referenceMatch('Seiko Prospex SPB143',model)); // no suffix: exact matching already covers it
// FINN, Blocket and DBA share Tori's platform and structured data.
const nordic=(host,currency,name='Rolex Datejust 36 126200 årstall 2022')=>html([{name,url:`https://${host}/recommerce/forsale/item/450134382`,offers:{price:'95000',priceCurrency:currency,availability:'https://schema.org/InStock'}}]);
const finn=parseToriListings(nordic('www.finn.no','NOK'),silverJub,now,'finn');
assert.equal(finn.length,1);assert.equal(finn[0].sourceId,'finn');assert.equal(finn[0].country,'NO');assert.equal(finn[0].currency,'NOK');assert.equal(finn[0].match,'reference');
assert.equal(parseToriListings(nordic('www.finn.no','NOK'),silverJub,now,'blocket').length,0); // host must belong to the site
assert.equal(parseToriListings(nordic('www.blocket.se','SEK','Solgt Rolex Datejust 36/126200/2024'),silverJub,now,'blocket')[0].status,'sold-asking');
assert.equal(parseToriListings(nordic('www.dba.dk','DKK'),silverJub,now,'dba')[0].country,'DK');
const {partsListing}=await lib('collectors');
assert(!partsListing('Rolex Datejust 36 Wimbledon Dial, Smooth Bezel, Jubilee Bracelet Ref. 126200'));
assert(!partsListing('[WTS] Omega Speedmaster 310.30.42.50.01.001 on bracelet, full set'));
assert(partsListing('Rolex Jubilee bracelet for 126200'));assert(partsListing('Seiko SPB143 strap'));assert(partsListing('Rolex 126200 dial only'));
console.log('Base-reference matching and Nordic marketplace checks passed.');
// WatchRecon: reduced real markup.
const wr=parseWatchRecon(await readFile('tests/fixtures/watchrecon-126200.html','utf8'),silverJub,new Date('2026-11-08T12:00:00Z'));
const wrDj=parseWatchRecon(await readFile('tests/fixtures/watchrecon-126200.html','utf8'),dj,new Date('2026-11-08T12:00:00Z'));
assert(wrDj.some(l=>l.price===9000&&l.currency==='USD'&&l.sourceId==='reddit'&&l.observedAt==='2026-11-03'&&l.match==='reference'),'brand comes from the brand field');
assert(wrDj.every(l=>l.url.startsWith('https://')));
assert(!wr.some(l=>l.price===9000&&l.match!=='similar'),'Wimbledon dial is not the silver variant');
assert(wr.some(l=>l.price===10829&&l.match==='similar'),'black dial is not the silver variant');
assert.throws(()=>parseWatchRecon('<html>Just a moment...</html>',dj),/WatchRecon/);
assert.equal(relativeDate('5 days ago',new Date('2026-11-08T12:00:00Z')),'2026-11-03');
assert.equal(relativeDate('14 hours ago',new Date('2026-11-08T12:00:00Z')),'2026-11-07');
assert.equal(relativeDate('yesterday'),undefined);
console.log('WatchRecon checks passed.');
// Bot walls are reported as blocked (no rapid retry); other failures stay errors.
await assert.rejects(()=>safeFetch('https://x.test',{},async()=>new Response('',{status:403})),e=>e.code==='blocked'&&failureStatus(e)==='blocked');
await assert.rejects(()=>safeFetch('https://x.test',{},async()=>new Response('',{status:500})),e=>failureStatus(e)==='error');
console.log('Blocked-source checks passed.');

// Nordic forum feeds: local currencies ("kr", ":-", ",-"), Tidssonen's /forum/ path, wanted "O:" posts.
{
const {extractPrice,parseForumRss,matchForumItems,classifyMatch,FORUM_FEEDS}=await lib('collectors');
assert.deepEqual(extractPrice('Pris 45 000 kr inkl frakt','SEK'),{price:45000,currency:'SEK'});
assert.deepEqual(extractPrice('Säljes för 5000:-','SEK'),{price:5000,currency:'SEK'});
assert.deepEqual(extractPrice('Prisidé: kr 75.000,-','NOK'),{price:75000,currency:'NOK'});
assert.deepEqual(extractPrice('NOK 26 000'),{price:26000,currency:'NOK'});
assert.equal(extractPrice('45 000 kr'),null); // "kr" alone does not say which krona.
assert.deepEqual(extractPrice('Price 7.900€','SEK'),{price:7900,currency:'EUR'});
const rss=(link,title,body)=>`<rss><channel><item><title>${title}</title><link>${link}</link><pubDate>Fri, 06 Nov 2026 10:00:00 +0000</pubDate><content:encoded><![CDATA[${body}]]></content:encoded></item></channel></rss>`;
const tds=FORUM_FEEDS.find(f=>f.id==='tidssonen');
const items=parseForumRss(rss('https://www.tidssonen.no/forum/threads/tudor-black-bay-58-79030n.78131/','Tudor Black Bay 58 79030N SOLGT','Full sett 2023. Pris 32 000,-'),tds.host);
assert.equal(items.length,1);assert.equal(items[0].id,'78131');
const bb={id:'tudor-79030n',brand:'Tudor',name:'Black Bay Fifty-Eight',reference:'79030N'};
const [l]=matchForumItems(items,bb,'tidssonen',{country:tds.country,currency:tds.currency});
assert.deepEqual([l.price,l.currency,l.country,l.status,l.observedAt],[32000,'NOK','NO','sold-asking','2026-11-06']);
assert.equal(parseForumRss(rss('https://evil.test/forum/threads/x.1/','Tudor 79030N','8000 €'),tds.host).length,0);
assert.equal(classifyMatch('O: Tudor Black Bay 58 79030N',bb),null);
assert.equal(classifyMatch('M: Tudor Black Bay 58 79030N',bb),'exact');
console.log('Nordic forum checks passed.');
}

// Service layer: shared merge, search terms and services that report instead of throwing.
{
const {addListings,searchQueries,collectEbay,collectReddit,chrono24Source,exactCandidates}=await lib('collectors');
const base={modelId:'m',sourceId:'tori',country:'FI',currency:'EUR',price:1,status:'asking',observedAt:'2026-11-08',condition:'unknown',sellerType:'unknown',contents:'unknown',title:'t',collectedAt:'2026-11-08'};
const into=[{...base,url:'https://a',match:'similar'}];
assert.equal(addListings(into,[{...base,url:'https://a',match:'exact'},{...base,url:'https://b',match:'reference'}]),1);
assert.deepEqual(into.map(l=>l.match),['exact','reference']); // A URL seen twice keeps its strongest match.
assert.deepEqual(exactCandidates(into).map(c=>[c.url,'match' in c]),[['https://a',false]]);
assert.deepEqual(searchQueries({brand:'Rolex',reference:'126200-0001',name:'Datejust 36 Stainless Steel / Blue'}),['Rolex 126200','Rolex Datejust 36']);
assert.deepEqual(searchQueries({brand:'Tudor',reference:'79030N',name:'Black Bay / Steel',family:'Black Bay Fifty-Eight'}),['Tudor 79030N','Tudor Black Bay Fifty-Eight']);
const ebay=await collectEbay({id:'x',brand:'Seiko',reference:'SPB143',name:'Prospex'},{},'EBAY_DE');
assert.deepEqual([ebay.listings.length,ebay.sources[0].status],[0,'credentials_required']);
const reddit=await collectReddit({id:'x',brand:'Seiko',reference:'SPB143',name:'Prospex'},['Seiko SPB143'],{});
assert.equal(reddit.sources[0].status,'blocked');
assert.equal(chrono24Source('Seiko SPB143').sources[0].searchUrl,'https://www.chrono24.com/search/index.htm?query=Seiko+SPB143');
console.log('Collector service checks passed.');
}

// Host backoff: after a 429/403 the host is not asked again for a while; 401 (bad keys) does not trigger it.
{
const {safeFetch}=await lib('collectors');
const realFetch=globalThis.fetch;let calls=0;
globalThis.fetch=async(url)=>{calls++;return new Response('',{status:String(url).includes('limited')?429:401});};
try{
 await assert.rejects(()=>safeFetch('https://limited.test/a'),/HTTP 429/);
 await assert.rejects(()=>safeFetch('https://limited.test/b'),/HTTP 429/);
 assert.equal(calls,1);
 await assert.rejects(()=>safeFetch('https://keys.test/a'),/HTTP 401/);
 await assert.rejects(()=>safeFetch('https://keys.test/b'),/HTTP 401/);
 assert.equal(calls,3);
}finally{globalThis.fetch=realFetch;}
console.log('Host backoff checks passed.');
}

// eBay: seller's own currency, one entry per item across sites, lettered Rolex references, sold prices.
{
  const { parseEbayListings, parseEbaySales, classifyMatch, DISTINCT_LETTERED_REFERENCES } = await lib('collectors');
  const sub = { id: 'sub', brand: 'Rolex', reference: '124060-0001', name: 'Submariner', family: 'Submariner' };
  const at = new Date('2026-11-09T10:00:00Z');
  const item = (o) => ({ title: 'Rolex Submariner 124060LN 2024 full set', itemWebUrl: 'https://www.ebay.com/itm/123456789012?hash=x', itemLocation: { country: 'DE' }, price: { value: '11644.44', currency: 'USD', convertedFromValue: '10450.00', convertedFromCurrency: 'EUR' }, conditionId: '3000', ...o });
  const [l] = parseEbayListings({ itemSummaries: [item(), item({ itemWebUrl: 'https://www.ebay.com/itm/123456789012' })] }, sub, at);
  assert.equal(parseEbayListings({ itemSummaries: [item(), item({ itemWebUrl: 'https://www.ebay.com/itm/123456789012' })] }, sub, at).length, 1);
  assert.deepEqual([l.price, l.currency, l.country, l.match, l.canonicalUrl], [10450, 'EUR', 'DE', 'reference', 'https://www.ebay.com/itm/123456789012']);
  assert.equal(classifyMatch('Rolex Submariner 124060BKSO black', sub), 'reference');
  assert.equal(classifyMatch('Rolex Submariner Ref. 124060LN 2023', sub), 'reference');
  assert.equal(classifyMatch('Rolex Submariner Date 126610LN', sub), 'similar');
  assert.equal(classifyMatch('Rolex Milgauss 116400GV green', { brand: 'Rolex', reference: '116400-0001', name: 'Milgauss', family: 'Milgauss' }), 'similar');
  assert(DISTINCT_LETTERED_REFERENCES.has('116400'));
  const sold = parseEbaySales({ itemSales: [{ ...item(), lastSoldDate: '2026-10-30T12:00:00.000Z', lastSoldPrice: { value: '9900', currency: 'EUR' } }, { ...item({ itemWebUrl: 'https://www.ebay.com/itm/223456789012' }), lastSoldPrice: { value: '9800', currency: 'EUR' } }] }, sub, at);
  assert.equal(sold.length, 1, 'a sale without a sale date is skipped');
  assert.deepEqual([sold[0].status, sold[0].price, sold[0].observedAt], ['confirmed-sale', 9900, '2026-10-30']);
  const { collectEbaySold } = await lib('collectors');
  assert.equal((await collectEbaySold(sub, {}, 'EBAY_DE')).sources[0].status, 'credentials_required');
  console.log('eBay checks passed: seller currency kept, items merged across sites, lettered references, sold sales.');
}

// Regions and archive: Nordic countries are in Europe; listings without a stated country take their source's.
{
  const { inRegion } = await lib('market');
  assert(['FI', 'SE', 'DK', 'NO', 'IS', 'DE'].every((c) => inRegion(c, 'EU')));
  assert(!inRegion('US', 'EU'));
  const { mergeListings, reclassifyListings } = await lib('market-archive/listings');
  const base = { modelId: 'sub', currency: 'EUR', price: 9000, status: 'asking', observedAt: '2026-11-08', condition: 'used', sellerType: 'dealer', contents: 'unknown', title: 'Rolex Submariner 124060', collectedAt: '2026-11-08T00:00:00Z', match: 'reference' };
  const sub = { id: 'sub', brand: 'Rolex', reference: '124060-0001', name: 'Submariner', family: 'Submariner' };
  const [laatu] = reclassifyListings([{ ...base, sourceId: 'laatukellot', country: 'UNKNOWN', url: 'https://www.laatukellot.fi/rolex/1' }], sub);
  assert.equal(laatu.country, 'FI');
  const merged = mergeListings(
    [{ ...base, sourceId: 'ebay', country: 'DE', url: 'https://www.ebay.de/itm/123456789012' }],
    [{ ...base, sourceId: 'ebay', country: 'DE', url: 'https://www.ebay.com/itm/123456789012', canonicalUrl: 'https://www.ebay.com/itm/123456789012' }],
  );
  assert.equal(merged.length, 1, 'an archived ebay.de link and a new ebay.com link of the same item are one listing');
  const kept = mergeListings([{ ...base, sourceId: 'ebay', country: 'DE', status: 'confirmed-sale', url: 'https://www.ebay.com/itm/1234567890', canonicalUrl: 'https://www.ebay.com/itm/1234567890' }], [{ ...base, sourceId: 'ebay', country: 'DE', url: 'https://www.ebay.com/itm/1234567890', canonicalUrl: 'https://www.ebay.com/itm/1234567890' }]);
  assert.equal(kept[0].status, 'confirmed-sale');
  console.log('Region and archive checks passed: Nordic in Europe, source home country, eBay item keys, sales kept.');
}

// A repriced listing keeps its earlier prices; an unchanged one adds nothing.
{
  const { mergeListings } = await lib('market-archive/listings');
  const l = { modelId: 'm', sourceId: 'tori', country: 'FI', currency: 'EUR', price: 9000, status: 'asking', observedAt: '2026-11-01', condition: 'used', sellerType: 'private', contents: 'unknown', url: 'https://www.tori.fi/x/1', title: 'Rolex 124060', collectedAt: '2026-11-01T00:00:00Z', match: 'reference' };
  const first = mergeListings([], [l], '2026-11-01T10:00:00Z');
  const same = mergeListings(first, [{ ...l, observedAt: '2026-11-03' }], '2026-11-03T10:00:00Z');
  assert.equal(same[0].priceChanges, undefined);
  const cut = mergeListings(same, [{ ...l, price: 8500, observedAt: '2026-11-05' }], '2026-11-05T10:00:00Z');
  assert.deepEqual([cut[0].price, cut[0].priceChanges], [8500, [{ date: '2026-11-03', price: 9000 }]]);
  const gone = mergeListings(cut, [], '2026-11-06T10:00:00Z');
  assert.deepEqual([gone[0].archived, gone[0].price, gone[0].priceChanges.length], [true, 8500, 1], 'a listing no longer found keeps its prices');
  const back = mergeListings(gone, [{ ...l, price: 8500, observedAt: '2026-11-07' }], '2026-11-07T10:00:00Z');
  assert.deepEqual([back[0].archived, back[0].priceChanges.length, back[0].firstSeenAt], [false, 1, '2026-11-01T10:00:00Z']);
  console.log('Listing price-change checks passed: earlier prices kept, nothing overwritten.');
}
