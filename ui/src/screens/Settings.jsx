import React, { useEffect, useState } from "react";
import { api } from "../api.js";

const PROVIDERS = [
  { id: "none", name: "No LLM", desc: "Zero-key retrieval. Cited answers, no network." },
  { id: "ollama", name: "Ollama", desc: "Local models, fully offline chat." },
  { id: "openai", name: "OpenAI-compatible", desc: "Any hosted API with a key." },
];

export default function Settings({ onSaved }) {
  const [s, setS] = useState(null);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { api.settings().then(setS); }, []);
  if (!s) return <div className="empty"><span className="spin" /> Loading…</div>;

  async function save(patch) {
    const next = { ...s, ...patch };
    setS(next);
    const body = { provider: next.provider, model: next.model, base_url: next.base_url };
    if (key) body.api_key = key;
    const res = await api.saveSettings(body);
    setS((cur) => ({ ...cur, has_key: res.has_key }));
    setKey("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onSaved?.();
  }

  const needsKey = s.provider === "openai";
  const showModel = s.provider !== "none";

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="title">Settings</h1>
          <div className="sub">Everything runs locally. An LLM is optional — only for chat.</div>
        </div>
      </div>

      <div className="side-h" style={{ padding: "0 0 12px" }}>LLM provider</div>
      <div className="opts">
        {PROVIDERS.map((p) => (
          <button key={p.id} className={"opt" + (s.provider === p.id ? " active" : "")}
                  onClick={() => save({ provider: p.id })}>
            <b>{p.name}</b><span>{p.desc}</span>
          </button>
        ))}
      </div>

      {(needsKey || showModel) && (
        <div className="card" style={{ maxWidth: 760 }}>
          {needsKey && (
            <div className="field">
              <label>API key {s.has_key && <span className="note">· stored ✓</span>}</label>
              <input type="password" placeholder={s.has_key ? "•••••••• (saved)" : "sk-…"}
                     value={key} onChange={(e) => setKey(e.target.value)}
                     onBlur={() => key && save({})} />
            </div>
          )}
          {showModel && (
            <div className="field">
              <label>Model</label>
              <input value={s.model || ""} placeholder={s.provider === "ollama" ? "llama3.1" : "gpt-4o"}
                     onChange={(e) => setS({ ...s, model: e.target.value })}
                     onBlur={() => save({})} />
            </div>
          )}
          <div className="note">
            Key is stored in your OS keychain, never in the bundle.{saved && " · saved"}
          </div>
        </div>
      )}
    </>
  );
}
