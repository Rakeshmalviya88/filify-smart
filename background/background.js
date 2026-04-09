const STORAGE_KEYS = {
  PROFILE: "profile",
  CUSTOM_FIELDS: "customFields",
  SETTINGS: "settings",
  HISTORY: "history"
};

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

function getStorage(defaults) {
  return new Promise((resolve) => chrome.storage.local.get(defaults, resolve));
}

function setStorage(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

async function ensureDefaults() {
  const current = await getStorage({});
  const payload = {};

  if (!current[STORAGE_KEYS.PROFILE]) {
    payload[STORAGE_KEYS.PROFILE] = DEFAULT_PROFILE;
  }

  if (!Array.isArray(current[STORAGE_KEYS.CUSTOM_FIELDS])) {
    payload[STORAGE_KEYS.CUSTOM_FIELDS] = [];
  }

  if (!current[STORAGE_KEYS.SETTINGS]) {
    payload[STORAGE_KEYS.SETTINGS] = DEFAULT_SETTINGS;
  } else {
    payload[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      ...current[STORAGE_KEYS.SETTINGS]
    };
  }

  if (!Array.isArray(current[STORAGE_KEYS.HISTORY])) {
    payload[STORAGE_KEYS.HISTORY] = [];
  }

  if (Object.keys(payload).length) {
    await setStorage(payload);
  }
}

async function generateCoverLetter(input) {
  const storage = await getStorage({
    [STORAGE_KEYS.PROFILE]: DEFAULT_PROFILE,
    [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS
  });

  const profile = storage[STORAGE_KEYS.PROFILE] || DEFAULT_PROFILE;
  const settings = { ...DEFAULT_SETTINGS, ...(storage[STORAGE_KEYS.SETTINGS] || {}) };

  if (!settings.aiApiKey) {
    return {
      ok: false,
      error: "Add your AI API key in Filify settings before generating a cover letter."
    };
  }

  const userPrompt = [
    `Candidate Name: ${profile.fullName || profile.firstName || "Not provided"}`,
    `Email: ${profile.email || "Not provided"}`,
    `Phone: ${profile.phone || "Not provided"}`,
    `College: ${profile.college || "Not provided"}`,
    `Degree/Course: ${profile.degree || profile.course || "Not provided"}`,
    `CGPA: ${profile.cgpa || "Not provided"}`,
    `Skills: ${profile.skills || "Not provided"}`,
    `Experience (years): ${profile.experienceYears || "Not provided"}`,
    `LinkedIn: ${profile.linkedin || "Not provided"}`,
    `GitHub: ${profile.github || "Not provided"}`,
    "",
    `Target Role: ${input.role || "Not provided"}`,
    `Company: ${input.company || "Not provided"}`,
    `Job Description: ${input.jobDescription || "Not provided"}`,
    "",
    "Write a concise, human-sounding, customized cover letter (180-260 words).",
    "Avoid generic cliches. Keep tone professional and specific to this role.",
    "Output only the final cover letter text."
  ].join("\n");

  try {
    const response = await fetch(settings.aiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.aiApiKey}`
      },
      body: JSON.stringify({
        model: settings.aiModel,
        messages: [
          {
            role: "system",
            content:
              "You are an expert job application writer. Tailor each cover letter to the role using the candidate profile and job details."
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        temperature: 0.6
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        ok: false,
        error: `AI request failed (${response.status}). ${errText.slice(0, 400)}`
      };
    }

    const data = await response.json();
    const text =
      data?.choices?.[0]?.message?.content ||
      data?.output?.[0]?.content?.[0]?.text ||
      "";

    if (!text.trim()) {
      return {
        ok: false,
        error: "AI returned an empty response."
      };
    }

    return {
      ok: true,
      coverLetter: text.trim()
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Failed to generate cover letter."
    };
  }
}

async function appendHistory(entry) {
  const storage = await getStorage({ [STORAGE_KEYS.HISTORY]: [] });
  const history = Array.isArray(storage[STORAGE_KEYS.HISTORY]) ? storage[STORAGE_KEYS.HISTORY] : [];

  history.unshift({
    ...entry,
    timestamp: Date.now()
  });

  await setStorage({ [STORAGE_KEYS.HISTORY]: history.slice(0, 50) });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults();
});

chrome.runtime.onStartup.addListener(() => {
  ensureDefaults();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-current-form") {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "FILIFY_FILL_FORM" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "FILIFY_GENERATE_COVER_LETTER") {
    generateCoverLetter(message.payload || {}).then(sendResponse);
    return true;
  }

  if (message?.type === "FILIFY_GET_HISTORY") {
    getStorage({ [STORAGE_KEYS.HISTORY]: [] }).then((storage) => {
      sendResponse({ history: storage[STORAGE_KEYS.HISTORY] || [] });
    });
    return true;
  }

  if (message?.type === "FILIFY_LOG_APPLICATION") {
    appendHistory({
      pageTitle: message.payload?.pageTitle || sender?.tab?.title || "Unknown page",
      pageUrl: message.payload?.pageUrl || sender?.tab?.url || "",
      filledFields: Number(message.payload?.filledFields || 0)
    }).then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});
