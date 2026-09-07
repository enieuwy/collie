#!/bin/sh
# Re-apply the ui/density-zen web bundle onto the live install.
# A Collie update lays a stock payload beside the old one and flips `current`,
# so the live dir serves stock again until this runs. Run from the repo root.
set -eu
cd "$(dirname "$0")/.."
bun run build
LIVE=$(readlink current)
rm -rf "$LIVE/web/dist"
cp -R web/dist "$LIVE/web/dist"
echo "custom UI live at $LIVE/web/dist - reload the phone app."
