// ぷにっかー用 簡易Service Worker
// 「stale-while-revalidate」方式：一度読み込んだファイルはキャッシュから即返しつつ、
// 裏で最新版を取得してキャッシュを更新する。これによりオフラインでも起動でき、
// 通信環境が悪いスマホでも表示が速くなる。

const CACHE_NAME = 'punicker-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // 別オリジン(GAタグ等)はそのままネットワークに任せる
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
