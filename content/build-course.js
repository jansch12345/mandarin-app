// Erzeugt src/course.json aus content/course-part*.txt
// Format: "# id | icon | Titel | Stufe", "> Erklärungszeile", "Hanzi | Pinyin | Deutsch | Tipp(optional)"
const fs=require('fs'),path=require('path');const {pinyin}=require('pinyin-pro');
const dir=__dirname;const files=fs.readdirSync(dir).filter(f=>/^course-part\d+\.txt$/.test(f)).sort((a,b)=>parseInt(a.match(/\d+/))-parseInt(b.match(/\d+/)));
const tones=[];
const toneN=s=>{for(const c of s.normalize('NFD')){if(c==='\u0304')return 1;if(c==='\u0301')return 2;if(c==='\u030c')return 3;if(c==='\u0300')return 4}return 0};
function tokenize(p){const d=p.toLowerCase().replace(/…/g,'').replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g,'');const st=strip(d);const re=/(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(iang|iong|uang|ueng|ang|eng|ing|ong|ian|iao|uai|uan|ai|ei|ao|ou|an|en|er|in|un|ia|ie|iu|ua|uo|ui|ue|a|o|e|i|u)/y;const out=[];let pos=0;while(pos<st.length){re.lastIndex=pos;const m=re.exec(st);if(!m)break;let len=m[0].length;const nx=st[pos+len];if(/n$|ng$/.test(m[0])&&nx&&/[aeiou]/.test(nx)){len-=m[0].endsWith('ng')?1:1;}out.push(d.slice(pos,pos+len));pos+=len;}return out;}
const units=[];let u=null;const seen=new Map();const warn=[];
const strip=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize('NFC').replace(/ü/g,'u').replace(/v/g,'u');
const keepU=s=>s.normalize('NFD').replace(/[\u0300\u0301\u030c\u0304]/g,'').normalize('NFC');
function align(h,p){
  const han=(h.match(/[\u3400-\u9fff]/g)||[]).join('');if(!han)return null;
  const py=pinyin(han,{type:'array'});
  let disp=p.toLowerCase().replace(/…/g,'').replace(/[^a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g,'');
  const out=[];let pos=0;
  for(const s of py){const base=strip(s);const seg=disp.slice(pos,pos+base.length);
    if(strip(seg)!==base) return {err:`${h}: erwartet „${s}“ bei „${disp.slice(pos)}“ (pinyin-pro: ${py.join(' ')})`};
    out.push(seg);pos+=base.length;}
  if(pos!==disp.length) return {err:`${h}: übrig „${disp.slice(pos)}“`};
  return {sy:out};
}
for(const f of files){for(const raw of fs.readFileSync(path.join(dir,f),'utf8').split('\n')){const line=raw.trim();if(!line)continue;
  if(line.startsWith('#')){const [id,icon,title,level]=line.slice(1).split('|').map(s=>s.trim());u={id,icon,title,level,intro:[],items:[]};units.push(u);continue}
  if(line.startsWith('>')){u.intro.push(line.slice(1).trim());continue}
  const [h,p,de,tip]=line.split('|').map(s=>s&&s.trim());
  if(!h||!p||!de){warn.push('Zeile unvollständig: '+line);continue}
  if(seen.has(h)){warn.push(`Doppelt (übersprungen): ${h} in ${u.id}, schon in ${seen.get(h)}`);continue}
  seen.set(h,u.id);
  const a=align(h,p);const it={h,p,de};if(tip)it.tip=tip;
  if(a&&a.err){const t=tokenize(p);if(t.length===(h.match(/[\u3400-\u9fff]/g)||[]).length){it.sy=t;}else warn.push('Pinyin: '+a.err+' / tokenize: '+t.join(' '));}
  else if(a){it.sy=a.sy;const ref=pinyin((h.match(/[\u3400-\u9fff]/g)||[]).join(''),{type:'array'});a.sy.forEach((x,i)=>{if(x!==ref[i]&&toneN(x)!==0)tones.push(`${h}: ${x} vs ${ref[i]}`)});}
  u.items.push(it);}}
const course={version:1,title:'Mandarin für die Reise',units};
fs.writeFileSync(path.join(dir,'..','src','course.json'),JSON.stringify(course,null,1));
console.log(units.map(u=>u.id+':'+u.items.length).join(' '),'| gesamt',units.reduce((a,u)=>a+u.items.length,0));
console.log(warn.join('\n'));console.log('TON-ABWEICHUNGEN (prüfen):\n'+tones.join('\n'));
