// Thin client for the `okf serve` local API. The pywebview shell opens the UI
// with ?base=<url>&token=<t>; in production okf serve hosts this UI itself, so
// base is same-origin. No okf-kit logic lives here — this only calls the API.

const params = new URLSearchParams(location.search);
const BASE = params.get("base") || ""; // same-origin when served by okf serve
const TOKEN = params.get("token") || "";

const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error?.message || msg; } catch { /* noop */ }
    throw new Error(`${res.status}: ${msg}`);
  }
  return res.status === 204 ? null : res.json();
}

// Parse an SSE stream, invoking onEvent(name, data) per event.
async function stream(path, opts, onEvent) {
  const res = await fetch(BASE + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const blocks = buf.split("\n\n");
    buf = blocks.pop(); // keep the incomplete tail
    for (const block of blocks) {
      let ev = null, data = null;
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) ev = line.slice(7);
        else if (line.startsWith("data: ")) data = JSON.parse(line.slice(6));
      }
      if (ev) onEvent(ev, data);
    }
  }
}

export const api = {
  status: () => req("/api/status"),
  health: () => req("/api/health"),

  registry: () => req("/api/registry"),
  books: () => req("/api/books"),
  book: (name) => req(`/api/books/${name}`),
  removeBook: (name) => req(`/api/books/${name}`, { method: "DELETE" }),
  install: (name, onEvent) => stream(`/api/books/${name}/install`, { method: "POST" }, onEvent),

  toc: (name) => req(`/api/books/${name}/toc`),
  concept: (name, id) => req(`/api/books/${name}/concept?id=${encodeURIComponent(id)}`),

  chats: (name) => req(`/api/books/${name}/chats`),
  newChat: (name) => req(`/api/books/${name}/chats`, { method: "POST" }),
  chat: (name, sid) => req(`/api/books/${name}/chats/${sid}`),
  delChat: (name, sid) => req(`/api/books/${name}/chats/${sid}`, { method: "DELETE" }),
  ask: (name, sid, question, onEvent) =>
    stream(`/api/books/${name}/chats/${sid}/ask`, { method: "POST", body: JSON.stringify({ question }) }, onEvent),

  settings: () => req("/api/settings"),
  saveSettings: (body) => req("/api/settings", { method: "PUT", body: JSON.stringify(body) }),
};

// Open a URL outside the app via the pywebview bridge (reliable — uses the OS
// browser). Returns true if it handled it; false means the caller should let a
// native target=_blank link open instead.
export function openExternal(url) {
  try {
    if (window.pywebview?.api?.open_external) {
      window.pywebview.api.open_external(url);
      return true;
    }
  } catch {
    /* fall through to native */
  }
  return false;
}

export function fmtSize(bytes) {
  if (!bytes) return "0 KB";
  const mb = bytes / 1e6;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export function ago(iso) {
  if (!iso) return "—";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}
