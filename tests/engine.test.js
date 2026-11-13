const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/engine.js');
const { CARDS, CATEGORIES } = require('../js/cards.js');

const fixed = () => { let x = 1; return () => ((x = (x * 9301 + 49297) % 233280) / 233280); };
const game = (o = {}) => E.newGame({ teams: ['أ', 'ب'], cards: CARDS, length: 'short', rand: fixed(), ...o });

test('النقاط: ٥ لأول تلميحة ونقطة وحدة للأخيرة', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 5].map(E.cluePoints), [5, 4, 3, 2, 1]);
});

test('عدد الفرق من ٢ إلى ٤', () => {
  assert.throws(() => game({ teams: ['أ'] }));
  assert.throws(() => game({ teams: ['1', '2', '3', '4', '5'] }));
  assert.strictEqual(game({ teams: ['1', '2', '3', '4'] }).teams.length, 4);
});

test('طول السهرة وبدون تكرار', () => {
  const g = game({ length: 'medium' });
  assert.strictEqual(g.deck.length, 20);
  assert.strictEqual(new Set(g.deck).size, 20);
});

test('فلتر الفئات', () => {
  const g = game({ categories: ['food'] });
  g.deck.forEach(id => assert.strictEqual(CARDS.find(c => c.id === id).cat, 'food'));
});

test('البطاقات اللي انلعبت تجي آخر شي', () => {
  const seen = CARDS.slice(0, CARDS.length - 5).map(c => c.id);
  const g = game({ seen });
  const fresh = CARDS.slice(CARDS.length - 5).map(c => c.id);
  assert.deepStrictEqual(g.deck.slice(0, 5).sort(), fresh.sort());
});

test('بالدور: الغلط ينقل الدور ويكشف تلميحة', () => {
  let g = game();
  assert.strictEqual(g.turn, 0); assert.strictEqual(g.revealed, 1);
  g = E.wrong(g);
  assert.strictEqual(g.turn, 1); assert.strictEqual(g.revealed, 2);
  g = E.correct(g, 1);
  assert.strictEqual(g.teams[1].score, 4);
  assert.strictEqual(g.phase, 'answer');
});

test('آخر تلميحة: كل فريق ياخذ فرصة وبعدين تنكشف بدون نقاط', () => {
  let g = game({ teams: ['أ', 'ب', 'ج'] });
  for (let i = 0; i < 4; i++) g = E.wrong(g);
  assert.strictEqual(g.revealed, 5);
  g = E.wrong(g); g = E.wrong(g);
  assert.strictEqual(g.phase, 'clue');
  g = E.wrong(g);
  assert.strictEqual(g.phase, 'answer');
  assert.strictEqual(g.result.team, null);
  assert.ok(g.teams.every(t => t.score === 0));
});

test('الفريق اللي يبدأ يتبدل كل بطاقة', () => {
  let g = game({ teams: ['أ', 'ب', 'ج'] });
  g = E.giveUp(g); g = E.nextCard(g);
  assert.strictEqual(g.turn, 1);
  g = E.giveUp(g); g = E.nextCard(g);
  assert.strictEqual(g.turn, 2);
});

test('آخر ٣ بطاقات نقاطها مضاعفة', () => {
  let g = game();
  for (let i = 0; i < 7; i++) { assert.ok(!E.isGolden(g)); g = E.giveUp(g); g = E.nextCard(g); }
  assert.ok(E.isGolden(g));
  g = E.correct(g, 0);
  assert.strictEqual(g.teams[0].score, 10);
});

test('النهاية والفائز', () => {
  let g = game();
  for (let i = 0; i < 10; i++) { g = i === 0 ? E.correct(g, 1) : E.giveUp(g); g = E.nextCard(g, CARDS.map(c => c.id)); }
  assert.strictEqual(g.phase, 'over');
  assert.deepStrictEqual(E.winners(g), [1]);
});

test('التعادل: بطاقة فاصلة للفرق المتعادلة وتحسم', () => {
  let g = game({ teams: ['أ', 'ب', 'ج'] });
  const all = CARDS.map(c => c.id);
  g = E.correct(g, 0); g = E.nextCard(g, all);
  g = E.correct(g, 1); g = E.nextCard(g, all);
  for (let i = 2; i < 10; i++) { g = E.giveUp(g); g = E.nextCard(g, all); }
  assert.strictEqual(g.phase, 'tiebreak');
  assert.deepStrictEqual(g.tiebreak.teams, [0, 1]);
  assert.ok(!g.deck.includes(g.tiebreak.card));
  const before = g.teams.map(t => t.score);
  g = E.wrong(g); assert.strictEqual(g.turn, 1);
  g = E.correct(g, 1);
  assert.strictEqual(g.phase, 'over');
  assert.deepStrictEqual(E.winners(g), [1]);
  assert.deepStrictEqual(g.teams.map(t => t.score), before);
});

test('التعادل اللي ما ينحسم يجيب بطاقة ثانية', () => {
  let g = game();
  const all = CARDS.map(c => c.id);
  for (let i = 0; i < 10; i++) { g = E.giveUp(g); g = E.nextCard(g, all); }
  assert.strictEqual(g.phase, 'tiebreak');
  const first = g.tiebreak.card;
  g = E.giveUp(g); g = E.nextCard(g, all);
  assert.strictEqual(g.phase, 'tiebreak');
  assert.notStrictEqual(g.tiebreak.card, first);
});

test('التعديل اليدوي ما ينزل تحت الصفر', () => {
  let g = game();
  g = E.adjust(g, 0, 3); g = E.adjust(g, 0, -5);
  assert.strictEqual(g.teams[0].score, 0);
});

test('المحتوى: كل بطاقة ٥ تلميحات وفئة معروفة وid فريد', () => {
  const ids = new Set();
  const answers = new Set();
  const cats = CATEGORIES.map(c => c.id);
  for (const c of CARDS) {
    assert.strictEqual(c.clues.length, 5, c.id);
    assert.ok(cats.includes(c.cat), c.id);
    assert.ok(!ids.has(c.id), c.id); ids.add(c.id);
    assert.ok(!answers.has(c.answer.trim()), "جواب مكرر " + c.answer); answers.add(c.answer.trim());
    for (const cl of c.clues) assert.ok(!cl.includes(c.answer.replace(/^ال/, '')) || c.id === 'adnan', `${c.id}: التلميحة فيها الجواب: ${cl}`);
  }
  assert.ok(CARDS.length >= 500, 'عدد البطاقات ' + CARDS.length);
});
