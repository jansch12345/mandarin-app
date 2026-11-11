(function(){
'use strict';
var COURSE = window.COURSE, UNITS = COURSE.units, PY = window.pinyinPro, CMP = window.MandarinCompare;
var CHUNK = 8, MASTER = 0.8;
var $ = function(s, el){ return (el||document).querySelector(s); };
var esc = function(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var DAY = 864e5, INTERVALS = [0, 1, 2, 4, 8, 16, 32, 64]; // Tage je Stufe
var KEY = 'mandarin-reise-v1';

// ---------- Speicher ----------
function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ return {}; } }
var S = load();
S.cards = S.cards || {}; S.settings = S.settings || { rate: 0.85, slowRate: 0.55, hideMeaning: false, voice: '', unlockAll: false };
S.days = S.days || [];
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }
function today(){ var d = new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function markActive(){ var t = today(); if (S.days[S.days.length-1] !== t){ S.days.push(t); if (S.days.length > 400) S.days.shift(); save(); } }
function streak(){
  var n = 0, d = new Date();
  for (;;){ var k = d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
    if (S.days.indexOf(k) >= 0){ n++; d.setDate(d.getDate()-1); }
    else if (n === 0 && k === today()){ d.setDate(d.getDate()-1); }
    else break; }
  return n;
}
var ALL = [];
UNITS.forEach(function(u, ui){
  u.index = ui; u.lessons = [];
  for (var i = 0; i < u.items.length; i += CHUNK){
    var part = u.items.slice(i, i + CHUNK);
    if (part.length < 4 && u.lessons.length){ u.lessons[u.lessons.length-1] = u.lessons[u.lessons.length-1].concat(part); }
    else u.lessons.push(part);
  }
  u.items.forEach(function(c){ c.unit = u.id; ALL.push(c); });
});
function unitById(id){ return UNITS.filter(function(u){ return u.id === id; })[0]; }
function learnedShare(items){ return items.filter(function(c){ var s = st(c); return s && s.box >= 1; }).length / (items.length || 1); }
function unlocked(u){ if (S.settings.unlockAll || u.index === 0) return true; var p = UNITS[u.index - 1]; return unlocked(p) && learnedShare(p.items) >= MASTER; }
function shuffle(a){ for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function st(c){ return S.cards[c.h] || null; }
function isDue(c, now){ var s = st(c); return s && s.due <= (now || Date.now()); }
function isKnown(c){ var s = st(c); return s && s.box >= 2; }
function grade(c, good){
  var s = st(c) || { box: 0, due: 0, reps: 0 };
  s.reps++; s.last = Date.now();
  if (good){ s.box = Math.min(s.box + 1, INTERVALS.length - 1); s.due = Date.now() + INTERVALS[s.box] * DAY - 3600e3; }
  else { s.box = 0; s.due = Date.now() + 10 * 60e3; }
  S.cards[c.h] = s; markActive(); save();
}

// ---------- Sprachausgabe ----------
var voices = [];
function loadVoices(){
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices().filter(function(v){ return /^zh/i.test(v.lang) || /cmn/i.test(v.lang); });
}
if ('speechSynthesis' in window){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function pickVoice(){
  if (S.settings.voice){ var f = voices.filter(function(v){ return v.voiceURI === S.settings.voice; })[0]; if (f) return f; }
  var cn = voices.filter(function(v){ return /zh[-_]CN/i.test(v.lang); });
  var pref = cn.filter(function(v){ return /ting|li-mu|yu-shu|xiaoxiao|google/i.test(v.name); });
  return pref[0] || cn[0] || voices.filter(function(v){ return !/HK|TW/i.test(v.lang); })[0] || voices[0] || null;
}
function speak(text, slow){
  if (!('speechSynthesis' in window)){ toast('Sprachausgabe wird von diesem Browser nicht unterstützt.'); return; }
  speechSynthesis.cancel();
  var u = new SpeechSynthesisUtterance(text.replace(/[?!？！]/g, ''));
  u.lang = 'zh-CN'; var v = pickVoice(); if (v) u.voice = v;
  u.rate = slow ? S.settings.slowRate : S.settings.rate;
  speechSynthesis.speak(u);
  if (!v && !voices.length) setTimeout(function(){ loadVoices(); if (!voices.length) toast('Keine chinesische Stimme gefunden – unter iOS: Einstellungen › Bedienungshilfen › Gesprochene Inhalte › Stimmen › Chinesisch.'); }, 1200);
}

// ---------- Spracherkennung ----------
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
var standalone = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
var rec = null, listening = false;
function srErrorText(code){
  switch(code){
    case 'not-allowed': case 'service-not-allowed':
      return 'Kein Zugriff auf Mikrofon oder Spracherkennung. Auf dem iPhone: <b>Einstellungen › Safari › Mikrofon</b> auf „Fragen“ oder „Erlauben“ stellen, und <b>Einstellungen › Allgemein › Tastaturen › Diktierfunktion</b> einschalten (die Spracherkennung nutzt Apples Diktierdienst). Danach die Seite neu laden.' +
        (standalone ? '<br><br>Falls es in der Homescreen-App nicht klappt: Öffne die Seite direkt in Safari – dort funktioniert die Spracherkennung zuverlässiger.' : '');
    case 'no-speech': return 'Ich habe nichts gehört. Tippe auf „Aussprache prüfen“ und sprich direkt danach deutlich ins Mikrofon.';
    case 'audio-capture': return 'Kein Mikrofon gefunden oder es wird gerade von einer anderen App benutzt.';
    case 'network': return 'Die Spracherkennung braucht eine Internetverbindung (sie läuft über Apples Server). Bitte Verbindung prüfen.';
    case 'language-not-supported': return 'Chinesisch (zh-CN) wird von der Spracherkennung dieses Geräts nicht unterstützt. Auf dem iPhone ggf. unter Einstellungen › Allgemein › Tastaturen eine chinesische Tastatur (Pinyin) hinzufügen.';
    case 'aborted': return '';
    default: return 'Die Spracherkennung ist fehlgeschlagen (' + esc(code) + '). Bitte noch einmal versuchen.';
  }
}
function unsupportedText(){
  if (!window.isSecureContext) return 'Die Aussprache-Prüfung braucht eine sichere Verbindung (https://). Bitte die App über ihre https-Adresse öffnen.';
  return 'Dieser Browser unterstützt keine Spracherkennung. Auf dem iPhone bitte <b>Safari</b> (iOS 14.5 oder neuer) verwenden; Siri bzw. die Diktierfunktion muss eingeschaltet sein. Am Computer funktioniert Chrome oder Safari.' +
    (standalone ? '<br><br>In der Homescreen-App ist die Spracherkennung auf manchen iOS-Versionen gesperrt – öffne die Seite dann direkt in Safari.' : '');
}
function startCheck(card, ui){
  if (!SR){ ui.error(unsupportedText()); return; }
  if (listening && rec){ try { rec.stop(); } catch(e){} return; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  rec = new SR();
  rec.lang = 'zh-CN'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 5;
  var alts = [], interim = '', gotFinal = false, timer;
  rec.onstart = function(){ listening = true; ui.listening(true); timer = setTimeout(function(){ try { rec.stop(); } catch(e){} }, 7000); };
  rec.onresult = function(ev){
    interim = '';
    for (var i = ev.resultIndex; i < ev.results.length; i++){
      var r = ev.results[i];
      if (r.isFinal){ gotFinal = true; alts = []; for (var j = 0; j < r.length; j++) alts.push(r[j].transcript); }
      else interim += r[0].transcript;
    }
    ui.interim(gotFinal ? alts[0] : interim);
  };
  rec.onerror = function(ev){ clearTimeout(timer); listening = false; ui.listening(false); var t = srErrorText(ev.error); if (t) ui.error(t); gotFinal = true; alts = null; };
  rec.onend = function(){
    clearTimeout(timer); listening = false; ui.listening(false);
    if (alts === null) return;
    if (!alts.length && interim) alts = [interim];
    if (!alts.length){ ui.error(srErrorText('no-speech')); return; }
    var best = null;
    alts.forEach(function(a){ var r = CMP.compare(card.h, a, PY); if (!best || r.score > best.score) best = r; });
    ui.result(best);
  };
  try { rec.start(); } catch(e){ ui.error('Spracherkennung konnte nicht gestartet werden: ' + esc(e.message || e)); }
}

// ---------- Darstellung ----------
var root = $('#app');
function toast(t){ var el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function(){ el.classList.remove('show'); }, 3200); }
function toneOf(sy){ var m = { 'ā':1,'ē':1,'ī':1,'ō':1,'ū':1,'ǖ':1,'á':2,'é':2,'í':2,'ó':2,'ú':2,'ǘ':2,'ǎ':3,'ě':3,'ǐ':3,'ǒ':3,'ǔ':3,'ǚ':3,'à':4,'è':4,'ì':4,'ò':4,'ù':4,'ǜ':4 };
  for (var i = 0; i < sy.length; i++) if (m[sy[i]]) return m[sy[i]]; return 0; }
function cardSyls(c){
  var han = CMP.onlyHan(c.h); if (!han) return [];
  var p = (c.sy && c.sy.length === han.length) ? c.sy : PY.pinyin(han, { type: 'array' });
  return han.split('').map(function(ch, i){ return { han: ch, py: p[i], tone: toneOf(p[i]) }; });
}
function sylsHTML(c){
  return cardSyls(c).map(function(s){
    return '<div class="syl"><span class="c">' + s.han + '</span><span class="p tone' + s.tone + '">' + esc(s.py) + '</span></div>'; }).join('');
}
var ST_LABEL = { ok: 'richtig', homophone: 'gleicher Klang', tone: 'Ton?', miss: 'fehlt' };
function resultHTML(r, c){
  var cs = cardSyls(c);
  var cls = r.score >= 80 ? 'good' : r.score >= 50 ? 'mid' : 'low';
  var tonename = ['neutral', '1. Ton', '2. Ton', '3. Ton', '4. Ton', 'neutral'];
  var syl = r.details.map(function(d, i){
    var py = cs[i] ? cs[i].py : d.base, tn = cs[i] ? cs[i].tone : d.tone;
    var extra = d.status === 'tone' ? '<span class="st">gehört: ' + esc(d.heardHan) + '</span>' : d.status === 'homophone' ? '<span class="st">' + esc(d.heardHan) + '</span>' : '<span class="st">' + ST_LABEL[d.status] + '</span>';
    return '<div class="syl ' + d.status + '"><span class="c">' + d.han + '</span><span class="p tone' + d.tone + '">' + esc(py) + '</span>' + extra + '</div>';
  }).join('');
  var fb = [];
  var miss = r.details.filter(function(d){ return d.status === 'miss'; }), tone = r.details.filter(function(d){ return d.status === 'tone'; });
  if (r.score === 100 && r.heard === r.target) fb.push('Sehr gut! Die Spracherkennung hat genau den Zielsatz verstanden. 🎉');
  else if (r.score === 100) fb.push('Klingt richtig! Erkannt wurden gleich klingende Zeichen (gleiche Silben und Töne) – das zählt als richtig ausgesprochen. 👍');
  else if (r.score >= 80) fb.push('Gut verstanden! Kleine Abweichungen – hör dir das Original noch einmal an.');
  if (tone.length) fb.push('Prüfe den Ton bei: ' + tone.map(function(d){ return '<b>' + d.han + '</b> (Ziel: ' + tonename[d.tone] + ')'; }).join(', ') + '.');
  if (miss.length) fb.push('Nicht erkannt: ' + miss.map(function(d){ return '<b>' + d.han + '</b>'; }).join(', ') + ' – langsam anhören und Silbe für Silbe nachsprechen.');
  if (r.extra > 0 && r.score < 100) fb.push('Es wurden zusätzliche Silben erkannt – sprich nur den Zielsatz.');
  return '<div class="result"><div class="score ' + cls + '"><b>' + r.score + '</b><span>/ 100 Punkte (ungefähr)</span></div>' +
    '<div class="heard">Verstanden: <span>' + (esc(r.heardRaw) || '—') + '</span></div>' +
    '<div class="syls">' + syl + '</div>' +
    '<div class="legend"><span><i style="background:var(--ok)"></i>richtig</span><span><i style="background:#7fc49b"></i>gleicher Klang, anderes Zeichen</span><span><i style="background:var(--warn)"></i>Ton abweichend</span><span><i style="background:var(--bad)"></i>nicht erkannt</span></div>' +
    '<div class="fb">' + fb.join('<br>') + '</div>' +
    '<div class="honest">Hinweis: Das ist eine <b>ungefähre</b> Prüfung. Die Spracherkennung errät aus deinem Gesprochenen die wahrscheinlichsten Zeichen – sie korrigiert dabei oft kleine Ton­fehler stillschweigend aus dem Zusammenhang. Ein hoher Wert heißt „verständlich“, nicht „perfekt“. Für feine Töne: immer mit dem Original vergleichen.</div></div>';
}

// ---------- Ansichten ----------
var session = null;
function md(t){ return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
function lessonStats(items, now){
  return { known: items.filter(isKnown).length, learned: items.filter(function(c){ var s = st(c); return s && s.box >= 1; }).length,
           started: items.filter(st).length, due: items.filter(function(c){ return isDue(c, now); }).length };
}
function nextLesson(){
  for (var i = 0; i < UNITS.length; i++){ var u = UNITS[i]; if (!unlocked(u)) break;
    for (var j = 0; j < u.lessons.length; j++) if (u.lessons[j].some(function(c){ var s = st(c); return !s || s.box < 1; })) return { u: u, j: j }; }
  return null;
}
function home(){
  session = null; if ('speechSynthesis' in window) speechSynthesis.cancel();
  var now = Date.now(), due = ALL.filter(function(c){ return isDue(c, now); }).length;
  var known = ALL.filter(isKnown).length, learned = ALL.filter(function(c){ var s = st(c); return s && s.box >= 1; }).length;
  var showInstall = !standalone && /iPhone|iPad|iPod/.test(navigator.userAgent) && !S.installHint;
  var nx = nextLesson();
  root.innerHTML =
    '<header class="top"><div class="logo">中</div><h1>Mandarin für die Reise</h1><button class="iconbtn" id="btnInfo" aria-label="Einstellungen">⚙️</button></header>' +
    (showInstall ? '<div class="install"><div>📲 <b>Als App installieren:</b> In Safari unten auf <b>Teilen</b> (□↑) tippen › <b>Zum Home-Bildschirm</b>.</div><button id="hideInstall" aria-label="Schließen">×</button></div>' : '') +
    '<div class="stats"><div class="stat"><b>' + learned + '</b><span>von ' + ALL.length + ' gelernt</span></div><div class="stat"><b>' + due + '</b><span>fällig</span></div><div class="stat"><b>' + streak() + '</b><span>Tage am Stück</span></div></div>' +
    (due ? '<button class="primary" id="btnReview">🔁 ' + due + ' Karte' + (due > 1 ? 'n' : '') + ' wiederholen</button><div style="height:8px"></div>' : '') +
    (nx ? '<button class="' + (due ? 'secondary' : 'primary') + '" id="btnNext">▶︎ Weiterlernen: ' + esc(nx.u.title) + ' · Lektion ' + (nx.j + 1) + '</button>' : (!due ? '<button class="primary" disabled>Alles erledigt für heute ✨</button>' : '')) +
    '<div class="lessons">' + UNITS.map(function(u){
      var ok = unlocked(u), s = lessonStats(u.items, now), pct = Math.round(100 * s.learned / u.items.length);
      return '<button class="lesson' + (ok ? '' : ' locked') + '" data-u="' + u.id + '"><span class="ic">' + (ok ? u.icon : '🔒') + '</span><span class="tt"><b>' + (u.index) + ' · ' + esc(u.title) + '</b><small>' + u.items.length + ' Einträge · ' +
        (ok ? s.learned + ' gelernt' + (s.due ? ' · ' + s.due + ' fällig' : '') + (pct >= MASTER * 100 ? ' · ✅' : '') : 'frei ab ' + Math.round(MASTER * 100) + ' % in Unit ' + (u.index - 1)) +
        '</small><span class="bar"><i style="width:' + pct + '%"></i></span></span><span>' + (ok ? '›' : '') + '</span></button>';
    }).join('') + '</div>' +
    '<p class="note">Eine Unit wird frei, sobald du ' + Math.round(MASTER * 100) + ' % der vorherigen Unit mindestens einmal mit „Kann ich ✓“ markiert hast. Fortschritt wird nur auf diesem Gerät gespeichert. ' + known + ' Einträge sind schon sicher (mehrfach wiederholt).</p>';
  root.querySelectorAll('.lesson').forEach(function(b){ b.onclick = function(){ var u = unitById(b.getAttribute('data-u'));
    if (!unlocked(u)) { toast('Noch gesperrt – lerne zuerst ' + Math.round(MASTER * 100) + ' % von Unit ' + (u.index - 1) + '. (Oder in den Einstellungen alles freischalten.)'); return; } unitView(u); }; });
  var r = $('#btnReview'); if (r) r.onclick = startReview;
  var n = $('#btnNext'); if (n) n.onclick = function(){ startLesson(nx.u, nx.j); };
  var h = $('#hideInstall'); if (h) h.onclick = function(){ S.installHint = 1; save(); home(); };
  $('#btnInfo').onclick = info;
  window.scrollTo(0, 0);
}
function unitView(u){
  var now = Date.now(), s = lessonStats(u.items, now);
  root.innerHTML =
    '<header class="top"><button class="iconbtn" id="back" aria-label="Zurück">‹</button><h1>' + u.icon + ' ' + esc(u.title) + '</h1></header>' +
    '<div class="sheet intro"><h2>Neu in dieser Unit</h2>' + u.intro.map(function(t){ return '<p>' + md(t) + '</p>'; }).join('') + '</div>' +
    '<div class="lessons">' + u.lessons.map(function(items, j){ var ls = lessonStats(items, now);
      return '<button class="lesson" data-j="' + j + '"><span class="ic">' + (ls.learned === items.length ? '✅' : (j + 1)) + '</span><span class="tt"><b>Lektion ' + (j + 1) + '</b><small class="zh">' + esc(items.map(function(c){ return CMP.onlyHan(c.h) || c.h; }).join(' · ')) + '</small><span class="bar"><i style="width:' + Math.round(100 * ls.learned / items.length) + '%"></i></span></span><span>›</span></button>'; }).join('') + '</div>' +
    '<div style="height:12px"></div><button class="secondary" id="all">Ganze Unit am Stück üben (' + u.items.length + ')</button>' +
    '<p class="note">' + s.learned + ' von ' + u.items.length + ' gelernt · ' + s.known + ' sicher' + (s.due ? ' · ' + s.due + ' fällig' : '') + '. In jede Lektion mischen sich ein paar Wörter aus früheren Units zur Wiederholung.</p>';
  $('#back').onclick = home;
  root.querySelectorAll('.lesson').forEach(function(b){ b.onclick = function(){ startLesson(u, +b.getAttribute('data-j')); }; });
  $('#all').onclick = function(){ session = { title: u.title, queue: u.items.slice(), i: 0, good: 0, again: 0, back: u }; card(); };
  window.scrollTo(0, 0);
}
function earlierReview(u, n){
  var pool = ALL.filter(function(c){ var s = st(c); return s && s.box >= 1 && unitById(c.unit).index < u.index; });
  pool.sort(function(a, b){ return st(a).due - st(b).due; });
  return shuffle(pool.slice(0, Math.max(n * 3, 6))).slice(0, n);
}
function startLesson(u, j){
  var items = u.lessons[j].slice(), rev = earlierReview(u, 3);
  rev.forEach(function(c, k){ items.splice(Math.min(items.length, 3 + k * 3), 0, c); });
  session = { title: u.title + ' · Lektion ' + (j + 1), queue: items, i: 0, good: 0, again: 0, back: u, review: rev.map(function(c){ return c.h; }) };
  if (!S.seenIntro) S.seenIntro = {};
  card();
}
function startReview(){
  var now = Date.now(), q = ALL.filter(function(c){ return isDue(c, now); }).sort(function(a, b){ return st(a).due - st(b).due; }).slice(0, 40);
  session = { title: 'Wiederholung', queue: q, i: 0, good: 0, again: 0 }; card();
}
// Automatische Aussprache-Hinweise aus dem Pinyin
var TONE_WORD = ['neutral', 'hoch', 'steigend', 'tief', 'fallend'];
function autoTip(c){
  var sy = cardSyls(c), hints = [], seen = {};
  function add(k, t){ if (!seen[k] && hints.length < 2){ seen[k] = 1; hints.push(t); } }
  sy.forEach(function(s){
    var b = s.py.normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').toLowerCase();
    if (/^(zh|ch|sh|r)i$/.test(b)) add('retroi', '„' + b + '“: Das „i“ wird nicht gesprochen – Zunge nach hinten gebogen, es klingt wie ein summendes „r“.');
    else if (/^[zcs]i$/.test(b)) add('flati', '„' + b + '“: Das „i“ klingt wie ein gesummtes „s“, kein deutsches „i“.');
    if (/^zh/.test(b)) add('zh', '„zh“ = „dsch“ mit nach hinten gebogener Zunge.');
    else if (/^ch/.test(b)) add('ch', '„ch“ = „tsch“ mit nach hinten gebogener Zunge und Luftstoß.');
    else if (/^sh/.test(b)) add('sh', '„sh“ = „sch“ mit nach hinten gebogener Zunge.');
    else if (/^x/.test(b)) add('x', '„x“ = weiches „ch“ wie in „ich“, nicht „ks“.');
    else if (/^q/.test(b)) add('q', '„q“ = „tch“ mit breit gezogenen Lippen, mit Luftstoß.');
    else if (/^j/.test(b)) add('j', '„j“ = weiches „dj“ mit lächelnden Lippen – kein deutsches „j“.');
    else if (/^r/.test(b)) add('r', '„r“ klingt wie ein summendes „j“ in „Journal“, Zunge nach hinten.');
    else if (/^z/.test(b)) add('z', '„z“ = „ds“ (stimmlos, ohne Luftstoß), nicht wie deutsches „z“.');
    else if (/^c/.test(b)) add('c', '„c“ = „ts“ wie in „Zahn“, mit Luftstoß.');
    if (/^[jqxy]u/.test(b) || /ü/.test(b)) add('ue', '„' + b + '“: Das „u“ nach j, q, x, y wird „ü“ gesprochen.');
    if (/^[^aeiou]*e(ng|n)?$/.test(b) && !/ei|ie|ue|er/.test(b) && /e$/.test(b)) add('e', '„e“ in „' + b + '“ ist ein dunkler Laut zwischen „ö“ und „ä“, ohne Lippenrundung.');
    if (/ian$/.test(b)) add('ian', '„ian“ klingt wie „jän“, nicht „jan“.');
    if (/ui$/.test(b)) add('ui', '„ui“ wird „uej“ gesprochen.');
    if (/iu$/.test(b)) add('iu', '„iu“ wird „jou“ gesprochen.');
    if (/^h/.test(b)) add('h', '„h“ ist kratzig wie das „ch“ in „Bach“.');
  });
  for (var i = 0; i + 1 < sy.length; i++) if (sy[i].tone === 3 && sy[i+1].tone === 3){ add('33', 'Zwei 3. Töne hintereinander: Der erste wird steigend (wie ein 2. Ton) gesprochen.'); break; }
  var pat = sy.length ? 'Tonfolge: ' + sy.map(function(s){ return s.py + ' ' + TONE_WORD[s.tone]; }).join(' · ') : '';
  return { hints: hints, pattern: pat };
}
function card(){
  if (!session) return home();
  if (session.i >= session.queue.length) return finished();
  var c = session.queue[session.i], s = st(c), hide = S.settings.hideMeaning && s;
  var nh = CMP.onlyHan(c.h).length, lng = nh > 5 ? ' long' : '', xl = nh > 8 ? ' xlong' : '';
  var isRev = session.review && session.review.indexOf(c.h) >= 0 && session.queue.indexOf(c) === session.i;
  var tag = isRev ? '<div class="tag">🔁 Wiederholung aus Unit ' + unitById(c.unit).index + '</div>' : !s ? '<div class="tag new">✨ neu</div>' : '';
  root.innerHTML =
    '<div class="study-head"><button class="iconbtn" id="back" aria-label="Zurück">‹</button><div class="prog"><div style="font-size:13px;color:var(--mut)">' + esc(session.title) + '</div><div class="bar"><i style="width:' + Math.round(100 * session.i / session.queue.length) + '%"></i></div></div><div class="count">' + (session.i + 1) + ' / ' + session.queue.length + '</div></div>' +
    '<div class="card">' + tag + '<div class="hanzi' + lng + xl + '">' + esc(c.h) + '</div>' +
    (nh > 1 ? '<div class="syls">' + sylsHTML(c) + '</div>' : '') +
    '<div class="pinyin">' + esc(c.p) + '</div>' +
    '<div class="meaning' + (hide ? ' hidden' : '') + '" id="meaning">' + esc(c.de) + '</div>' +
    tipHTML(c) +
    '<div class="actions"><button class="act" id="play">🔊 Anhören</button><button class="act" id="slow">🐢 Langsam</button>' +
    '<button class="act mic" id="mic">🎙️ Aussprache prüfen</button></div>' +
    '<div id="out"></div>' +
    '<div class="grade"><button class="again" id="again">Nochmal üben</button><button class="good" id="good">Kann ich ✓</button></div>' +
    '</div>' +
    '<div class="nav"><button id="prev"' + (session.i ? '' : ' style="visibility:hidden"') + '>‹ Zurück</button><button id="skip">Überspringen ›</button></div>';
  var out = $('#out'), mic = $('#mic');
  $('#back').onclick = function(){ if (rec && listening) try { rec.abort(); } catch(e){} if (session.back) unitView(session.back); else home(); };
  $('#play').onclick = function(){ speak(c.h, false); };
  $('#slow').onclick = function(){ speak(c.h, true); };
  $('#meaning').onclick = function(){ this.classList.remove('hidden'); };
  var ui = {
    listening: function(on){ mic.classList.toggle('listening', on); mic.innerHTML = on ? '⏹ Ich höre zu … (tippen zum Beenden)' : '🎙️ Aussprache prüfen'; if (on) out.innerHTML = '<div class="msg info">Sprich jetzt: <b>' + esc(c.h) + '</b></div>'; },
    interim: function(t){ out.innerHTML = '<div class="msg info">Verstanden: <span style="font-size:18px">' + esc(t) + '</span> …</div>'; },
    error: function(html){ out.innerHTML = '<div class="msg">' + html + '</div>'; },
    result: function(r){ out.innerHTML = resultHTML(r, c); var ss = S.cards[c.h] || (S.cards[c.h] = { box: 0, due: Date.now(), reps: 0 }); ss.lastScore = r.score; ss.best = Math.max(ss.best || 0, r.score); markActive(); save();
      if (r.score >= 80) toast('Gut verstanden – tippe „Kann ich ✓“, wenn du dir sicher bist.'); }
  };
  mic.onclick = function(){ startCheck(c, ui); };
  $('#again').onclick = function(){ grade(c, false); session.again++; session.queue.push(c); session.i++; card(); };
  $('#good').onclick = function(){ grade(c, true); session.good++; session.i++; card(); };
  $('#skip').onclick = function(){ session.i++; card(); };
  $('#prev').onclick = function(){ session.i = Math.max(0, session.i - 1); card(); };
  if (!s || !S.settings.hideMeaning) {} // nichts
  window.scrollTo(0, 0);
}
function tipHTML(c){
  var a = autoTip(c), h = c.tip ? [esc(c.tip)] : a.hints.map(esc);
  return '<div class="tip"><b>Aussprache-Tipp</b>' + (h.length ? h.join('<br>') : 'Achte auf die Töne – hör dir das Original an und sprich nach.') + (a.pattern ? '<div class="pat">' + esc(a.pattern) + '</div>' : '') + '</div>';
}
function finished(){
  var g = session.good, a = session.again;
  root.innerHTML = '<div class="done"><div class="big">🎉</div><h2>Geschafft!</h2><p>' + esc(session.title) + ': ' + g + '× „Kann ich“, ' + a + '× „Nochmal“.</p><p class="note">Die Karten kommen nach dem Wiederholungsplan zurück (1, 2, 4, 8 … Tage).</p><button class="primary" id="h">Zur Übersicht</button></div>';
  $('#h').onclick = home;
}
function info(){
  var sel = '<option value="">Automatisch (zh-CN)</option>' + voices.map(function(v){ return '<option value="' + esc(v.voiceURI) + '"' + (S.settings.voice === v.voiceURI ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>'; }).join('');
  root.innerHTML =
    '<header class="top"><button class="iconbtn" id="back">‹</button><h1>Einstellungen & Hilfe</h1></header>' +
    '<div class="sheet"><h2>Aussprache</h2>' +
    '<div class="row"><span>Stimme</span><select id="voice">' + sel + '</select></div>' +
    '<div class="row"><span>Tempo normal</span><input type="range" id="rate" min="0.5" max="1.1" step="0.05" value="' + S.settings.rate + '"></div>' +
    '<div class="row"><span>Tempo langsam</span><input type="range" id="slowRate" min="0.3" max="0.8" step="0.05" value="' + S.settings.slowRate + '"></div>' +
    '<div class="row"><span>Test</span><button class="act" id="test" style="padding:8px 12px">🔊 你好</button></div>' +
    '<div class="row"><span>Alle Units freischalten</span><label class="switch"><input type="checkbox" id="unlock"' + (S.settings.unlockAll ? ' checked' : '') + '><span></span></label></div>' +
    '<div class="row"><span>Bedeutung bei Wiederholung verdecken</span><label class="switch"><input type="checkbox" id="hide"' + (S.settings.hideMeaning ? ' checked' : '') + '><span></span></label></div></div>' +
    '<div class="sheet"><h2>Die vier Töne</h2><p><span class="tone1"><b>1. Ton ā</b></span> hoch und gerade – wie gesungen.<br><span class="tone2"><b>2. Ton á</b></span> steigend – wie eine erstaunte Frage „Hä?“.<br><span class="tone3"><b>3. Ton ǎ</b></span> tief absinken (und leicht wieder hoch).<br><span class="tone4"><b>4. Ton à</b></span> scharf fallend – wie ein energisches „Nein!“.<br><span class="tone0"><b>neutral a</b></span> kurz und leicht.</p><p>Die Farben der Silben zeigen überall den Ton an.</p></div>' +
    '<div class="sheet"><h2>Wie funktioniert die Aussprache-Prüfung?</h2><p>Dein iPhone (Apples Diktierdienst) wandelt das Gesprochene in chinesische Zeichen um. Die App vergleicht diese Silbe für Silbe (inklusive Ton laut Wörterbuch) mit dem Zielsatz.</p><p><b>Ehrlich gesagt:</b> Das ist nur eine Annäherung. Die Erkennung „rät“ aus dem Zusammenhang und verzeiht deshalb oft Tonfehler. Wenn ein Muttersprachler-System dich versteht, bist du auf einem guten Weg – für saubere Töne hilft trotzdem: anhören, nachsprechen, vergleichen.</p>' +
    '<p>Spracherkennung: ' + (SR ? '✅ verfügbar' : '❌ nicht verfügbar') + ' · Sichere Verbindung: ' + (window.isSecureContext ? '✅' : '❌') + ' · Chinesische Stimmen: ' + voices.length + '</p></div>' +
    '<div class="sheet"><h2>Fortschritt</h2><p>Gespeichert nur auf diesem Gerät. Kurs: ' + UNITS.length + ' Units, ' + ALL.length + ' Einträge.</p><button class="secondary" id="reset">Fortschritt zurücksetzen</button></div>';
  $('#back').onclick = home;
  $('#voice').onchange = function(){ S.settings.voice = this.value; save(); };
  $('#rate').onchange = function(){ S.settings.rate = +this.value; save(); };
  $('#slowRate').onchange = function(){ S.settings.slowRate = +this.value; save(); };
  $('#hide').onchange = function(){ S.settings.hideMeaning = this.checked; save(); };
  $('#unlock').onchange = function(){ S.settings.unlockAll = this.checked; save(); };
  $('#test').onclick = function(){ speak('你好', false); };
  $('#reset').onclick = function(){ if (confirm('Wirklich den gesamten Lernfortschritt löschen?')){ S.cards = {}; S.days = []; save(); toast('Fortschritt gelöscht.'); home(); } };
}
home();
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && window.SW_ENABLED) navigator.serviceWorker.register('sw.js').catch(function(){});
window.__app = { compare: CMP.compare, grade: grade, state: function(){ return S; } };
})();
