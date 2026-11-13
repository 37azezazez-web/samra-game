/* محرك سمرة: منطق السهرة والنقاط، بدون أي شاشات.
   يشتغل بالمتصفح (window.SamraEngine) وبـ Node للاختبارات (module.exports). */
(function (root) {
  'use strict';

  var MAX_CLUES = 5;
  var LENGTHS = { short: 10, medium: 20, long: 30 };
  var TEAM_COLORS = ['#C9934A', '#A8473B', '#5E9C93', '#8C7BB5'];

  // نقاط مسيرة: أول تلميحة ٥، وكل تلميحة زيادة تنقص نقطة
  function cluePoints(revealed) {
    return Math.max(1, MAX_CLUES + 1 - revealed);
  }

  function shuffle(list, rand) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* opts: { teams:[names], cards:[...], length:'short'|'medium'|'long',
             categories:[ids] (اختياري), style:'turns'|'speed', golden:true, rand:fn, seen:[ids] } */
  function newGame(opts) {
    var names = (opts.teams || []).map(function (n) { return String(n || '').trim(); });
    if (names.length < 2 || names.length > 4) throw new Error('عدد الفرق لازم يكون من ٢ إلى ٤');
    var rand = opts.rand || Math.random;
    var cats = opts.categories && opts.categories.length ? opts.categories : null;
    var pool = opts.cards.filter(function (c) { return !cats || cats.indexOf(c.cat) !== -1; });
    if (!pool.length) throw new Error('ما فيه بطاقات بالفئات المختارة');
    // البطاقات اللي ما انلعبت قبل تجي أول
    var seen = opts.seen || [];
    var fresh = shuffle(pool.filter(function (c) { return seen.indexOf(c.id) === -1; }), rand);
    var old = shuffle(pool.filter(function (c) { return seen.indexOf(c.id) !== -1; }), rand);
    var want = LENGTHS[opts.length] || LENGTHS.medium;
    var deck = fresh.concat(old).slice(0, want).map(function (c) { return c.id; });

    var state = {
      v: 1,
      style: opts.style === 'speed' ? 'speed' : 'turns',
      golden: opts.golden !== false,
      teams: names.map(function (n, i) {
        return { name: n || ('فريق ' + (i + 1)), color: TEAM_COLORS[i], score: 0 };
      }),
      deck: deck,
      index: 0,
      revealed: 1,
      starter: 0,      // الفريق اللي يبدأ البطاقة الحالية
      turn: 0,         // الفريق اللي عليه الدور الحين (بأسلوب بالدور)
      phase: 'clue',   // clue | answer | over | tiebreak
      result: null,    // نتيجة البطاقة: {team, points} أو {team:null}
      tiebreak: null,
      history: []
    };
    return state;
  }

  function clone(s) { return JSON.parse(JSON.stringify(s)); }

  function isGolden(s, i) {
    var idx = i == null ? s.index : i;
    return s.golden && s.deck.length >= 6 && idx >= s.deck.length - 3;
  }

  function currentCardId(s) {
    if (s.phase === 'tiebreak' && s.tiebreak) return s.tiebreak.card;
    return s.deck[s.index];
  }

  // تكشف التلميحة الجاية (أسلوب سرعة، أو المضيف يبي يكمل)
  function revealNext(s) {
    if (s.phase !== 'clue' && s.phase !== 'tiebreak') return s;
    var n = clone(s);
    if (n.revealed < MAX_CLUES) n.revealed++;
    return n;
  }

  function teamsInPlay(s) {
    if (s.phase === 'tiebreak' && s.tiebreak) return s.tiebreak.teams;
    return s.teams.map(function (_, i) { return i; });
  }

  // بأسلوب بالدور: الفريق اللي عليه الدور غلط، الدور ينتقل وتنكشف تلميحة جديدة
  function wrong(s) {
    if (s.phase !== 'clue' && s.phase !== 'tiebreak') return s;
    var n = clone(s);
    var play = teamsInPlay(n);
    if (n.revealed >= MAX_CLUES) {
      // آخر تلميحة: كل فريق ياخذ فرصة، ولو رجعنا للي بدأ تنكشف الإجابة
      var pos = play.indexOf(n.turn);
      var nextTeam = play[(pos + 1) % play.length];
      n.lastChance = (n.lastChance || 0) + 1;
      if (n.lastChance >= play.length) {
        return finishCard(n, null);
      }
      n.turn = nextTeam;
      return n;
    }
    var p = play.indexOf(n.turn);
    n.turn = play[(p + 1) % play.length];
    n.revealed++;
    return n;
  }

  // فريق جاوب صح. team = رقم الفريق
  function correct(s, team) {
    if (s.phase !== 'clue' && s.phase !== 'tiebreak') return s;
    var n = clone(s);
    return finishCard(n, team);
  }

  // محد عرفها: تنكشف الإجابة بدون نقاط
  function giveUp(s) {
    if (s.phase !== 'clue' && s.phase !== 'tiebreak') return s;
    return finishCard(clone(s), null);
  }

  function finishCard(n, team) {
    var tb = n.phase === 'tiebreak';
    var pts = 0;
    if (team != null && !tb) {
      pts = cluePoints(n.revealed) * (isGolden(n) ? 2 : 1);
      n.teams[team].score += pts;
    }
    n.result = { team: team, points: pts, revealed: n.revealed, golden: !tb && isGolden(n) };
    n.history.push({ card: currentCardId(n), team: team, points: pts, revealed: n.revealed, tiebreak: tb });
    delete n.lastChance;
    if (tb) {
      if (team != null) { n.tiebreak.winner = team; n.phase = 'over'; }
      else { n.phase = 'answer'; n.tiebreak.retry = true; }
      return n;
    }
    n.phase = 'answer';
    return n;
  }

  // بعد الكشف: البطاقة الجاية، أو النهاية
  function nextCard(s, extraCards) {
    if (s.phase !== 'answer') return s;
    var n = clone(s);
    n.result = null;
    n.revealed = 1;
    if (n.tiebreak) {
      // تعادل ما انحسم: بطاقة فاصلة ثانية
      return startTiebreak(n, extraCards);
    }
    if (n.index >= n.deck.length - 1) {
      var lead = leaders(n);
      if (lead.length > 1) return startTiebreak(n, extraCards);
      n.phase = 'over';
      return n;
    }
    n.index++;
    n.starter = (n.starter + 1) % n.teams.length;
    n.turn = n.starter;
    n.phase = 'clue';
    return n;
  }

  function leaders(s) {
    var top = Math.max.apply(null, s.teams.map(function (t) { return t.score; }));
    var out = [];
    s.teams.forEach(function (t, i) { if (t.score === top) out.push(i); });
    return out;
  }

  // extraCards: ids بطاقات ما انلعبت بالسهرة
  function startTiebreak(n, extraCards) {
    var used = n.history.map(function (h) { return h.card; });
    var spare = (extraCards || []).filter(function (id) { return used.indexOf(id) === -1; });
    if (!spare.length) { n.phase = 'over'; n.tiebreak = n.tiebreak || { teams: leaders(n) }; n.tiebreak.shared = true; return n; }
    var teams = n.tiebreak ? n.tiebreak.teams : leaders(n);
    n.tiebreak = { teams: teams, card: spare[0] };
    n.turn = teams[0];
    n.revealed = 1;
    n.phase = 'tiebreak';
    return n;
  }

  function winners(s) {
    if (s.phase !== 'over') return [];
    if (s.tiebreak && s.tiebreak.winner != null) return [s.tiebreak.winner];
    return leaders(s);
  }

  // تعديل يدوي من المضيف
  function adjust(s, team, delta) {
    var n = clone(s);
    n.teams[team].score = Math.max(0, n.teams[team].score + delta);
    return n;
  }

  function progress(s) {
    return { card: Math.min(s.index + 1, s.deck.length), total: s.deck.length };
  }

  var api = {
    MAX_CLUES: MAX_CLUES, LENGTHS: LENGTHS, TEAM_COLORS: TEAM_COLORS,
    cluePoints: cluePoints, newGame: newGame, revealNext: revealNext, wrong: wrong,
    correct: correct, giveUp: giveUp, nextCard: nextCard, winners: winners, leaders: leaders,
    adjust: adjust, isGolden: isGolden, currentCardId: currentCardId, progress: progress, shuffle: shuffle
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SamraEngine = api;
})(this);
