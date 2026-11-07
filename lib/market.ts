export const catalog = [
 {id:"rolex-124060",brand:"Rolex",name:"Submariner",reference:"124060",color:"#263d38",size:"41 mm"},
 {id:"omega-31030425001001",brand:"Omega",name:"Speedmaster Moonwatch",reference:"310.30.42.50.01.001",color:"#30333b",size:"42 mm"},
 {id:"tudor-79030n",brand:"Tudor",name:"Black Bay Fifty-Eight",reference:"79030N",color:"#534237",size:"39 mm"},
 {id:"cartier-wssa0029",brand:"Cartier",name:"Santos de Cartier",reference:"WSSA0029",color:"#d4cfc1",size:"35.1 mm"},
 {id:"seiko-spb143",brand:"Seiko",name:"Prospex",reference:"SPB143",color:"#424c53",size:"40.5 mm"},
 {id:"grandseiko-sbga211",brand:"Grand Seiko",name:"Snowflake",reference:"SBGA211",color:"#d4dbe0",size:"41 mm"},
];
export const defaultSources = [
 {id:"chrono24",name:"Chrono24",url:"https://www.chrono24.com",country:"",mode:"Manual observations"},
 {id:"ebay",name:"eBay",url:"https://www.ebay.com",country:"",mode:"Manual observations"},
 {id:"reddit",name:"Reddit · r/Watchexchange",url:"https://www.reddit.com/r/Watchexchange/",country:"",mode:"Manual observations"},
 {id:"tori",name:"Tori.fi",url:"https://www.tori.fi",country:"FI",mode:"Manual observations"},
];
export type Model = typeof catalog[number];
export type Source = typeof defaultSources[number];
export type Observation = {modelId:string;sourceId:string;country:string;currency:string;price:number;status:string;observedAt:string;condition:string;sellerType:string;contents:string;url:string};
export type Owned = {modelId:string;cost:number;currency:string;purchaseDate:string};
export type Entry = {id:string;kind:string;data: any};
export const countries: Record<string,string> = {FI:"Finland",DE:"Germany",FR:"France",IT:"Italy",ES:"Spain",NL:"Netherlands",SE:"Sweden",DK:"Denmark",AT:"Austria",BE:"Belgium",IE:"Ireland",PT:"Portugal",PL:"Poland",CZ:"Czechia",EE:"Estonia",LV:"Latvia",LT:"Lithuania",LU:"Luxembourg",MT:"Malta",CY:"Cyprus",GR:"Greece",HR:"Croatia",SI:"Slovenia",SK:"Slovakia",HU:"Hungary",RO:"Romania",BG:"Bulgaria",US:"United States",GB:"United Kingdom",CH:"Switzerland",JP:"Japan",CA:"Canada",AU:"Australia",UNKNOWN:"Unknown"};
export const eu = new Set(["FI","DE","FR","IT","ES","NL","SE","DK","AT","BE","IE","PT","PL","CZ","EE","LV","LT","LU","MT","CY","GR","HR","SI","SK","HU","RO","BG"]);
export function inRegion(country:string, region:string) { return region === "Global" || (region === "EU" ? eu.has(country) : region === "US" ? country === "US" : country === region); }
export function summarize(values:number[], method="median") { if(!values.length)return null; if(method==="average")return values.reduce((a,b)=>a+b,0)/values.length; const s=[...values].sort((a,b)=>a-b); const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2; }
export const money = (n:number|null,currency="EUR") => n===null?"—":new Intl.NumberFormat("en",{style:"currency",currency,maximumFractionDigits:0}).format(n);
export function history(items:Observation[],method:string){ const groups=new Map<string,number[]>();for(const o of items){const xs=groups.get(o.observedAt)||[];xs.push(o.price);groups.set(o.observedAt,xs);}return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>({date,value:summarize(values,method)!})); }
