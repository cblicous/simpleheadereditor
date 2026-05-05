#!/usr/bin/env bash
set -euo pipefail

usage() { echo "Usage: $(basename "$0") <chrome|firefox|all>" >&2; exit 1; }
[ $# -eq 1 ] || usage

ROOT="$(cd "$(dirname "$0")" && pwd)"

build() {
  local t=$1
  local out=$ROOT/dist/$t
  local zip=$ROOT/dist/simple-header-editor-$t.zip
  rm -rf "$out" "$zip"
  mkdir -p "$out"
  cp -R "$ROOT"/{background.js,popup.html,popup.js,icons} "$out/"
  cp "$ROOT/manifest.$t.json" "$out/manifest.json"
  (cd "$out" && zip -qr "$zip" .)
  echo "Built dist/$t/ and dist/$(basename "$zip")"
}

case $1 in
  chrome|firefox) build "$1" ;;
  all)            build chrome; build firefox ;;
  *)              usage ;;
esac
