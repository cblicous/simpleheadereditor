const EXAMPLE_CONFIG = [
  {
    "domain": "*.example.com",
    "header-name": "x-custom-header",
    "header-value": "my-value"
  },
  {
    "domain": "api.github.com",
    "header-name": "x-debug-mode",
    "header-value": "true"
  }
];

const textarea = document.getElementById("config");
const saveBtn  = document.getElementById("save");
const status   = document.getElementById("status");

function showStatus(message, type) {
  status.textContent = message;
  status.className = type; // "success" | "error" | "info"
}

function clearStatus() {
  status.textContent = "";
  status.className = "";
}

// Validate a parsed config array. Returns null on success, or an error string.
function validate(parsed) {
  if (!Array.isArray(parsed)) {
    return "Config must be a JSON array [ ... ].";
  }
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (typeof item !== "object" || item === null) {
      return `Item at index ${i} must be an object.`;
    }
    if (typeof item["domain"] !== "string" || item["domain"].trim() === "") {
      return `Item at index ${i} is missing a non-empty "domain" field.`;
    }
    if (typeof item["header-name"] !== "string" || item["header-name"].trim() === "") {
      return `Item at index ${i} is missing a non-empty "header-name" field.`;
    }
    if (typeof item["header-value"] !== "string") {
      return `Item at index ${i} is missing a "header-value" field.`;
    }
  }
  return null;
}

// Load existing config from storage and populate the textarea
chrome.storage.sync.get("headerRules", (result) => {
  if (chrome.runtime.lastError) {
    showStatus("Error reading storage: " + chrome.runtime.lastError.message, "error");
    return;
  }
  const rules = result.headerRules;
  if (Array.isArray(rules)) {
    textarea.value = JSON.stringify(rules, null, 2);
    showStatus(`${rules.length} rule(s) active.`, "info");
  } else {
    // First launch: show example config
    textarea.value = JSON.stringify(EXAMPLE_CONFIG, null, 2);
    showStatus("No rules saved yet. Edit the example and click Save.", "info");
  }
});

// Clear status when the user starts editing
textarea.addEventListener("input", clearStatus);

// Save handler
saveBtn.addEventListener("click", () => {
  const raw = textarea.value.trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    showStatus("Invalid JSON: " + e.message, "error");
    return;
  }

  const validationError = validate(parsed);
  if (validationError) {
    showStatus(validationError, "error");
    return;
  }

  saveBtn.disabled = true;
  showStatus("Saving…", "info");

  chrome.storage.sync.set({ headerRules: parsed }, () => {
    saveBtn.disabled = false;
    if (chrome.runtime.lastError) {
      showStatus("Save failed: " + chrome.runtime.lastError.message, "error");
      return;
    }
    // Pretty-print after successful save
    textarea.value = JSON.stringify(parsed, null, 2);
    showStatus(`Saved. ${parsed.length} rule(s) active.`, "success");
  });
});
