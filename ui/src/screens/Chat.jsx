import React, { useEffect, useMemo, useRef, useState } from "react";
import MarkdownIt from "markdown-it";
import { api, openExternal } from "../api.js";
import { normUrl, buildResourceMap } from "../links.js";
import { BookHeader } from "./Read.jsx";

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
  const href = tokens[idx].attrGet("href") || "";
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  return self.renderToken(tokens, idx, opts);
};

export default function Chat({ name, status, open, openRead }) {
  const [sessions, setSessions] = useState([]);
  const [sid, setSid] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toc, setToc] = useState([]);
  const msgsRef = useRef(null);

  // original-URL → concept id, so a link in an answer that points to a page in
  // this book opens in the reader instead of the browser.
  const resourceMap = useMemo(() => buildResourceMap(toc), [toc]);

  // A link inside a chat answer: in-book → open the reader; else → browser.
  function onAnswerClick(e) {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    const hit = resourceMap.get(normUrl(href));
    if (hit) {
      e.preventDefault();
      let frag = null;
      try { frag = new URL(href).hash.slice(1) || null; } catch { /* keep null */ }
      openRead(hit, frag);
      return;
    }
    if (openExternal(href)) e.preventDefault();
  }

  const loadSessions = () => api.chats(name).then(setSessions);

  useEffect(() => {
    api.toc(name).then(setToc).catch(() => {});
    api.chats(name).then(async (list) => {
      setSessions(list);
      if (list.length) selectSession(list[0].id);
      else newChat();
    });
  }, [name]);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function selectSession(id) {
    setSid(id);
    const s = await api.chat(name, id);
    setMessages(s.messages || []);
  }

  async function newChat() {
    const s = await api.newChat(name);
    setSid(s.id);
    setMessages([]);
  }

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text: q }, { role: "assistant", text: "", sources: [] }]);
    try {
      await api.ask(name, sid, q, (ev, data) => {
        if (ev === "token") setMessages((m) => bumpLast(m, (b) => ({ ...b, text: b.text + data.text })));
        else if (ev === "sources") setMessages((m) => bumpLast(m, (b) => ({ ...b, sources: data.sources })));
      });
    } catch (e) {
      setMessages((m) => bumpLast(m, (b) => ({ ...b, text: b.text || `⚠ ${e.message}` })));
    } finally {
      setBusy(false);
      loadSessions();
    }
  }

  const prov = status?.provider === "none" ? "retrieval · no LLM" : (status?.model || status?.provider);

  return (
    <>
      <BookHeader name={name} concept={{ title: name }} mode="chat" open={open} />
      <div className="chat">
        <div>
          <button className="btn primary" style={{ width: "100%", marginBottom: 16 }} onClick={newChat}>
            + New chat
          </button>
          <div className="side-h" style={{ padding: "0 0 10px" }}>Saved chats</div>
          <div className="sessions">
            {sessions.map((s) => (
              <button key={s.id} className={"session" + (s.id === sid ? " active" : "")}
                      onClick={() => selectSession(s.id)}>
                <div className="t">{s.title}</div>
                <div className="m">{s.message_count} messages</div>
              </button>
            ))}
          </div>
        </div>

        <div className="thread">
          <div className="msgs" ref={msgsRef}>
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="bubble user">{m.text}</div>
              ) : (
                <div key={i} className="bubble bot">
                  {m.text
                    ? <div className="text" onClick={onAnswerClick}
                           dangerouslySetInnerHTML={{ __html: md.render(m.text) }} />
                    : <div className="text"><span className="spin" /></div>}
                  {m.sources?.length > 0 && (
                    <div className="cites">
                      {m.sources.map((s, j) => (
                        <button key={j} className="cite" title={s.snippet}
                                onClick={() => openRead(s.concept_id, s.anchor)}>
                          📖 {s.section || s.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
          <div className="composer">
            <input placeholder={`Ask ${name} anything…`} value={input}
                   onChange={(e) => setInput(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && send()} />
            <button className="btn primary" onClick={send} disabled={busy}>Send</button>
          </div>
          <div className="chat-foot">grounded in this book · {prov} · chats saved to ~/.okf/chats</div>
        </div>
      </div>
    </>
  );
}

function bumpLast(msgs, fn) {
  const copy = msgs.slice();
  copy[copy.length - 1] = fn(copy[copy.length - 1]);
  return copy;
}
