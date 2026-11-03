// オフラインでも読めるように、本の中身(1ファイル)とアイコンを端末に保存しておく。
// 本を更新したら CACHE_NAME の番号を上げる(上げないと古い版が配られ続ける)。
const CACHE_NAME = "shinsho-keiei2-v1";
const scope = self.registration.scope;
const FILES = ["", "index.html", "manifest.json", "icon-180.png", "icon-192.png", "icon-512.png"].map(f => new URL(f, scope).href);

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // 同期の通信はキャッシュしない
  // 本文はネット優先(新しい版があれば取る)、つながらなければ保存した版
  e.respondWith(
    fetch(e.request.url, { cache: "no-cache" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match(new URL("index.html", scope).href)))
  );
});
