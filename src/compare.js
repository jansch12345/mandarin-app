// Vergleich: erkannter Text vs. Zielsatz. Benötigt pinyinPro (global) oder übergebenes Modul.
(function(root){
  var DIG = {'0':'零','1':'一','2':'二','3':'三','4':'四','5':'五','6':'六','7':'七','8':'八','9':'九'};
  function numToHan(s){
    // einfache Umwandlung: 10 -> 十, 100 -> 一百, sonst ziffernweise
    return s.replace(/\d+/g, function(m){
      var n = parseInt(m,10);
      if (n === 10) return '十';
      if (n > 10 && n < 20) return '十' + DIG[String(n%10)];
      if (n >= 20 && n < 100) return DIG[String(Math.floor(n/10))] + '十' + (n%10 ? DIG[String(n%10)] : '');
      if (n === 100) return '一百';
      if (n > 100 && n < 1000 && n % 100 === 0) return DIG[String(n/100)] + '百';
      return m.split('').map(function(d){return DIG[d];}).join('');
    });
  }
  function onlyHan(s){
    s = numToHan(String(s||''));
    var m = s.match(/[\u3400-\u9fff]/g);
    return m ? m.join('') : '';
  }
  function syl(py, s){
    if (!s) return [];
    var arr = py.pinyin(s, {toneType:'num', type:'array', toneSandhi:false});
    return arr.map(function(x, i){
      var mm = /^([a-zü:v]+?)([0-5])?$/i.exec(x) || [null, x, '0'];
      return { han: s[i], base: mm[1].replace('v','ü').toLowerCase(), tone: mm[2] ? +mm[2] : 0 };
    });
  }
  // Längste gemeinsame Teilfolge auf Silbenbasis (ohne Ton)
  function lcs(a, b){
    var n=a.length, m=b.length, dp=[], i, j;
    for (i=0;i<=n;i++){ dp.push(new Array(m+1).fill(0)); }
    for (i=n-1;i>=0;i--) for (j=m-1;j>=0;j--)
      dp[i][j] = a[i].base===b[j].base ? dp[i+1][j+1]+1 : Math.max(dp[i+1][j], dp[i][j+1]);
    var pairs = {}; i=0; j=0;
    while (i<n && j<m){
      if (a[i].base===b[j].base){ pairs[i]=j; i++; j++; }
      else if (dp[i+1][j] >= dp[i][j+1]) i++; else j++;
    }
    return pairs;
  }
  function compare(target, heardRaw, py){
    py = py || root.pinyinPro;
    var t = onlyHan(target), h = onlyHan(heardRaw);
    var ts = syl(py, t), hs = syl(py, h);
    var pairs = lcs(ts, hs);
    var details = ts.map(function(s, i){
      var j = pairs[i];
      if (j === undefined) return { han:s.han, base:s.base, tone:s.tone, status:'miss' };
      var o = hs[j];
      var toneOk = s.tone===o.tone || s.tone===0 || o.tone===0 || s.tone===5 || o.tone===5;
      return { han:s.han, base:s.base, tone:s.tone, heardHan:o.han, heardTone:o.tone,
               status: toneOk ? (o.han===s.han ? 'ok' : 'homophone') : 'tone' };
    });
    var n = ts.length || 1, pts = 0;
    details.forEach(function(d){ pts += d.status==='ok'||d.status==='homophone' ? 1 : d.status==='tone' ? 0.5 : 0; });
    var extra = Math.max(0, hs.length - Object.keys(pairs).length);
    var score = Math.round(100 * pts / n - Math.min(20, extra * 5));
    if (t && h === t) score = 100;
    score = Math.max(0, Math.min(100, score));
    return { score: score, target: t, heard: h, heardRaw: String(heardRaw||''), details: details, extra: extra };
  }
  root.MandarinCompare = { compare: compare, onlyHan: onlyHan, numToHan: numToHan };
  if (typeof module !== 'undefined') module.exports = root.MandarinCompare;
})(typeof window !== 'undefined' ? window : globalThis);
