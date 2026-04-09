const PROFILE_KEY = "profile";
const CUSTOM_FIELDS_KEY = "customFields";
const SETTINGS_KEY = "settings";

const DEFAULT_PROFILE = {
  fullName: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  college: "",
  srn: "",
  degree: "",
  course: "",
  specialization: "",
  cgpa: "",
  tenthPercentage: "",
  twelfthPercentage: "",
  graduationYear: "",
  linkedin: "",
  github: "",
  portfolio: "",
  location: "",
  address: "",
  experienceYears: "",
  skills: "",
  resumeUrl: ""
};

const DEFAULT_SETTINGS = {
  autofillEnabled: true,
  autoFillOnPageLoad: false,
  skipIfFieldHasValue: true,
  aiProvider: "openai",
  aiApiKey: "",
  aiModel: "gpt-4o-mini",
  aiEndpoint: "https://api.openai.com/v1/chat/completions"
};

let customFields = [];

function getStorage(defaults) {
  return new Promise((resolve) => chrome.storage.local.get(defaults, resolve));
}

function setStorage(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

function setStatus(msg, isError = false) {
  const status = document.getElementById("status");
  status.textContent = msg;
  status.style.color = isError ? "#b42318" : "#1d7b45";
}

function profileInputIds() {
  return Object.keys(DEFAULT_PROFILE);
}

function renderCustomFields() {
  const tbody = document.getElementById("customFieldsTable");

  if (!customFields.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center;color:#5c6e86;">No custom fields added.</td></tr>';
    return;
  }

  tbody.innerHTML = customFields
    .map(
      (field, idx) =>
        `<tr>
          <td>${escapeHtml(field.key || "")}</td>
          <td>${escapeHtml(field.label || "")}</td>
          <td>${escapeHtml((field.aliases || []).join(", "))}</td>
          <td>${escapeHtml(field.value || "")}</td>
          <td><button data-index="${idx}" class="removeCustomBtn">Remove</button></td>
        </tr>`
    )
    .join("");

  document.querySelectorAll(".removeCustomBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      customFields.splice(idx, 1);
      renderCustomFields();
    });
  });
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function loadAll() {
  const storage = await getStorage({
    [PROFILE_KEY]: DEFAULT_PROFILE,
    [CUSTOM_FIELDS_KEY]: [],
    [SETTINGS_KEY]: DEFAULT_SETTINGS
  });

  const profile = { ...DEFAULT_PROFILE, ...(storage[PROFILE_KEY] || {}) };
  const settings = { ...DEFAULT_SETTINGS, ...(storage[SETTINGS_KEY] || {}) };
  customFields = Array.isArray(storage[CUSTOM_FIELDS_KEY]) ? storage[CUSTOM_FIELDS_KEY] : [];

  for (const id of profileInputIds()) {
    const el = document.getElementById(id);
    if (el) {
      el.value = profile[id] || "";
    }
  }

  document.getElementById("autofillEnabled").checked = Boolean(settings.autofillEnabled);
  document.getElementById("autoFillOnPageLoad").checked = Boolean(settings.autoFillOnPageLoad);
  document.getElementById("skipIfFieldHasValue").checked = Boolean(settings.skipIfFieldHasValue);
  document.getElementById("aiProvider").value = settings.aiProvider || "openai";
  document.getElementById("aiApiKey").value = settings.aiApiKey || "";
  document.getElementById("aiModel").value = settings.aiModel || "gpt-4o-mini";
  document.getElementById("aiEndpoint").value = settings.aiEndpoint || DEFAULT_SETTINGS.aiEndpoint;

  renderCustomFields();
}

function collectProfile() {
  const profile = {};
  for (const id of profileInputIds()) {
    const el = document.getElementById(id);
    profile[id] = el ? el.value.trim() : "";
  }
  return profile;
}

function collectSettings() {
  return {
    autofillEnabled: document.getElementById("autofillEnabled").checked,
    autoFillOnPageLoad: document.getElementById("autoFillOnPageLoad").checked,
    skipIfFieldHasValue: document.getElementById("skipIfFieldHasValue").checked,
    aiProvider: document.getElementById("aiProvider").value,
    aiApiKey: document.getElementById("aiApiKey").value.trim(),
    aiModel: document.getElementById("aiModel").value.trim(),
    aiEndpoint: document.getElementById("aiEndpoint").value.trim()
  };
}

async function saveAll() {
  await setStorage({
    [PROFILE_KEY]: collectProfile(),
    [CUSTOM_FIELDS_KEY]: customFields,
    [SETTINGS_KEY]: collectSettings()
  });
  setStatus("Saved successfully.");
}

function addCustomField() {
  const key = document.getElementById("customKey").value.trim();
  const label = document.getElementById("customLabel").value.trim();
  const aliases = document
    .getElementById("customAliases")
    .value.split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const value = document.getElementById("customValue").value.trim();

  if (!key || !value) {
    setStatus("Custom field key and value are required.", true);
    return;
  }

  customFields.push({ key, label, aliases, value });

  document.getElementById("customKey").value = "";
  document.getElementById("customLabel").value = "";
  document.getElementById("customAliases").value = "";
  document.getElementById("customValue").value = "";

  renderCustomFields();
  setStatus("Custom field added.");
}

async function exportData() {
  const storage = await getStorage({
    [PROFILE_KEY]: DEFAULT_PROFILE,
    [CUSTOM_FIELDS_KEY]: [],
    [SETTINGS_KEY]: DEFAULT_SETTINGS
  });

  const blob = new Blob([JSON.stringify(storage, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "filify-data.json";
  a.click();
  URL.revokeObjectURL(url);
  setStatus("Data exported.");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      const payload = {
        [PROFILE_KEY]: { ...DEFAULT_PROFILE, ...(parsed[PROFILE_KEY] || {}) },
        [CUSTOM_FIELDS_KEY]: Array.isArray(parsed[CUSTOM_FIELDS_KEY]) ? parsed[CUSTOM_FIELDS_KEY] : [],
        [SETTINGS_KEY]: { ...DEFAULT_SETTINGS, ...(parsed[SETTINGS_KEY] || {}) }
      };

      await setStorage(payload);
      await loadAll();
      setStatus("Data imported successfully.");
    } catch (error) {
      setStatus(`Import failed: ${error?.message || "Invalid file"}`, true);
    }
  };

  reader.readAsText(file);
}

document.getElementById("saveBtn").addEventListener("click", saveAll);
document.getElementById("addCustomBtn").addEventListener("click", addCustomField);
document.getElementById("exportBtn").addEventListener("click", exportData);
document.getElementById("importInput").addEventListener("change", importData);

loadAll();
