import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { getDb } from '../../../../db';
import { records } from '../../../../db/schema';
import { catalog } from '../../../../lib/market';
import { collectPrices, CollectorError } from '../../../../lib/collectors';
const schema=z.object({modelId:z.string().max(160),provider:z.enum(['tori','ebay','chrono24','reddit','facebook']),marketplace:z.enum(['EBAY_DE','EBAY_US','EBAY_GB','EBAY_FR','EBAY_IT','EBAY_ES']).default('EBAY_DE')});
export async function GET(){return Response.json({providers:[{id:'tori',status:'available',type:'public structured data',coverage:'First search page; exact brand/reference matches only'},{id:'ebay',status:env.EBAY_CLIENT_ID&&env.EBAY_CLIENT_SECRET?'configured':'credentials_required',type:'Browse API',coverage:'Up to 50 active listings per search'},{id:'chrono24',status:'blocked'},{id:'reddit',status:'not_configured'},{id:'facebook',status:'not_configured'}]},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:'Please sign in.'},{status:401});try{
 const input=schema.safeParse(await req.json());if(!input.success)return Response.json({error:'Choose a valid provider, watch model and eBay marketplace.'},{status:400});const db=getDb();const rows=await db.select().from(records).where(eq(records.owner,user.userId));
 const custom=rows.find(r=>r.kind==='model'&&r.id===input.data.modelId);const model=catalog.find(m=>m.id===input.data.modelId)||(custom?{...JSON.parse(custom.payload),id:custom.id}:null);if(!model)return Response.json({error:'Watch model not found.'},{status:404});
 // Atomic per-user minute slot prevents concurrent collection requests from exceeding this limit.
 const slot=`collect:${user.userId}:${Math.floor(Date.now()/60000)}`;for(const row of rows.filter(r=>r.kind==='collection-lock'&&r.id!==slot))await db.delete(records).where(eq(records.id,row.id));const lock=await db.insert(records).values({id:slot,owner:user.userId,kind:'collection-lock',payload:'{}'}).onConflictDoNothing().returning();if(!lock.length)return Response.json({error:'Wait one minute between collection requests.',code:'rate_limited'},{status:429,headers:{'Retry-After':'60'}});
 const candidates=await collectPrices(input.data.provider,model,env,input.data.marketplace);return Response.json({candidates,coverage:'One search page. Exact brand and reference matches only. Active asking prices; no sold history.',collectedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){if(import.meta.env.DEV)console.warn('Collection failure:',e instanceof Error?e.message:String(e));if(e instanceof CollectorError)return Response.json({error:e.message,code:e.code},{status:e.code==='credentials_required'||e.code==='unsupported_source'?422:502});return Response.json({error:'Collection failed or timed out. No observations were imported.',code:'collection_failed'},{status:502});}}
