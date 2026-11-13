/* شاشات سمرة. المنطق كله في engine.js، هنا العرض والأزرار والحفظ. */
(function () {
  'use strict';
  var E = window.SamraEngine;
  var CARDS = window.SAMRA_CARDS;
  var CATS = window.SAMRA_CATEGORIES;
  var byId = {}; CARDS.forEach(function (c) { byId[c.id] = c; });
  var catById = {}; CATS.forEach(function (c) { catById[c.id] = c; });

  var app = document.getElementById('app');
  var KEY = 'samra.game.v1', SEEN = 'samra.seen.v1', SETUP = 'samra.setup.v1';
  var DEFAULT_NAMES = ['الدلة', 'المبخرة', 'الفنجال', 'النخلة'];
  var AR = '٠١٢٣٤٥٦٧٨٩';

  function num(n) { return String(n).replace(/\d/g, function (d) { return AR[d]; }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* التخزين مقفل: نكمل بدونه */ } }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }

  var state = load(KEY, null);
  if (state && (!state.deck || state.v !== 1)) state = null;
  var lastRevealed = 0;

  function setState(s) {
    var prev = state;
    state = s;
    if (s) save(KEY, s); else drop(KEY);
    // نسجل البطاقات اللي انلعبت عشان ما تتكرر بالسهرات الجاية
    if (s && s.history.length && (!prev || prev.history.length !== s.history.length)) {
      var seen = load(SEEN, []);
      var id = s.history[s.history.length - 1].card;
      if (seen.indexOf(id) === -1) { seen.push(id); if (seen.length >= CARDS.length) seen = [id]; save(SEEN, seen); }
    }
    render();
  }

  /* رمز السدو بخمس طبقات: الطبقات تنور حسب التلميحات المكشوفة */
  function layers(on, cls) {
    var rs = [46, 37, 28, 19, 10], fills = ['#A8473B', '#120F0E', '#C9934A', '#120F0E', '#E9E1D3'];
    var p = rs.map(function (r, i) {
      var lit = i < on;
      var f = lit ? fills[i] : (i % 2 ? '#120F0E' : '#3A322D');
      return '<path d="M50 ' + (50 - r) + 'L' + (50 + r) + ' 50L50 ' + (50 + r) + 'L' + (50 - r) + ' 50Z" fill="' + f + '"/>';
    }).join('');
    return '<svg class="layers ' + (cls || '') + '" viewBox="0 0 100 100" aria-hidden="true">' + p + '</svg>';
  }

  function strip(s, active) {
    return '<button class="strip" type="button" data-act="scores" aria-label="النقاط، اضغط للتعديل">' +
      s.teams.map(function (t, i) {
        return '<span class="s' + (i === active ? ' on' : '') + '" style="--c:' + t.color + '"><span class="nm">' + esc(t.name) + '</span><span class="sc">' + num(t.score) + '</span></span>';
      }).join('') + '</button>';
  }

  /* ---------- الشاشات ---------- */
  var view = state ? 'play' : 'home';
  var setup = load(SETUP, { count: 2, names: DEFAULT_NAMES.slice(), length: 'medium', style: 'turns', cats: CATS.map(function (c) { return c.id; }) });

  function render() {
    if (view === 'home') return renderHome();
    if (view === 'how') return renderHow();
    if (view === 'setup') return renderSetup();
    if (!state) { view = 'home'; return renderHome(); }
    if (state.phase === 'over') return renderOver();
    if (state.phase === 'answer') return renderAnswer();
    return renderClue();
  }

  function renderHome() {
    app.className = 'home';
    var resume = state && state.phase !== 'over';
    app.innerHTML =
      '<img class="logo" src="' + (window.SAMRA_LOGO || 'assets/img/lockup-stacked-light.svg') + '" alt="سمرة">' +
      '<p class="tag">لعبة الجمعات. جوال واحد يدور بالمجلس، وتلميحات تنكشف وحدة ورا الثانية.</p>' +
      '<div class="stack">' +
      (resume ? '<button class="btn big" type="button" data-act="resume">كمّل السهرة</button>' : '') +
      '<button class="btn ' + (resume ? 'ghost' : 'big') + '" type="button" data-act="new">سهرة جديدة</button>' +
      '<button class="btn link" type="button" data-act="how">كيف نلعب؟</button>' +
      '</div>';
  }

  function renderHow() {
    app.className = 'how';
    app.innerHTML =
      '<div class="top"><span>كيف نلعب؟</span></div>' +
      '<h2>مسيرة</h2>' +
      '<ol>' +
      '<li>قسّموا أنفسكم فرق، من فريقين إلى ٤.</li>' +
      '<li>اللي ماسك الجوال هو المضيف. يقرا التلميحة بصوت عالي.</li>' +
      '<li>الدور على فريق واحد كل مرة. يجاوب مرة وحدة بس.</li>' +
      '<li>صح؟ ياخذ النقاط. غلط؟ الدور ينتقل وتنكشف تلميحة جديدة.</li>' +
      '<li>أول تلميحة بـ ٥ نقاط، وكل تلميحة زيادة تنقص نقطة.</li>' +
      '<li>آخر ٣ بطاقات نقاطها مضاعفة، ولو تعادلتوا فيه جولة فاصلة.</li>' +
      '</ol>' +
      '<p class="muted small">تبون أسرع؟ اختاروا «سرعة» من الإعداد: أي فريق يصارخ أول ياخذها.</p>' +
      '<div class="spacer"></div>' +
      '<button class="btn" type="button" data-act="home">رجوع</button>';
  }

  function renderSetup(err) {
    app.className = 'setup';
    var names = setup.names;
    var teamInputs = '';
    for (var i = 0; i < setup.count; i++) {
      teamInputs += '<label class="team-input"><span class="dot" style="background:' + E.TEAM_COLORS[i] + '"></span>' +
        '<input type="text" id="team-' + i + '" maxlength="16" value="' + esc(names[i] || '') + '" aria-label="اسم الفريق ' + num(i + 1) + '"></label>';
    }
    function chip(group, val, label, on) {
      return '<button class="chip" type="button" data-group="' + group + '" data-val="' + val + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + label + '</button>';
    }
    var count = 0;
    var pool = CARDS.filter(function (c) { return setup.cats.indexOf(c.cat) !== -1; }).length;
    app.innerHTML =
      '<div class="top"><span>سهرة جديدة</span><button class="end" type="button" data-act="home">رجوع</button></div>' +
      '<div class="field"><span class="label">كم فريق؟</span><div class="chips">' +
        [2, 3, 4].map(function (n) { return chip('count', n, num(n) + ' فرق', setup.count === n); }).join('') + '</div></div>' +
      '<div class="field"><span class="label">أسماء الفرق</span><div class="stack">' + teamInputs + '</div></div>' +
      '<div class="field"><span class="label">طول السهرة</span><div class="chips">' +
        chip('length', 'short', 'قصيرة · ' + num(E.LENGTHS.short), setup.length === 'short') +
        chip('length', 'medium', 'متوسطة · ' + num(E.LENGTHS.medium), setup.length === 'medium') +
        chip('length', 'long', 'طويلة · ' + num(E.LENGTHS.long), setup.length === 'long') + '</div></div>' +
      '<div class="field"><span class="label">أسلوب التخمين</span><div class="chips">' +
        chip('style', 'turns', 'بالدور', setup.style === 'turns') +
        chip('style', 'speed', 'سرعة', setup.style === 'speed') + '</div>' +
        '<span class="hint">' + (setup.style === 'turns' ? 'كل تلميحة لها فريق واحد يجاوب مرة وحدة.' : 'أي فريق يصارخ بالجواب أول ياخذها.') + '</span></div>' +
      '<div class="field"><span class="label">الفئات</span><div class="chips">' +
        CATS.map(function (c) { return chip('cat', c.id, c.name, setup.cats.indexOf(c.id) !== -1); }).join('') + '</div>' +
        '<span class="hint">' + num(pool) + ' بطاقة بالفئات المختارة</span></div>' +
      (err ? '<p class="error" role="alert">' + esc(err) + '</p>' : '') +
      '<div class="spacer"></div>' +
      '<button class="btn big" type="button" data-act="start">يلا نبدأ</button>';
    void count;
  }

  function renderClue() {
    app.className = 'play';
    var s = state, card = byId[E.currentCardId(s)], cat = catById[card.cat];
    var tb = s.phase === 'tiebreak';
    var prog = E.progress(s), golden = !tb && E.isGolden(s);
    var pts = E.cluePoints(s.revealed) * (golden ? 2 : 1);
    var clues = '';
    for (var i = 0; i < E.MAX_CLUES; i++) {
      if (i < s.revealed) clues += '<li class="clue' + (i >= lastRevealed ? ' new' : '') + '"><span class="n">' + num(i + 1) + '</span><span>' + esc(card.clues[i]) + '</span></li>';
      else clues += '<li class="clue locked"><span class="n">' + num(i + 1) + '</span><span>تلميحة مخفية</span></li>';
    }
    lastRevealed = s.revealed;
    var t = s.teams[s.turn];
    var controls;
    if (s.style === 'turns' || tb) {
      var lastRound = s.revealed >= E.MAX_CLUES;
      controls =
        '<div class="turn" style="--c:' + t.color + '"><span class="dot" style="background:' + t.color + '"></span>الدور على: ' + esc(t.name) + '</div>' +
        '<div class="row"><button class="btn ok big" type="button" data-act="correct" data-team="' + s.turn + '">صح ✓</button>' +
        '<button class="btn no big" type="button" data-act="wrong">غلط ✗</button></div>' +
        '<p class="hint">' + (lastRound ? 'آخر تلميحة: كل فريق ياخذ فرصة وحدة.' : 'غلط؟ الدور ينتقل للفريق الجاي وتنكشف تلميحة.') + '</p>';
    } else {
      controls =
        '<span class="label">مين جاوب صح؟</span>' +
        '<div class="team-btns">' + s.teams.map(function (tm, i) {
          return '<button class="btn team-btn" style="--c:' + tm.color + '" type="button" data-act="correct" data-team="' + i + '">' + esc(tm.name) + '</button>';
        }).join('') + '</div>' +
        '<button class="btn quiet" type="button" data-act="reveal"' + (s.revealed >= E.MAX_CLUES ? ' disabled' : '') + '>تلميحة جديدة</button>';
    }
    app.innerHTML =
      '<div class="top"><span>' + (tb ? '<span class="badge red">جولة فاصلة</span>' : 'بطاقة ' + num(prog.card) + ' من ' + num(prog.total)) +
        (golden ? ' <span class="badge gold">نقاط مضاعفة</span>' : '') + '</span>' +
        '<button class="end" type="button" data-act="end">إنهاء</button></div>' +
      '<div class="q-head">' + layers(s.revealed) + '<div><span class="badge">' + esc(cat.name) + '</span><h2 class="q-title">' + esc(cat.q) + '</h2>' +
        (tb ? '<p class="pts">أول فريق يعرفها يفوز بالسهرة</p>' : '<p class="pts">الحين على <b>' + num(pts) + '</b> نقاط</p>') + '</div></div>' +
      '<ol class="clues">' + clues + '</ol>' +
      '<div class="stack">' + controls + '</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn link" type="button" data-act="giveup">محد عرفها، ورني الجواب</button>' +
      strip(s, s.style === 'turns' || tb ? s.turn : -1);
  }

  function renderAnswer() {
    app.className = 'play';
    var s = state, card = byId[s.history[s.history.length - 1].card], r = s.result;
    lastRevealed = 0;
    var line;
    if (r.team == null) line = '<p class="result muted">محد عرفها</p>';
    else if (s.tiebreak) line = '<p class="result">' + esc(s.teams[r.team].name) + ' عرفها</p>';
    else line = '<p class="result"><span class="plus">+' + num(r.points) + '</span> لـ ' + esc(s.teams[r.team].name) + (r.golden ? ' <span class="badge gold">مضاعفة</span>' : '') + '</p>';
    var last = !s.tiebreak && s.index >= s.deck.length - 1;
    app.innerHTML =
      '<div class="top"><span>' + (s.tiebreak ? 'جولة فاصلة' : 'بطاقة ' + num(s.index + 1) + ' من ' + num(s.deck.length)) + '</span><button class="end" type="button" data-act="end">إنهاء</button></div>' +
      '<div class="reveal">' + layers(5) + '<span class="badge">' + esc(catById[card.cat].name) + '</span><div class="ans">' + esc(card.answer) + '</div>' + line + '</div>' +
      '<ol class="clues">' + card.clues.map(function (c, i) {
        return '<li class="clue' + (i >= r.revealed ? ' locked' : '') + '"><span class="n">' + num(i + 1) + '</span><span>' + esc(c) + '</span></li>';
      }).join('') + '</ol>' +
      '<div class="spacer"></div>' +
      '<button class="btn big" type="button" data-act="next">' + (s.tiebreak ? 'بطاقة فاصلة ثانية' : last ? 'النتيجة' : 'البطاقة الجاية') + '</button>' +
      strip(s, r.team == null ? -1 : r.team);
  }

  function renderOver() {
    app.className = 'over';
    var s = state, win = E.winners(s);
    var order = s.teams.map(function (t, i) { return { t: t, i: i }; }).sort(function (a, b) {
      var aw = win.indexOf(a.i) !== -1, bw = win.indexOf(b.i) !== -1;
      if (aw !== bw) return aw ? -1 : 1;
      return b.t.score - a.t.score;
    });
    var title = win.length === 1 ? 'مبروك ' + esc(s.teams[win[0]].name) + '!' : 'تعادل!';
    var known = s.history.filter(function (h) { return h.team != null && !h.tiebreak; });
    var quick = known.filter(function (h) { return h.revealed === 1; }).length;
    app.innerHTML =
      '<div class="reveal">' + layers(5) + '<div class="crown">' + title + '</div>' +
      (s.tiebreak && s.tiebreak.winner != null ? '<p class="muted">حسموها بالجولة الفاصلة</p>' : '') + '</div>' +
      '<ol class="podium">' + order.map(function (o, k) {
        return '<li class="' + (win.indexOf(o.i) !== -1 ? 'win' : '') + '" style="--c:' + o.t.color + '"><span class="rk">' + num(k + 1) + '</span><span class="nm">' + esc(o.t.name) + '</span><span class="sc">' + num(o.t.score) + '</span></li>';
      }).join('') + '</ol>' +
      '<p class="muted small" style="text-align:center">عرفتوا ' + num(known.length) + ' من ' + num(s.deck.length) + ' بطاقة' + (quick ? '، و' + num(quick) + ' منها من أول تلميحة' : '') + '</p>' +
      '<div class="spacer"></div>' +
      '<div class="stack"><button class="btn big" type="button" data-act="again">سهرة ثانية بنفس الفرق</button>' +
      '<button class="btn ghost" type="button" data-act="home-clear">الرئيسية</button></div>';
  }

  /* ---------- التحكم ---------- */
  function readNames() {
    for (var i = 0; i < setup.count; i++) {
      var el = document.getElementById('team-' + i);
      if (el) setup.names[i] = el.value;
    }
  }

  function startGame(prevTeams) {
    var names = prevTeams || setup.names.slice(0, setup.count).map(function (n, i) { return (n || '').trim() || DEFAULT_NAMES[i]; });
    try {
      var g = E.newGame({ teams: names, cards: CARDS, length: setup.length, style: setup.style, categories: setup.cats, seen: load(SEEN, []) });
      lastRevealed = 0;
      view = 'play';
      setState(g);
    } catch (e) { view = 'setup'; renderSetup(e.message); }
  }

  function spareIds() {
    var inPlay = state.deck;
    return E.shuffle(CARDS.filter(function (c) { return inPlay.indexOf(c.id) === -1; }).map(function (c) { return c.id; }), Math.random);
  }

  app.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var act = b.getAttribute('data-act'), group = b.getAttribute('data-group');
    if (group) {
      readNames();
      var v = b.getAttribute('data-val');
      if (group === 'count') setup.count = +v;
      if (group === 'length') setup.length = v;
      if (group === 'style') setup.style = v;
      if (group === 'cat') {
        var k = setup.cats.indexOf(v);
        if (k === -1) setup.cats.push(v); else if (setup.cats.length > 1) setup.cats.splice(k, 1);
      }
      save(SETUP, setup);
      return renderSetup();
    }
    switch (act) {
      case 'new': view = 'setup'; return renderSetup();
      case 'resume': view = 'play'; return render();
      case 'how': view = 'how'; return render();
      case 'home': view = 'home'; return render();
      case 'start': readNames(); save(SETUP, setup); return startGame();
      case 'correct': buzz(30); return setState(E.correct(state, +b.getAttribute('data-team')));
      case 'wrong': buzz(12); return setState(E.wrong(state));
      case 'reveal': return setState(E.revealNext(state));
      case 'giveup': return setState(E.giveUp(state));
      case 'next': return setState(E.nextCard(state, spareIds()));
      case 'scores': return openScores();
      case 'end': return document.getElementById('confirm').showModal();
      case 'again': return startGame(state.teams.map(function (t) { return t.name; }));
      case 'home-clear': view = 'home'; return setState(null);
    }
  });

  /* نافذة تعديل النقاط */
  var scoresDlg = document.getElementById('scores');
  function openScores() {
    fillScores();
    scoresDlg.showModal();
  }
  function fillScores() {
    document.getElementById('scores-list').innerHTML = state.teams.map(function (t, i) {
      return '<li style="--c:' + t.color + '"><span class="nm">' + esc(t.name) + '</span>' +
        '<button class="btn quiet" type="button" data-adj="-1" data-team="' + i + '" aria-label="نقص نقطة من ' + esc(t.name) + '">−</button>' +
        '<span class="sc">' + num(t.score) + '</span>' +
        '<button class="btn quiet" type="button" data-adj="1" data-team="' + i + '" aria-label="زد نقطة لـ ' + esc(t.name) + '">+</button></li>';
    }).join('');
  }
  scoresDlg.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-adj')) { setState(E.adjust(state, +b.getAttribute('data-team'), +b.getAttribute('data-adj'))); fillScores(); }
  });
  document.querySelectorAll('dialog [data-close]').forEach(function (b) {
    b.addEventListener('click', function () { b.closest('dialog').close(); });
  });
  document.getElementById('confirm-yes').addEventListener('click', function () {
    document.getElementById('confirm').close();
    view = 'home'; setState(null);
  });

  render();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }
})();
