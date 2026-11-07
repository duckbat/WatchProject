import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { records } from '../../../db/schema';
import { history,inRegion,summarize,currencies } from '../../../lib/market';
const schema=z.object({modelId:z.string().min(1),region:z.enum(['Global','EU','US','Asia','FI','GB','CH']).default('Global'),currency:z.enum(currencies).default('EUR'),basis:z.enum(['asking','confirmed-sale','sold-asking']).default('asking'),statistic:z.enum(['median','average']).default('median'),sourceId:z.string().optional(),days:z.coerce.number().int().min(1).max(36500).default(30)});
export async function GET(req:Request){const user=await getChatGPTUser();if(!user)return Response.json({error:'Please sign in.'},{status:401});const parsed=schema.safeParse(Object.fromEntries(new URL(req.url).searchParams));if(!parsed.success)return Response.json({error:'Invalid market query.'},{status:400});const q=parsed.data;const start=new Date(Date.now()-q.days*86400000).toISOString().slice(0,10);const rows=await getDb().select().from(records).where(eq(records.owner,user.userId));
 // Use the latest observation per listing so daily re-collection does not overweight active listings.
 const all=rows.filter(r=>r.kind==='observation').map(r=>JSON.parse(r.payload)).filter(o=>o.modelId===q.modelId&&inRegion(o.country,q.region)&&o.currency===q.currency&&o.status===q.basis&&(!q.sourceId||o.sourceId===q.sourceId)&&o.observedAt>=start);
 const unique=new Map();for(const o of all.sort((a,b)=>a.observedAt.localeCompare(b.observedAt)))unique.set(o.url||JSON.stringify(o),o);const current=[...unique.values()];return Response.json({query:q,price:summarize(current.map(o=>o.price),q.statistic),sampleSize:current.length,observationCount:all.length,history:history(all,q.statistic),observations:current,limitations:'Asking prices are not confirmed sales. History groups observed dates; missing dates are not backfilled.'},{headers:{'Cache-Control':'no-store'}});}
