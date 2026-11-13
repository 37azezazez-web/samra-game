/* أصوات «اسمعها»: كل صوت مصنوع بالكود (Web Audio)، بدون أي ملف صوتي أو تسجيل لأحد.
   SamraSfx.play(id) يشغل الصوت، SamraSfx.stop() يوقفه، SamraSfx.render(id, ctx) للفحص. */
(function (root) {
  'use strict';
  var ctx = null, current = null, noiseBuf = null;

  function ac() {
    if (!ctx) {
      var C = root.AudioContext || root.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () { });
    return ctx;
  }

  function noiseOf(c) {
    if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
    var len = Math.floor(c.sampleRate * 2), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b;
    return b;
  }

  /* أدوات البناء: tone (نغمة) و noise (تشويش مفلتر). كل وحدة تاخذ:
     t بداية، d مدة، g قوة، a صعود، hold يثبت القوة بدل ما تخفت، r نزول آخر شي،
     am [سرعة، عمق] تذبذب بالقوة، vib [سرعة، عمق] تذبذب بالنغمة، path [[وقت، قيمة]] مسار للنغمة/الفلتر */
  function kit(c, out, t0) {
    var nb = noiseOf(c);
    function env(g, o) {
      var a = o.a || 0.005, d = o.d, peak = o.g == null ? 0.5 : o.g, s = t0 + (o.t || 0);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(peak, s + a);
      if (o.hold) {
        var r = o.r || 0.04;
        g.gain.setValueAtTime(peak, s + Math.max(a, d - r));
        g.gain.linearRampToValueAtTime(0.0001, s + d);
      } else {
        g.gain.exponentialRampToValueAtTime(0.0001, s + d);
      }
      return s;
    }
    function lfo(param, rate, depth, s, e) {
      var o = c.createOscillator(), g = c.createGain();
      o.frequency.value = rate; g.gain.value = depth;
      o.connect(g); g.connect(param); o.start(s); o.stop(e + 0.05);
    }
    function amp(node, am, s, e) {
      if (!am) return node;
      var g = c.createGain(); g.gain.value = 1 - am[1] / 2;
      lfo(g.gain, am[0], am[1] / 2, s, e);
      node.connect(g);
      return g;
    }
    function freq(param, o, s) {
      param.setValueAtTime(o.f, s);
      if (o.f2) param.exponentialRampToValueAtTime(o.f2, s + (o.fd || o.d));
      if (o.path) o.path.forEach(function (p) { param.linearRampToValueAtTime(p[1], s + p[0]); });
    }
    function tone(o) {
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine';
      var s = env(g, o);
      freq(osc.frequency, o, s);
      if (o.vib) lfo(osc.frequency, o.vib[0], o.vib[1], s, s + o.d);
      var node = osc;
      if (o.lp) { var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 0.7; osc.connect(f); node = f; }
      node = amp(node, o.am, s, s + o.d);
      node.connect(g); g.connect(out);
      osc.start(s); osc.stop(s + o.d + 0.05);
    }
    function noise(o) {
      var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = nb; src.loop = true;
      f.type = o.ft || 'lowpass'; f.Q.value = o.q || 0.7;
      var s = env(g, o);
      freq(f.frequency, o, s);
      src.connect(f);
      var node = amp(f, o.am, s, s + o.d);
      node.connect(g); g.connect(out);
      src.start(s, Math.random() * 1.5); src.stop(s + o.d + 0.05);
    }
    function many(n, from, to, fn) { for (var i = 0; i < n; i++) fn(from + Math.random() * (to - from), i); }
    return { tone: tone, noise: noise, many: many, r: Math.random };
  }

  /* الأصوات. dur = مدة الصوت بالثواني */
  var S = {
    rain: [4, function (k) {
      k.noise({ ft: 'bandpass', f: 2800, q: 0.4, d: 4, g: 0.35, a: 0.4, hold: true, r: 0.6 });
      k.noise({ ft: 'lowpass', f: 400, d: 4, g: 0.15, a: 0.4, hold: true, r: 0.6 });
      k.many(70, 0.1, 3.6, function (t) { k.tone({ t: t, f: 2500 + k.r() * 3000, f2: 900, d: 0.04, g: 0.06 + k.r() * 0.08 }); });
    }],
    thunder: [4, function (k) {
      k.noise({ ft: 'lowpass', f: 4000, f2: 600, fd: 0.3, d: 0.5, g: 0.6 });
      k.noise({ t: 0.1, ft: 'lowpass', f: 900, f2: 70, fd: 3.5, d: 3.8, g: 1, a: 0.08, am: [6, 0.6] });
      k.noise({ t: 0.6, ft: 'lowpass', f: 300, d: 3, g: 0.6, a: 0.3, am: [3, 0.5] });
    }],
    heartbeat: [3.8, function (k) {
      for (var i = 0; i < 4; i++) {
        var t = i * 0.9;
        k.tone({ t: t, f: 70, f2: 38, d: 0.18, g: 1 });
        k.noise({ t: t, ft: 'lowpass', f: 160, d: 0.12, g: 0.5 });
        k.tone({ t: t + 0.26, f: 62, f2: 36, d: 0.16, g: 0.75 });
      }
    }],
    clock: [4, function (k) {
      for (var i = 0; i < 8; i++) k.noise({ t: i * 0.5, ft: 'bandpass', f: i % 2 ? 2200 : 3000, q: 6, d: 0.04, g: 0.9 });
    }],
    doorbell: [3, function (k) {
      k.tone({ type: 'triangle', f: 659, d: 1.4, g: 0.55 }); k.tone({ f: 1318, d: 0.8, g: 0.12 });
      k.tone({ t: 0.65, type: 'triangle', f: 523, d: 2.2, g: 0.55 }); k.tone({ t: 0.65, f: 1046, d: 1, g: 0.12 });
    }],
    knock: [2.6, function (k) {
      [0, 0.2, 0.4, 1.3, 1.5].forEach(function (t) {
        k.noise({ t: t, ft: 'lowpass', f: 450, d: 0.09, g: 1 });
        k.tone({ t: t, f: 130, f2: 80, d: 0.09, g: 0.9 });
      });
    }],
    whistle: [2.2, function (k) {
      [[0, 0.22], [0.36, 0.22], [0.75, 1.1]].forEach(function (x) {
        k.tone({ t: x[0], f: 2900, d: x[1], g: 0.32, hold: true, vib: [32, 180] });
        k.noise({ t: x[0], ft: 'bandpass', f: 2900, q: 3, d: x[1], g: 0.15, hold: true });
      });
    }],
    microwave: [2.6, function (k) {
      for (var i = 0; i < 3; i++) k.tone({ t: i * 0.8, f: 1950, d: 0.5, g: 0.28, hold: true });
    }],
    schoolbell: [3.2, function (k) {
      k.tone({ type: 'triangle', f: 2100, d: 3, g: 0.35, hold: true, r: 0.3, am: [22, 1] });
      k.tone({ type: 'triangle', f: 2950, d: 3, g: 0.2, hold: true, r: 0.3, am: [22, 1] });
      k.noise({ ft: 'bandpass', f: 3500, q: 2, d: 3, g: 0.15, hold: true, r: 0.3, am: [22, 1] });
    }],
    oldphone: [3.6, function (k) {
      [0, 1.9].forEach(function (t) {
        k.tone({ t: t, type: 'triangle', f: 1250, d: 1.2, g: 0.3, hold: true, am: [17, 1] });
        k.tone({ t: t, type: 'triangle', f: 1650, d: 1.2, g: 0.22, hold: true, am: [17, 1] });
      });
    }],
    carhorn: [1.6, function (k) {
      [[0, 0.3], [0.45, 0.9]].forEach(function (x) {
        k.tone({ t: x[0], type: 'sawtooth', f: 415, lp: 1800, d: x[1], g: 0.3, hold: true });
        k.tone({ t: x[0], type: 'sawtooth', f: 495, lp: 1800, d: x[1], g: 0.3, hold: true });
      });
    }],
    siren: [4.2, function (k) {
      k.tone({ type: 'sawtooth', lp: 2500, f: 650, d: 4, g: 0.22, hold: true, r: 0.4,
        path: [[1.0, 1450], [2.0, 650], [3.0, 1450], [4.0, 650]] });
    }],
    alarmclock: [3.2, function (k) {
      for (var b = 0; b < 5; b++) for (var i = 0; i < 4; i++) k.tone({ t: b * 0.62 + i * 0.1, type: 'square', lp: 5000, f: 2800, d: 0.06, g: 0.14, hold: true, r: 0.01 });
    }],
    waves: [5, function (k) {
      [0, 2.4].forEach(function (t) {
        k.noise({ t: t, ft: 'lowpass', f: 350, path: [[1.1, 2600], [2.5, 400]], d: 2.6, g: 0.7, a: 1.1 });
      });
    }],
    wind: [4.5, function (k) {
      k.noise({ ft: 'bandpass', q: 4, f: 350, path: [[1.2, 900], [2.2, 500], [3.4, 1200], [4.4, 400]], d: 4.4, g: 0.9, a: 1, hold: true, r: 1 });
      k.noise({ ft: 'lowpass', f: 250, d: 4.4, g: 0.25, a: 1, hold: true, r: 1 });
    }],
    fire: [4, function (k) {
      k.noise({ ft: 'lowpass', f: 500, d: 4, g: 0.3, a: 0.3, hold: true, r: 0.5 });
      k.many(70, 0, 3.8, function (t) { k.noise({ t: t, ft: 'highpass', f: 1500 + k.r() * 2500, d: 0.01 + k.r() * 0.03, g: 0.2 + k.r() * 0.6 }); });
    }],
    kettle: [4.4, function (k) {
      k.noise({ ft: 'bandpass', f: 900, path: [[1.5, 2000]], q: 1, d: 4.3, g: 0.35, a: 1.4, hold: true });
      k.tone({ t: 1.2, f: 1500, path: [[1.5, 2300], [3, 2350]], d: 3, g: 0.3, a: 0.6, hold: true, r: 0.2, vib: [7, 25] });
    }],
    mosquito: [3.6, function (k) {
      k.tone({ type: 'sawtooth', lp: 3000, f: 620, path: [[1.2, 700], [2.4, 580], [3.4, 660]], vib: [9, 35], d: 3.5, g: 0.18, a: 0.6, hold: true, r: 0.8, am: [0.6, 0.8] });
    }],
    crickets: [3.6, function (k) {
      for (var c = 0; c < 7; c++) for (var p = 0; p < 3; p++) k.tone({ t: c * 0.5 + p * 0.045, f: 4500, d: 0.03, g: 0.25, hold: true, r: 0.01 });
    }],
    owl: [3, function (k) {
      [[0, 0.55], [0.95, 0.22], [1.25, 0.22], [1.6, 0.85]].forEach(function (x) {
        k.tone({ t: x[0], f: 390, f2: 345, d: x[1], g: 0.5, a: 0.07, hold: true, r: 0.12 });
        k.noise({ t: x[0], ft: 'bandpass', f: 400, q: 2, d: x[1], g: 0.06, a: 0.07, hold: true, r: 0.12 });
      });
    }],
    cuckoo: [3, function (k) {
      [0, 1, 2].forEach(function (t) {
        k.tone({ t: t, type: 'triangle', f: 784, d: 0.32, g: 0.45, a: 0.02, hold: true, r: 0.08 });
        k.tone({ t: t + 0.36, type: 'triangle', f: 622, d: 0.42, g: 0.45, a: 0.02, hold: true, r: 0.12 });
      });
    }],
    horse: [3.4, function (k) {
      for (var b = 0; b < 7; b++) [0, 0.09, 0.2].forEach(function (o) {
        var t = b * 0.45 + o;
        k.noise({ t: t, ft: 'bandpass', f: 1400, q: 2, d: 0.05, g: 0.8 });
        k.tone({ t: t, f: 520, f2: 280, d: 0.06, g: 0.5 });
      });
    }],
    ball: [3.2, function (k) {
      var t = 0, gap = 0.6, g = 0.9;
      for (var i = 0; i < 12 && t < 3; i++) {
        k.tone({ t: t, f: 190, f2: 90, d: 0.09, g: g });
        k.noise({ t: t, ft: 'lowpass', f: 1200, d: 0.04, g: g * 0.5 });
        t += gap; gap *= 0.75; g *= 0.85;
      }
    }],
    footsteps: [3.4, function (k) {
      for (var i = 0; i < 7; i++) {
        k.noise({ t: i * 0.48, ft: 'lowpass', f: 700, d: 0.12, g: 0.8 });
        k.noise({ t: i * 0.48 + 0.02, ft: 'highpass', f: 3500, d: 0.05, g: 0.12 });
      }
    }],
    typewriter: [3.8, function (k) {
      var t = 0;
      for (var i = 0; i < 16; i++) { k.noise({ t: t, ft: 'bandpass', f: 2500, q: 1.2, d: 0.035, g: 0.8 }); t += 0.08 + k.r() * 0.13; }
      k.tone({ t: t + 0.1, f: 2637, d: 1.2, g: 0.3 });
      k.noise({ t: t + 0.4, ft: 'bandpass', f: 800, path: [[0.5, 1600]], q: 2, d: 0.55, g: 0.3, hold: true, r: 0.1 });
    }],
    cashier: [3, function (k) {
      [0, 0.9, 1.6, 2.3].forEach(function (t) { k.tone({ t: t, f: 2650, d: 0.12, g: 0.3, hold: true, r: 0.01 }); });
    }],
    drip: [3.4, function (k) {
      [0, 0.7, 1.4, 2.1, 2.8].forEach(function (t) { k.tone({ t: t, f: 700, f2: 1700, fd: 0.05, d: 0.09, g: 0.6 }); });
    }],
    bubbles: [3.2, function (k) {
      k.many(28, 0, 3, function (t) { var f = 300 + k.r() * 700; k.tone({ t: t, f: f, f2: f * 2.2, d: 0.05 + k.r() * 0.06, g: 0.25 }); });
    }],
    fireworks: [4.2, function (k) {
      k.tone({ f: 900, f2: 3200, d: 1.05, g: 0.12, hold: true, r: 0.1 });
      k.noise({ ft: 'highpass', f: 3000, d: 1.05, g: 0.1, a: 0.3, hold: true, r: 0.1 });
      k.noise({ t: 1.1, ft: 'lowpass', f: 2000, f2: 90, fd: 1.5, d: 1.8, g: 1 });
      k.many(45, 1.4, 3.6, function (t) { k.noise({ t: t, ft: 'highpass', f: 3000, d: 0.02, g: 0.15 + k.r() * 0.35 }); });
    }],
    helicopter: [4, function (k) {
      k.noise({ ft: 'lowpass', f: 380, d: 4, g: 1, a: 0.8, hold: true, r: 0.8, am: [13, 1] });
      k.tone({ type: 'sawtooth', lp: 400, f: 95, d: 4, g: 0.12, a: 0.8, hold: true, r: 0.8 });
    }],
    train: [4.2, function (k) {
      var t = 0, gap = 0.26;
      for (var i = 0; i < 14; i++) { k.noise({ t: t, ft: 'bandpass', f: i % 2 ? 900 : 650, q: 1.5, d: 0.14, g: 0.55 }); t += gap; gap = Math.max(0.16, gap * 0.96); }
      k.tone({ t: 2.3, type: 'sawtooth', lp: 1400, f: 311, d: 1.6, g: 0.22, a: 0.05, hold: true, r: 0.2 });
      k.tone({ t: 2.3, type: 'sawtooth', lp: 1400, f: 370, d: 1.6, g: 0.22, a: 0.05, hold: true, r: 0.2 });
    }],
    darbuka: [3, function (k) {
      var D = function (t) { k.tone({ t: t, f: 95, f2: 70, d: 0.35, g: 1 }); k.noise({ t: t, ft: 'lowpass', f: 300, d: 0.1, g: 0.4 }); };
      var T = function (t) { k.noise({ t: t, ft: 'highpass', f: 2000, d: 0.06, g: 0.7 }); k.tone({ t: t, type: 'triangle', f: 820, d: 0.05, g: 0.3 }); };
      var u = 0.17;
      [0, 1.36].forEach(function (b) { D(b); T(b + u); T(b + u * 3); D(b + u * 4); T(b + u * 6); });
    }],
    camera: [1.4, function (k) {
      k.noise({ ft: 'bandpass', f: 3200, q: 1, d: 0.03, g: 1 });
      k.noise({ t: 0.09, ft: 'bandpass', f: 2200, q: 1, d: 0.04, g: 0.8 });
      k.tone({ t: 0.25, type: 'sawtooth', lp: 900, f: 190, f2: 320, d: 0.5, g: 0.08, hold: true, r: 0.05 });
    }],
    coins: [2.6, function (k) {
      k.many(11, 0, 1.4, function (t) {
        var f = 3000 + k.r() * 3200;
        k.tone({ t: t, f: f, d: 0.35, g: 0.18 }); k.tone({ t: t, f: f * 1.48, d: 0.2, g: 0.08 });
        k.noise({ t: t, ft: 'highpass', f: 4000, d: 0.015, g: 0.3 });
      });
    }],
    glass: [2.6, function (k) {
      [0, 0.8].forEach(function (t) {
        [[3150, 0.3], [4720, 0.15], [6180, 0.1]].forEach(function (p) { k.tone({ t: t, f: p[0], d: 1.6, g: p[1] }); });
        k.noise({ t: t, ft: 'highpass', f: 5000, d: 0.02, g: 0.3 });
      });
    }],
    snore: [5, function (k) {
      [0, 2.5].forEach(function (t) {
        k.noise({ t: t, ft: 'lowpass', f: 260, d: 1.4, g: 1, a: 0.6, hold: true, r: 0.3, am: [32, 1] });
        k.tone({ t: t, type: 'sawtooth', lp: 300, f: 32, d: 1.4, g: 0.25, a: 0.6, hold: true, r: 0.3 });
        k.noise({ t: t + 1.5, ft: 'bandpass', f: 900, q: 1, d: 0.9, g: 0.18, a: 0.15, hold: true, r: 0.4 });
      });
    }],
    arcade: [2, function (k) {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, i) { k.tone({ t: i * 0.08, type: 'square', lp: 6000, f: f, d: 0.07, g: 0.12, hold: true, r: 0.01 }); });
      k.tone({ t: 0.6, type: 'square', lp: 6000, f: 1568, d: 0.45, g: 0.12, hold: true, r: 0.1, vib: [12, 25] });
    }],
    vibrate: [3, function (k) {
      [[0, 0.4], [0.55, 0.4], [1.75, 0.4], [2.3, 0.4]].forEach(function (x) {
        k.tone({ t: x[0], type: 'sawtooth', lp: 500, f: 165, d: x[1], g: 0.5, hold: true, r: 0.03 });
        k.noise({ t: x[0], ft: 'lowpass', f: 350, d: x[1], g: 0.3, hold: true, r: 0.03, am: [165, 1] });
      });
    }],
    countdown: [4, function (k) {
      [0, 1, 2].forEach(function (t) { k.tone({ t: t, f: 880, d: 0.22, g: 0.35, hold: true, r: 0.02 }); });
      k.tone({ t: 3, f: 1760, d: 0.8, g: 0.35, hold: true, r: 0.1 });
    }],
    balloon: [2.6, function (k) {
      [0, 0.6, 1.2].forEach(function (t) { k.noise({ t: t, ft: 'bandpass', f: 500 + t * 300, q: 1.5, d: 0.45, g: 0.35, a: 0.15, hold: true, r: 0.1 }); });
      k.noise({ t: 1.9, ft: 'lowpass', f: 7000, f2: 400, fd: 0.2, d: 0.25, g: 1 });
    }],
    frog: [3.3, function (k) {
      [0, 0.32, 1.2, 1.52, 2.4, 2.72].forEach(function (t) {
        k.tone({ t: t, type: 'sawtooth', lp: 750, q: 6, f: 150, f2: 120, d: 0.22, g: 0.6, a: 0.02, hold: true, r: 0.05, am: [38, 1] });
      });
    }],
    woodpecker: [2.8, function (k) {
      [0, 1.5].forEach(function (b) {
        for (var i = 0; i < 14; i++) { k.noise({ t: b + i * 0.055, ft: 'bandpass', f: 1300, q: 3, d: 0.025, g: 0.9 }); k.tone({ t: b + i * 0.055, f: 700, d: 0.03, g: 0.25 }); }
      });
    }],
    elevator: [3, function (k) {
      k.tone({ f: 1047, d: 2, g: 0.4 }); k.tone({ f: 2094, d: 1, g: 0.08 });
      k.noise({ t: 1, ft: 'lowpass', f: 300, d: 1.6, g: 0.35, a: 0.2, hold: true, r: 0.3 });
      k.noise({ t: 2.55, ft: 'lowpass', f: 600, d: 0.12, g: 0.5 });
    }],
    sonar: [4, function (k) {
      k.tone({ f: 1150, d: 2.2, g: 0.5, a: 0.01 });
      k.tone({ t: 1.6, f: 1150, d: 1.8, g: 0.12, a: 0.01 });
    }],
    laser: [2, function (k) {
      [0, 0.3, 0.55, 1.1].forEach(function (t) { k.tone({ t: t, type: 'square', lp: 5000, f: 1800, f2: 180, d: 0.2, g: 0.18 }); });
    }],
    carstart: [4, function (k) {
      k.noise({ ft: 'lowpass', f: 500, d: 1.2, g: 0.6, hold: true, r: 0.05, am: [7, 1] });
      k.tone({ type: 'sawtooth', lp: 400, f: 60, d: 1.2, g: 0.15, hold: true, r: 0.05, am: [7, 1] });
      k.tone({ t: 1.2, type: 'sawtooth', lp: 500, f: 45, path: [[0.5, 85], [1.3, 50]], d: 2.7, g: 0.6, a: 0.05, hold: true, r: 0.6, am: [28, 0.5] });
    }],
    ecg: [4, function (k) {
      for (var i = 0; i < 5; i++) k.tone({ t: i * 0.8, f: 1000, d: 0.13, g: 0.35, hold: true, r: 0.02 });
    }],
    applause: [4, function (k) {
      k.many(260, 0, 3.8, function (t) { k.noise({ t: t, ft: 'bandpass', f: 1000 + k.r() * 1500, q: 1, d: 0.02, g: 0.15 + k.r() * 0.3 }); });
    }],
    jet: [5, function (k) {
      k.noise({ ft: 'highpass', f: 600, path: [[2.5, 2200], [5, 500]], d: 5, g: 0.6, a: 2.3, hold: true, r: 2.3 });
      k.noise({ ft: 'lowpass', f: 200, d: 5, g: 0.5, a: 2.3, hold: true, r: 2.3 });
    }],
    pour: [3.6, function (k) {
      k.noise({ ft: 'bandpass', q: 3, f: 500, path: [[3.4, 1700]], d: 3.4, g: 0.6, a: 0.15, hold: true, r: 0.3 });
      k.many(30, 0.1, 3.2, function (t) { var f = 500 + t * 350; k.tone({ t: t, f: f, f2: f * 1.6, d: 0.04, g: 0.08 }); });
    }],
    najr: [3.4, function (k) {
      [0, 0.3, 0.45, 0.9, 1.2, 1.35, 1.8, 2.1, 2.25, 2.7].forEach(function (t, i) {
        var hi = i % 3 === 0 ? 1 : 0.75;
        [[1850, 0.3], [2930, 0.18], [4120, 0.1]].forEach(function (p) { k.tone({ t: t, f: p[0] * (i % 3 === 0 ? 1 : 1.06), d: 0.6, g: p[1] * hi }); });
        k.noise({ t: t, ft: 'highpass', f: 3000, d: 0.02, g: 0.3 });
      });
    }],
    soda: [2.6, function (k) {
      k.noise({ ft: 'bandpass', f: 1500, q: 2, d: 0.03, g: 0.9 });
      k.noise({ t: 0.03, ft: 'highpass', f: 3000, f2: 6000, fd: 0.2, d: 0.7, g: 0.6, a: 0.01 });
      k.many(60, 0.4, 2.5, function (t) { k.noise({ t: t, ft: 'highpass', f: 6000, d: 0.01, g: 0.1 + k.r() * 0.15 }); });
    }],
    match: [2.4, function (k) {
      k.noise({ ft: 'bandpass', f: 1800, path: [[0.25, 4000]], q: 1.5, d: 0.25, g: 0.7, hold: true, r: 0.05 });
      k.noise({ t: 0.22, ft: 'lowpass', f: 900, f2: 300, d: 1.2, g: 0.6, a: 0.05 });
      k.noise({ t: 0.5, ft: 'lowpass', f: 400, d: 1.6, g: 0.12, a: 0.2, hold: true, r: 0.5 });
    }],
    zipper: [2, function (k) {
      [[0, 0.7, 1500, 3500], [1.0, 0.5, 3500, 1500]].forEach(function (x) {
        var n = Math.floor(x[1] / 0.012);
        for (var i = 0; i < n; i++) k.noise({ t: x[0] + i * 0.012, ft: 'bandpass', q: 2, f: x[2] + (x[3] - x[2]) * i / n, d: 0.008, g: 0.5 });
      });
    }],
    vacuum: [4.2, function (k) {
      k.tone({ type: 'sawtooth', lp: 1500, f: 120, path: [[1, 240], [4, 245]], d: 4, g: 0.15, a: 0.5, hold: true, r: 0.6 });
      k.noise({ ft: 'bandpass', f: 600, path: [[1, 1800]], q: 0.8, d: 4, g: 0.6, a: 0.8, hold: true, r: 0.6 });
    }],
    ship: [4, function (k) {
      k.tone({ type: 'sawtooth', lp: 700, f: 98, d: 2.8, g: 0.45, a: 0.15, hold: true, r: 0.4 });
      k.tone({ type: 'sawtooth', lp: 700, f: 147, d: 2.8, g: 0.3, a: 0.15, hold: true, r: 0.4 });
      k.noise({ t: 2.8, ft: 'lowpass', f: 300, d: 1.2, g: 0.15 });
    }],
    laugh: [3, function (k) {
      [0, 0.22, 0.44, 0.66, 0.9, 1.6, 1.82, 2.04].forEach(function (t, i) {
        k.noise({ t: t, ft: 'bandpass', f: 1100 - i * 30, q: 3, d: 0.15, g: 0.45, a: 0.02 });
        k.tone({ t: t, type: 'sawtooth', lp: 1500, f: 230 - i * 6, d: 0.15, g: 0.12, a: 0.02 });
      });
    }]
  };

  function render(id, c) {
    var def = S[id]; if (!def || !c) return 0;
    var comp = c.createDynamicsCompressor(), master = c.createGain();
    master.gain.value = 0.85;
    master.connect(comp); comp.connect(c.destination);
    def[1](kit(c, master, c.currentTime + 0.05));
    return { dur: def[0], master: master };
  }

  function stop() {
    if (!current || !ctx) return;
    var m = current; current = null;
    try { m.gain.setTargetAtTime(0, ctx.currentTime, 0.03); setTimeout(function () { try { m.disconnect(); } catch (e) { } }, 300); } catch (e) { }
  }

  function play(id) {
    try {
      var c = ac(); if (!c) return 0;
      stop();
      var r = render(id, c);
      current = r.master;
      return r.dur;
    } catch (e) { return 0; }
  }

  var api = { play: play, stop: stop, render: render, ids: Object.keys(S), dur: function (id) { return S[id] ? S[id][0] : 0; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SamraSfx = api;
})(this);
