# Simple Header Editor

A Chrome browser extension that injects custom HTTP request headers based on domain patterns. Rules are configured via a JSON array edited directly in the extension popup.

---

## What it does

When you navigate to a site or a page makes a network request, Simple Header Editor checks the request URL against your configured domain rules. For any match, it injects the specified HTTP header into the outgoing request before it leaves the browser.

Use cases include: passing authentication tokens to local APIs, setting debug flags, spoofing feature-flag headers during development, or testing backend behavior that depends on specific request headers.

---

## Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the folder containing `manifest.json`.
5. The extension icon appears in the Chrome toolbar. Click it to open the config editor.

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
| `manifest.json` | Extension manifest (MV3). Declares permissions, service worker, and popup. |
| `background.js` | Service worker. Converts stored config into `declarativeNetRequest` dynamic rules. |
| `popup.html` | Editor UI shell. Contains the textarea, Save button, and status area. |
| `popup.js` | Editor logic. Reads config from storage on open, validates on save, writes back to storage. |

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

**No build step**: The extension is plain HTML, CSS, and JavaScript with no bundler or transpiler. Load it directly from the source directory.

---

## Limitations

- **Maximum 5000 dynamic rules** (Chrome hard limit). Practically, the JSON would be enormous before hitting this.
- **No response header injection**: `declarativeNetRequest` with `modifyHeaders` and `operation: "set"` only works on request headers, not response headers.
- **No regex domain patterns**: Only simple domain matching is supported (`*.example.com` style). For regex-based URL filtering, `declarativeNetRequest` supports a `regexFilter` field, but it is not exposed in this extension's config format.
- **Header values are strings only**: No dynamic values (timestamps, computed tokens, etc.) — the value is injected exactly as typed.
