"""Run against the local preview only; never production."""
import urllib.request,urllib.error,http.cookiejar,json
base='http://127.0.0.1:5173'
def request(opener,path,data=None):
    req=urllib.request.Request(base+path,data=json.dumps(data).encode() if data else None,headers={'Content-Type':'application/json'})
    try:
        with opener.open(req,timeout=30) as r:return r.status,json.loads(r.read())
    except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
anon=urllib.request.build_opener()
assert request(anon,'/api/market?modelId=seiko-spb143')[0]==401
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with opener.open(base+'/signin-with-chatgpt?return_to=%2F',timeout=30) as r:r.read()
status,body=request(opener,'/api/market?modelId=seiko-spb143&region=EU&currency=EUR')
assert status==200 and body['sampleSize']==0,(status,body)
assert request(opener,'/api/market?modelId=seiko-spb143&currency=INVALID')[0]==400
assert request(opener,'/api/market/collect',{'modelId':'nonexistent','provider':'tori'})[0]==404
status,body=request(opener,'/api/market/collect',{'modelId':'seiko-spb143','provider':'ebay'})
assert status==422 and body['code']=='credentials_required',(status,body)
assert request(opener,'/api/market/collect',{'modelId':'seiko-spb143','provider':'tori'})[0]==429
print('API smoke checks passed: authentication, queries, validation, missing models, credential errors, atomic collection rate limit.')
