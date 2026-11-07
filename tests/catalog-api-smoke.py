import urllib.request,urllib.error,json
base='http://127.0.0.1:5173/api/catalog'
def get(q):
 with urllib.request.urlopen(base+q,timeout=120) as r:return json.loads(r.read())
first=get('');assert first['totalCatalog']>40000 and len(first['items'])==24 and len(first['brands'])>200,first
second=get('?page=2');assert not {m['id'] for m in first['items']} & {m['id'] for m in second['items']}
omega=get('?brand=Omega&q=speedmaster');assert omega['total']>100 and all(m['brand']=='Omega' and 'speedmaster' in m['name'].lower() for m in omega['items'])
empty=get('?q=xyznonexistent99999');assert empty['total']==0 and empty['items']==[]
model=omega['items'][0];resolved=get('?ids='+model['id']);assert resolved['items'][0]['reference']==model['reference']
assert get('?ids=rolex-124060')['items'][0]['id']=='rolex-124060'
try:get('?page=-1');raise AssertionError('Invalid page accepted')
except urllib.error.HTTPError as e:assert e.code==400
print('Catalog API passed: total coverage, pagination, brand/search filters, empty results, ID resolution and invalid query rejection.')

# Confirm catalog references outside the six starters are accepted by personal-record APIs.
import http.cookiejar,datetime
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with client.open('http://127.0.0.1:5173/signin-with-chatgpt?return_to=%2F') as r:r.read()
req=urllib.request.Request('http://127.0.0.1:5173/api/records',data=json.dumps({'kind':'owned','data':{'modelId':model['id'],'cost':0,'currency':'EUR','purchaseDate':datetime.date.today().isoformat()}}).encode(),headers={'Content-Type':'application/json'})
with client.open(req) as r:
 assert r.status==201
 record=json.loads(r.read())
with client.open(urllib.request.Request('http://127.0.0.1:5173/api/records?id='+record['id'],method='DELETE')) as r:assert r.status==200
print('Collection API accepts a catalog reference beyond the original starter models; temporary record removed.')
