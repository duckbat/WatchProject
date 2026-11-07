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
 {id:"facebook",name:"Facebook groups",url:"https://www.facebook.com/groups/",country:"",mode:"Manual observations"},
 {id:"web",name:"Other website",url:"",country:"",mode:"Manual observations"},
];
export type Model = typeof catalog[number] & {imageUrl?:string;imageSource?:string};
export type Source = typeof defaultSources[number];
export type Observation = {modelId:string;sourceId:string;country:string;currency:string;price:number;status:string;observedAt:string;condition:string;sellerType:string;contents:string;url:string};
export type Owned = {modelId:string;cost:number;currency:string;purchaseDate:string};
export type Entry = {id:string;kind:string;data: any};
export const countries: Record<string,string> = {FI:"Finland",DE:"Germany",FR:"France",IT:"Italy",ES:"Spain",NL:"Netherlands",SE:"Sweden",DK:"Denmark",AT:"Austria",BE:"Belgium",IE:"Ireland",PT:"Portugal",PL:"Poland",CZ:"Czechia",EE:"Estonia",LV:"Latvia",LT:"Lithuania",LU:"Luxembourg",MT:"Malta",CY:"Cyprus",GR:"Greece",HR:"Croatia",SI:"Slovenia",SK:"Slovakia",HU:"Hungary",RO:"Romania",BG:"Bulgaria",US:"United States",GB:"United Kingdom",CH:"Switzerland",JP:"Japan",CA:"Canada",AU:"Australia",UNKNOWN:"Unknown"};
export const currencies = ['EUR','USD','GBP','CHF','JPY','CNY','HKD','SGD','KRW','TWD','INR','AED','THB','MYR','IDR','VND','PHP'] as const;
export const asia = new Set(['AF','AM','AZ','BH','BD','BT','BN','KH','CN','CY','GE','HK','IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MO','MY','MV','MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK','SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE']);
Object.assign(countries,{AF:'Afghanistan',AM:'Armenia',AZ:'Azerbaijan',BH:'Bahrain',BD:'Bangladesh',BT:'Bhutan',BN:'Brunei',KH:'Cambodia',CN:'China',GE:'Georgia',HK:'Hong Kong',IN:'India',ID:'Indonesia',IR:'Iran',IQ:'Iraq',IL:'Israel',JO:'Jordan',KZ:'Kazakhstan',KW:'Kuwait',KG:'Kyrgyzstan',LA:'Laos',LB:'Lebanon',MO:'Macao',MY:'Malaysia',MV:'Maldives',MN:'Mongolia',MM:'Myanmar',NP:'Nepal',KP:'North Korea',OM:'Oman',PK:'Pakistan',PS:'Palestine',PH:'Philippines',QA:'Qatar',SA:'Saudi Arabia',SG:'Singapore',KR:'South Korea',LK:'Sri Lanka',SY:'Syria',TW:'Taiwan',TJ:'Tajikistan',TH:'Thailand',TL:'Timor-Leste',TR:'Türkiye',TM:'Turkmenistan',AE:'United Arab Emirates',UZ:'Uzbekistan',VN:'Vietnam',YE:'Yemen'});
export const eu = new Set(["FI","DE","FR","IT","ES","NL","SE","DK","AT","BE","IE","PT","PL","CZ","EE","LV","LT","LU","MT","CY","GR","HR","SI","SK","HU","RO","BG"]);
export function inRegion(country:string, region:string) { return region === "Global" || (region === "EU" ? eu.has(country) : region === "US" ? country === "US" : region === "Asia" ? asia.has(country) : country === region); }
export function summarize(values:number[], method="median") { if(!values.length)return null; if(method==="average")return values.reduce((a,b)=>a+b,0)/values.length; const s=[...values].sort((a,b)=>a-b); const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2; }
export const money = (n:number|null,currency="EUR") => n===null?"—":new Intl.NumberFormat("en",{style:"currency",currency,maximumFractionDigits:0}).format(n);
export function history(items:Observation[],method:string){ const groups=new Map<string,number[]>();for(const o of items){const xs=groups.get(o.observedAt)||[];xs.push(o.price);groups.set(o.observedAt,xs);}return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>({date,value:summarize(values,method)!})); }

export const watchPhotos:Record<string,{url:string;source:string;page:string}>={
 'rolex-124060':{url:'https://www.watchclub.com/upload/watches/originali/watch-club-15408-1689010202141-15408-wb.png',source:'Watch Club',page:'https://www.watchclub.com/rolex/submariner/124060-brandnew-ref-124060-year-2022'},
 'omega-31030425001001':{url:'https://backend.altherr.de/media/0b/87/06/1770625504/Product_21680_F5FE9DBB.png?ts=1770625504',source:'Altherr',page:'https://www.altherr.de/omega-speedmaster-moonwatch-hesalit-chronograph-310-30-42-50-01-001'},
 'tudor-79030n':{url:'https://i.ebayimg.com/images/g/H8EAAOSwOFJoSJm~/s-l500.jpg',source:'eBay listing',page:'https://www.ebay.com/itm/286640799210'},
 'cartier-wssa0029':{url:'https://cdn.shopify.com/s/files/1/0566/7982/5558/files/4.Cartier-Santos-WSSA0029-White-Dial_2_432da802-b2ec-4501-9dae-8fc79cbca14c.jpg?v=1731896577',source:'Luxehouze',page:'https://luxehouze.com/sg/en/product/watch/cartier-santos-wssa0029-silver-0013269-sg'},
 'seiko-spb143':{url:'https://topperjewelers.com/cdn/shop/products/SPB143.jpg?v=1608201108',source:'Topper Jewelers',page:'https://topperjewelers.com/products/seiko-prospex-spb143'},
 'grandseiko-sbga211':{url:'https://www.hassin.co.jp/cdn/shop/files/SBGA211_e49f98bd-bd85-41f5-80ce-40bd06d410f8.jpg?v=1778222258&width=600',source:'Hassin',page:'https://www.hassin.co.jp/collections/grandseiko'}
};

export function latestListings<T extends {data:Observation}>(entries:T[]):T[]{const latest=new Map<string,T>();for(const e of [...entries].sort((a,b)=>a.data.observedAt.localeCompare(b.data.observedAt))){latest.set(e.data.url||JSON.stringify(e),e);}return [...latest.values()];}

/** Seller-side marketplace commission. The listed price is what the buyer pays; the seller receives price × (1 − rate). */
export const marketplaceFees:Record<string,{rate:number;label:string}>={chrono24:{rate:0.0695,label:'Chrono24 commission'}};
export function feeBreakdown(price:number,sourceId='chrono24'){const fee=marketplaceFees[sourceId];if(!fee)return null;const commission=price*fee.rate;return {rate:fee.rate,label:fee.label,listed:price,commission,sellerNet:price-commission,listToNet:price/(1-fee.rate)};}
