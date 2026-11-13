/* شاشات سمرة. المنطق كله في engine.js، هنا العرض والأزرار والحفظ. */
(function () {
  'use strict';
  var E = window.SamraEngine;
  var CARDS = window.SAMRA_CARDS;
  var CATS = window.SAMRA_CATEGORIES;
  var SOUNDS = window.SAMRA_SOUNDS || [];
  var PROMPTS = window.SAMRA_PROMPTS || [];
  var SFX = window.SamraSfx || { play: function () { return 0; }, stop: function () { } };
  var byId = {}; CARDS.concat(SOUNDS).forEach(function (c) { byId[c.id] = c; });
  var catById = {}; CATS.concat([{ id: 'sound', name: 'اسمعها', q: 'وش هالصوت؟' }, { id: 'who', name: 'من فينا؟', q: 'مين فينا؟' }]).forEach(function (c) { catById[c.id] = c; });
  var MODES = {
    masira: { name: 'مسيرة', desc: 'تلميحات تنكشف وحدة ورا الثانية، وكل ما عرفتوها أسرع نقاطكم أكثر.' },
    sound: { name: 'اسمعها', desc: 'صوت يشتغل، وعليكم تعرفون وش هو. محتارين؟ فيه تلميحات.' },
    who: { name: 'من فينا؟', desc: 'كل واحد يكتب أسراره بالسر، والباقين يخمنون مين صاحبها.' }
  };
  var MIN_PLAYERS = 3, MAX_PLAYERS = 16, WHO_Q = 5;

  var app = document.getElementById('app');
  var KEY = 'samra.game.v1', SEEN = 'samra.seen.v1', SETUP = 'samra.setup.v2', WHO = 'samra.who.v1';
  var DEFAULT_NAMES = ['الدلة', 'المبخرة', 'الفنجال', 'النخلة'];
  var AR = '٠١٢٣٤٥٦٧٨٩';

  function num(n) { return String(n).replace(/\d/g, function (d) { return AR[d]; }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* التخزين مقفل: نكمل بدونه */ } }
  function drop(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }

  /* نتأكد إن السهرة المحفوظة سليمة قبل ما نكملها. أي شي غريب (ملف قديم، بطاقة انحذفت، تلاعب) = نبدأ من جديد بدل ما تعلق */
  function valid(s) {
    try {
      if (!s || s.v !== 1 || !Array.isArray(s.teams) || s.teams.length < 2 || s.teams.length > 4) return false;
      if (s.mode == null) s.mode = 'masira';
      if (!MODES[s.mode]) return false;
      if (s.mode === 'who' && !validPlayers(s.players, MIN_PLAYERS)) return false;
      var has = function (id) { return !!cardOf(s, id); };
      if (!Array.isArray(s.deck) || !s.deck.length || !s.deck.every(has)) return false;
      if (['clue', 'answer', 'over', 'tiebreak'].indexOf(s.phase) === -1) return false;
      if (!(s.index >= 0 && s.index < s.deck.length) || !(s.revealed >= 1 && s.revealed <= E.MAX_CLUES)) return false;
      if (!(s.turn >= 0 && s.turn < s.teams.length) || !(s.starter >= 0 && s.starter < s.teams.length)) return false;
      if (!s.teams.every(function (t) { return t && typeof t.name === 'string' && t.name.length <= 40 && typeof t.score === 'number' && isFinite(t.score) && t.score >= 0; })) return false;
      if (!Array.isArray(s.history) || !s.history.every(function (h) { return h && has(h.card); })) return false;
      if (s.phase === 'answer' && (!s.result || !s.history.length)) return false;
      if (s.phase === 'tiebreak' && (!s.tiebreak || !has(s.tiebreak.card) || !Array.isArray(s.tiebreak.teams))) return false;
      return true;
    } catch (e) { return false; }
  }
  /* لاعبين «من فينا؟»: اسم + ٥ تلميحات نصية، كلها بحدود */
  function validPlayers(ps, min) {
    return Array.isArray(ps) && ps.length >= min && ps.length <= MAX_PLAYERS && ps.every(function (p) {
      return p && typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 24 && Array.isArray(p.clues) && p.clues.length === WHO_Q &&
        p.clues.every(function (c) { return typeof c === 'string' && c.length > 0 && c.length <= 120; });
    });
  }
  // البطاقة حسب نوع اللعبة: من فينا بطاقاته من اللاعبين نفسهم
  function cardOf(s, id) {
    if (s && s.mode === 'who') {
      var m = /^p(\d{1,2})$/.exec(String(id)), p = m && s.players[+m[1]];
      return p ? { id: id, cat: 'who', answer: p.name, clues: p.clues } : null;
    }
    var c = byId[id];
    if (!c) return null;
    if (s && s.mode === 'sound' ? c.cat !== 'sound' : c.cat === 'sound') return null;
    return c;
  }
  var state = load(KEY, null);
  if (!valid(state)) { state = null; drop(KEY); }
  var lastRevealed = 0;

  function setState(s) {
    var prev = state;
    state = s;
    if (s) save(KEY, s); else drop(KEY);
    // نسجل البطاقات اللي انلعبت عشان ما تتكرر بالسهرات الجاية
    if (s && s.mode !== 'who' && s.history.length && (!prev || prev.history.length !== s.history.length)) {
      var seen = load(SEEN, []);
      var id = s.history[s.history.length - 1].card;
      if (seen.indexOf(id) === -1) { seen.push(id); if (seen.length >= CARDS.length + SOUNDS.length) seen = [id]; save(SEEN, seen); }
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
        return '<span class="s t' + i + (i === active ? ' on' : '') + '"><span class="nm">' + esc(t.name) + '</span><span class="sc">' + num(t.score) + '</span></span>';
      }).join('') + '</button>';
  }

  /* ---------- الشاشات ---------- */
  var view = state ? 'play' : 'home';
  var setupDefault = function () { return { mode: 'masira', count: 2, names: DEFAULT_NAMES.slice(), length: 'medium', style: 'turns', cats: CATS.filter(function (c) { return !c.off; }).map(function (c) { return c.id; }) }; };
  var setup = load(SETUP, null);
  if (!setup || [2, 3, 4].indexOf(setup.count) === -1 || !Array.isArray(setup.names) || !Array.isArray(setup.cats) ||
      !setup.cats.length || !setup.cats.every(function (c) { return catById[c]; }) || !E.LENGTHS[setup.length]) setup = setupDefault();
  if (!MODES[setup.mode]) setup.mode = 'masira';
  setup.names = setup.names.slice(0, 4).map(function (n) { return String(n || '').slice(0, 16); });
  while (setup.names.length < 4) setup.names.push(DEFAULT_NAMES[setup.names.length]);
  var peek = false; // المضيف يشوف الجواب
  var who = load(WHO, null); // لاعبين «من فينا؟» قبل ما تبدأ السهرة
  if (!who || !validPlayers(who.players, 0)) who = { players: [] };
  var whoPrompts = null, whoErr = '';

  /* لو صار أي خطأ غير متوقع وقت العرض، نرجع للرئيسية بدل شاشة فاضية */
  function render() {
    try { draw(); }
    catch (e) {
      try { console.error(e); } catch (x) { }
      state = null; drop(KEY); view = 'home'; renderHome();
    }
  }
  function draw() {
    if (view === 'home') return renderHome();
    if (view === 'how') return renderHow();
    if (view === 'setup') return renderSetup();
    if (view === 'collect') return renderCollect();
    if (view === 'who-form') return renderWhoForm();
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
      '<p class="tag">لعبة الجمعات. جوال واحد يدور بالمجلس، وثلاث ألعاب تختارون منها.</p>' +
      '<div class="stack">' +
      (resume ? '<button class="btn big" type="button" data-act="resume">كمّل سهرة ' + esc(MODES[state.mode].name) + '</button>' : '') +
      Object.keys(MODES).map(function (m) {
        return '<button class="mode" type="button" data-act="new" data-mode="' + m + '"><span class="mode-name">' + MODES[m].name + '</span><span class="mode-desc">' + MODES[m].desc + '</span></button>';
      }).join('') +
      '<button class="btn link" type="button" data-act="how">كيف نلعب؟</button>' +
      '</div>';
  }

  function renderHow() {
    app.className = 'how';
    app.innerHTML =
      '<div class="top"><span>كيف نلعب؟</span></div>' +
      '<p>قسّموا أنفسكم فرق، من فريقين إلى ٤. اللي ماسك الجوال هو المضيف، ويقدر يشوف الجواب من زر «المضيف».</p>' +
      '<h2>مسيرة</h2>' +
      '<ol>' +
      '<li>المضيف يقرا التلميحة بصوت عالي.</li>' +
      '<li>الدور على فريق واحد كل مرة. يجاوب مرة وحدة بس.</li>' +
      '<li>صح؟ ياخذ النقاط. غلط؟ الدور ينتقل وتنكشف تلميحة جديدة.</li>' +
      '<li>أول تلميحة بـ ٥ نقاط، وكل تلميحة زيادة تنقص نقطة.</li>' +
      '<li>آخر ٣ بطاقات نقاطها مضاعفة، ولو تعادلتوا فيه جولة فاصلة.</li>' +
      '</ol>' +
      '<h2>اسمعها</h2>' +
      '<ol>' +
      '<li>نفس مسيرة، بس أول تلميحة صوت. ارفعوا صوت الجوال أو وصلوه بسماعة.</li>' +
      '<li>عرفتوه من الصوت بس؟ ٥ نقاط. تقدرون تعيدون الصوت كل ما بغيتوا.</li>' +
      '<li>كل الأصوات مصنوعة داخل اللعبة، وتشتغل بدون إنترنت.</li>' +
      '</ol>' +
      '<h2>من فينا؟</h2>' +
      '<ol>' +
      '<li>كل لاعب ياخذ الجوال لحاله، يكتب اسمه ويجاوب ٥ أسئلة عن نفسه بالسر، ويرجعه.</li>' +
      '<li>لازم ٣ لاعبين على الأقل.</li>' +
      '<li>بعدها كل بطاقة شخص منكم: أجوبته تنكشف وحدة وحدة، والفرق يخمنون مين هو.</li>' +
      '<li>صاحب البطاقة يسكت ولا يساعد فريقه!</li>' +
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
      teamInputs += '<label class="team-input t' + i + '"><span class="dot"></span>' +
        '<input type="text" id="team-' + i + '" maxlength="16" value="' + esc(names[i] || '') + '" aria-label="اسم الفريق ' + num(i + 1) + '"></label>';
    }
    function chip(group, val, label, on) {
      return '<button class="chip" type="button" data-group="' + group + '" data-val="' + val + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + label + '</button>';
    }
    var count = 0;
    var pool = CARDS.filter(function (c) { return setup.cats.indexOf(c.cat) !== -1; }).length;
    var m = setup.mode;
    app.innerHTML =
      '<div class="top"><span>سهرة ' + MODES[m].name + '</span><button class="end" type="button" data-act="home">رجوع</button></div>' +
      '<div class="field"><span class="label">كم فريق؟</span><div class="chips">' +
        [2, 3, 4].map(function (n) { return chip('count', n, num(n) + ' فرق', setup.count === n); }).join('') + '</div></div>' +
      '<div class="field"><span class="label">أسماء الفرق</span><div class="stack">' + teamInputs + '</div></div>' +
      (m === 'who' ? '' : '<div class="field"><span class="label">طول السهرة</span><div class="chips">' +
        chip('length', 'short', 'قصيرة · ' + num(E.LENGTHS.short), setup.length === 'short') +
        chip('length', 'medium', 'متوسطة · ' + num(E.LENGTHS.medium), setup.length === 'medium') +
        chip('length', 'long', 'طويلة · ' + num(E.LENGTHS.long), setup.length === 'long') + '</div></div>') +
      '<div class="field"><span class="label">أسلوب التخمين</span><div class="chips">' +
        chip('style', 'turns', 'بالدور', setup.style === 'turns') +
        chip('style', 'speed', 'سرعة', setup.style === 'speed') + '</div>' +
        '<span class="hint">' + (setup.style === 'turns' ? 'كل تلميحة لها فريق واحد يجاوب مرة وحدة.' : 'أي فريق يصارخ بالجواب أول ياخذها.') + '</span></div>' +
      (m !== 'masira' ? '' : '<div class="field"><span class="label">الفئات</span><div class="chips">' +
        CATS.map(function (c) { return chip('cat', c.id, c.name, setup.cats.indexOf(c.id) !== -1); }).join('') + '</div>' +
        '<span class="hint">' + num(pool) + ' بطاقة بالفئات المختارة</span></div>') +
      (m === 'sound' ? '<p class="hint">' + num(SOUNDS.length) + ' صوت. ارفعوا صوت الجوال.</p>' : '') +
      (err ? '<p class="error" role="alert">' + esc(err) + '</p>' : '') +
      '<div class="spacer"></div>' +
      '<button class="btn big" type="button" data-act="start">' + (m === 'who' ? 'التالي: أسرار اللاعبين' : 'يلا نبدأ') + '</button>';
    void count;
  }

  /* ---------- من فينا؟: جمع أسرار اللاعبين ---------- */
  function renderCollect(err) {
    app.className = 'setup';
    var ps = who.players, ready = ps.length >= MIN_PLAYERS;
    app.innerHTML =
      '<div class="top"><span>من فينا؟</span><button class="end" type="button" data-act="who-back">رجوع</button></div>' +
      '<h2>أسرار اللاعبين</h2>' +
      '<p class="muted">مرروا الجوال: كل واحد يضغط «دوري»، يكتب اسمه ويجاوب ٥ أسئلة بالسر، وبعدها يرجّع الجوال. أجوبته تنخفي على طول.</p>' +
      (ps.length ? '<ul class="players">' + ps.map(function (pl, i) {
        return '<li><span class="nm">' + esc(pl.name) + '</span><span class="ok-mark">جاهز ✓</span>' +
          '<button class="x" type="button" data-act="who-del" data-i="' + i + '" aria-label="احذف ' + esc(pl.name) + '">×</button></li>';
      }).join('') + '</ul>' : '') +
      '<p class="hint">' + num(ps.length) + ' من ' + num(MAX_PLAYERS) + ' لاعب' + (ready ? '' : '، تحتاجون ' + num(MIN_PLAYERS) + ' على الأقل') + '</p>' +
      (err ? '<p class="error" role="alert">' + esc(err) + '</p>' : '') +
      '<div class="spacer"></div>' +
      '<div class="stack">' +
      (ps.length < MAX_PLAYERS ? '<button class="btn ' + (ready ? 'ghost' : 'big') + '" type="button" data-act="who-add">دوري: أكتب أسراري</button>' : '') +
      (ready ? '<button class="btn big" type="button" data-act="who-start">خلصنا، يلا نبدأ</button>' : '') +
      (ps.length ? '<button class="btn link" type="button" data-act="who-clear">امسح كل اللاعبين</button>' : '') +
      '</div>';
  }

  function pickPrompts() { return E.shuffle(PROMPTS, Math.random).slice(0, WHO_Q); }

  function renderWhoForm() {
    app.className = 'setup';
    if (!whoPrompts) whoPrompts = pickPrompts();
    app.innerHTML =
      '<div class="top"><span>من فينا؟ · بالسر</span><button class="end" type="button" data-act="who-cancel">إلغاء</button></div>' +
      '<p class="muted">لا تخلي أحد يشوف! جاوب بكلمة أو كلمتين.</p>' +
      '<div class="field"><label class="label" for="who-name">اسمك</label><input type="text" id="who-name" maxlength="24" autocomplete="off"></div>' +
      whoPrompts.map(function (q, i) {
        return '<div class="field"><label class="label" for="who-a' + i + '">' + esc(q) + '</label><input type="text" id="who-a' + i + '" maxlength="40" autocomplete="off"></div>';
      }).join('') +
      '<button class="btn link" type="button" data-act="who-shuffle">ما عجبتني الأسئلة، غيّرها</button>' +
      (whoErr ? '<p class="error" role="alert">' + esc(whoErr) + '</p>' : '') +
      '<div class="spacer"></div>' +
      '<button class="btn big" type="button" data-act="who-save">احفظ وأخفِ أجوبتي</button>';
  }

  function readWhoForm() {
    var nameEl = document.getElementById('who-name');
    var name = nameEl ? nameEl.value.trim().slice(0, 24) : '';
    var answers = whoPrompts.map(function (q, i) { var el = document.getElementById('who-a' + i); return el ? el.value.trim().slice(0, 40) : ''; });
    return { name: name, answers: answers };
  }

  function renderClue() {
    app.className = 'play';
    var s = state, card = cardOf(s, E.currentCardId(s)), cat = catById[card.cat];
    var tb = s.phase === 'tiebreak';
    var prog = E.progress(s), golden = !tb && E.isGolden(s);
    var pts = E.cluePoints(s.revealed) * (golden ? 2 : 1);
    var clues = '';
    for (var i = 0; i < E.MAX_CLUES; i++) {
      if (i === 0 && card.sfx) clues += soundClue();
      else if (i < s.revealed) clues += '<li class="clue' + (i >= lastRevealed ? ' new' : '') + '"><span class="n">' + num(i + 1) + '</span><span>' + esc(card.clues[i]) + '</span></li>';
      else clues += '<li class="clue locked"><span class="n">' + num(i + 1) + '</span><span>تلميحة مخفية</span></li>';
    }
    var fresh = lastRevealed === 0;
    lastRevealed = s.revealed;
    if (fresh && card.sfx) SFX.play(card.sfx);
    var t = s.teams[s.turn];
    var controls;
    if (s.style === 'turns' || tb) {
      var lastRound = s.revealed >= E.MAX_CLUES;
      controls =
        '<div class="turn t' + s.turn + '"><span class="dot"></span>الدور على: ' + esc(t.name) + '</div>' +
        '<div class="row"><button class="btn ok big" type="button" data-act="correct" data-team="' + s.turn + '">صح ✓</button>' +
        '<button class="btn no big" type="button" data-act="wrong">غلط ✗</button></div>' +
        '<p class="hint">' + (lastRound ? 'آخر تلميحة: كل فريق ياخذ فرصة وحدة.' : 'غلط؟ الدور ينتقل للفريق الجاي وتنكشف تلميحة.') + '</p>';
    } else {
      controls =
        '<span class="label">مين جاوب صح؟</span>' +
        '<div class="team-btns">' + s.teams.map(function (tm, i) {
          return '<button class="btn team-btn t' + i + '" type="button" data-act="correct" data-team="' + i + '">' + esc(tm.name) + '</button>';
        }).join('') + '</div>' +
        '<button class="btn quiet" type="button" data-act="reveal"' + (s.revealed >= E.MAX_CLUES ? ' disabled' : '') + '>تلميحة جديدة</button>';
    }
    app.innerHTML =
      '<div class="top"><span>' + (tb ? '<span class="badge red">جولة فاصلة</span>' : 'بطاقة ' + num(prog.card) + ' من ' + num(prog.total)) +
        (golden ? ' <span class="badge gold">نقاط مضاعفة</span>' : '') + '</span>' +
        '<button class="end" type="button" data-act="end">إنهاء</button></div>' +
      '<div class="q-head">' + layers(s.revealed) + '<div><span class="badge">' + esc(cat.name) + '</span><h2 class="q-title">' + esc(cat.q) + '</h2>' +
        (tb ? '<p class="pts">أول فريق يعرفها يفوز بالسهرة</p>' : '<p class="pts">الحين على <b>' + num(pts) + '</b> نقاط</p>') + '</div></div>' +
      '<button class="peek" type="button" data-act="peek" aria-pressed="' + peek + '">' + (peek ? 'الجواب: <b>' + esc(card.answer) + '</b> · اخفه' : 'المضيف: اضغط تشوف الجواب') + '</button>' +
      (s.mode === 'who' ? '<p class="hint">صاحب البطاقة يسكت!</p>' : '') +
      '<ol class="clues">' + clues + '</ol>' +
      '<div class="stack">' + controls + '</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn link" type="button" data-act="giveup">محد عرفها، ورني الجواب</button>' +
      strip(s, s.style === 'turns' || tb ? s.turn : -1);
  }

  function soundClue() {
    return '<li class="clue sound"><span class="n">' + num(1) + '</span><button class="btn quiet play" type="button" data-act="play">▶ شغّل الصوت</button></li>';
  }

  function renderAnswer() {
    app.className = 'play';
    var s = state, card = cardOf(s, s.history[s.history.length - 1].card), r = s.result;
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
        if (i === 0 && card.sfx) return soundClue();
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
        return '<li class="t' + o.i + (win.indexOf(o.i) !== -1 ? ' win' : '') + '"><span class="rk">' + num(k + 1) + '</span><span class="nm">' + esc(o.t.name) + '</span><span class="sc">' + num(o.t.score) + '</span></li>';
      }).join('') + '</ol>' +
      '<p class="muted small center">عرفتوا ' + num(known.length) + ' من ' + num(s.deck.length) + ' بطاقة' + (quick ? '، و' + num(quick) + ' منها من أول تلميحة' : '') + '</p>' +
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

  function startGame(prevTeams, mode, players) {
    var names = prevTeams || setup.names.slice(0, setup.count).map(function (n, i) { return (n || '').trim() || DEFAULT_NAMES[i]; });
    mode = mode || setup.mode;
    try {
      var opts = { teams: names, length: setup.length, style: setup.style, seen: load(SEEN, []) };
      if (mode === 'sound') opts.cards = SOUNDS;
      else if (mode === 'who') {
        players = players || who.players;
        if (!validPlayers(players, MIN_PLAYERS)) throw new Error('تحتاجون ' + num(MIN_PLAYERS) + ' لاعبين على الأقل');
        opts.cards = players.map(function (_, i) { return { id: 'p' + i, cat: 'who' }; });
        opts.count = players.length; opts.seen = [];
      } else { opts.cards = CARDS; opts.categories = setup.cats; }
      var g = E.newGame(opts);
      g.mode = mode;
      if (mode === 'who') g.players = players.map(function (p) { return { name: p.name, clues: p.clues.slice() }; });
      lastRevealed = 0;
      view = 'play';
      setState(g);
    } catch (e) {
      if (mode === 'who') { view = 'collect'; renderCollect(e.message); }
      else { view = 'setup'; renderSetup(e.message); }
    }
  }

  function spareIds() {
    var inPlay = state.deck;
    if (state.mode === 'who') return [];
    return E.shuffle((state.mode === 'sound' ? SOUNDS : CARDS).filter(function (c) { return inPlay.indexOf(c.id) === -1; }).map(function (c) { return c.id; }), Math.random);
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
      case 'new': setup.mode = MODES[b.getAttribute('data-mode')] ? b.getAttribute('data-mode') : 'masira'; save(SETUP, setup); view = 'setup'; return renderSetup();
      case 'resume': view = 'play'; return render();
      case 'how': view = 'how'; return render();
      case 'home': view = 'home'; return render();
      case 'start':
        readNames(); save(SETUP, setup);
        if (setup.mode === 'who') { view = 'collect'; return renderCollect(); }
        return startGame();
      case 'play': if (state) { var cc = cardOf(state, state.phase === 'answer' ? state.history[state.history.length - 1].card : E.currentCardId(state)); if (cc && cc.sfx) SFX.play(cc.sfx); } return;
      case 'who-back': view = 'setup'; return renderSetup();
      case 'who-add': whoPrompts = pickPrompts(); whoErr = ''; view = 'who-form'; return render();
      case 'who-cancel': whoErr = ''; view = 'collect'; return render();
      case 'who-shuffle': {
        var keep = readWhoForm().name;
        whoPrompts = pickPrompts(); whoErr = ''; render();
        var ne = document.getElementById('who-name'); if (ne) ne.value = keep;
        return;
      }
      case 'who-save': {
        var f = readWhoForm();
        var taken = who.players.some(function (pl) { return pl.name === f.name; });
        whoErr = !f.name ? 'اكتب اسمك' : taken ? 'هالاسم موجود، اكتبه بطريقة ثانية' : f.answers.some(function (a) { return !a; }) ? 'جاوب على كل الأسئلة' : '';
        if (!whoErr && who.players.length >= MAX_PLAYERS) whoErr = 'وصلتوا الحد: ' + num(MAX_PLAYERS) + ' لاعب';
        if (whoErr || who.players.length >= MAX_PLAYERS) {
          var vals = f; render();
          var n2 = document.getElementById('who-name'); if (n2) n2.value = vals.name;
          vals.answers.forEach(function (a, i) { var el = document.getElementById('who-a' + i); if (el) el.value = a; });
          return;
        }
        who.players.push({ name: f.name, clues: whoPrompts.map(function (q, i) { return q + ': ' + f.answers[i]; }) });
        save(WHO, who); whoPrompts = null; view = 'collect'; buzz(20);
        return render();
      }
      case 'who-del': who.players.splice(+b.getAttribute('data-i'), 1); save(WHO, who); return render();
      case 'who-clear': who = { players: [] }; save(WHO, who); return render();
      case 'who-start': return startGame(null, 'who');
      case 'correct': if (!state) return; buzz(30); return setState(E.correct(state, +b.getAttribute('data-team')));
      case 'wrong': if (!state) return; buzz(12); return setState(E.wrong(state));
      case 'reveal': if (!state) return; return setState(E.revealNext(state));
      case 'giveup': if (!state) return; return setState(E.giveUp(state));
      case 'next': if (!state) return; peek = false; SFX.stop(); return setState(E.nextCard(state, spareIds()));
      case 'peek': peek = !peek; return render();
      case 'scores': return openScores();
      case 'end': return openDlg(document.getElementById('confirm'));
      case 'again': if (!state) return; return startGame(state.teams.map(function (t) { return t.name; }), state.mode, state.players);
      case 'home-clear': view = 'home'; SFX.stop(); return setState(null);
    }
  });

  function openDlg(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function closeDlg(d) { if (d.close) d.close(); else d.removeAttribute('open'); }

  /* نافذة تعديل النقاط */
  var scoresDlg = document.getElementById('scores');
  function openScores() {
    fillScores();
    openDlg(scoresDlg);
  }
  function fillScores() {
    document.getElementById('scores-list').innerHTML = state.teams.map(function (t, i) {
      return '<li class="t' + i + '"><span class="nm">' + esc(t.name) + '</span>' +
        '<button class="btn quiet" type="button" data-adj="-1" data-team="' + i + '" aria-label="نقص نقطة من ' + esc(t.name) + '">−</button>' +
        '<span class="sc">' + num(t.score) + '</span>' +
        '<button class="btn quiet" type="button" data-adj="1" data-team="' + i + '" aria-label="زد نقطة لـ ' + esc(t.name) + '">+</button></li>';
    }).join('');
  }
  scoresDlg.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-adj') && state) { setState(E.adjust(state, +b.getAttribute('data-team'), +b.getAttribute('data-adj'))); fillScores(); }
  });
  document.querySelectorAll('dialog [data-close]').forEach(function (b) {
    b.addEventListener('click', function () { closeDlg(b.closest('dialog')); });
  });
  document.getElementById('confirm-yes').addEventListener('click', function () {
    closeDlg(document.getElementById('confirm'));
    view = 'home'; SFX.stop(); setState(null);
  });

  render();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(function () { });
  }
})();
