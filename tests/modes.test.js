/* فحوصات «كم تتوقع؟» و«من فينا؟» */
const test = require('node:test');
const assert = require('node:assert');
const { NUMBERS } = require('../js/numbers.js');
const G = require('../js/guess.js');
const { PROMPTS } = require('../js/who.js');
const E = require('../js/engine.js');

test('كم تتوقع: الأسئلة كاملة وما تتكرر', () => {
  const ids = new Set(), qs = new Set();
  for (const q of NUMBERS) {
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0, q.id);
    assert.ok(q.q.length > 8 && q.q.endsWith('؟'), q.id);
    assert.ok(!ids.has(q.id), q.id); ids.add(q.id);
    assert.ok(!qs.has(q.q), q.q); qs.add(q.q);
  }
  assert.ok(NUMBERS.length >= 100, 'عدد الأسئلة ' + NUMBERS.length);
});

test('كم تتوقع: قراءة الأرقام', () => {
  assert.strictEqual(G.parse('١٢٣'), 123);
  assert.strictEqual(G.parse(' 1,500 '), 1500);
  assert.strictEqual(G.parse('٣٨٤٬٠٠٠'), 384000);
  assert.strictEqual(G.parse('<img>'), null);
  assert.strictEqual(G.parse('-5'), null);
  assert.strictEqual(G.parse('1e9'), null);
  assert.strictEqual(G.parse(''), null);
});

test('كم تتوقع: النقاط', () => {
  assert.deepStrictEqual(G.score([100, 120, null], 100), [5, 0, 0]);
  assert.deepStrictEqual(G.score([90, 110, 50], 100), [3, 3, 0]);
  assert.deepStrictEqual(G.score([null, null], 100), [0, 0]);
  assert.deepStrictEqual(G.score([99, 1, 100], 100, [0, 1]), [3, 0, 0]);
});

test('كم تتوقع: سهرة كاملة مع جولة فاصلة', () => {
  let s = G.newGame({ teams: ['أ', 'ب'], questions: NUMBERS, length: 'short' });
  assert.strictEqual(s.deck.length, 10);
  for (let i = 0; i < 10; i++) {
    const a = NUMBERS.find(q => q.id === s.deck[s.index]).answer;
    s = G.submit(s, [a, a], a); // تعادل دايم
    assert.strictEqual(s.phase, 'show');
    s = G.next(s, NUMBERS.map(q => q.id));
  }
  assert.strictEqual(s.phase, 'ask');
  assert.ok(s.tiebreak && s.tiebreak.card);
  const a = NUMBERS.find(q => q.id === s.tiebreak.card).answer;
  const before = s.teams.map(t => t.score);
  s = G.submit(s, [a + 1, a + 9], a);
  assert.deepStrictEqual(s.teams.map(t => t.score), before, 'الفاصلة ما تزيد النقاط');
  s = G.next(s);
  assert.strictEqual(s.phase, 'over');
  assert.deepStrictEqual(G.winners(s), [0]);
  // ضغطات بعد النهاية ما تخرب شي
  assert.strictEqual(G.submit(s, [1, 1], 1), s);
  assert.strictEqual(G.next(s), s);
});

test('من فينا: الأسئلة كثيرة وما تتكرر', () => {
  assert.ok(PROMPTS.length >= 50);
  assert.strictEqual(new Set(PROMPTS).size, PROMPTS.length);
  for (const p of PROMPTS) assert.ok(p.length <= 70, p);
});

test('المحرك: count يحدد عدد البطاقات (من فينا = عدد اللاعبين)', () => {
  const cards = [0, 1, 2, 3, 4].map(i => ({ id: 'p' + i, cat: 'who' }));
  const g = E.newGame({ teams: ['أ', 'ب'], cards, count: 5 });
  assert.strictEqual(g.deck.length, 5);
  assert.deepStrictEqual([...g.deck].sort(), cards.map(c => c.id).sort());
});
