const ALL_RESOURCE_TYPES = [
  "main_frame", "sub_frame", "stylesheet", "script",
  "image", "font", "object", "xmlhttprequest",
  "ping", "csp_report", "media", "websocket", "other"
];

// Convert a domain pattern like "*.heise.de" or "heise.de" to a
// declarativeNetRequest urlFilter using the "||" domain anchor syntax.
function domainToUrlFilter(domain) {
  // Strip leading "*." if present
  const stripped = domain.startsWith("*.") ? domain.slice(2) : domain;
  // "||example.com/" matches example.com and all subdomains
  return `||${stripped}/`;
}

function configToRules(configItems) {
  return configItems.map((item, index) => ({
    id: index + 1, // rule IDs must be positive integers
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        {
          header: item["header-name"].toLowerCase(),
          operation: "set",
          value: item["header-value"]
        }
      ]
    },
    condition: {
      urlFilter: domainToUrlFilter(item["domain"]),
      resourceTypes: ALL_RESOURCE_TYPES
    }
  }));
}

async function applyRules(configItems) {
  // Get current dynamic rules so we can remove them all
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map(r => r.id);
  const addRules = configToRules(configItems);

  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
  console.log(`[SimpleHeaderEditor] Applied ${addRules.length} rule(s), removed ${removeRuleIds.length} old rule(s).`);
}

// Apply rules whenever storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.headerRules) return;
  const newRules = changes.headerRules.newValue;
  if (Array.isArray(newRules)) {
    applyRules(newRules).catch(err => console.error("[SimpleHeaderEditor] Failed to apply rules:", err));
  }
});

// Bootstrap rules on install or extension update
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get("headerRules", (result) => {
    if (chrome.runtime.lastError) {
      console.error("[SimpleHeaderEditor] Storage read error:", chrome.runtime.lastError);
      return;
    }
    const rules = result.headerRules;
    if (Array.isArray(rules) && rules.length > 0) {
      applyRules(rules).catch(err => console.error("[SimpleHeaderEditor] Failed to bootstrap rules:", err));
    }
  });
});
