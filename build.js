const fs=require('fs');
// Icons: PNG liegen als Base64 in assets/ (Repo enthält nur Text) und werden nach dist/ dekodiert
fs.mkdirSync('dist',{recursive:true});
for (const s of [180,192,512]) { const b=`assets/icon-${s}.png.b64`, p=`dist/icon-${s}.png`;
  if (fs.existsSync(b)) fs.writeFileSync(p, Buffer.from(fs.readFileSync(b,'utf8').trim(),'base64'));
  else if (fs.existsSync(p)) fs.writeFileSync(b, fs.readFileSync(p).toString('base64')); }
const r=f=>fs.readFileSync(f,'utf8');
const VERSION='v1-'+Date.now();
const py=r('node_modules/pinyin-pro/dist/index.js');
const course=JSON.parse(r('src/course.json'));
const js=[py,'window.COURSE='+JSON.stringify(course)+';',r('src/compare.js'),r('src/app.js')];
const b64=f=>'data:image/png;base64,'+fs.readFileSync(f).toString('base64');
const manifest={name:'Mandarin für die Reise',short_name:'Mandarin',lang:'de',start_url:'./',scope:'./',display:'standalone',background_color:'#fbf7f2',theme_color:'#c8102e',
  icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]};
function page({single}){
  const icon180= single? b64('dist/icon-180.png'):'icon-180.png';
  let man;
  if(single){const m=JSON.parse(JSON.stringify(manifest));m.icons=[{src:b64('dist/icon-192.png'),sizes:'192x192',type:'image/png'},{src:b64('dist/icon-512.png'),sizes:'512x512',type:'image/png'}];delete m.start_url;delete m.scope;man='data:application/manifest+json,'+encodeURIComponent(JSON.stringify(m));}
  else man='manifest.webmanifest';
  return `<!DOCTYPE html>
<html lang="de"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Mandarin für die Reise</title>
<meta name="description" content="Mandarin-Reisesätze lernen mit Aussprache-Check">
<meta name="theme-color" content="#c8102e">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Mandarin">
<meta name="format-detection" content="telephone=no">
<link rel="apple-touch-icon" href="${icon180}">
<link rel="icon" type="image/png" href="${icon180}">
<link rel="manifest" href="${man}">
<style>${r('src/style.css')}</style>
</head><body>
<div class="app" id="app"><noscript>Bitte JavaScript aktivieren.</noscript></div>
<div class="toast" id="toast"></div>
<script>window.SW_ENABLED=${single?'false':'true'};</script>
<script>${js.join('\n;\n').replace(/<\/script/gi,'<\\/script')}</script>
</body></html>`;
}
fs.writeFileSync('dist/index.html',page({single:false}));
fs.writeFileSync('dist/course.json',JSON.stringify(course));
fs.writeFileSync('dist/manifest.webmanifest',JSON.stringify(manifest,null,1));
fs.writeFileSync('dist/sw.js',`const C='mandarin-${VERSION}';const F=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))))});
`);
fs.writeFileSync('mandarin-app.html',page({single:true}));
console.log('built',VERSION);
