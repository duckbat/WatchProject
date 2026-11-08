import { z } from 'zod';
import { countries, currencies, type Model } from './market';
export const collectedPrice = z.object({modelId:z.string(),sourceId:z.string(),country:z.string(),currency:z.enum(currencies),price:z.number().finite().positive().max(1e9),status:z.enum(['asking','sold-asking','confirmed-sale']),observedAt:z.string(),condition:z.enum(['used','new','unknown']),sellerType:z.enum(['private','dealer','unknown']),contents:z.literal('unknown'),url:z.string().url(),title:z.string().max(500),collectedAt:z.string()});
export type Candidate=z.infer<typeof collectedPrice>;
export class CollectorError extends Error { code:string; constructor(code:string,message:string){super(message);this.code=code;} }
const compact=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const excluded=/\b(strap|bracelet|bezel|dial only|parts|replica|homage|ranneke|varaosat|box only|laatikko)\b/i;
// Use the base reference for discovery only; its suffix identifies dial/bracelet variants.
export function baseReference(reference:string){const ref=reference.trim();const m=ref.match(/^(.{4,}?)-\d{3,4}$/);return m?m[1]:ref;}
function titleTokens(title:string){const out=new Set<string>();for(const t of title.toLowerCase().match(/[a-z0-9]+(?:[.\-/][a-z0-9]+)*/g)||[]){out.add(compact(t));const noRef=t.replace(/^ref(?:erence)?\.?/,'');out.add(compact(noRef));}return out;}
const dialColors='black|white|blue|green|silver|grey|gray|champagne|brown|pink|purple|red|orange|yellow|salmon|turquoise|beige|ivory';
// shortcut: recognized dial colors only; use structured dial metadata when sources expose more detail.
function conflictingDial(text:string,name=''){
 // Only compare explicit dial descriptions; a silver case or blue strap is not evidence of dial color.
 const expected=new Set<string>();
 for(const part of name.split('/').slice(1)){
  if(/\b(gold|steel|case|bezel|bracelet|leather|rubber|strap|ceramic|titanium)\b/i.test(part))continue;
  const color=part.trim().match(new RegExp(`^(${dialColors})\\b`,'i'))?.[1];
  if(color)expected.add(color.toLowerCase().replace('gray','grey'));
 }
 if(expected.size!==1)return false;
 const before=new RegExp(`\\b(${dialColors})(?:[ -]+(?:sunburst|sunray|fluted|motif|palm|roman|diamond)){0,3}\\s+(?:dial|taulu)\\b`,'gi');
 const after=new RegExp(`\\b(?:dial|taulu)\\s*[:=-]\\s*(${dialColors})\\b`,'gi');
 const observed=[...text.matchAll(before),...text.matchAll(after)].map(m=>m[1].toLowerCase().replace('gray','grey'));
 return observed.some(color=>!expected.has(color));
}
export function exactMatch(title:string, model:Pick<Model,'brand'|'reference'>&Partial<Pick<Model,'name'>>,details=''){
 const reference=compact(model.reference),text=`${title}\n${details}`;
 const tokens=titleTokens(text);
 const found=tokens.has(reference)||(/^(rolex|tudor)$/i.test(model.brand)&&tokens.has(`m${reference}`));
 return reference.length>=4 && compact(text).includes(compact(model.brand)) && found && !excluded.test(title) && !conflictingDial(text,model.name);
}
/** Same brand and model line, without confirmation of the complete variant reference. Never used for prices. */
export function similarMatch(title:string, model:Pick<Model,'brand'|'name'>&{family?:string}){
 const t=title.toLowerCase();if(!compact(t).includes(compact(model.brand))||excluded.test(title))return false;
 const words=(model.name||'').toLowerCase().split(/[\s/]+/).filter(Boolean);const line=words[0]&&/^\d{2}(mm)?$/.test(words[1]||'')?[words[0],words[1].replace('mm','')]:[(model.family||words[0]||'').toLowerCase()];
 return line.every(w=>w&&new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`).test(t));
}
/** listedAt: when the seller posted or last edited the listing (observedAt stays the collection date). */
export type LiveListing=Candidate&{match:'exact'|'similar';image?:string;listedAt?:string};
function firstImage(v:any):string|undefined{const x=Array.isArray(v)?v[0]:v;const u=typeof x==='string'?x:x?.url;return typeof u==='string'&&u.startsWith('https://')?u:undefined;}
export function parseToriListings(html:string,model:Model&{family?:string},now=new Date()):LiveListing[]{
 const script=html.match(/<script\b(?=[^>]*\bid=["']seoStructuredData["'])[^>]*>([\s\S]*?)<\/script>/i);
 if(!script)throw new CollectorError('layout_changed','Tori returned no recognized structured listing data. Nothing was imported.');
 if(!script[1].trim())return []; // Tori leaves the block empty when a search has no results.
 let page:any;try{page=JSON.parse(script[1]);}catch{throw new CollectorError('layout_changed','Tori structured data could not be parsed.');}
 if(!Array.isArray(page?.mainEntity?.itemListElement))throw new CollectorError('layout_changed','Tori listing format changed.');
 const result:LiveListing[]=[];
 for(const entry of page.mainEntity.itemListElement.slice(0,100)){
 const p=entry.item,o=p?.offers; if(!p||o?.availability!=='https://schema.org/InStock')continue;
 const match=exactMatch(p.name||'',model)?'exact':similarMatch(p.name||'',model)?'similar':null;if(!match)continue;
 let link:URL;try{link=new URL(p.url);}catch{continue;}
 if(link.protocol!=='https:'||link.hostname!=='www.tori.fi'||!/^\/recommerce\/forsale\/item\/\d+$/.test(link.pathname))continue;
 const condition=o.itemCondition||p.itemCondition;
 const candidate=collectedPrice.safeParse({modelId:model.id,sourceId:'tori',country:'FI',currency:o.priceCurrency,price:Number(o.price),status:'asking',observedAt:now.toISOString().slice(0,10),condition:condition==='https://schema.org/UsedCondition'?'used':condition==='https://schema.org/NewCondition'?'new':'unknown',sellerType:'unknown',contents:'unknown',url:link.origin+link.pathname,title:p.name,collectedAt:now.toISOString()});
 if(candidate.success&&!result.some(r=>r.url===candidate.data.url))result.push({...candidate.data,match,image:firstImage(p.image)});
 }return result;
}
export function parseTori(html:string,model:Model,now=new Date()):Candidate[]{return parseToriListings(html,model,now).filter(l=>l.match==='exact').map(({match:_m,image:_i,...c})=>c);}
const currencyBySymbol:Record<string,string>={'$':'USD','usd':'USD','€':'EUR','eur':'EUR','£':'GBP','gbp':'GBP','chf':'CHF'};
/** First price in the text: "$8,500", "8.500€", "EUR 7900", "£6k". */
export function extractPrice(text:string,fallbackCurrency?:string):{price:number;currency:string}|null{
 const num='(\\d{1,3}(?:[,.\\u00a0\\u202f ]\\d{3})+|\\d+(?:\\.\\d{1,2})?)';const sym='(\\$|€|£|\\b(?:usd|eur|gbp|chf)\\b)';
 // Prefer "$8,500" / "EUR 7900"; then "7.900€" / "7 500 €" / "7500e" / "8500 USD"; then "hinta 7500" / "price: 7500" with a fallback currency.
 const before=text.match(new RegExp(`${sym}\\s?${num}(\\s?k\\b)?`,'i'));
 const after=before?null:text.match(new RegExp(`${num}(\\s?k\\b)?\\s?(€|£|e\\b|eur\\b|euroa?\\b|usd\\b|gbp\\b|chf\\b)`,'i'));
 const keyword=before||after||!fallbackCurrency?null:text.match(new RegExp(`\\b(?:hinta|hintapyyntö|hp\\.?|h\\.p\\.?|price|asking|pyyntö|myydään)\\s*[:=-]?\\s*${num}(\\s?k\\b)?`,'i'));
 const m=before?{sym:before[1],raw:before[2],k:before[3]}:after?{sym:after[3].trim(),raw:after[1],k:after[2]}:keyword?{sym:'',raw:keyword[1],k:keyword[2]}:null;if(!m)return null;
 const grouped=/[,.\s  ]\d{3}$/.test(m.raw)&&!/\.\d{1,2}$/.test(m.raw);
 let price=Number(grouped?m.raw.replace(/[,.\s  ]/g,''):m.raw.replace(/,/g,''));if(m.k)price*=1000;
 const sy=m.sym.toLowerCase();const currency=sy?(currencyBySymbol[sy]||(/^(e|euro|euroa)$/.test(sy)?'EUR':undefined)):fallbackCurrency;
 if(!currency||!Number.isFinite(price)||price<50||price>5_000_000)return null;return {price,currency};
}
/** r/Watchexchange search results ([WTS] posts). Post date is kept, so they form a real price history. */
export function parseRedditListings(body:any,model:Model&{family?:string}):LiveListing[]{
 const result:LiveListing[]=[];
 for(const child of (body?.data?.children||[]).slice(0,100)){
  const p=child?.data;if(!p||typeof p.title!=='string')continue;
  if(!/\[\s*wts|\[\s*wtt/i.test(p.title))continue;
  const match=exactMatch(p.title,model,typeof p.selftext==='string'?p.selftext.slice(0,3000):'')?'exact':similarMatch(p.title,model)?'similar':null;if(!match)continue;
  const priced=extractPrice(p.title)||extractPrice(typeof p.selftext==='string'?p.selftext.slice(0,3000):'');if(!priced)continue;
  if(typeof p.permalink!=='string'||!/^\/r\/watchexchange\/comments\/[a-z0-9]+\//i.test(p.permalink))continue;
  const created=new Date(Number(p.created_utc)*1000);if(!Number.isFinite(+created))continue;
  const sold=/sold/i.test(p.link_flair_text||'')||/\[\s*sold/i.test(p.title);
  const preview=p.preview?.images?.[0]?.source?.url;const image=typeof preview==='string'?preview.replace(/&amp;/g,'&'):undefined;
  const c=collectedPrice.safeParse({modelId:model.id,sourceId:'reddit',country:/\b(conus|usa|us)\b/i.test(p.title)?'US':'UNKNOWN',currency:priced.currency,price:priced.price,status:sold?'sold-asking':'asking',observedAt:created.toISOString().slice(0,10),condition:'unknown',sellerType:'private',contents:'unknown',url:'https://www.reddit.com'+p.permalink,title:p.title.slice(0,500),collectedAt:new Date().toISOString()});
  if(c.success&&!result.some(r=>r.url===c.data.url))result.push({...c.data,match,image:firstImage(image),listedAt:c.data.observedAt});
 }return result;
}
const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
export function decodeEntities(text:string){return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(m,e:string)=>e[0]==='#'?String.fromCodePoint(e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):Number(e.slice(1))):entities[e.toLowerCase()]??m);}
/** Reddit's public Atom search feed (no API key). It has no post body, so only titles with a price are used. */
export function parseRedditRss(xml:string,model:Model&{family?:string}):LiveListing[]{
 if(!/<feed[\s>]/.test(xml))throw new CollectorError('layout_changed','Reddit did not return a feed.');
 const children=[];
 for(const entry of (xml.match(/<entry>[\s\S]*?<\/entry>/g)||[]).slice(0,100)){
  const title=entry.match(/<title>([\s\S]*?)<\/title>/)?.[1];const href=entry.match(/<link href="([^"]+)"/)?.[1];const when=entry.match(/<(?:published|updated)>([^<]+)</)?.[1];
  if(!title||!href||!when)continue;
  const link=decodeEntities(href);if(!link.startsWith('https://www.reddit.com/r/'))continue;
  const thumb=entry.match(/<media:thumbnail url="([^"]+)"/)?.[1];
  children.push({data:{title:decodeEntities(decodeEntities(title)),selftext:'',permalink:link.slice('https://www.reddit.com'.length),created_utc:+new Date(when)/1000,link_flair_text:'',preview:thumb?{images:[{source:{url:decodeEntities(thumb)}}]}:undefined}});
 }
 return parseRedditListings({data:{children}},model);
}
/** One thread from a forum's public RSS feed (XenForo: WatchUSeek). */
export type ForumItem={id:string;title:string;url:string;date:string;text:string};
export function parseForumRss(xml:string,host='www.watchuseek.com'):ForumItem[]{
 if(!/<rss[\s>]/.test(xml))throw new CollectorError('layout_changed','The forum did not return an RSS feed.');
 const out:ForumItem[]=[];
 for(const item of (xml.match(/<item>[\s\S]*?<\/item>/g)||[]).slice(0,100)){
  const title=item.match(/<title>([\s\S]*?)<\/title>/)?.[1];const link=item.match(/<link>([^<]+)<\/link>/)?.[1]?.trim();const pub=item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
  if(!title||!link||!pub)continue;let u:URL;try{u=new URL(decodeEntities(link));}catch{continue;}
  if(u.protocol!=='https:'||u.hostname!==host||!/^\/threads\/[^/]*\.(\d+)\/?$/.test(u.pathname))continue;
  const when=new Date(pub);if(!Number.isFinite(+when))continue;
  const raw=item.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1]||item.match(/<description>([\s\S]*?)<\/description>/)?.[1]||'';
  const text=decodeEntities(raw.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,' ')).replace(/[ \t]+/g,' ').trim().slice(0,2000);
  out.push({id:u.pathname.match(/\.(\d+)\/?$/)![1],title:decodeEntities(title).trim().slice(0,300),url:u.origin+u.pathname,date:when.toISOString().slice(0,10),text});
 }return out;
}
/** Forum threads that name this watch, with the first price in the title or post. */
export function matchForumItems(items:ForumItem[],model:Model&{family?:string},sourceId:string):LiveListing[]{
 const result:LiveListing[]=[];
 for(const it of items){
  const match=exactMatch(it.title,model,it.text)?'exact':similarMatch(it.title,model)?'similar':null;if(!match)continue;
  const priced=extractPrice(it.title)||extractPrice(it.text);if(!priced)continue;
  const sold=/\bsold\b/i.test(it.title);
  const c=collectedPrice.safeParse({modelId:model.id,sourceId,country:/\b(conus|usa|u\.s\.)\b/i.test(`${it.title} ${it.text}`)?'US':'UNKNOWN',currency:priced.currency,price:priced.price,status:sold?'sold-asking':'asking',observedAt:it.date,condition:/\b(new|unworn|bnib)\b/i.test(it.title)?'new':'unknown',sellerType:/\b(dealer|sponsor)\b/i.test(it.text)?'dealer':'private',contents:'unknown',url:it.url,title:it.title,collectedAt:new Date().toISOString()});
  if(c.success&&!result.some(r=>r.url===c.data.url))result.push({...c.data,match,listedAt:it.date});
 }return result;
}
/** Threads naming this exact reference whose feed excerpt has no price (shown as links only). */
export function forumItemsNeedingPost(items:ForumItem[],model:Model):ForumItem[]{
 return items.filter(it=>exactMatch(it.title,model,it.text)&&!extractPrice(it.title)&&!extractPrice(it.text));
}
export async function safeFetch(url:string,init:RequestInit={},fetcher:typeof fetch=fetch){
 // Only fixed provider URLs reach this helper. User marketplace URLs are never fetched.
 const response=await fetcher(url,{...init,redirect:'manual',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new CollectorError('upstream_error',`Source returned HTTP ${response.status}. No data was imported.`);
 if(Number(response.headers.get('content-length'))>3_000_000)throw new CollectorError('too_large','Source response exceeds the collection limit.');
 const reader=response.body?.getReader();if(!reader)return '';let size=0;const decoder=new TextDecoder();let body='';
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>3_000_000)throw new CollectorError('too_large','Source response exceeds the collection limit.');body+=decoder.decode(value,{stream:true});}body+=decoder.decode();return body;}finally{await reader.cancel();}
}
export function parseEbay(body:any,model:Model,now=new Date()):Candidate[]{return parseEbayListings(body,model,now).filter(l=>l.match==='exact').map(({match:_m,image:_i,...c})=>c);}
export function parseEbayListings(body:any,model:Model&{family?:string},now=new Date()):LiveListing[]{const result:LiveListing[]=[];for(const p of (body.itemSummaries||[]).slice(0,50)){
 const match=exactMatch(p.title||'',model)?'exact':similarMatch(p.title||'',model)?'similar':null;if(!match)continue;let link:URL;try{link=new URL(p.itemWebUrl);}catch{continue;}if(link.protocol!=='https:'||!/(^|\.)ebay\.(com|de|co\.uk|fr|it|es)$/.test(link.hostname))continue;
 const c=collectedPrice.safeParse({modelId:model.id,sourceId:'ebay',country:p.itemLocation?.country in countries?p.itemLocation.country:'UNKNOWN',currency:p.price?.currency,price:Number(p.price?.value),status:'asking',observedAt:now.toISOString().slice(0,10),condition:p.conditionId==='1000'?'new':Number(p.conditionId)>=3000?'used':'unknown',sellerType:p.seller?.sellerAccountType==='BUSINESS'?'dealer':p.seller?.sellerAccountType==='INDIVIDUAL'?'private':'unknown',contents:'unknown',url:link.origin+link.pathname,title:p.title,collectedAt:now.toISOString()});if(c.success&&!result.some(r=>r.url===c.data.url))result.push({...c.data,match,image:firstImage(p.image?.imageUrl||p.thumbnailImages),listedAt:/^\d{4}-\d{2}-\d{2}/.test(p.itemCreationDate||'')?p.itemCreationDate.slice(0,10):undefined});
 }return result;}
export async function collectPrices(provider:string,model:Model,secrets:{EBAY_CLIENT_ID?:string;EBAY_CLIENT_SECRET?:string},marketplace='EBAY_DE'){
 if(provider==='tori'){const url=new URL('https://www.tori.fi/recommerce/forsale/search');url.searchParams.set('q',`${model.brand} ${baseReference(model.reference)}`);const html=await safeFetch(url.href,{headers:{'User-Agent':'WatchProject/1.0 (personal watch price tracker)','Accept':'text/html'}});return parseTori(html,model);}
 if(provider==='ebay'){
 if(!secrets.EBAY_CLIENT_ID||!secrets.EBAY_CLIENT_SECRET)throw new CollectorError('credentials_required','eBay needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET configured on the server.');
 const auth=JSON.parse(await safeFetch('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{Authorization:`Basic ${btoa(secrets.EBAY_CLIENT_ID+':'+secrets.EBAY_CLIENT_SECRET)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'}));
 if(typeof auth.access_token!=='string')throw new CollectorError('credentials_required','eBay did not return an application token.');
 const url=new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');url.searchParams.set('q',`${model.brand} ${baseReference(model.reference)}`);url.searchParams.set('category_ids','31387');url.searchParams.set('limit','50');
 const data=JSON.parse(await safeFetch(url.href,{headers:{Authorization:`Bearer ${auth.access_token}`,'X-EBAY-C-MARKETPLACE-ID':marketplace}}));if(data.errors?.length)throw new CollectorError('upstream_error','eBay returned an API error.');return parseEbay(data,model);
 }
 throw new CollectorError('unsupported_source',provider==='facebook'?'Facebook group collection is not connected. Private group content requires a supported authorized data source.':provider==='chrono24'?'Chrono24 blocked the public collection check. No bypass is configured.':provider==='reddit'?'Reddit collection needs an approved API integration; it is not configured.':'Automatic collection is not available for this source.');
}
/** Tori item pages embed the listing's last-edited time; the search page has no dates. */
export function parseToriItemDate(html:string):string|undefined{
 const iso=html.match(/\\?"edited\\?"\s*:\s*\\?"(\d{4}-\d{2}-\d{2})T/);if(iso)return iso[1];
 const fi=html.match(/Viimeksi muokattu(?:<!-- -->)?:\s*(?:<!-- -->)?(\d{1,2})\.(\d{1,2})\.(\d{4})/);
 return fi?`${fi[3]}-${fi[2].padStart(2,'0')}-${fi[1].padStart(2,'0')}`:undefined;
}
const toriDates=new Map<string,{at:number;date?:string}>();
async function addToriDates(items:LiveListing[]){
 const queue=items.filter(l=>l.sourceId==='tori'&&!l.listedAt).slice(0,24);
 const worker=async()=>{for(let l=queue.shift();l;l=queue.shift()){
  const hit=toriDates.get(l.url);if(hit&&Date.now()-hit.at<24*3600_000){l.listedAt=hit.date;continue;}
  try{const date=parseToriItemDate(await safeFetch(l.url,{headers:toriHeaders}));toriDates.set(l.url,{at:Date.now(),date});l.listedAt=date;}catch{/* keep undated */}
 }};
 await Promise.all([worker(),worker(),worker(),worker()]);
}
export type SourceStatus={id:string;name:string;status:'ok'|'error'|'credentials_required'|'blocked';count:number;message?:string;searchUrl?:string};
export const WATCHUSEEK_FEED='https://www.watchuseek.com/forums/watches-private-sellers-and-sponsors.29/index.rss';
const toriHeaders={'User-Agent':'WatchProject/1.0 (personal watch price tracker)','Accept':'text/html'};
async function toriSearch(q:string,model:Model&{family?:string}){const url=new URL('https://www.tori.fi/recommerce/forsale/search');url.searchParams.set('q',q);return parseToriListings(await safeFetch(url.href,{headers:toriHeaders}),model);}
/** Live, unsaved asking prices for the detail page: exact-reference matches plus clearly labelled similar listings. */
export async function fetchLiveListings(model:Model&{family?:string},secrets:{EBAY_CLIENT_ID?:string;EBAY_CLIENT_SECRET?:string;EBAY_MARKETPLACE?:string;EBAY_ENVIRONMENT?:string;EBAY_SANDBOX_CLIENT_ID?:string;EBAY_SANDBOX_CLIENT_SECRET?:string;REDDIT_CLIENT_ID?:string;REDDIT_CLIENT_SECRET?:string},marketplace=secrets.EBAY_MARKETPLACE||'EBAY_DE',opts:{skipReddit?:string}={}){
 const listings:LiveListing[]=[];const sources:SourceStatus[]=[];
 const add=(xs:LiveListing[])=>{for(const x of xs){const i=listings.findIndex(l=>l.url===x.url);if(i<0)listings.push(x);else if(x.match==='exact')listings[i]=x;}};
 const words=(model.name||'').split(/[\s/]+/).filter(Boolean);const line=words[0]&&/^\d{2}(mm)?$/i.test(words[1]||'')?`${words[0]} ${words[1]}`:(model.family||words[0]||'');
 {const before=listings.length;const errors:string[]=[];
  for(const query of [`${model.brand} ${baseReference(model.reference)}`,line?`${model.brand} ${line}`:''].filter(Boolean)){try{add(await toriSearch(query,model));}catch(e){errors.push(e instanceof Error?e.message:'Tori request failed');}}
  await addToriDates(listings);
  sources.push(errors.length&&listings.length===before?{id:'tori',name:'Tori.fi',status:'error',count:0,message:errors[0]}:{id:'tori',name:'Tori.fi',status:'ok',count:listings.length-before});}
 const sandbox=secrets.EBAY_ENVIRONMENT==='sandbox';
 const ebayId=sandbox?secrets.EBAY_SANDBOX_CLIENT_ID:secrets.EBAY_CLIENT_ID,ebaySecret=sandbox?secrets.EBAY_SANDBOX_CLIENT_SECRET:secrets.EBAY_CLIENT_SECRET,ebayHost=sandbox?'api.sandbox.ebay.com':'api.ebay.com';
 if(ebayId&&ebaySecret){try{const before=listings.length;const auth=JSON.parse(await safeFetch(`https://${ebayHost}/identity/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${btoa(ebayId+':'+ebaySecret)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'}));
  const url=new URL(`https://${ebayHost}/buy/browse/v1/item_summary/search`);url.searchParams.set('q',`${model.brand} ${baseReference(model.reference)}`);url.searchParams.set('category_ids','31387');url.searchParams.set('limit','50');
  const found=parseEbayListings(JSON.parse(await safeFetch(url.href,{headers:{Authorization:`Bearer ${auth.access_token}`,'X-EBAY-C-MARKETPLACE-ID':marketplace}})),model);
  // Sandbox listings are eBay's made-up test data: check the connection, never use them as prices.
  if(sandbox)sources.push({id:'ebay',name:'eBay (sandbox)',status:'ok',count:0,message:`Sandbox connection works (${found.length} test listings, not used as prices). Set EBAY_ENVIRONMENT=production once the production keyset is enabled.`});
  else{add(found);sources.push({id:'ebay',name:'eBay',status:'ok',count:listings.length-before});}}
  catch(e){const msg=e instanceof Error?e.message:'eBay request failed';sources.push({id:'ebay',name:sandbox?'eBay (sandbox)':'eBay',status:'error',count:0,message:/HTTP 401/.test(msg)?`eBay rejected the ${sandbox?'sandbox':'production'} keys (invalid_client). A new production keyset stays disabled until the Marketplace Account Deletion step is done on developer.ebay.com; also check the Cert ID was copied in full.`:msg});}}
 else sources.push({id:'ebay',name:'eBay',status:'credentials_required',count:0,message:'Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET on the server to include eBay.'});
 const q=`${model.brand} ${baseReference(model.reference)}`;
 const redditSearch=`https://www.reddit.com/r/Watchexchange/search/?${new URLSearchParams({q,restrict_sr:'1',sort:'new'})}`;
 if(opts.skipReddit)sources.push({id:'reddit',name:'r/Watchexchange',status:'error',count:0,message:opts.skipReddit,searchUrl:redditSearch});
 else if(secrets.REDDIT_CLIENT_ID&&secrets.REDDIT_CLIENT_SECRET){try{const before=listings.length;const ua='web:watchledger:1.0 (personal watch price tracker)';
  const auth=JSON.parse(await safeFetch('https://www.reddit.com/api/v1/access_token',{method:'POST',headers:{Authorization:`Basic ${btoa(secrets.REDDIT_CLIENT_ID+':'+secrets.REDDIT_CLIENT_SECRET)}`,'Content-Type':'application/x-www-form-urlencoded','User-Agent':ua},body:'grant_type=client_credentials'}));
  if(typeof auth.access_token!=='string')throw new CollectorError('credentials_required','Reddit did not return an application token.');
  for(const query of [q,line?`${model.brand} ${line}`:''].filter(Boolean)){const url=new URL('https://oauth.reddit.com/r/Watchexchange/search');url.search=new URLSearchParams({q:query,restrict_sr:'1',sort:'new',t:'year',limit:'100',raw_json:'1'}).toString();add(parseRedditListings(JSON.parse(await safeFetch(url.href,{headers:{Authorization:`Bearer ${auth.access_token}`,'User-Agent':ua}})),model));}
  sources.push({id:'reddit',name:'r/Watchexchange',status:'ok',count:listings.length-before,searchUrl:redditSearch});}
  catch(e){sources.push({id:'reddit',name:'r/Watchexchange',status:'error',count:0,message:e instanceof Error?e.message:'Reddit request failed',searchUrl:redditSearch});}}
 else{try{const before=listings.length;const url=new URL('https://www.reddit.com/r/Watchexchange/search.rss');url.search=new URLSearchParams({q,restrict_sr:'1',sort:'new',t:'year'}).toString();
  add(parseRedditRss(await safeFetch(url.href,{headers:{'User-Agent':'WatchLedger/1.0 (personal watch price tracker)',Accept:'application/atom+xml'}}),model));sources.push({id:'reddit',name:'r/Watchexchange',status:'ok',count:listings.length-before,searchUrl:redditSearch,message:'Public RSS search: posts are used when the title states a price.'});}
  catch(e){const msg=e instanceof Error?e.message:'Reddit request failed';sources.push({id:'reddit',name:'r/Watchexchange',status:'error',count:0,message:/429/.test(msg)?'Reddit is rate-limiting requests right now. Try Refresh in a minute.':msg,searchUrl:redditSearch});}}
 sources.push({id:'chrono24',name:'Chrono24',status:'blocked',count:0,message:'Chrono24 blocks automated access. Open its search and record prices you see.',searchUrl:`https://www.chrono24.com/search/index.htm?${new URLSearchParams({query:q})}`});
 return {listings,sources};
}
