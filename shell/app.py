"""okf desktop — pywebview shell.

Runs okf-kit's local API (`okf serve`) in-process on a background thread, then
opens a native window pointing at it. Running in-process (rather than spawning
`okf serve` as a subprocess) is what lets the whole thing freeze into one
PyInstaller binary.

Dev:      python shell/app.py          (needs okf-kit[serve] + pywebview installed)
Packaged: ./okf-desktop                (see build.sh / okf-desktop.spec)
"""

from __future__ import annotations

import os
import pathlib
import secrets
import socket
import sys
import threading
import time
import webbrowser


def _bundle_root() -> pathlib.Path:
    # Frozen: assets live under sys._MEIPASS. Dev: the repo root.
    if getattr(sys, "frozen", False):
        return pathlib.Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return pathlib.Path(__file__).resolve().parent.parent


UI_DIST = _bundle_root() / "ui" / "dist"


class Api:
    """window.pywebview.api — opens external links / 'source page' citations in
    the user's real browser instead of the app window."""

    def open_external(self, url):
        if isinstance(url, str) and url.startswith(("http://", "https://")):
            webbrowser.open(url)
        return True


def _free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def start_server(ui_dir: pathlib.Path) -> tuple[str, str]:
    """Launch the okf serve ASGI app on a daemon thread; return (base_url, token)."""
    import uvicorn

    from okf_kit.serve.app import create_app

    token = secrets.token_hex(16)
    port = _free_port()
    app = create_app(token, ui_dir=str(ui_dir))
    # asyncio/h11/no-ws keeps the frozen bundle off uvloop/httptools/websockets.
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning",
                            loop="asyncio", http="h11", ws="none")
    server = uvicorn.Server(config)
    # uvicorn skips signal handlers off the main thread, so this is safe.
    threading.Thread(target=server.run, daemon=True).start()

    # wait until it's accepting connections
    for _ in range(200):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                break
        except OSError:
            time.sleep(0.05)
    return f"http://127.0.0.1:{port}", token


def main() -> int:
    try:
        import webview
    except ImportError:
        sys.exit("Install the shell deps:  pip install -r shell/requirements.txt")

    if not (UI_DIST / "index.html").exists():
        sys.exit(f"UI not found at {UI_DIST}. Build it:  cd ui && npm install && npm run build")

    base, token = start_server(UI_DIST)

    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True
    webview.create_window("okf desktop", f"{base}/?token={token}", js_api=Api(),
                          text_select=True, width=1200, height=820, min_size=(940, 620))
    webview.start(debug=bool(os.environ.get("OKF_DEBUG")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
