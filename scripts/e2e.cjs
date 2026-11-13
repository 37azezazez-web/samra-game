/* فحص المتصفح: يشغّل اللعبة على localhost ويضغط أزرار عشوائية آلاف المرات بأحجام جوالات مختلفة،
   ويتأكد: ما فيه أخطاء، ما فيه مخالفات أمان (CSP)، دايم فيه زر تضغطه، وتشتغل بدون إنترنت.
   التشغيل: node scripts/e2e.cjs   (يحتاج Playwright) */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let fails = 0;
function ok(c, m) { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; }

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const b = await chromium.launch();
  const viewports = [[320, 568], [390, 844], [430, 932], [768, 1024], [1280, 800]];
  const steps = +(process.env.STEPS || 700);
  let seed = 99;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  for (const [w, h] of viewports) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
    });
    await p.goto(url);
    let clicks = 0, dead = 0, overflow = 0;
    for (let i = 0; i < steps; i++) {
      if (i % 150 === 149) await p.reload();
      const r = rnd();
      const res = await p.evaluate(r => {
        document.querySelectorAll('main input[type=text]').forEach(el => {
          el.value = (r < 0.5 ? '<img src=x onerror="window.__xss=1">' : 'فريق «١»') + (el.id === 'who-name' ? Math.floor(r * 1e6) : '');
        });
        const all = [...document.querySelectorAll('main button:not([disabled]), dialog[open] button')]
          .filter(b => b.offsetParent !== null || b.closest('dialog[open]'));
        const dlg = document.querySelector('dialog[open]');
        const pool = dlg ? all.filter(b => dlg.contains(b)) : all;
        if (!pool.length) return 'dead';
        pool[Math.floor(r * pool.length)].click();
        return 'ok';
      }, r);
      if (res === 'dead') { dead++; await p.reload(); continue; }
      clicks++;
      if (i % 25 === 0) {
        const sw = await p.evaluate(() => document.documentElement.scrollWidth);
        if (sw > w + 1) overflow++;
      }
    }
    const csp = await p.evaluate(() => window.__csp);
    const xss = await p.evaluate(() => window.__xss);
    ok(!errs.length, `${w}×${h}: ${clicks} ضغطة بدون أخطاء ${errs.length ? JSON.stringify(errs.slice(0, 3)) : ''}`);
    ok(!dead, `${w}×${h}: ما فيه شاشة بدون أزرار`);
    ok(!csp.length, `${w}×${h}: ما فيه مخالفات CSP ${csp.length ? JSON.stringify(csp.slice(0, 3)) : ''}`);
    ok(!xss, `${w}×${h}: أسماء الفرق ما تنفذ كود`);
    ok(!overflow, `${w}×${h}: ما فيه تمرير جانبي`);
    await ctx.close();
  }

  // كل أصوات «اسمعها» تطلع صوت مسموع وما فيها خلل
  {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    await p.goto(url);
    const res = await p.evaluate(async () => {
      const out = [];
      for (const id of window.SamraSfx.ids) {
        const d = window.SamraSfx.dur(id);
        const c = new OfflineAudioContext(1, Math.ceil(44100 * (d + 0.3)), 44100);
        window.SamraSfx.render(id, c);
        const buf = await c.startRendering();
        const x = buf.getChannelData(0);
        let peak = 0, sum = 0, bad = 0;
        for (let i = 0; i < x.length; i++) { const v = x[i]; if (!isFinite(v)) bad++; else { peak = Math.max(peak, Math.abs(v)); sum += v * v; } }
        out.push({ id, peak, rms: Math.sqrt(sum / x.length), bad });
      }
      return out;
    });
    const quiet = res.filter(r => r.peak < 0.05 || r.bad);
    ok(!quiet.length, `${res.length} صوت كلها تطلع صوت واضح ` + (quiet.length ? JSON.stringify(quiet) : ''));
    console.log('  ' + res.map(r => `${r.id}:${r.peak.toFixed(2)}/${r.rms.toFixed(3)}`).join(' '));
    await ctx.close();
  }

  // من فينا: ٣ لاعبين بأسماء فيها أكواد، ونلعب للنهاية
  {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective)); });
    await p.goto(url);
    await p.click('[data-mode=who]');
    await p.click('[data-act=start]');
    for (let i = 0; i < 3; i++) {
      await p.click('[data-act=who-add]');
      await p.fill("#who-name", `${i}<svg/onload=__xss=1>`);
      for (let k = 0; k < 5; k++) await p.fill('#who-a' + k, `<script>window.__xss=1</script>${k}`);
      await p.click('[data-act=who-save]');
    }
    const n = await p.$$eval('.players li', l => l.length);
    ok(n === 3, 'من فينا: ٣ لاعبين انحفظوا');
    await p.click('[data-act=who-start]');
    ok(!!(await p.$('.clue')), 'من فينا: البطاقة الأولى طلعت');
    let guard = 0;
    while (!(await p.$('.podium')) && guard++ < 60) {
      const btn = (await p.$('[data-act=correct]')) || (await p.$('[data-act=next]'));
      await btn.click();
    }
    ok(!!(await p.$('.podium')), 'من فينا: السهرة توصل للنهاية');
    await p.reload();
    ok(!errs.length && !(await p.evaluate(() => window.__xss)) && !(await p.evaluate(() => window.__csp.length)), 'من فينا: بدون أخطاء ولا تنفيذ أكواد ' + errs.join(' '));
    await ctx.close();
  }

  // اسمعها: تبدأ ويشتغل زر الصوت
  {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(url);
    await p.click('[data-mode=sound]');
    await p.click('[data-act=start]');
    await p.click('[data-act=play]');
    await p.click('[data-act=wrong]');
    await p.click('[data-act=play]');
    ok(!!(await p.$('.clue.sound')) && (await p.$$('.clue:not(.locked)')).length === 2 && !errs.length, 'اسمعها: الصوت يشتغل والتلميحات تنكشف ' + errs.join(' '));
    await ctx.close();
  }

  // سهرة محفوظة خربانة أو متلاعب فيها
  const bad = ['{', 'null', '{"v":1}',
    JSON.stringify({ v: 1, teams: [{ name: 'a', score: 0 }], deck: ['x'] }),
    JSON.stringify({ v: 1, teams: [{ name: 'a', score: 0 }, { name: 'b', score: -5 }], deck: ['kabsa'], index: 0, revealed: 1, turn: 0, starter: 0, phase: 'clue', history: [] }),
    JSON.stringify({ v: 1, teams: [{ name: 'a', score: 0 }, { name: 'b', score: 0 }], deck: ['kabsa', 'nope'], index: 0, revealed: 9, turn: 5, starter: 0, phase: 'boom', history: [] }),
    JSON.stringify({ v: 1, mode: 'sound', teams: [{ name: 'a', score: 0 }, { name: 'b', score: 0 }], deck: ['kabsa'], index: 0, revealed: 1, turn: 0, starter: 0, phase: 'clue', history: [] }),
    JSON.stringify({ v: 1, mode: 'who', players: [{ name: 'x', clues: [1] }], teams: [{ name: 'a', score: 0 }, { name: 'b', score: 0 }], deck: ['p0'], index: 0, revealed: 1, turn: 0, starter: 0, phase: 'clue', history: [] }),
    JSON.stringify({ v: 1, mode: 'who', players: [], teams: [{ name: 'a', score: 0 }, { name: 'b', score: 0 }], deck: ['p9'], index: 0, revealed: 1, turn: 0, starter: 0, phase: 'clue', history: [] })];
  for (const v of bad) {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(url);
    await p.evaluate(x => localStorage.setItem('samra.game.v1', x), v);
    await p.reload();
    const home = await p.$('[data-act=new]');
    ok(!!home && !errs.length, `حفظ خربان (${v.slice(0, 24)}…) يرجع للرئيسية بدون خطأ`);
    await ctx.close();
  }

  // بدون إنترنت بعد أول زيارة
  {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    await p.goto(url);
    await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 8000 }).catch(() => {});
    await p.reload();
    await p.waitForTimeout(500);
    await ctx.setOffline(true);
    await p.reload();
    ok(!!(await p.$('[data-act=new]')), 'تشتغل بدون إنترنت بعد أول فتح');
    await p.click('[data-act=new]');
    await p.click('[data-act=start]');
    ok(!!(await p.$('.clue')), 'تقدر تبدأ سهرة وأنت أوفلاين');
    await ctx.close();
  }

  // سرعة الفتح وما فيه طلبات خارجية
  {
    const ctx = await b.newContext();
    const p = await ctx.newPage();
    let bytes = 0;
    p.on('response', async r => { try { bytes += (await r.body()).length; } catch (e) { /* ignore */ } });
    const t0 = Date.now();
    await p.goto(url, { waitUntil: 'load' });
    const ms = Date.now() - t0;
    await p.waitForTimeout(300);
    ok(ms < 2000, `الفتح خلال ${ms} ملي ثانية`);
    console.log(`  الحجم المحمّل: ${(bytes / 1024).toFixed(0)} كيلوبايت`);
    const ext = await p.evaluate(() => performance.getEntriesByType('resource').filter(e => !e.name.startsWith(location.origin)).map(e => e.name));
    ok(!ext.length, 'ما فيه أي طلب لموقع خارجي ' + (ext.length ? JSON.stringify(ext) : ''));
    await ctx.close();
  }

  await b.close();
  server.close();
  console.log(fails ? `\n${fails} فحص فشل` : '\nكل الفحوصات نجحت');
  process.exit(fails ? 1 : 0);
})();
