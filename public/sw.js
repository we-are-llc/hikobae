// ひこばえ Service Worker
// 目的：一度オンラインで開いたあと、オフラインでも起動・利用できるようにする。
//
// 方針：
//  - HTML（ナビゲーション）はネットワーク優先。オンライン時は常に最新を取得し、
//    オフライン時のみキャッシュにフォールバック（新しいデプロイの取りこぼしを防ぐ）。
//  - それ以外（ハッシュ付きの JS/CSS/画像など）はキャッシュ優先。
//    ファイル名にハッシュが付くため、内容が変われば URL が変わり、古い版を掴まない。
//
// BUILD_ID と PRECACHE は本番ビルド時に scripts/inject-sw.mjs が実際の値へ置換する。
// （開発時は既定値のまま。ハッシュ付きアセット一覧を注入することで、
//   初回オンライン閲覧の直後からオフライン起動できるようにする）
const BUILD_ID = 'dev';
const PRECACHE = [];

const CACHE = 'hikobae-' + BUILD_ID;

// 起動に必要な静的ファイル。HTML・アイコン等の固定パスに、
// ビルドで注入されるハッシュ付きアセット（JS/CSS 等）を加える。
const CORE = [
  '/',
  '/index.html',
  '/lp.html',
  '/manual.html',
  '/writing-difficulty.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
].concat(PRECACHE);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // 個別に取得し、一部が失敗しても install 全体を止めない
      .then((cache) => Promise.allSettled(
        CORE.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外部リクエストは介入しない

  const isHTML =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // ネットワーク優先（更新を確実に反映）、失敗時にキャッシュ or index.html
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('/index.html')))
    );
    return;
  }

  // キャッシュ優先、なければ取得してキャッシュ
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
