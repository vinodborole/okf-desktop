import React, { useState } from "react";
import { api, fmtSize, ago } from "../api.js";

export default function Library({ books, reload, open, goDiscover }) {
  const [busy, setBusy] = useState({});

  async function remove(name) {
    await api.removeBook(name);
    reload();
  }

  async function update(name) {
    setBusy((b) => ({ ...b, [name]: true }));
    try {
      await api.install(name, () => {}); // re-download the latest release, replace in place
      reload();
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[name]; return n; });
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="title">Library</h1>
          <div className="sub">
            {books.length} {books.length === 1 ? "book" : "books"} on disk · all conformant
          </div>
        </div>
        <button className="btn primary" onClick={goDiscover}>Browse registry →</button>
      </div>

      <div className="grid">
        {books.map((b) => (
          <div className="card" key={b.name}>
            <div className="row1">
              <span className="tag">{b.tag}</span>
              <span className="pages">{b.pages ?? "—"} pages</span>
            </div>
            <h3>{b.title}</h3>
            <div className="src">{b.source_url?.replace(/^https?:\/\//, "")}</div>
            <div className="meta">
              {fmtSize(b.size_bytes)} · synced {ago(b.synced_at)} · {b.chat_count} chat
              {b.chat_count === 1 ? "" : "s"} saved
            </div>
            <div className="actions">
              <button className="btn primary" onClick={() => open(b.name, "read")}>Read</button>
              <button className="btn" onClick={() => open(b.name, "chat")}>Chat</button>
              <button className="btn" onClick={() => update(b.name)} disabled={busy[b.name]}
                      title="Re-download the latest version">
                {busy[b.name] ? <span className="spin" /> : "Update"}
              </button>
              <button className="btn ghost" onClick={() => remove(b.name)}>Remove</button>
            </div>
          </div>
        ))}

        <div className="card add" onClick={goDiscover}>
          <div className="plus">+</div>
          Add a book
        </div>
      </div>
    </>
  );
}
