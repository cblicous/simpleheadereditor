# Simple Header Editor

A browser extension for **Chrome** and **Firefox** (Manifest V3) that injects custom HTTP request headers based on domain patterns. Rules are configured via a JSON array edited directly in the extension popup.

---

## What it does

When you navigate to a site or a page makes a network request, Simple Header Editor checks the request URL against your configured domain rules. For any match, it injects the specified HTTP header into the outgoing request before it leaves the browser.

Use cases include: passing authentication tokens to local APIs, setting debug flags, spoofing feature-flag headers during development, or testing backend behavior that depends on specific request headers.

---

## Installation

The extension ships per-browser bundles. First, build them:

```bash
./build.sh all          # builds both targets
./build.sh chrome       # or just one
./build.sh firefox
```

This produces `dist/chrome/`, `dist/firefox/`, and matching zip files for store submission.

### Chrome

1. Open `chrome://extensions` and enable **Developer mode** (top-right toggle).
2. Click **Load unpacked** and select `dist/chrome/`.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `dist/firefox/manifest.json`.

Temporary add-ons are removed when Firefox restarts. For a persistent install, the zip needs to be signed via [addons.mozilla.org](https://addons.mozilla.org/).

> After editing source files, re-run `./build.sh` and reload the extension on the relevant `chrome://extensions` or `about:debugging` page.

---

## Configuration format

The config is a JSON **array** of rule objects. Each rule has three fields:

```json
[
  {
    "domain": "*.heise.de",
    "header-name": "x-test-header",
    "header-value": "textvalue"
  },
  {
    "domain": "api.example.com",
    "header-name": "x-debug-mode",
    "header-value": "true"
  }
]
```

| Field | Type | Description |
|---|---|---|
| `domain` | string | Domain pattern to match (see below) |
| `header-name` | string | HTTP header name to inject (case-insensitive) |
| `header-value` | string | Value for the header |

### Domain matching

Domains are matched using Chrome's `declarativeNetRequest` URL filter with the `||` anchor syntax, which means:

- `*.heise.de` matches `heise.de`, `www.heise.de`, `forum.heise.de`, etc.
- `heise.de` matches the same set (the `*.` prefix is optional)
- `api.example.com` matches only `api.example.com`, not `www.example.com`

The match applies to the **request destination** (where the request is going), not the page making the request.

Headers are injected on all resource types: page navigations, scripts, images, XHR/fetch, WebSockets, etc.

---

## Using the popup editor

1. Click the extension icon in the Chrome toolbar.
2. Edit the JSON array in the text field.
3. Click **Save**.
4. The extension validates your JSON and applies the rules immediately — no browser restart needed.

Validation checks:
- Must be a valid JSON array
- Each item must have non-empty `domain`, `header-name`, and `header-value` string fields

Errors are shown in red below the Save button. A green confirmation message appears on success.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  popup.html / popup.js  (Chrome Extension Popup)    │
│                                                     │
│  User edits JSON in <textarea>                      │
│  → JSON.parse() + validation                        │
│  → chrome.storage.sync.set({ headerRules: [...] })  │
└───────────────────┬─────────────────────────────────┘
                    │ storage.onChanged event
                    ▼
┌─────────────────────────────────────────────────────┐
│  background.js  (MV3 Service Worker)                │
│                                                     │
│  chrome.storage.onChanged listener fires            │
│  → getDynamicRules() → collect existing rule IDs    │
│  → convert config items to rule objects:            │
│      "*.heise.de" → urlFilter "||heise.de/"         │
│  → updateDynamicRules({ removeRuleIds, addRules })  │
└───────────────────┬─────────────────────────────────┘
                    │ declarativeNetRequest rules active
                    ▼
┌─────────────────────────────────────────────────────┐
│  Chrome Network Stack                               │
│                                                     │
│  Outgoing request URL matched against rules         │
│  → matching rule: header injected into request      │
│  → request sent to server with injected header      │
└─────────────────────────────────────────────────────┘
```

### Files

| File | Role |
|---|---|
| `manifest.chrome.json` | Chrome MV3 manifest. Uses `background.service_worker`. |
| `manifest.firefox.json` | Firefox MV3 manifest. Uses `background.scripts` and declares the `gecko` ID required for `storage.sync`. |
| `background.js` | Background script. Converts stored config into `declarativeNetRequest` dynamic rules. Runs as a service worker in Chrome and as an event-page script in Firefox. |
| `popup.html` | Editor UI shell. Contains the textarea, Save button, and status area. |
| `popup.js` | Editor logic. Reads config from storage on open, validates on save, writes back to storage. |
| `build.sh` | Assembles `dist/chrome/` and `dist/firefox/` from the shared sources, picking the matching manifest. |

### Why two manifests?

Chrome MV3 requires `background.service_worker` and rejects `background.scripts`. Firefox MV3 doesn't support `service_worker` at all and uses `background.scripts`. A single manifest can't satisfy both reliably (Firefox's behavior with both keys present has changed across versions), so each target gets its own.

### Permissions

| Permission | Why it is needed |
|---|---|
| `declarativeNetRequest` | To create and update dynamic header-injection rules |
| `storage` | To persist the JSON config across browser sessions |
| `host_permissions: <all_urls>` | Required for dynamic `declarativeNetRequest` rules to target arbitrary domains |

### Key design decisions

**Manifest V3**: Chrome has deprecated Manifest V2. MV3 replaces the `webRequest` API (which could modify headers imperatively) with `declarativeNetRequest` (a declarative rule engine). Rules are declared upfront and Chrome applies them without running extension JavaScript on every request, which improves performance and security.

**Full-replace on every save**: When config is saved, all existing dynamic rules are removed and replaced. This avoids stale rules accumulating and keeps the rule set exactly in sync with what the user configured.

**`chrome.storage.sync`**: Config is stored in sync storage so it is available across Chrome profiles signed into the same Google account. The practical size limit is 8KB per item / 100KB total, which comfortably fits hundreds of rules.

**Minimal build step**: The extension is plain HTML, CSS, and JavaScript — no bundler, transpiler, or test framework. `build.sh` is just a file-copy script that picks the per-browser manifest and zips the result; there is no compilation.

---

## Limitations

- **Maximum 5000 dynamic rules** (Chrome hard limit). Practically, the JSON would be enormous before hitting this.
- **No response header injection**: `declarativeNetRequest` with `modifyHeaders` and `operation: "set"` only works on request headers, not response headers.
- **No regex domain patterns**: Only simple domain matching is supported (`*.example.com` style). For regex-based URL filtering, `declarativeNetRequest` supports a `regexFilter` field, but it is not exposed in this extension's config format.
- **Header values are strings only**: No dynamic values (timestamps, computed tokens, etc.) — the value is injected exactly as typed.
