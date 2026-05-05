# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Simple Header Editor is a cross-browser extension (Manifest V3) targeting **Chrome** and **Firefox** that injects custom HTTP request headers based on domain patterns. Rules are stored as JSON in `chrome.storage.sync` and applied via the `declarativeNetRequest` API.

## Build step

The source is plain HTML/CSS/JS with no bundler, transpiler, package manager, or test framework. `build.sh` is a small bash file-copy script — not a real compiler.

- `./build.sh chrome|firefox|all` produces `dist/<target>/` and a matching zip in `dist/`.
- The build picks the right manifest (`manifest.chrome.json` or `manifest.firefox.json`) and renames it to `manifest.json` inside the dist folder.
- Load `dist/chrome/` via `chrome://extensions` → Load unpacked, or `dist/firefox/manifest.json` via `about:debugging#/runtime/this-firefox` → Load Temporary Add-on. After editing sources, re-run `./build.sh` and reload.

## Why two manifests?

Chrome needs `background.service_worker`, Firefox needs `background.scripts`, and they reject each other's. The Firefox manifest also carries `browser_specific_settings.gecko.id` (required for `storage.sync`) and a `strict_min_version`. See README "Why two manifests?" for more.

## Architecture

Two components communicate through `chrome.storage.sync`:

- **`popup.js`** — reads `headerRules` from storage on open, validates user-edited JSON on save, writes back to storage. Validation is in `validate()`.
- **`background.js`** (MV3 service worker) — listens for `storage.onChanged` to apply rules, and re-applies on `onInstalled`. Converts domain patterns to `declarativeNetRequest` rules via `configToRules()`, which calls `domainToUrlFilter()` to produce `||domain/` anchored URL filters.

Rule application is always a full replace: all existing dynamic rules are removed and the full new set is added. Rule IDs are assigned sequentially starting at 1.

## Config schema

The stored value (`headerRules`) is a JSON array of objects with three required string fields (`domain`, `header-name`, `header-value`) plus one optional boolean field (`active`, defaults to `true`). When `active` is `false`, the rule is filtered out in `configToRules()` before being passed to `declarativeNetRequest`. Domain patterns like `*.example.com` and `example.com` are equivalent — the `*.` prefix is stripped before building the URL filter.

## Key constraints

- Chrome's hard limit is 5000 dynamic `declarativeNetRequest` rules.
- `declarativeNetRequest` with `operation: "set"` only works on **request** headers, not response headers.
- Only simple domain matching is supported; `regexFilter` is not exposed in the config format.
- `chrome.storage.sync` has an 8KB per-item / 100KB total size limit.
