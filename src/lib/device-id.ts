/** A random id for this browser, sent with every API call (X-Haru-Device). The server keeps only a
 * keyed hash of it, to give the free trial of Haru Nói once per browser rather than once per new
 * account. It says nothing about the person: it is made here, at random, and lives in this
 * browser's storage. Where storage is blocked it lasts until the tab is closed. */
const KEY = "haru.device";
let memo: string | null = null;

function fresh(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID().replace(/-/g, "");
  let out = "";
  for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

export function deviceId(): string | null {
  if (typeof window === "undefined") return null;
  if (memo) return memo;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) {
      memo = saved;
      return memo;
    }
  } catch {
    /* storage blocked: keep one for this tab */
  }
  memo = fresh();
  try {
    window.localStorage.setItem(KEY, memo);
  } catch {
    /* storage blocked */
  }
  return memo;
}
