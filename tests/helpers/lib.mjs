// Compiles lib/**/*.ts into .sites-runtime/test-modules/ (same folders), so tests can load modules that use
// extensionless imports: `await lib('collectors')`. The Vite-only catalog shard loader is replaced by a JSON loader.
import ts from 'typescript';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = 'lib', OUT = '.sites-runtime/test-modules';
const target = (spec) => (existsSync(`${spec}.ts`) ? `${spec}.mjs` : existsSync(join(spec, 'index.ts')) ? `${spec}/index.mjs` : null);

function compile(dir) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) { compile(file); continue; }
    if (!name.endsWith('.ts') || name.endsWith('.d.ts')) continue;
    const out = join(OUT, file.slice(SRC.length + 1)).replace(/\.ts$/, '.mjs');
    mkdirSync(dirname(out), { recursive: true });
    if (name === 'catalog-shards.ts') {
      const shards = readdirSync('data/catalog/shards').filter((f) => f.endsWith('.json')).sort();
      writeFileSync(out, `import { readFileSync } from 'node:fs';\nexport const catalogRows = ${JSON.stringify(shards)}.flatMap((f) => JSON.parse(readFileSync('data/catalog/shards/' + f, 'utf8')));\n`);
      continue;
    }
    const js = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    // './x' → './x.mjs' or './x/index.mjs'; imports leaving lib/ (db, cloudflare:workers) are left for modules tests never load.
    writeFileSync(out, js.replace(/(from\s+|import\s*\(\s*)'(\.{1,2}\/[^']+)'/g, (m, lead, spec) => {
      const t = target(join(dirname(file), spec));
      return t ? `${lead}'${spec}${t.slice(join(dirname(file), spec).length)}'` : m;
    }));
  }
}

let built = false;
export async function lib(path) {
  if (!built) { compile(SRC); built = true; }
  const t = target(join(SRC, path));
  if (!t) throw new Error(`lib/${path} not found`);
  return import(pathToFileURL(resolve(OUT, t.slice(SRC.length + 1))).href);
}
