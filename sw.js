// ぷにっかー用 簡易Service Worker
// HTML本体(index.html)は「ネットワーク優先」：オンラインなら常に最新版を取りに行き、
// オフラインの時だけキャッシュにフォールバックする。これで見た目/UIの修正がすぐ反映される。
// 画像や音声などの静的アセットは今まで通り「stale-while-revalidate」：
// キャッシュを即返しつつ裏で更新するので、通信が遅くても表示は速いまま。

const CACHE_NAME = 'punicker-cache-v18';

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

  // 音声ファイルはService Workerで一切キャッシュしない。
  // <audio>要素はRangeリクエスト（バイト範囲指定）を発行することがあり、
  // それをそのままCache Storageに保存してしまうと、後で別の範囲リクエストに対して
  // 誤ったキャッシュ（206 Partial Content等）を返してしまい、再生が失敗する原因になっていた。
  // 音声はブラウザ標準のHTTPキャッシュに任せ、SWは素通りさせる。
  const isAudio = req.destination === 'audio' || /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(url.pathname);
  if (isAudio) return;

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

  // それ以外の静的アセット(画像など)は従来通りstale-while-revalidate
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