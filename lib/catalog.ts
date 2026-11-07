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
export function searchCatalog({q='',brand='',page=1,pageSize=24}:{q?:string;brand?:string;page?:number;pageSize?:number}){
 const tokens=q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const matching=allModels.filter(m=>(!brand||m.brand===brand)&&tokens.every(t=>`${m.brand} ${m.name} ${m.reference} ${m.family||''}`.toLocaleLowerCase().includes(t)));
 const pages=Math.max(1,Math.ceil(matching.length/pageSize));const current=Math.min(Math.max(1,page),pages);
 return {items:matching.slice((current-1)*pageSize,current*pageSize),total:matching.length,totalCatalog:allModels.length,page:current,pages,pageSize,brands,source:'Timepiecepedia · CC0 catalog metadata',coverage:'Catalog coverage is incomplete; prices require separate market observations.'};
}
