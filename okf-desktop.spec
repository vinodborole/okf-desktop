# PyInstaller spec for okf desktop — freezes the pywebview shell + the in-process
# okf serve API + the built React UI into one distributable.
#
# Build:  cd okf-desktop && python -m PyInstaller okf-desktop.spec
# Output: dist/okf-desktop/  (a folder with the `okf-desktop` executable)
#
# Notes:
# - Consume-only: the crawl stack (trafilatura/lxml/selectolax/crawl4ai) is excluded,
#   so the bundle stays small.
# - Linux: uses the system GTK3 + WebKit2GTK (present on typical desktops), same as
#   pywebview does when run normally.

import sys

from PyInstaller.utils.hooks import collect_submodules, collect_data_files

datas = [("ui/dist", "ui/dist")]
datas += collect_data_files("webview")   # pywebview's injected JS

hiddenimports = []
hiddenimports += collect_submodules("uvicorn")          # dynamic loop/protocol imports
hiddenimports += collect_submodules("keyring")          # credential backends
hiddenimports += collect_submodules("okf_kit.serve")
hiddenimports += [
    "okf_kit", "okf_kit.serve.app", "okf_kit.chat.agent", "okf_kit.chat.retrieval",
    "okf_kit.chat.providers", "okf_kit.chat.history",
]
if sys.platform.startswith("linux"):
    # pywebview's GTK backend pulls these gi modules dynamically
    hiddenimports += ["gi", "gi.repository.Gtk", "gi.repository.Gdk",
                      "gi.repository.GLib", "gi.repository.WebKit2"]
# macOS uses WKWebView and Windows the Edge WebView2 runtime — no gi needed.

excludes = [
    "trafilatura", "selectolax", "lxml", "crawl4ai",       # crawl stack — not used
    "uvloop", "httptools", "watchfiles", "websockets",     # uvicorn[standard] extras — using asyncio/h11
    "botocore", "boto3", "s3transfer", "zstandard",        # AWS/compression — not ours
    "tkinter", "matplotlib", "numpy", "pandas", "PIL", "scipy", "pytest", "IPython",
]

block_cipher = None

a = Analysis(
    ["shell/app.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# Drop GTK icon themes / themes / locale data the app never shows (~225 MB).
# A webview window needs no icon theme; GTK falls back to the system's if present.
_DROP = ("share/icons", "share/themes", "share/locale", "share/doc", "share/man")
a.datas = [d for d in a.datas if not d[0].startswith(_DROP)]

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="okf-desktop",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,        # GUI app — no terminal window
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="okf-desktop",
)
