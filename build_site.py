import json, re
from PIL import Image, ImageDraw
tpl=open('template.html').read()
data=json.dumps(json.load(open('ranges_8max.json')),ensure_ascii=False,separators=(',',':'))
body=tpl.replace('__DATA__',data)
title=re.search(r'<title>(.*?)</title>',body).group(1)
body=body.replace('<title>'+title+'</title>','')
head=f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Ranges">
<meta name="theme-color" content="#15181c">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<link rel="icon" href="icon-192.png">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}</style>
</head>
<body>
'''
tail='''
<script>if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{})}</script>
</body>
</html>
'''
open('docs/index.html','w').write(head+body+tail)
open('docs/manifest.webmanifest','w').write(json.dumps({
 "name":"Ranges 8-max","short_name":"Ranges","start_url":"./","display":"standalone",
 "background_color":"#15181c","theme_color":"#15181c",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png"},{"src":"icon-512.png","sizes":"512x512","type":"image/png"}]},indent=1))
open('docs/sw.js','w').write('''const C='ranges-v1';
const FILES=['./','./index.html','./manifest.webmanifest','./icon-180.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(m=>m||caches.match('./index.html'))));
});
''')
# icons: dark tile, green/red diagonal cell, "8" label
def icon(size,path):
    im=Image.new('RGB',(size,size),'#15181c'); d=ImageDraw.Draw(im)
    m=int(size*0.18); r=int(size*0.12)
    d.rounded_rectangle([m,m,size-m,size-m],radius=r,fill='#2e9e4f')
    d.polygon([(size-m,m),(size-m,size-m),(m,size-m)],fill='#d93a3a')
    # re-round corners by masking
    mask=Image.new('L',(size,size),0); ImageDraw.Draw(mask).rounded_rectangle([m,m,size-m,size-m],radius=r,fill=255)
    bg=Image.new('RGB',(size,size),'#15181c'); bg.paste(im,mask=mask); im=bg
    im.save(path)
for s in (180,192,512): icon(s,f'docs/icon-{s}.png')
print('site built')
