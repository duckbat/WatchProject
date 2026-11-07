import { z } from 'zod';
import { matchReferences } from '../../../../lib/catalog';

const body = z.object({ texts: z.array(z.string().max(4000)).max(300) });

/** POST {texts: string[]} → for each text, catalog entries whose reference appears in it. */
export async function POST(req: Request) {
  if (Number(req.headers.get('content-length')) > 1_300_000) return Response.json({ error: 'Too much text at once.' }, { status: 413 });
  const input = body.safeParse(await req.json().catch(() => null));
  if (!input.success) return Response.json({ error: 'Send {texts: string[]} (up to 300).' }, { status: 400 });
  return Response.json({ matches: input.data.texts.map((t) => matchReferences(t)) });
}
