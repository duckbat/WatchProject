import { findCatalogModel } from "../../../lib/catalog";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getDb } from "../../../db";
import { records } from "../../../db/schema";
import { defaultSources, countries, currencies } from "../../../lib/market";
const short = z.string().trim().min(1).max(160);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+"T00:00:00Z");return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v&&v<=new Date().toISOString().slice(0,10)},"Use a valid date, today or earlier");
const currency=z.enum(currencies);
const url=z.string().max(2000).refine(v=>!v||/^https?:$/.test((()=>{try{return new URL(v).protocol}catch{return ""}})()),"Use an HTTP or HTTPS link");
const payload=z.discriminatedUnion("kind",[
 z.object({kind:z.literal("source"),data:z.object({name:short,url,country:z.string().refine(v=>!v||v in countries),mode:z.literal("Manual observations")})}),
 z.object({kind:z.literal("model"),data:z.object({brand:short,name:short,reference:short,color:z.literal("#344d47"),size:z.string().max(40),imageUrl:url.optional()})}),
 z.object({kind:z.literal("owned"),data:z.object({modelId:short,cost:z.number().finite().min(0).max(1e9),currency,purchaseDate:date})}),
 z.object({kind:z.literal("observation"),data:z.object({modelId:short,sourceId:short,country:z.string().refine(v=>v in countries),currency,price:z.number().finite().positive().max(1e9),status:z.enum(["asking","confirmed-sale","sold-asking"]),observedAt:date,condition:z.enum(["used","new","unknown"]),sellerType:z.enum(["private","dealer","unknown"]),contents:z.enum(["full-set","watch-only","unknown"]),url,title:z.string().max(500).optional(),collectedAt:z.string().datetime().optional()})})
]);
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:"Please sign in to access your tracker."},{status:401}); const rows=await getDb().select().from(records).where(eq(records.owner,user.userId));return Response.json(rows.filter(r=>r.kind!=="collection-lock").map(r=>({id:r.id,kind:r.kind,data:JSON.parse(r.payload)})),{headers:{"Cache-Control":"no-store"}});}
export async function POST(req:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:"Please sign in."},{status:401});try{
 if(Number(req.headers.get("content-length"))>16000)return Response.json({error:"Request too large"},{status:413});
 const parsed=payload.safeParse(await req.json());if(!parsed.success)return Response.json({error:parsed.error.issues[0].message},{status:400});const {kind,data}=parsed.data;const db=getDb();
 const rows=await db.select().from(records).where(eq(records.owner,user.userId));
 if("modelId" in data && !findCatalogModel(data.modelId)&&!rows.some(r=>r.kind==="model"&&r.id===data.modelId))return Response.json({error:"Choose a watch model first."},{status:400});
 if("sourceId" in data&&!defaultSources.some(s=>s.id===data.sourceId)&&!rows.some(r=>r.kind==="source"&&r.id===data.sourceId))return Response.json({error:"Choose a source first."},{status:400});
 if(kind==="observation"&&data.url&&rows.some(r=>r.kind==="observation"&&JSON.parse(r.payload).url===data.url&&JSON.parse(r.payload).observedAt===data.observedAt))return Response.json({error:"This listing is already recorded for this date."},{status:409});
 const id=crypto.randomUUID();await db.insert(records).values({id,owner:user.userId,kind,payload:JSON.stringify(data)});return Response.json({id,kind,data},{status:201});
 }catch{return Response.json({error:"Could not save. Please retry."},{status:500})}}
export async function DELETE(req:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:"Please sign in."},{status:401});const id=new URL(req.url).searchParams.get("id");if(!id)return Response.json({error:"Missing record"},{status:400});const db=getDb();const row=await db.select().from(records).where(and(eq(records.id,id),eq(records.owner,user.userId)));if(row[0]?.kind!=="owned"&&row[0]?.kind!=="observation")return Response.json({error:"Record cannot be removed here."},{status:400});await db.delete(records).where(and(eq(records.id,id),eq(records.owner,user.userId)));return Response.json({ok:true});}
