// オフライン対応：一度開いたしおりを電波がなくても表示する
const CACHE = 'shiori-offline-v1';
const CORE = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

// 電波があれば最新を取得して保存、なければ保存分を返す
async function networkFirst(req, key, ms) {
  const cache = await caches.open(CACHE);
  try {
    const res = await Promise.race([fetch(req), timeout(ms)]);
    if (res && (res.ok || res.type === 'opaque')) cache.put(key || req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key || req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
// フォントなど変わらないもの：保存分を優先し、裏で更新
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') { e.respondWith(networkFirst(req, './index.html', 5000)); return; }
    e.respondWith(networkFirst(req, null, 5000)); return;
  }
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') { e.respondWith(cacheFirst(req)); return; }
  if (url.host === 'api.open-meteo.com') { e.respondWith(networkFirst(req, null, 6000)); return; }
});
