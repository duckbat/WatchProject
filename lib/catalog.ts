import { catalogRows } from './catalog-shards';
import { catalog as starter, type Model } from './market';
export type CatalogModel=Model & {family?:string;sourceUrl?:string};
const rows=catalogRows as CatalogModel[];
const seen=new Set(rows.map(r=>r.id));
// Preserve IDs already referenced by collection and observation records.
export const allModels:CatalogModel[]=[...rows,...starter.filter(m=>!seen.has(m.id))];
const byId=new Map(allModels.map(m=>[m.id,m]));
export const findCatalogModel=(id:string)=>byId.get(id);
export const brands=[...new Set(allModels.map(m=>m.brand))].sort((a,b)=>a.localeCompare(b));
const counts=new Map<string,number>();for(const m of allModels)counts.set(m.brand,(counts.get(m.brand)||0)+1);
export const brandCounts=brands.map(brand=>({brand,count:counts.get(brand)||0}));
const haystack=new Map(allModels.map(m=>[m.id,`${m.brand} ${m.name} ${m.reference} ${m.family||''}`.toLocaleLowerCase()]));
const squash=(s:string)=>s.toLocaleLowerCase().replace(/[^a-z0-9]/g,'');
/** Higher is better: exact reference, then reference prefix, brand+model line, then plain token match. */
function rank(m:CatalogModel,q:string,tokens:string[]){
 const ref=squash(m.reference),sq=squash(q);let score=0;
 if(sq&&ref===sq)score+=100;else if(sq&&ref.startsWith(sq))score+=60;else if(tokens.some(t=>squash(t).length>=3&&ref.startsWith(squash(t))))score+=40;
 const name=`${m.brand} ${m.name}`.toLocaleLowerCase();if(name.startsWith(q))score+=30;if(m.brand.toLocaleLowerCase()===tokens[0])score+=10;
 if(m.imageUrl)score+=2;return score;
}
export function searchCatalog({q='',brand='',page=1,pageSize=24}:{q?:string;brand?:string;page?:number;pageSize?:number}){
 const query=q.trim().toLocaleLowerCase();const tokens=query.split(/\s+/).filter(Boolean);
 let matching=allModels.filter(m=>(!brand||m.brand===brand)&&tokens.every(t=>haystack.get(m.id)!.includes(t)));
 if(tokens.length)matching=matching.map(m=>({m,s:rank(m,query,tokens)})).sort((a,b)=>b.s-a.s).map(x=>x.m);
 const pages=Math.max(1,Math.ceil(matching.length/pageSize));const current=Math.min(Math.max(1,page),pages);
 return {items:matching.slice((current-1)*pageSize,current*pageSize),total:matching.length,totalCatalog:allModels.length,page:current,pages,pageSize,brands,source:'Timepiecepedia · CC0 catalog metadata',coverage:'Catalog coverage is incomplete; prices require separate market observations.'};
}

// Reference index for matching free text (forum posts) to catalog entries; variant suffixes (-0001) are optional.
const refIndex=new Map<string,CatalogModel[]>();
for(const m of allModels){for(const k of new Set([squash(m.reference),squash(m.reference.replace(/-\d{3,4}$/,''))])){if(k.length<4)continue;const xs=refIndex.get(k)||[];if(xs.length<12)xs.push(m);refIndex.set(k,xs);}}
export function matchReferences(text:string){
 const lower=text.toLocaleLowerCase();const tokens=new Set<string>();
 for(const t of lower.match(/[a-z0-9][a-z0-9.\-/]{3,}/g)||[]){if(!/\d/.test(t))continue;const k=squash(t.replace(/^ref\.?/,'').replace(/^m(?=\d{5})/,''));tokens.add(squash(t));tokens.add(k);const market=k.match(/^(.{5,}?)(j1|k1|p1|j|k)$/);if(market)tokens.add(market[1]);}
 const found:CatalogModel[]=[];
 for(const t of tokens){for(const m of refIndex.get(t)||[])if(!found.includes(m))found.push(m);}
 return found.sort((a,b)=>Number(lower.includes(b.brand.toLocaleLowerCase()))-Number(lower.includes(a.brand.toLocaleLowerCase()))).slice(0,6);
}
