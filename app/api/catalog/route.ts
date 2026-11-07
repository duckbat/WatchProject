import { z } from 'zod';
import { searchCatalog,findCatalogModel } from '../../../lib/catalog';
const query=z.object({q:z.string().max(200).default(''),brand:z.string().max(160).default(''),page:z.coerce.number().int().min(1).max(100000).default(1)});
export async function GET(req:Request){const params=new URL(req.url).searchParams;
 if(params.has('ids')){const ids=params.get('ids')!.split(',');if(ids.length>200)return Response.json({error:'Request at most 200 model IDs.'},{status:400});return Response.json({items:ids.map(findCatalogModel).filter(Boolean)});}
 const input=query.safeParse(Object.fromEntries(params));if(!input.success)return Response.json({error:'Invalid catalog query.'},{status:400});return Response.json(searchCatalog(input.data),{headers:{'Cache-Control':'public, max-age=0, must-revalidate'}});
}
