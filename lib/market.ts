export const catalog = [
 {id:"rolex-124060",brand:"Rolex",name:"Submariner",reference:"124060",color:"#263d38",size:"41 mm"},
 {id:"omega-31030425001001",brand:"Omega",name:"Speedmaster Moonwatch",reference:"310.30.42.50.01.001",color:"#30333b",size:"42 mm"},
 {id:"tudor-79030n",brand:"Tudor",name:"Black Bay Fifty-Eight",reference:"79030N",color:"#534237",size:"39 mm"},
 {id:"cartier-wssa0029",brand:"Cartier",name:"Santos de Cartier",reference:"WSSA0029",color:"#d4cfc1",size:"35.1 mm"},
 {id:"seiko-spb143",brand:"Seiko",name:"Prospex",reference:"SPB143",color:"#424c53",size:"40.5 mm"},
 {id:"grandseiko-sbga211",brand:"Grand Seiko",name:"Snowflake",reference:"SBGA211",color:"#d4dbe0",size:"41 mm"},
];
export const defaultSources = [
 {id:"kellotux",name:"Kellotux.com",url:"https://kellotux.com",country:"FI",mode:"Automatic used-market listings"},
 {id:"laatukellot",name:"Laatukellot.fi",url:"https://www.laatukellot.fi",country:"FI",mode:"Automatic new and used shop prices"},
 {id:"keskisenkello",name:"Keskisen Kello",url:"https://www.keskisenkello.fi",country:"FI",mode:"Automatic new-watch shop prices"},
 {id:"huuto",name:"Huuto.net sold listings",url:"https://www.huuto.net",country:"FI",mode:"Automatic public sold evidence"},
 {id:"phillips",name:"Phillips auctions",url:"https://www.phillips.com",country:"",mode:"Automatic auction results"},
 {id:"antiquorum",name:"Antiquorum",url:"https://catalog.antiquorum.swiss",country:"",mode:"Automatic reported sales"},
 {id:"christies",name:"Christie’s",url:"https://onlineonly.christies.com",country:"",mode:"Automatic sales · selected catalogues"},
 {id:"auctionet",name:"Auctionet",url:"https://auctionet.com",country:"",mode:"Automatic sales · winning bid"},
 {id:"bukowskis",name:"Bukowskis",url:"https://www.bukowskis.com",country:"",mode:"Not connected · access challenge"},
 {id:"kaplans",name:"Kaplans",url:"https://www.kaplans.se",country:"",mode:"Not connected · access blocked"},
 {id:"cheffins",name:"Cheffins",url:"https://fineart.cheffins.co.uk",country:"",mode:"Not connected · access challenge"},
 {id:"bonhams",name:"Bonhams",url:"https://www.bonhams.com",country:"",mode:"Not connected · collector unverified"},
 {id:"chrono24",name:"Chrono24",url:"https://www.chrono24.com",country:"",mode:"Manual observations"},
 {id:"ebay-new",name:"eBay new (dealers)",url:"https://www.ebay.com",country:"",mode:"Automatic new-watch dealer prices"},
 {id:"ebay",name:"eBay",url:"https://www.ebay.com",country:"",mode:"Manual observations"},
 {id:"reddit",name:"Reddit · r/Watchexchange",url:"https://www.reddit.com/r/Watchexchange/",country:"",mode:"Manual observations"},
 {id:"tori",name:"Tori.fi",url:"https://www.tori.fi",country:"FI",mode:"Automatic asking prices"},
 {id:"finn",name:"FINN.no",url:"https://www.finn.no",country:"NO",mode:"Automatic asking prices"},
 {id:"blocket",name:"Blocket",url:"https://www.blocket.se",country:"SE",mode:"Automatic asking prices"},
 {id:"dba",name:"DBA",url:"https://www.dba.dk",country:"DK",mode:"Automatic asking prices"},
 {id:"watchrecon",name:"WatchRecon (sale forums)",url:"https://www.watchrecon.com",country:"",mode:"Automatic forum asking prices"},
 {id:"kellofoorumi",name:"Kellofoorumi",url:"https://kellofoorumi.fi/forums/yksityisten-ilmoitukset.8/",country:"FI",mode:"Automatic forum asking prices"},
 {id:"klocksnack",name:"Klocksnack",url:"https://klocksnack.se/forums/handla-s%C3%A4ljes-bytes-k%C3%B6pes.11/",country:"SE",mode:"Automatic forum asking prices"},
 {id:"tidssonen",name:"Tidssonen",url:"https://www.tidssonen.no/forum/forums/marked-%E2%80%93-klokker.9/",country:"NO",mode:"Automatic forum asking prices"},
 {id:"timezone",name:"TimeZone",url:"https://forums.timezone.com",country:"",mode:"Via WatchRecon"},
 {id:"facebook",name:"Facebook groups",url:"https://www.facebook.com/groups/",country:"",mode:"Manual observations"},
 {id:"fb-1424920254386825",name:"Facebook watch group",url:"https://www.facebook.com/groups/1424920254386825/",country:"",mode:"Manual observations"},
 {id:"watchuseek",name:"WatchUSeek",url:"https://www.watchuseek.com/forums/watches-private-sellers-and-sponsors.29/",country:"",mode:"Automatic forum asking prices"},
 {id:"web",name:"Other website",url:"",country:"",mode:"Manual observations"},
];
/**
 * Catalog fields plus what search results add: priced = market observations found, variants = dial/bracelet variants
 * of the same reference, market = 1-year market price in the requested currency, label/dial = what sets a variant apart.
 */
export type Model = typeof catalog[number] & {imageUrl?:string;imageSource?:string;priced?:number;variants?:number;market?:{price:number;currency:string;count:number};label?:string;dial?:string|null};
export type Source = typeof defaultSources[number];
export type Observation = {modelId:string;sourceId:string;country:string;currency:string;price:number;status:string;observedAt:string;condition:string;sellerType:string;contents:string;url:string};
export type Owned = {modelId:string;cost:number;currency:string;purchaseDate:string};
export type Entry = {id:string;kind:string;data: any};
export const countries: Record<string,string> = {FI:"Finland",DE:"Germany",FR:"France",IT:"Italy",ES:"Spain",NL:"Netherlands",SE:"Sweden",DK:"Denmark",AT:"Austria",BE:"Belgium",IE:"Ireland",PT:"Portugal",PL:"Poland",CZ:"Czechia",EE:"Estonia",LV:"Latvia",LT:"Lithuania",LU:"Luxembourg",MT:"Malta",CY:"Cyprus",GR:"Greece",HR:"Croatia",SI:"Slovenia",SK:"Slovakia",HU:"Hungary",RO:"Romania",BG:"Bulgaria",US:"United States",GB:"United Kingdom",CH:"Switzerland",JP:"Japan",CA:"Canada",AU:"Australia",NO:"Norway",UNKNOWN:"Unknown"};
export const currencies = ['EUR','USD','GBP','CHF','NOK','SEK','DKK','JPY','CNY','HKD','SGD','KRW','TWD','INR','AED','THB','MYR','IDR','VND','PHP'] as const;
export const asia = new Set(['AF','AM','AZ','BH','BD','BT','BN','KH','CN','CY','GE','HK','IN','ID','IR','IQ','IL','JP','JO','KZ','KW','KG','LA','LB','MO','MY','MV','MN','MM','NP','KP','OM','PK','PS','PH','QA','SA','SG','KR','LK','SY','TW','TJ','TH','TL','TR','TM','AE','UZ','VN','YE']);
Object.assign(countries,{AF:'Afghanistan',AM:'Armenia',AZ:'Azerbaijan',BH:'Bahrain',BD:'Bangladesh',BT:'Bhutan',BN:'Brunei',KH:'Cambodia',CN:'China',GE:'Georgia',HK:'Hong Kong',IN:'India',ID:'Indonesia',IR:'Iran',IQ:'Iraq',IL:'Israel',JO:'Jordan',KZ:'Kazakhstan',KW:'Kuwait',KG:'Kyrgyzstan',LA:'Laos',LB:'Lebanon',MO:'Macao',MY:'Malaysia',MV:'Maldives',MN:'Mongolia',MM:'Myanmar',NP:'Nepal',KP:'North Korea',OM:'Oman',PK:'Pakistan',PS:'Palestine',PH:'Philippines',QA:'Qatar',SA:'Saudi Arabia',SG:'Singapore',KR:'South Korea',LK:'Sri Lanka',SY:'Syria',TW:'Taiwan',TJ:'Tajikistan',TH:'Thailand',TL:'Timor-Leste',TR:'Türkiye',TM:'Turkmenistan',AE:'United Arab Emirates',UZ:'Uzbekistan',VN:'Vietnam',YE:'Yemen'});
export const eu = new Set(["FI","DE","FR","IT","ES","NL","SE","DK","AT","BE","IE","PT","PL","CZ","EE","LV","LT","LU","MT","CY","GR","HR","SI","SK","HU","RO","BG"]);
/** Seller regions offered in the header. A country code (FI, GB, …) also works as a region. */
export const nordic = new Set(["FI","SE","NO","DK","IS"]);
export const latinAmerica = new Set(["MX","GT","BZ","HN","SV","NI","CR","PA","CU","DO","PR","HT","CO","VE","EC","PE","BO","BR","PY","UY","AR","CL"]);
Object.assign(countries,{IS:"Iceland",MX:"Mexico",GT:"Guatemala",BZ:"Belize",HN:"Honduras",SV:"El Salvador",NI:"Nicaragua",CR:"Costa Rica",PA:"Panama",CU:"Cuba",DO:"Dominican Republic",PR:"Puerto Rico",HT:"Haiti",CO:"Colombia",VE:"Venezuela",EC:"Ecuador",PE:"Peru",BO:"Bolivia",BR:"Brazil",PY:"Paraguay",UY:"Uruguay",AR:"Argentina",CL:"Chile"});
export function inRegion(country:string, region:string) {
 if (region === "Global") return true;
 const group = {EU:eu, Nordic:nordic, Asia:asia, Latin:latinAmerica}[region];
 return group ? group.has(country) : country === region;
}
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

/** Facebook group sources: their numeric ID, and a link to Facebook's own in-group search (works while signed in to Facebook). */
export function facebookGroupId(url=''){return url.match(/facebook\.com\/groups\/([\w.]+)/i)?.[1]||null;}
export function facebookGroupSearchUrl(url:string,query:string){const id=facebookGroupId(url);return id?`https://www.facebook.com/groups/${id}/search/?${new URLSearchParams({q:query})}`:null;}

/** Official brand websites, used to find and recognise retail (MSRP) prices. */
export const brandSites: Record<string, string> = {
  'Rolex': 'rolex.com', 'Tudor': 'tudorwatch.com', 'Omega': 'omegawatches.com', 'Cartier': 'cartier.com', 'Seiko': 'seikowatches.com',
  'Grand Seiko': 'grand-seiko.com', 'Longines': 'longines.com', 'TAG Heuer': 'tagheuer.com', 'IWC': 'iwc.com', 'Breitling': 'breitling.com',
  'Patek Philippe': 'patek.com', 'Audemars Piguet': 'audemarspiguet.com', 'Tissot': 'tissotwatch.com', 'Hamilton': 'hamiltonwatch.com',
  'Panerai': 'panerai.com', 'Jaeger-LeCoultre': 'jaeger-lecoultre.com', 'Zenith': 'zenith-watches.com', 'Oris': 'oris.ch', 'Sinn': 'sinn.de',
  'NOMOS Glashütte': 'nomos-glashuette.com', 'Nomos': 'nomos-glashuette.com', 'Blancpain': 'blancpain.com', 'Breguet': 'breguet.com', 'Hublot': 'hublot.com',
  'Vacheron Constantin': 'vacheron-constantin.com', 'Citizen': 'citizenwatch.com', 'Casio': 'casio.com',
  'Bell & Ross': 'bellross.com', 'Chopard': 'chopard.com', 'Montblanc': 'montblanc.com', 'Frederique Constant': 'frederiqueconstant.com',
  'Glashütte Original': 'glashuette-original.com', 'A. Lange & Söhne': 'alange-soehne.com', 'Ulysse Nardin': 'ulysse-nardin.com', 'Rado': 'rado.com',
  'Mido': 'midowatches.com', 'Certina': 'certina.com', 'Baume & Mercier': 'baume-et-mercier.com', 'Bulova': 'bulova.com', 'Doxa': 'doxawatches.com',
};
export function brandSiteFor(brand: string) { return brandSites[brand] || null; }
export function isBrandSite(host: string) { const h = host.toLowerCase().replace(/^www\./, ''); return Object.values(brandSites).some((d) => h === d || h.endsWith('.' + d)); }
/** A web search restricted to the brand's site for this reference (brand sites have no stable public search URL). */
export function retailLookupUrl(brand: string, reference: string) {
  const site = brandSiteFor(brand);
  return site ? `https://duckduckgo.com/?${new URLSearchParams({ q: `site:${site} ${reference}` })}` : `https://duckduckgo.com/?${new URLSearchParams({ q: `${brand} ${reference} retail price` })}`;
}

/** Exchange rates relative to EUR (ECB reference rates). */
export type Fx = { date: string; rates: Record<string, number> };
export function parseEcbRates(xml: string): Fx | null {
  const date = xml.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  const rates: Record<string, number> = { EUR: 1 };
  for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) rates[m[1]] = Number(m[2]);
  return date && Object.keys(rates).length > 5 ? { date, rates } : null;
}
/** Converts with ECB rates; null when either currency has no rate. */
export function convertPrice(price: number, from: string, to: string, fx: Fx | null) {
  if (from === to) return price;
  const a = fx?.rates[from], b = fx?.rates[to];
  return a && b ? (price / a) * b : null;
}
