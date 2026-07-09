#!/usr/bin/env bash
# Build okf desktop into a distributable with PyInstaller.
# Run on each target OS (PyInstaller does not cross-compile).
set -euo pipefail
cd "$(dirname "$0")"

echo "==> 1/3  building the UI"
( cd ui && npm install --no-audit --no-fund && npm run build )

echo "==> 2/3  freezing with PyInstaller"
python3 -m pip install --quiet --upgrade pyinstaller
rm -rf build dist
python3 -m PyInstaller okf-desktop.spec --noconfirm --log-level WARN

echo "==> 3/3  packaging"
case "$(uname -s)" in
  Linux)  tar -C dist -czf dist/okf-desktop-linux-x64.tar.gz okf-desktop
          echo "    -> dist/okf-desktop-linux-x64.tar.gz" ;;
  Darwin) ( cd dist && zip -qry okf-desktop-macos.zip okf-desktop )
          echo "    -> dist/okf-desktop-macos.zip" ;;
  *)      echo "    (zip dist/okf-desktop yourself for this OS)" ;;
esac

echo
echo "Done.  Run it:  ./dist/okf-desktop/okf-desktop"
