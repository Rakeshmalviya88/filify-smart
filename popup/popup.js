const SETTINGS_KEY = "settings";

const defaultSettings = {
  autofillEnabled: true
};

const fillNowBtn = document.getElementById("fillNowBtn");
const openOptionsBtn = document.getElementById("openOptionsBtn");
const autofillToggle = document.getElementById("autofillToggle");
const statusEl = document.getElementById("status");

const roleInput = document.getElementById("roleInput");
const companyInput = document.getElementById("companyInput");
const jdInput = document.getElementById("jdInput");
const generateBtn = document.getElementById("generateBtn");
const coverLetterOutput = document.getElementById("coverLetterOutput");
const historyList = document.getElementById("historyList");

function getStorage(defaults) {
  return new Promise((resolve) => chrome.storage.local.get(defaults, resolve));
}

function setStorage(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#b42318" : "#1e7f49";
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadSettings() {
  const storage = await getStorage({ [SETTINGS_KEY]: defaultSettings });
  const settings = { ...defaultSettings, ...(storage[SETTINGS_KEY] || {}) };
  autofillToggle.checked = Boolean(settings.autofillEnabled);
}

async function saveAutofillToggle() {
  const storage = await getStorage({ [SETTINGS_KEY]: defaultSettings });
  const settings = { ...defaultSettings, ...(storage[SETTINGS_KEY] || {}) };
  settings.autofillEnabled = autofillToggle.checked;
  await setStorage({ [SETTINGS_KEY]: settings });
  setStatus(`Autofill ${settings.autofillEnabled ? "enabled" : "disabled"}.`);
}

async function fillCurrentForm() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    setStatus("No active tab found.", true);
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "FILIFY_FILL_FORM" }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Open a webpage first, then retry autofill.", true);
      return;
    }

    const count = Number(response?.filledFields || 0);
    setStatus(`Filled ${count} field${count === 1 ? "" : "s"}.`);
  });
}

async function generateCoverLetter() {
  coverLetterOutput.value = "";
  setStatus("Generating cover letter...");

  chrome.runtime.sendMessage(
    {
      type: "FILIFY_GENERATE_COVER_LETTER",
      payload: {
        role: roleInput.value.trim(),
        company: companyInput.value.trim(),
        jobDescription: jdInput.value.trim()
      }
    },
    (response) => {
      if (chrome.runtime.lastError) {
        setStatus("Failed to contact background service.", true);
        return;
      }

      if (!response?.ok) {
        setStatus(response?.error || "Could not generate cover letter.", true);
        return;
      }

      coverLetterOutput.value = response.coverLetter;
      setStatus("Cover letter generated.");
    }
  );
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "Unknown time";
  }
}

async function loadHistory() {
  chrome.runtime.sendMessage({ type: "FILIFY_GET_HISTORY" }, (response) => {
    const history = Array.isArray(response?.history) ? response.history.slice(0, 5) : [];

    if (!history.length) {
      historyList.innerHTML = "<li>No activity yet.</li>";
      return;
    }

    historyList.innerHTML = history
      .map((entry) => {
        const title = (entry.pageTitle || "Untitled page").replace(/[<>]/g, "");
        const fields = Number(entry.filledFields || 0);
        return `<li>${title}<br/>${fields} fields · ${formatTime(entry.timestamp)}</li>`;
      })
      .join("");
  });
}

fillNowBtn.addEventListener("click", fillCurrentForm);
openOptionsBtn.addEventListener("click", () => chrome.runtime.openOptionsPage());
autofillToggle.addEventListener("change", saveAutofillToggle);
generateBtn.addEventListener("click", generateCoverLetter);

loadSettings();
loadHistory();
