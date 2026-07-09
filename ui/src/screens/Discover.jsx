import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Discover({ onChange }) {
  const [entries, setEntries] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState({}); // name -> phase

  const load = () => api.registry().then((r) => setEntries(r.entries)).catch(() => setEntries([]));
  useEffect(() => { load(); }, []);

  async function install(name) {
    setBusy((b) => ({ ...b, [name]: "downloading" }));
    try {
      await api.install(name, (ev, data) => {
        if (ev === "progress") setBusy((b) => ({ ...b, [name]: data.phase }));
      });
      await load();
      onChange?.();
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[name]; return n; });
    }
  }

  const shown = (entries || []).filter((e) =>
    !q || (e.title + " " + e.name + " " + (e.description || "")).toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="title">Discover</h1>
          <div className="sub">Community bundles — pull any book with one click.</div>
        </div>
        <input className="searchbar" placeholder="Search registry…"
               value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {entries === null && <div className="empty"><span className="spin" /> Loading registry…</div>}

      <div className="rows">
        {shown.map((e) => (
          <div className="rrow" key={e.name}>
            <span className="tag">{e.tag}</span>
            <div className="body">
              <h4>{e.title}</h4>
              <div className="src">
                {e.source_url?.replace(/^https?:\/\//, "")}{e.publisher ? ` · ${e.publisher}` : ""}
              </div>
            </div>
            <span className="pages">{e.pages ?? "—"} pages</span>
            {busy[e.name] ? (
              <span className="installed"><span className="spin" /> {busy[e.name]}…</span>
            ) : e.installed ? (
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="installed">✓ installed</span>
                <button className="btn" title="Re-download the latest version"
                        onClick={() => install(e.name)}>update</button>
              </span>
            ) : (
              <button className="btn dark" onClick={() => install(e.name)}>get</button>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
