// Shared link helpers used by both the reader and chat, so a link to a page
// that's in the book navigates in-app in both places (only truly-external links
// open the browser).

// GitHub-style heading slug — matches okf serve's concept heading anchors.
export function slug(text) {
  return text.trim().toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");
}

// Normalize a URL for matching against a concept's `resource` (drop scheme,
// query/fragment, trailing slash, index.html tail).
export function normUrl(u) {
  try {
    const x = new URL(u);
    const p = x.pathname.replace(/\/(index\.html?)?$/i, "/").replace(/\/+$/, "");
    return (x.host + (p || "/")).toLowerCase();
  } catch {
    return (u || "").toLowerCase();
  }
}

export function flattenConcepts(nodes, out = []) {
  for (const n of nodes) {
    if (n.kind === "concept") out.push(n);
    else flattenConcepts(n.children, out);
  }
  return out;
}

// original-URL → concept id, from a /toc tree
export function buildResourceMap(toc) {
  const m = new Map();
  for (const c of flattenConcepts(toc)) if (c.resource) m.set(normUrl(c.resource), c.id);
  return m;
}
