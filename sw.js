// ぷにっかー用 簡易Service Worker
// HTML本体(index.html)は「ネットワーク優先」：オンラインなら常に最新版を取りに行き、
// オフラインの時だけキャッシュにフォールバックする。これで見た目/UIの修正がすぐ反映される。
// 画像や音声などの静的アセットは今まで通り「stale-while-revalidate」：
// キャッシュを即返しつつ裏で更新するので、通信が遅くても表示は速いまま。

const CACHE_NAME = 'punicker-cache-v2';

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

  // HTMLドキュメント本体（画面遷移・アプリ起動時のリクエスト）はネットワーク優先
  const isDocument = req.mode === 'navigate' || req.destination === 'document';
  if (isDocument) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(req)))
    );
    return;
  }

  // それ以外の静的アセット(画像・音声など)は従来通りstale-while-revalidate
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