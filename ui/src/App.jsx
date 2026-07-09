import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import Library from "./screens/Library.jsx";
import Discover from "./screens/Discover.jsx";
import Settings from "./screens/Settings.jsx";
import Read from "./screens/Read.jsx";
import Chat from "./screens/Chat.jsx";

const NAV = [
  { id: "library", label: "Library", icon: "▤" },
  { id: "discover", label: "Discover", icon: "◎" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function App() {
  const [view, setView] = useState("library");
  const [books, setBooks] = useState([]);
  const [status, setStatus] = useState(null);
  const [activeBook, setActiveBook] = useState(null);
  const [readTarget, setReadTarget] = useState(null);

  const reloadBooks = () => api.books().then(setBooks).catch(() => {});
  const reloadStatus = () => api.status().then(setStatus).catch(() => {});
  useEffect(() => { reloadBooks(); reloadStatus(); }, []);

  function open(name, mode = "read", target = null) {
    setActiveBook(name);
    setReadTarget(target);
    setView(mode);
  }

  return (
    <div className="app">
      <Topbar view={view} book={activeBook} status={status} />
      <aside className="sidebar">
        <div className="brand"><b>◐ okf</b><span className="ver">v0.1.0</span></div>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.id} className={view === n.id ? "active" : ""}
               onClick={() => setView(n.id)}>
              <span style={{ opacity: 0.7 }}>{n.icon}</span> {n.label}
            </a>
          ))}
        </nav>
        <div className="side-h">My books</div>
        <div className="booklist">
          {books.map((b) => (
            <button key={b.name} className={activeBook === b.name ? "active" : ""}
                    onClick={() => open(b.name, "read")}>
              <span><span className="dot">●</span> {b.name}</span>
              <span className="n">{b.pages ?? "—"}</span>
            </button>
          ))}
        </div>
        <div className="side-foot">~/.okf · {books.length} bundles</div>
      </aside>

      <main className="main">
        {view === "library" && (
          <Library books={books} reload={reloadBooks} open={open}
                   goDiscover={() => setView("discover")} />
        )}
        {view === "discover" && <Discover onChange={reloadBooks} />}
        {view === "settings" && <Settings onSaved={reloadStatus} />}
        {view === "read" && activeBook && (
          <Read name={activeBook} target={readTarget} open={open} />
        )}
        {view === "chat" && activeBook && (
          <Chat name={activeBook} status={status} open={open}
                openRead={(id, anchor) => open(activeBook, "read", { conceptId: id, anchor })} />
        )}
      </main>
    </div>
  );
}

function Topbar({ view, book, status }) {
  const label = book && (view === "read" || view === "chat") ? `${book} · ${view}` : view;
  const online = status?.online;
  const prov = status?.provider === "none" ? "no LLM" : (status?.model || status?.provider || "…");
  return (
    <div className="topbar">
      okf desktop — {label}
      <span className={"pill" + (online ? "" : " off")}>
        <span className="dot">●</span> {prov} · {online ? "online" : "offline"}
      </span>
    </div>
  );
}
