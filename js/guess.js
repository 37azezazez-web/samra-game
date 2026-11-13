/* منطق «كم تتوقع؟»: كل فريق يكتب رقم، والأقرب ياخذ النقاط. بدون شاشات، ويتختبر بـ Node. */
(function (root) {
  'use strict';
  var EXACT = 5, CLOSEST = 3;
  var LENGTHS = { short: 10, medium: 15, long: 20 };
  var COLORS = ['#C9934A', '#A8473B', '#5E9C93', '#8C7BB5'];

  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }

  // يحوّل كتابة الفريق لرقم: يقبل الأرقام العربية والفواصل، وإلا null
  function parse(v) {
    var t = String(v == null ? '' : v).trim()
      .replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); })
      .replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); })
      .replace(/[,،٬\s]/g, '');
    if (!/^\d{1,9}$/.test(t)) return null;
    return parseInt(t, 10);
  }

  /* guesses: رقم أو null لكل فريق (null = ما جاوب). only: الفرق المسموح لها (للجولة الفاصلة)
     يرجع النقاط لكل فريق: المضبوط ٥، والأقرب ٣، والتعادل بالقرب كلهم ياخذون */
  function score(guesses, answer, only) {
    var best = Infinity;
    guesses.forEach(function (g, i) {
      if (g == null || (only && only.indexOf(i) === -1)) return;
      best = Math.min(best, Math.abs(g - answer));
    });
    return guesses.map(function (g, i) {
      if (g == null || best === Infinity || (only && only.indexOf(i) === -1)) return 0;
      var d = Math.abs(g - answer);
      if (d !== best) return 0;
      return d === 0 ? EXACT : CLOSEST;
    });
  }

  function newGame(opts) {
    var names = (opts.teams || []).map(function (n) { return String(n || '').trim(); });
    if (names.length < 2 || names.length > 4) throw new Error('عدد الفرق لازم يكون من ٢ إلى ٤');
    var rand = opts.rand || Math.random, seen = opts.seen || [];
    var qs = opts.questions || [];
    if (!qs.length) throw new Error('ما فيه أسئلة');
    var fresh = shuffle(qs.filter(function (q) { return seen.indexOf(q.id) === -1; }), rand);
    var old = shuffle(qs.filter(function (q) { return seen.indexOf(q.id) !== -1; }), rand);
    var want = LENGTHS[opts.length] || LENGTHS.medium;
    return {
      v: 1, mode: 'guess',
      teams: names.map(function (n, i) { return { name: n || ('فريق ' + (i + 1)), color: COLORS[i], score: 0 }; }),
      deck: fresh.concat(old).slice(0, want).map(function (q) { return q.id; }),
      index: 0, revealed: 1, turn: 0, starter: 0,
      phase: 'ask',   // ask | show | over
      result: null, tiebreak: null, history: []
    };
  }

  function currentId(s) { return s.tiebreak && s.tiebreak.card ? s.tiebreak.card : s.deck[s.index]; }

  // المضيف كتب أرقام الفرق وضغط «ورنا الجواب»
  function submit(s, guesses, answer) {
    if (s.phase !== 'ask') return s;
    var n = clone(s);
    var g = n.teams.map(function (_, i) { return guesses[i] == null ? null : guesses[i]; });
    var tb = !!(n.tiebreak && n.tiebreak.card);
    var pts = score(g, answer, tb ? n.tiebreak.teams : null);
    if (!tb) pts.forEach(function (p, i) { n.teams[i].score += p; });
    n.result = { guesses: g, answer: answer, points: pts };
    n.history.push({ card: currentId(n), points: pts, tiebreak: tb });
    if (tb) {
      var win = [];
      pts.forEach(function (p, i) { if (p > 0) win.push(i); });
      if (win.length === 1) n.tiebreak.winner = win[0];
      else n.tiebreak.shared = true;
    }
    n.phase = 'show';
    return n;
  }

  function leaders(s) {
    var top = Math.max.apply(null, s.teams.map(function (t) { return t.score; }));
    var out = [];
    s.teams.forEach(function (t, i) { if (t.score === top) out.push(i); });
    return out;
  }

  // السؤال الجاي، أو جولة فاصلة إذا تعادلوا، أو النهاية
  function next(s, spare) {
    if (s.phase !== 'show') return s;
    var n = clone(s);
    n.result = null;
    if (n.tiebreak) { n.phase = 'over'; return n; }
    if (n.index < n.deck.length - 1) { n.index++; n.phase = 'ask'; return n; }
    var lead = leaders(n);
    var used = n.history.map(function (h) { return h.card; });
    var free = (spare || []).filter(function (id) { return used.indexOf(id) === -1; });
    if (lead.length > 1 && free.length) { n.tiebreak = { teams: lead, card: free[0] }; n.phase = 'ask'; return n; }
    if (lead.length > 1) n.tiebreak = { teams: lead, shared: true };
    n.phase = 'over';
    return n;
  }

  function winners(s) {
    if (s.phase !== 'over') return [];
    if (s.tiebreak && s.tiebreak.winner != null) return [s.tiebreak.winner];
    return leaders(s);
  }

  var api = { EXACT: EXACT, CLOSEST: CLOSEST, LENGTHS: LENGTHS, parse: parse, score: score, newGame: newGame, submit: submit, next: next, winners: winners, leaders: leaders, currentId: currentId };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SamraGuess = api;
})(this);
