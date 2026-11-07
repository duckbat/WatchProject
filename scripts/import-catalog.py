import csv,json,hashlib,shutil,re,subprocess,sys
from collections import Counter,defaultdict
from pathlib import Path
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('csv_path',type=Path)
parser.add_argument('--license-path',type=Path,required=True)
parser.add_argument('--image-archive',type=Path)
args=parser.parse_args()
p=Path(__file__).resolve().parents[1]
originals={('Rolex','124060'):'rolex-124060',('Omega','310.30.42.50.01.001'):'omega-31030425001001',('Tudor','79030N'):'tudor-79030n',('Cartier','WSSA0029'):'cartier-wssa0029',('Seiko','SPB143'):'seiko-spb143',('Grand Seiko','SBGA211'):'grandseiko-sbga211'}
models={};skipped=0
source_rows=list(csv.DictReader(args.csv_path.open()))
spellings=defaultdict(Counter)
for r in source_rows:spellings[r['brand'].strip().casefold()][r['brand'].strip()]+=1
canonical={k:v.most_common(1)[0][0] for k,v in spellings.items()}
for r in source_rows:
 brand=canonical[r['brand'].strip().casefold()];ref=re.split(r'\s*\(aka:',r['reference'].strip(),flags=re.I)[0].strip()
 if not brand or not ref:skipped+=1;continue
 key=brand.casefold()+'|'+ref.casefold()
 if key in models:continue
 image=r['image_url'].strip(); image='' if image.startswith('/') else image
 if not image.startswith('https://'):image=''
 id=originals.get((brand,ref),'ref-'+hashlib.sha256(key.encode()).hexdigest()[:20])
 models[key]={'id':id,'brand':brand,'name':r['name'].strip() or r['family'].strip() or ref,'reference':ref,'family':r['family'].strip(),'size':r['diameter_mm']+' mm' if r['diameter_mm'] else '', 'imageUrl':image,'sourceUrl':r['url'],'imageSource':'Timepiecepedia','color':'#344d47'}
rows=sorted(models.values(),key=lambda r:(r['brand'].casefold(),r['family'].casefold(),r['reference'].casefold()))
shards=p/'data/catalog/shards';shards.mkdir(exist_ok=True)
for old in shards.glob('*.json'):old.unlink()
imports=[];names=[]
for i,start in enumerate(range(0,len(rows),150)):
 name=f'chunk{i:03}';file=f'{i:03}.json';(shards/file).write_text(json.dumps(rows[start:start+150],ensure_ascii=False,separators=(',',':')));imports.append(f"import {name} from '../data/catalog/shards/{file}?raw';");names.append(name)
(p/'lib/catalog-shards.ts').write_text('\n'.join(imports)+'\nexport const catalogRows=['+','.join(names)+'].flatMap(s=>JSON.parse(s));\n')
shutil.copy(args.license_path,p/'data/catalog/LICENSE.txt')
(p/'data/catalog/README.md').write_text(f'''# Reference catalog\n\nSource: https://github.com/timepiecepedia/timepiecepedia-data (references.csv)\nLicense: CC0 1.0, supplied alongside this snapshot.\nImported 2026-11-07: {len(rows):,} unique brand/reference combinations from 48,603 CSV rows; {skipped} rows without a brand/reference excluded. Upstream coverage is incomplete and specifications are not independently verified. This is catalog metadata, not live pricing.\n\nImage URLs point to external sources; image rights are distinct from catalog metadata. Missing/broken images show a watch icon.\n''')
print(json.dumps({'uniqueModels':len(rows),'brands':len(set(r['brand'] for r in rows)),'legacyIdsFound':[r['id'] for r in rows if r['id'] in originals.values()]}))

if args.image_archive:
 subprocess.run([sys.executable,str(p/'scripts/repair-catalog-images.py'),str(args.image_archive)],check=True)
