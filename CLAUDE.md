# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Simple Header Editor is a Chrome Extension (Manifest V3) that injects custom HTTP request headers based on domain patterns. Rules are stored as JSON in `chrome.storage.sync` and applied via the `declarativeNetRequest` API.

## No build step

This is plain HTML/CSS/JS — no bundler, transpiler, package manager, or test framework. Load directly in Chrome via `chrome://extensions` → Developer mode → Load unpacked. Changes to source files take effect after reloading the extension on that page.

## Architecture

Two components communicate through `chrome.storage.sync`:

- **`popup.js`** — reads `headerRules` from storage on open, validates user-edited JSON on save, writes back to storage. Validation is in `validate()`.
- **`background.js`** (MV3 service worker) — listens for `storage.onChanged` to apply rules, and re-applies on `onInstalled`. Converts domain patterns to `declarativeNetRequest` rules via `configToRules()`, which calls `domainToUrlFilter()` to produce `||domain/` anchored URL filters.

Rule application is always a full replace: all existing dynamic rules are removed and the full new set is added. Rule IDs are assigned sequentially starting at 1.

## Config schema

The stored value (`headerRules`) is a JSON array of objects with three required string fields: `domain`, `header-name`, and `header-value`. Domain patterns like `*.example.com` and `example.com` are equivalent — the `*.` prefix is stripped before building the URL filter.

## Key constraints

- Chrome's hard limit is 5000 dynamic `declarativeNetRequest` rules.
- `declarativeNetRequest` with `operation: "set"` only works on **request** headers, not response headers.
- Only simple domain matching is supported; `regexFilter` is not exposed in the config format.
- `chrome.storage.sync` has an 8KB per-item / 100KB total size limit.
