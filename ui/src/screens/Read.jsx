import React, { useEffect, useMemo, useRef, useState } from "react";
import MarkdownIt from "markdown-it";
import { api, openExternal } from "../api.js";
import { slug, normUrl, flattenConcepts, buildResourceMap } from "../links.js";

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

// Mark absolute links so they never navigate the app window away.
const _linkOpen = md.renderer.rules.link_open ||
  ((t, i, o, e, self) => self.renderToken(t, i, o));
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const href = tokens[idx].attrGet("href") || "";
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  return _linkOpen(tokens, idx, opts, env, self);
};

export default function Read({ name, target, open }) {
  const [toc, setToc] = useState([]);
  const [cid, setCid] = useState(target?.conceptId || null);
  const [c, setC] = useState(null);
  const [jump, setJump] = useState(null); // pending in-app scroll after link nav
  const bodyRef = useRef(null);

  // flat, ordered concept list (for numbering + first-concept default)
  const flat = useMemo(() => flattenConcepts(toc), [toc]);

  // original-URL → concept id, so links to in-bundle pages navigate in-app
  const resourceMap = useMemo(() => buildResourceMap(toc), [toc]);

  const scrollToId = (id) => {
    const el = (id && bodyRef.current?.querySelector("#" + CSS.escape(id))) || bodyRef.current;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    api.toc(name).then((t) => {
      setToc(t);
      setCid((cur) => cur || flattenConcepts(t)[0]?.id || null);
    });
  }, [name]);

  useEffect(() => {
    if (target?.conceptId) setCid(target.conceptId);
  }, [target]);

  useEffect(() => {
    if (!cid) return;
    api.concept(name, cid).then(setC);
  }, [name, cid]);

  // after render: assign heading ids, resolve links, then scroll to the anchor
  useEffect(() => {
    if (!c || !bodyRef.current) return;
    const root = bodyRef.current;
    root.querySelectorAll("h1,h2,h3,h4").forEach((h) => (h.id = slug(h.textContent)));

    // Classify each link into anchor / concept (in-app) / external.
    root.querySelectorAll("a[href]").forEach((a) => {
      const raw = a.getAttribute("href") || "";
      a.removeAttribute("target"); a.removeAttribute("rel"); // clear md-added attrs
      if (raw.startsWith("#")) {
        a.dataset.kind = "anchor"; a.dataset.anchor = raw.slice(1);
        a.removeAttribute("href"); a.style.cursor = "pointer"; return;
      }
      let abs;
      try { abs = new URL(raw, c.resource || undefined).href; } catch { a.removeAttribute("href"); a.style.cursor = "default"; return; }
      if (!/^https?:/i.test(abs)) { a.removeAttribute("href"); a.style.cursor = "default"; return; }
      const frag = new URL(abs).hash.slice(1) || "";
      const hit = resourceMap.get(normUrl(abs));
      if (hit) {
        // any page in this book — including this page's own "source page"
        // citation — stays in the app (self-links just scroll).
        a.dataset.kind = "concept"; a.dataset.cid = hit; a.dataset.frag = frag;
        a.removeAttribute("href"); a.style.cursor = "pointer";
      } else {
        // a genuinely different website → open in the browser
        a.dataset.kind = "external";
        a.setAttribute("href", abs); a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer");
      }
    });

    const anchor =
      (jump?.conceptId === cid && jump.anchor) ||
      (target?.conceptId === cid ? target?.anchor : null);
    const el = anchor && root.querySelector("#" + CSS.escape(anchor));
    (el || root).scrollIntoView({ behavior: "smooth", block: "start" });
    if (jump) setJump(null);
  }, [c]); // eslint-disable-line

  const html = useMemo(() => (c ? md.render(c.markdown) : ""), [c]);
  const num = (id) => String(flat.findIndex((x) => x.id === id) + 1).padStart(2, "0");

  // Links are pre-classified in the render effect via data-kind.
  function onProseClick(e) {
    const a = e.target.closest("a");
    if (!a) return;
    const kind = a.dataset.kind;
    if (kind === "anchor") { e.preventDefault(); scrollToId(a.dataset.anchor); return; }
    if (kind === "concept") {
      e.preventDefault();
      const t = a.dataset.cid, frag = a.dataset.frag || null;
      if (t === cid) scrollToId(frag);
      else { setJump({ conceptId: t, anchor: frag }); setCid(t); }
      return;
    }
    if (kind === "external") {
      // Prefer the bridge (opens the OS browser reliably); else the native
      // target=_blank on the link opens it.
      if (openExternal(a.getAttribute("href"))) e.preventDefault();
    }
  }

  return (
    <>
      <BookHeader name={name} concept={c} mode="read" open={open} />
      <div className="reader">
        <div>
          <div className="toc-h">Contents</div>
          <Tree nodes={toc} cid={cid} onPick={setCid} num={num} />
        </div>
        <div>
          <article className="prose" ref={bodyRef} onClick={onProseClick}>
            {c && <div className="eyebrow">{c.type || "Concept"}</div>}
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </article>
          {c && (
            <div className="nextprev">
              <span>{c.prev && <button className="btn" onClick={() => setCid(c.prev.id)}>← {c.prev.title}</button>}</span>
              <span>{c.next && <button className="btn" onClick={() => setCid(c.next.id)}>{c.next.title} →</button>}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Tree({ nodes, cid, onPick, num }) {
  return (
    <div className="toc">
      {nodes.map((n, i) =>
        n.kind === "concept" ? (
          <button key={n.id} className={cid === n.id ? "active" : ""} onClick={() => onPick(n.id)}>
            <span className="num">{num(n.id)}</span> {n.title}
          </button>
        ) : (
          <div key={"s" + i}>
            <div className="sec">{n.title}</div>
            <Tree nodes={n.children} cid={cid} onPick={onPick} num={num} />
          </div>
        )
      )}
    </div>
  );
}

export function BookHeader({ name, concept, mode, open }) {
  return (
    <div className="page-head">
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="tag">{name.split("-")[0]}</span>
          <h1 className="title" style={{ fontSize: 30, margin: 0 }}>{concept?.title || name}</h1>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, background: "var(--card)", border: "1px solid var(--rule)", borderRadius: 10, padding: 4 }}>
        <button className={"btn " + (mode === "read" ? "dark" : "ghost")} onClick={() => open(name, "read")}>Read</button>
        <button className={"btn " + (mode === "chat" ? "dark" : "ghost")} onClick={() => open(name, "chat")}>Chat</button>
      </div>
    </div>
  );
}
