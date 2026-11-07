"""Restore exact-reference original image URLs from the upstream JSON archive."""
import argparse,json,tarfile
from pathlib import Path
from collections import Counter
from urllib.parse import urlsplit

def source_images(archive):
    images={}
    def walk(item):
        if isinstance(item,list):
            for child in item:walk(child)
        elif isinstance(item,dict):
            source=item.get('image_url_source');page=item.get('url')
            if isinstance(source,str) and isinstance(page,str) and source.startswith('https://'):
                images[urlsplit(page).path.rstrip('/')]=source
            for child in item.values():
                if isinstance(child,(dict,list)):walk(child)
    with tarfile.open(archive) as tar:
        # Read JSON only; do not extract or execute repository files.
        for entry in tar.getmembers():
            if entry.isfile() and '/catalog/' in entry.name and entry.name.endswith('.json') and entry.size<15_000_000:
                walk(json.load(tar.extractfile(entry)))
    return images

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('archive',type=Path);args=parser.parse_args()
    root=Path(__file__).resolve().parents[1];images=source_images(args.archive);repaired=0;missing=0;hosts=Counter()
    for shard in sorted((root/'data/catalog/shards').glob('*.json')):
        models=json.loads(shard.read_text())
        for model in models:
            source=images.get(urlsplit(model.get('sourceUrl','')).path.rstrip('/'))
            if source:
                host=urlsplit(source).hostname;model['imageUrl']=source;model['imageSource']='WatchBase' if host=='cdn.watchbase.com' else host;hosts[host]+=1;repaired+=1
            else:
                model['imageUrl']='';model['imageSource']='';missing+=1
        shard.write_text(json.dumps(models,ensure_ascii=False,separators=(',',':')))
    print(json.dumps({'repaired':repaired,'withoutOriginalPhoto':missing,'hosts':dict(hosts)},ensure_ascii=False))
