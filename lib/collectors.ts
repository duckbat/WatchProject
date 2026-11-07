import { z } from 'zod';
import { countries, currencies, type Model } from './market';
export const collectedPrice = z.object({modelId:z.string(),sourceId:z.string(),country:z.string(),currency:z.enum(currencies),price:z.number().finite().positive().max(1e9),status:z.enum(['asking','sold-asking']),observedAt:z.string(),condition:z.enum(['used','new','unknown']),sellerType:z.enum(['private','dealer','unknown']),contents:z.literal('unknown'),url:z.string().url(),title:z.string().max(500),collectedAt:z.string()});
export type Candidate=z.infer<typeof collectedPrice>;
export class CollectorError extends Error { code:string; constructor(code:string,message:string){super(message);this.code=code;} }
const compact=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const excluded=/\b(strap|bracelet|bezel|dial only|parts|replica|homage|ranneke|varaosat|box only|laatikko)\b/i;
// Catalog references often carry a dial/bracelet variant suffix (126200-0001) that sellers omit.
export function baseReference(reference:string){const ref=reference.trim();const m=ref.match(/^(.{4,}?)-\d{3,4}$/);return m?m[1]:ref;}
function titleTokens(title:string){const out=new Set<string>();for(const t of title.toLowerCase().match(/[a-z0-9]+(?:[.\-/][a-z0-9]+)*/g)||[]){out.add(compact(t));const noRef=t.replace(/^ref(?:erence)?\.?/,'');out.add(compact(noRef));}return out;}
export function exactMatch(title:string, model:Pick<Model,'brand'|'reference'>){
 const tokens=titleTokens(title);const refs=new Set([compact(model.reference),compact(baseReference(model.reference))].filter(r=>r.length>=4));
 return compact(title).includes(compact(model.brand)) && [...refs].some(r=>tokens.has(r)) && !excluded.test(title);
}
/** Same brand and model line (e.g. "Datejust 36") but no confirmed reference. Never used for prices. */
export function similarMatch(title:string, model:Pick<Model,'brand'|'name'>&{family?:string}){
 const t=title.toLowerCase();if(!compact(t).includes(compact(model.brand))||excluded.test(title))return false;
 const words=(model.name||'').toLowerCase().split(/[\s/]+/).filter(Boolean);const line=words[0]&&/^\d{2}(mm)?$/.test(words[1]||'')?[words[0],words[1].replace('mm','')]:[(model.family||words[0]||'').toLowerCase()];
 return line.every(w=>w&&new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`).test(t));
}
export type LiveListing=Candidate&{match:'exact'|'similar';image?:string};
function firstImage(v:any):string|undefined{const x=Array.isArray(v)?v[0]:v;const u=typeof x==='string'?x:x?.url;return typeof u==='string'&&u.startsWith('https://')?u:undefined;}
export function parseToriListings(html:string,model:Model&{family?:string},now=new Date()):LiveListing[]{
 const script=html.match(/<script\b(?=[^>]*\bid=["']seoStructuredData["'])[^>]*>([\s\S]*?)<\/script>/i);
 if(!script)throw new CollectorError('layout_changed','Tori returned no recognized structured listing data. Nothing was imported.');
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
export function extractPrice(text:string):{price:number;currency:string}|null{
 const re=/(\$|€|£|\b(?:usd|eur|gbp|chf)\b)\s?(\d{1,3}(?:[,.\s]\d{3})+|\d+(?:\.\d+)?)(\s?k\b)?|(\d{1,3}(?:[,.\s]\d{3})+|\d+(?:\.\d+)?)(\s?k\b)?\s?(\$|€|£|\b(?:usd|eur|gbp|chf)\b)/i;
 const m=text.match(re);if(!m)return null;
 const sym=(m[1]||m[6]||'').toLowerCase(),raw=(m[2]||m[4]||''),k=m[3]||m[5];
 const grouped=/[,.\s]\d{3}$/.test(raw)&&!/\.\d{1,2}$/.test(raw);
 let price=Number(grouped?raw.replace(/[,.\s]/g,''):raw.replace(/,/g,''));if(k)price*=1000;
 const currency=currencyBySymbol[sym];if(!currency||!Number.isFinite(price)||price<50)return null;return {price,currency};
}
/** r/Watchexchange search results ([WTS] posts). Post date is kept, so they form a real price history. */
export function parseRedditListings(body:any,model:Model&{family?:string}):LiveListing[]{
 const result:LiveListing[]=[];
 for(const child of (body?.data?.children||[]).slice(0,100)){
  const p=child?.data;if(!p||typeof p.title!=='string')continue;
  if(!/\[\s*wts|\[\s*wtt/i.test(p.title))continue;
  const text=`${p.title}\n${typeof p.selftext==='string'?p.selftext.slice(0,3000):''}`;
  const match=exactMatch(p.title,model)||exactMatch(text,model)?'exact':similarMatch(p.title,model)?'similar':null;if(!match)continue;
  const priced=extractPrice(p.title)||extractPrice(typeof p.selftext==='string'?p.selftext.slice(0,3000):'');if(!priced)continue;
  if(typeof p.permalink!=='string'||!/^\/r\/watchexchange\/comments\/[a-z0-9]+\//i.test(p.permalink))continue;
  const created=new Date(Number(p.created_utc)*1000);if(!Number.isFinite(+created))continue;
  const sold=/sold/i.test(p.link_flair_text||'')||/\[\s*sold/i.test(p.title);
  const preview=p.preview?.images?.[0]?.source?.url;const image=typeof preview==='string'?preview.replace(/&amp;/g,'&'):undefined;
  const c=collectedPrice.safeParse({modelId:model.id,sourceId:'reddit',country:/\b(conus|usa|us)\b/i.test(p.title)?'US':'UNKNOWN',currency:priced.currency,price:priced.price,status:sold?'sold-asking':'asking',observedAt:created.toISOString().slice(0,10),condition:'unknown',sellerType:'private',contents:'unknown',url:'https://www.reddit.com'+p.permalink,title:p.title.slice(0,500),collectedAt:new Date().toISOString()});
  if(c.success&&!result.some(r=>r.url===c.data.url))result.push({...c.data,match,image:firstImage(image)});
 }return result;
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
 const c=collectedPrice.safeParse({modelId:model.id,sourceId:'ebay',country:p.itemLocation?.country in countries?p.itemLocation.country:'UNKNOWN',currency:p.price?.currency,price:Number(p.price?.value),status:'asking',observedAt:now.toISOString().slice(0,10),condition:p.conditionId==='1000'?'new':Number(p.conditionId)>=3000?'used':'unknown',sellerType:p.seller?.sellerAccountType==='BUSINESS'?'dealer':p.seller?.sellerAccountType==='INDIVIDUAL'?'private':'unknown',contents:'unknown',url:link.origin+link.pathname,title:p.title,collectedAt:now.toISOString()});if(c.success&&!result.some(r=>r.url===c.data.url))result.push({...c.data,match,image:firstImage(p.image?.imageUrl||p.thumbnailImages)});
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
export type SourceStatus={id:string;name:string;status:'ok'|'error'|'credentials_required'|'blocked';count:number;message?:string;searchUrl?:string};
const toriHeaders={'User-Agent':'WatchProject/1.0 (personal watch price tracker)','Accept':'text/html'};
async function toriSearch(q:string,model:Model&{family?:string}){const url=new URL('https://www.tori.fi/recommerce/forsale/search');url.searchParams.set('q',q);return parseToriListings(await safeFetch(url.href,{headers:toriHeaders}),model);}
/** Live, unsaved asking prices for the detail page: exact-reference matches plus clearly labelled similar listings. */
export async function fetchLiveListings(model:Model&{family?:string},secrets:{EBAY_CLIENT_ID?:string;EBAY_CLIENT_SECRET?:string;REDDIT_CLIENT_ID?:string;REDDIT_CLIENT_SECRET?:string},marketplace='EBAY_DE'){
 const listings:LiveListing[]=[];const sources:SourceStatus[]=[];
 const add=(xs:LiveListing[])=>{for(const x of xs){const i=listings.findIndex(l=>l.url===x.url);if(i<0)listings.push(x);else if(x.match==='exact')listings[i]=x;}};
 const words=(model.name||'').split(/[\s/]+/).filter(Boolean);const line=words[0]&&/^\d{2}(mm)?$/i.test(words[1]||'')?`${words[0]} ${words[1]}`:(model.family||words[0]||'');
 try{const before=listings.length;add(await toriSearch(`${model.brand} ${baseReference(model.reference)}`,model));if(line)add(await toriSearch(`${model.brand} ${line}`,model));sources.push({id:'tori',name:'Tori.fi',status:'ok',count:listings.length-before});}
 catch(e){sources.push({id:'tori',name:'Tori.fi',status:'error',count:0,message:e instanceof Error?e.message:'Tori request failed'});}
 if(secrets.EBAY_CLIENT_ID&&secrets.EBAY_CLIENT_SECRET){try{const before=listings.length;const auth=JSON.parse(await safeFetch('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{Authorization:`Basic ${btoa(secrets.EBAY_CLIENT_ID+':'+secrets.EBAY_CLIENT_SECRET)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'}));
  const url=new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');url.searchParams.set('q',`${model.brand} ${baseReference(model.reference)}`);url.searchParams.set('category_ids','31387');url.searchParams.set('limit','50');
  add(parseEbayListings(JSON.parse(await safeFetch(url.href,{headers:{Authorization:`Bearer ${auth.access_token}`,'X-EBAY-C-MARKETPLACE-ID':marketplace}})),model));sources.push({id:'ebay',name:'eBay',status:'ok',count:listings.length-before});}
  catch(e){sources.push({id:'ebay',name:'eBay',status:'error',count:0,message:e instanceof Error?e.message:'eBay request failed'});}}
 else sources.push({id:'ebay',name:'eBay',status:'credentials_required',count:0,message:'Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET on the server to include eBay.'});
 const q=`${model.brand} ${baseReference(model.reference)}`;
 const redditSearch=`https://www.reddit.com/r/Watchexchange/search/?${new URLSearchParams({q,restrict_sr:'1',sort:'new'})}`;
 if(secrets.REDDIT_CLIENT_ID&&secrets.REDDIT_CLIENT_SECRET){try{const before=listings.length;const ua='web:watchledger:1.0 (personal watch price tracker)';
  const auth=JSON.parse(await safeFetch('https://www.reddit.com/api/v1/access_token',{method:'POST',headers:{Authorization:`Basic ${btoa(secrets.REDDIT_CLIENT_ID+':'+secrets.REDDIT_CLIENT_SECRET)}`,'Content-Type':'application/x-www-form-urlencoded','User-Agent':ua},body:'grant_type=client_credentials'}));
  if(typeof auth.access_token!=='string')throw new CollectorError('credentials_required','Reddit did not return an application token.');
  for(const query of [q,line?`${model.brand} ${line}`:''].filter(Boolean)){const url=new URL('https://oauth.reddit.com/r/Watchexchange/search');url.search=new URLSearchParams({q:query,restrict_sr:'1',sort:'new',t:'year',limit:'100',raw_json:'1'}).toString();add(parseRedditListings(JSON.parse(await safeFetch(url.href,{headers:{Authorization:`Bearer ${auth.access_token}`,'User-Agent':ua}})),model));}
  sources.push({id:'reddit',name:'r/Watchexchange',status:'ok',count:listings.length-before,searchUrl:redditSearch});}
  catch(e){sources.push({id:'reddit',name:'r/Watchexchange',status:'error',count:0,message:e instanceof Error?e.message:'Reddit request failed',searchUrl:redditSearch});}}
 else sources.push({id:'reddit',name:'r/Watchexchange',status:'credentials_required',count:0,message:'Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET (a free Reddit script app) to include r/Watchexchange.',searchUrl:redditSearch});
 sources.push({id:'chrono24',name:'Chrono24',status:'blocked',count:0,message:'Chrono24 blocks automated access. Open its search and record prices you see.',searchUrl:`https://www.chrono24.com/search/index.htm?${new URLSearchParams({query:q})}`});
 return {listings,sources};
}
