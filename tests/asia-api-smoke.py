"""Run only against the local preview; removes only the observations it creates."""
import urllib.request,urllib.error,http.cookiejar,json,datetime,uuid
base='http://127.0.0.1:5173'
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with client.open(base+'/signin-with-chatgpt?return_to=%2F',timeout=30) as r:r.read()
def api(path,data=None,method=None):
 req=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json'},method=method)
 with client.open(req,timeout=60) as r:return json.loads(r.read())
prefix='https://example.invalid/asia-qa-'+uuid.uuid4().hex
created=[]
try:
 for country,currency,price in [('JP','JPY',90000),('HK','JPY',100000),('DE','JPY',120000),('JP','USD',600),('SG','SGD',900)]:
  data={'modelId':'seiko-spb143','sourceId':'ebay','country':country,'currency':currency,'price':price,'status':'asking','observedAt':datetime.date.today().isoformat(),'condition':'used','sellerType':'private','contents':'unknown','url':prefix+'/'+country+'/'+currency}
  created.append(api('/api/records',{'kind':'observation','data':data})['id'])
 for currency,countries in [('JPY',{'JP','HK'}),('USD',{'JP'}),('SGD',{'SG'})]:
  result=api('/api/market?modelId=seiko-spb143&region=Asia&currency='+currency+'&statistic=average')
  own=[o for o in result['observations'] if o['url'].startswith(prefix)]
  assert {o['country'] for o in own}==countries,(currency,own)
  assert all(o['currency']==currency for o in result['observations'])
 assert not [o for o in api('/api/market?modelId=seiko-spb143&region=EU&currency=JPY')['observations'] if o['url'].startswith(prefix) and o['country']=='JP']
 print('Asia API checks passed: Japanese, Hong Kong and Singapore prices included; EU excluded; JPY, USD and SGD kept separate.')
finally:
 for id in created:api('/api/records?id='+id,method='DELETE')
 print('Removed temporary test observations.')
