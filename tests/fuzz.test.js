/* فحص الثبات: آلاف السهرات العشوائية، ونتأكد إن المحرك ما يعلق ولا يطلع حالة غلط أبد */
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/engine.js');
const { CARDS, CATEGORIES } = require('../js/cards.js');

function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
const ids = CARDS.map(c => c.id);
const byId = Object.fromEntries(CARDS.map(c => [c.id, c]));

function check(s) {
  assert.ok(['clue', 'answer', 'over', 'tiebreak'].includes(s.phase), 'phase ' + s.phase);
  assert.ok(s.revealed >= 1 && s.revealed <= E.MAX_CLUES, 'revealed ' + s.revealed);
  assert.ok(s.turn >= 0 && s.turn < s.teams.length, 'turn');
  assert.ok(s.index >= 0 && s.index < s.deck.length, 'index');
  assert.ok(byId[E.currentCardId(s)], 'card exists');
  assert.strictEqual(new Set(s.deck).size, s.deck.length, 'no dup in deck');
  s.teams.forEach(t => assert.ok(Number.isInteger(t.score) && t.score >= 0, 'score'));
  if (s.phase === 'tiebreak') {
    assert.ok(s.tiebreak.teams.includes(s.turn), 'tiebreak turn among tied');
    assert.ok(!s.history.some(h => h.card === s.tiebreak.card), 'tiebreak card unused');
  }
  JSON.parse(JSON.stringify(s)); // لازم ينحفظ
}

test('٥٠٠٠ سهرة عشوائية تخلص بدون أخطاء وبحالة سليمة', () => {
  const r = rng(12345);
  let ties = 0, finished = 0;
  for (let g = 0; g < 5000; g++) {
    const nTeams = 2 + Math.floor(r() * 3);
    const cats = CATEGORIES.filter(() => r() < 0.6).map(c => c.id);
    let s = E.newGame({
      teams: Array.from({ length: nTeams }, (_, i) => r() < 0.1 ? '' : 'فريق' + i),
      cards: CARDS, length: ['short', 'medium', 'long'][Math.floor(r() * 3)],
      style: r() < 0.5 ? 'turns' : 'speed', golden: r() < 0.8, categories: cats, rand: r,
      seen: ids.filter(() => r() < 0.3)
    });
    check(s);
    let steps = 0;
    while (s.phase !== 'over') {
      assert.ok(++steps < 2000, 'السهرة علقت');
      const x = r();
      if (s.phase === 'answer') s = E.nextCard(s, E.shuffle(ids.filter(id => !s.deck.includes(id)), r));
      else if (x < 0.35) s = E.wrong(s);
      else if (x < 0.55) s = E.correct(s, (s.phase === 'tiebreak' ? s.tiebreak.teams : [...s.teams.keys()])[Math.floor(r() * (s.phase === 'tiebreak' ? s.tiebreak.teams.length : s.teams.length))]);
      else if (x < 0.75) s = E.revealNext(s);
      else if (x < 0.85) s = E.giveUp(s);
      else if (x < 0.92) s = E.adjust(s, Math.floor(r() * s.teams.length), r() < 0.5 ? 1 : -1);
      else { // أزرار مضغوطة بالغلط في الحالة الغلط ما تخرب شي
        const before = JSON.stringify(s);
        if (s.phase === 'clue' || s.phase === 'tiebreak') assert.strictEqual(JSON.stringify(E.nextCard(s, [])), before);
      }
      check(s);
      if (s.phase === 'tiebreak') ties++;
    }
    const w = E.winners(s);
    assert.ok(w.length >= 1, 'فيه فائز');
    if (!(s.tiebreak && s.tiebreak.shared)) assert.ok(w.length === 1 || !s.tiebreak, 'التعادل ينحسم');
    finished++;
  }
  assert.strictEqual(finished, 5000);
  assert.ok(ties > 0, 'جربنا جولات فاصلة');
});

test('الأزرار بعد نهاية السهرة ما تسوي شي', () => {
  let s = E.newGame({ teams: ['أ', 'ب'], cards: CARDS, length: 'short', rand: rng(7) });
  const all = ids;
  for (let i = 0; i < 10; i++) { s = i ? E.giveUp(s) : E.correct(s, 0); s = E.nextCard(s, all); }
  assert.strictEqual(s.phase, 'over');
  const b = JSON.stringify(s);
  for (const f of [E.wrong, E.giveUp, E.revealNext, x => E.correct(x, 1), x => E.nextCard(x, all)]) assert.strictEqual(JSON.stringify(f(s)), b);
});

test('أسماء فيها أكواد ما تنفذ (تنحفظ كنص)', () => {
  const s = E.newGame({ teams: ['<img src=x onerror=alert(1)>', '"><script>'], cards: CARDS, rand: rng(3) });
  assert.strictEqual(s.teams[0].name, '<img src=x onerror=alert(1)>');
});
