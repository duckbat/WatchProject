import { z } from 'zod';
import { countries, currencies, type Model } from './market';
export const collectedPrice = z.object({modelId:z.string(),sourceId:z.string(),country:z.string(),currency:z.enum(currencies),price:z.number().finite().positive().max(1e9),status:z.literal('asking'),observedAt:z.string(),condition:z.enum(['used','new','unknown']),sellerType:z.enum(['private','dealer','unknown']),contents:z.literal('unknown'),url:z.string().url(),title:z.string().max(500),collectedAt:z.string()});
export type Candidate=z.infer<typeof collectedPrice>;
export class CollectorError extends Error { code:string; constructor(code:string,message:string){super(message);this.code=code;} }
const compact=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export function exactMatch(title:string, model:Pick<Model,'brand'|'reference'>){
 const tokens=title.toLowerCase().match(/[a-z0-9]+(?:[.\-/][a-z0-9]+)*/g)||[];
 return compact(title).includes(compact(model.brand)) && tokens.some(t=>compact(t)===compact(model.reference)) && !/\b(strap|bracelet|bezel|dial only|parts|replica|homage|ranneke|varaosat)\b/i.test(title);
}
export function parseTori(html:string,model:Model,now=new Date()):Candidate[]{
 const script=html.match(/<script\b(?=[^>]*\bid=["']seoStructuredData["'])[^>]*>([\s\S]*?)<\/script>/i);
 if(!script)throw new CollectorError('layout_changed','Tori returned no recognized structured listing data. Nothing was imported.');
 let page:any;try{page=JSON.parse(script[1]);}catch{throw new CollectorError('layout_changed','Tori structured data could not be parsed.');}
 if(!Array.isArray(page?.mainEntity?.itemListElement))throw new CollectorError('layout_changed','Tori listing format changed.');
 const result:Candidate[]=[];
 for(const entry of page.mainEntity.itemListElement.slice(0,100)){
 const p=entry.item,o=p?.offers; if(!p||!exactMatch(p.name||'',model)||o?.availability!=='https://schema.org/InStock')continue;
 let link:URL;try{link=new URL(p.url);}catch{continue;}
 if(link.protocol!=='https:'||link.hostname!=='www.tori.fi'||!/^\/recommerce\/forsale\/item\/\d+$/.test(link.pathname))continue;
 const condition=o.itemCondition||p.itemCondition;
 const candidate=collectedPrice.safeParse({modelId:model.id,sourceId:'tori',country:'FI',currency:o.priceCurrency,price:Number(o.price),status:'asking',observedAt:now.toISOString().slice(0,10),condition:condition==='https://schema.org/UsedCondition'?'used':condition==='https://schema.org/NewCondition'?'new':'unknown',sellerType:'unknown',contents:'unknown',url:link.origin+link.pathname,title:p.name,collectedAt:now.toISOString()});
 if(candidate.success&&!result.some(r=>r.url===candidate.data.url))result.push(candidate.data);
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
export function parseEbay(body:any,model:Model,now=new Date()):Candidate[]{const result:Candidate[]=[];for(const p of (body.itemSummaries||[]).slice(0,50)){
 if(!exactMatch(p.title||'',model))continue;let link:URL;try{link=new URL(p.itemWebUrl);}catch{continue;}if(link.protocol!=='https:'||!/(^|\.)ebay\.(com|de|co\.uk|fr|it|es)$/.test(link.hostname))continue;
 const c=collectedPrice.safeParse({modelId:model.id,sourceId:'ebay',country:p.itemLocation?.country in countries?p.itemLocation.country:'UNKNOWN',currency:p.price?.currency,price:Number(p.price?.value),status:'asking',observedAt:now.toISOString().slice(0,10),condition:p.conditionId==='1000'?'new':Number(p.conditionId)>=3000?'used':'unknown',sellerType:p.seller?.sellerAccountType==='BUSINESS'?'dealer':p.seller?.sellerAccountType==='INDIVIDUAL'?'private':'unknown',contents:'unknown',url:link.origin+link.pathname,title:p.title,collectedAt:now.toISOString()});if(c.success)result.push(c.data);
 }return result;}
export async function collectPrices(provider:string,model:Model,secrets:{EBAY_CLIENT_ID?:string;EBAY_CLIENT_SECRET?:string},marketplace='EBAY_DE'){
 if(provider==='tori'){const url=new URL('https://www.tori.fi/recommerce/forsale/search');url.searchParams.set('q',`${model.brand} ${model.reference}`);const html=await safeFetch(url.href,{headers:{'User-Agent':'WatchProject/1.0 (personal watch price tracker)','Accept':'text/html'}});return parseTori(html,model);}
 if(provider==='ebay'){
 if(!secrets.EBAY_CLIENT_ID||!secrets.EBAY_CLIENT_SECRET)throw new CollectorError('credentials_required','eBay needs EBAY_CLIENT_ID and EBAY_CLIENT_SECRET configured on the server.');
 const auth=JSON.parse(await safeFetch('https://api.ebay.com/identity/v1/oauth2/token',{method:'POST',headers:{Authorization:`Basic ${btoa(secrets.EBAY_CLIENT_ID+':'+secrets.EBAY_CLIENT_SECRET)}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope'}));
 if(typeof auth.access_token!=='string')throw new CollectorError('credentials_required','eBay did not return an application token.');
 const url=new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');url.searchParams.set('q',`${model.brand} ${model.reference}`);url.searchParams.set('category_ids','31387');url.searchParams.set('limit','50');
 const data=JSON.parse(await safeFetch(url.href,{headers:{Authorization:`Bearer ${auth.access_token}`,'X-EBAY-C-MARKETPLACE-ID':marketplace}}));if(data.errors?.length)throw new CollectorError('upstream_error','eBay returned an API error.');return parseEbay(data,model);
 }
 throw new CollectorError('unsupported_source',provider==='facebook'?'Facebook group collection is not connected. Private group content requires a supported authorized data source.':provider==='chrono24'?'Chrono24 blocked the public collection check. No bypass is configured.':provider==='reddit'?'Reddit collection needs an approved API integration; it is not configured.':'Automatic collection is not available for this source.');
}
