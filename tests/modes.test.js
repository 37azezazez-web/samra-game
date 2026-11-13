/* فحوصات «اسمعها» و«من فينا؟» */
const test = require('node:test');
const assert = require('node:assert');
const { SOUNDS } = require('../js/sounds.js');
const SFX = require('../js/sfx.js');
const { PROMPTS } = require('../js/who.js');
const E = require('../js/engine.js');

test('اسمعها: كل بطاقة لها صوت موجود و٥ تلميحات وما فيه تكرار', () => {
  const ids = new Set(), answers = new Set(), used = new Set();
  for (const c of SOUNDS) {
    assert.strictEqual(c.clues.length, 5, c.id);
    assert.strictEqual(c.cat, 'sound');
    assert.ok(SFX.ids.includes(c.sfx), 'صوت ناقص ' + c.sfx);
    assert.ok(SFX.dur(c.sfx) > 0 && SFX.dur(c.sfx) <= 6, c.id);
    assert.ok(!ids.has(c.id), c.id); ids.add(c.id);
    assert.ok(!answers.has(c.answer), c.answer); answers.add(c.answer);
    used.add(c.sfx);
    for (const cl of c.clues.slice(1)) assert.ok(!cl.includes(c.answer.replace(/^ال/, '')), `${c.id}: التلميحة فيها الجواب: ${cl}`);
  }
  assert.strictEqual(used.size, SFX.ids.length, 'كل صوت مصنوع له بطاقة');
  assert.ok(SOUNDS.length >= 50, 'عدد الأصوات ' + SOUNDS.length);
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
  const s = E.newGame({ teams: ['أ', 'ب'], cards: SOUNDS, length: 'short' });
  assert.strictEqual(s.deck.length, 10);
});
