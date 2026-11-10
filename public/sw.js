const CACHE = "haru-shell-v2";

const OFFLINE_PAGE =
  '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  "<title>Haru — chưa có kết nối</title>" +
  '<body style="font-family:system-ui,sans-serif;background:#FFF9EF;color:#222;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center">' +
  '<main style="padding:24px"><h1 style="font-size:22px;margin:0 0 8px">Chưa có kết nối mạng</h1>' +
  '<p style="margin:0 0 16px">Haru cần mạng để mở trang này. Kiểm tra kết nối rồi thử lại nhé.</p>' +
  '<button onclick="location.reload()" style="font:inherit;padding:10px 20px;border-radius:12px;border:0;background:#222;color:#fff">Thử lại</button></main></body></html>';

self.addEventListener("install", (event) =>
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/today", "/manifest.webmanifest"])),
  ),
);

self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

/** What to answer when the network fails: a copy kept in the cache, else — and ALWAYS something
 * that is a Response, because `respondWith(undefined)` throws "Failed to convert value to
 * 'Response'" and turns a plain network blip into a broken page. A page is never answered with
 * another page's copy (that would hydrate the wrong screen), only with the offline notice. */
async function offlineAnswer(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  if (request.mode === "navigate") {
    return new Response(OFFLINE_PAGE, {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Only this site's own files. The API (another origin), fonts and anything else cross-origin go
  // straight to the browser: this worker has nothing useful to say about them, and answering
  // them from here only adds a way to fail.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/api/")) return;
  // Music files and every Range request go straight to the network: an <audio> element asks for byte
  // ranges (Safari refuses to play when it gets a whole 200 response instead of 206), and a 15-minute
  // track must not be copied into the shell cache.
  if (url.pathname.startsWith("/music/") || request.headers.has("range")) return;
  event.respondWith(fetch(request).catch(() => offlineAnswer(request)));
});
