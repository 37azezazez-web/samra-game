/* تشغيل بدون إنترنت. غيّر رقم CACHE مع كل تحديث للملفات. */
var CACHE = 'samra-v8';
var FILES = ['./', 'index.html', 'css/style.css', 'css/fonts.css', 'js/app.js', 'js/engine.js', 'js/cards.js', 'js/sounds.js', 'js/who.js', 'js/sfx.js',
  'manifest.webmanifest', 'assets/img/symbol.svg', 'assets/img/lockup-stacked-light.svg', 'assets/img/icon-192.png',
  'assets/fonts/Almarai-400-arabic.woff2', 'assets/fonts/Almarai-700-arabic.woff2', 'assets/fonts/Almarai-800-arabic.woff2',
  'assets/fonts/ReemKufi-700-arabic.woff2'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok && r.type === 'basic') { var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
    return r;
  }).catch(function () { return caches.match(e.request); }));
});
