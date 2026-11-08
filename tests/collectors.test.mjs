import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
await mkdir('.sites-runtime/test-modules',{recursive:true});
for(const name of ['market','collectors']){const source=await readFile(`lib/${name}.ts`,'utf8');await writeFile(`.sites-runtime/test-modules/${name}.mjs`,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("'./market'","'./market.mjs'"));}
const {exactMatch,parseTori,parseEbay,safeFetch,collectPrices}=await import('../.sites-runtime/test-modules/collectors.mjs');
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

const {extractPrice,parseRedditListings}=await import('../.sites-runtime/test-modules/collectors.mjs');
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
const {feeBreakdown}=await import('../.sites-runtime/test-modules/market.mjs');
const f=feeBreakdown(10000);assert.equal(Math.round(f.commission),695);assert.equal(Math.round(f.sellerNet),9305);assert.equal(Math.round(f.listToNet),10747);assert.equal(feeBreakdown(100,'tori'),null);
console.log('Reddit parsing, price extraction and Chrono24 fee checks passed.');
const {parseRedditRss,decodeEntities}=await import('../.sites-runtime/test-modules/collectors.mjs');
assert.equal(decodeEntities('A &amp;amp; B &#32;&quot;x&quot;'),'A &amp; B  "x"');
const rss=parseRedditRss(await readFile('tests/fixtures/reddit-126200.rss','utf8'),dj);
assert(rss.length>=3);assert(rss.every(r=>r.sourceId==='reddit'&&r.url.startsWith('https://www.reddit.com/r/Watchexchange/comments/')&&r.price>1000));
assert(rss.some(r=>r.price===8999&&r.currency==='USD'));assert.throws(()=>parseRedditRss('<html>blocked</html>',dj),/feed/);
console.log(`Reddit RSS checks passed: ${rss.length} priced posts from fixture.`);
const {parseToriItemDate}=await import('../.sites-runtime/test-modules/collectors.mjs');
assert.equal(parseToriItemDate('x\\"edited\\":\\"2026-11-07T11:33:56.882191+01:00\\",y'),'2026-11-07');
assert.equal(parseToriItemDate('<p>Viimeksi muokattu<!-- -->: <!-- -->7.9.2026 klo 12.33</p>'),'2026-09-07');
assert.equal(parseToriItemDate('<html></html>'),undefined);
assert.equal(rss[0].listedAt,rss[0].observedAt);
console.log('Listing date checks passed.');
assert.deepEqual(parseTori('<script id="seoStructuredData" type="application/ld+json"></script>',model),[]);
console.log('Empty Tori search check passed.');
assert.deepEqual(extractPrice('Myydään Rolex Datejust 126200, 7 500 €'),{price:7500,currency:'EUR'});
assert.deepEqual(extractPrice('hinta 7500e tai paras tarjous'),{price:7500,currency:'EUR'});
assert.deepEqual(extractPrice('Hp. 6900',"EUR"),{price:6900,currency:'EUR'});
assert.equal(extractPrice('Hp. 6900'),null);
assert.deepEqual(extractPrice('9 200 euroa'),{price:9200,currency:'EUR'});
console.log('Finnish/Facebook price formats passed.');
const {parseForumRss,matchForumItems}=await import('../.sites-runtime/test-modules/collectors.mjs');
const forum=parseForumRss(await readFile('tests/fixtures/watchuseek-sample.rss','utf8'));
assert.equal(forum.length,3);assert.equal(forum[0].id,'5700001');assert.equal(forum[0].date,'2026-11-07');assert(forum[0].text.includes('$8,750'));
const wusDj=matchForumItems(forum,dj,'watchuseek');assert.equal(wusDj.length,1);assert.equal(wusDj[0].price,8750);assert.equal(wusDj[0].country,'US');assert.equal(wusDj[0].listedAt,'2026-11-07');assert.equal(wusDj[0].match,'reference');
const bb={id:'bb',brand:'Tudor',name:'Black Bay Fifty-Eight',reference:'79030N',family:'Black Bay'};
const wusBb=matchForumItems(forum,bb,'watchuseek');assert.equal(wusBb[0].status,'sold-asking');assert.equal(wusBb[0].price,3300);
assert.throws(()=>parseForumRss('<html>blocked</html>'),/RSS/);
console.log('WatchUSeek feed checks passed.');
const {forumItemsNeedingPost}=await import('../.sites-runtime/test-modules/collectors.mjs');
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
const {classifyMatch,referenceMatch,parseToriListings,parseWatchRecon,relativeDate,failureStatus,CollectorError}=await import('../.sites-runtime/test-modules/collectors.mjs');
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
const {partsListing}=await import('../.sites-runtime/test-modules/collectors.mjs');
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
