// オフラインでも読めるように、本の中身(1ファイル)とアイコンを端末に保存しておく。
// 本を更新したら CACHE_NAME の番号を上げる(上げないと古い版が配られ続ける)。
// 音声(audio/*.mp3)は別の入れ物 AUDIO_CACHE に入れ、版を上げても消さない(URL の ?v= で中身の違いを見分ける)。
const CACHE_NAME = "shinsho-keiei2-v5";
const AUDIO_CACHE = "shinsho-audio";
const scope = self.registration.scope;
const FILES = ["", "index.html", "manifest.json", "icon-180.png", "icon-192.png", "icon-512.png"].map(f => new URL(f, scope).href);

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME && k !== AUDIO_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// 音声:保存してあればそれを使い、なければ取ってきて保存する。
// iPhone の再生は「途中から(Range)」で取りに来るので、保存した全体から必要な部分を切り出して 206 で返す
async function audioResponse(req) {
  const cache = await caches.open(AUDIO_CACHE);
  let res = await cache.match(req.url);
  if (!res) {
    res = await fetch(req.url);
    if (!res.ok) return res;
    await cache.put(req.url, res.clone());
  }
  const range = req.headers.get("range");
  if (!range) return res;
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const size = buf.byteLength;
  let start = m[1] ? +m[1] : 0, end = m[2] ? +m[2] : size - 1;
  if (!m[1] && m[2]) { start = size - +m[2]; end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: { "Content-Type": "audio/mpeg", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" }
  });
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // 同期の通信はキャッシュしない
  if (url.pathname.includes("/audio/")) { e.respondWith(audioResponse(e.request)); return; }
  // 本文はネット優先(新しい版があれば取る)、つながらなければ保存した版
  e.respondWith(
    fetch(e.request.url, { cache: "no-cache" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match(new URL("index.html", scope).href)))
  );
});
