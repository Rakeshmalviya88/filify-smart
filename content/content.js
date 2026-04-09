const FILIFY_KEYS = {
  profile: "profile",
  customFields: "customFields",
  settings: "settings"
};

const FIELD_MAP = {
  fullName: ["full name", "name", "applicant name", "candidate name"],
  firstName: ["first name", "given name"],
  lastName: ["last name", "surname", "family name"],
  email: ["email", "gmail", "mail id", "e-mail"],
  phone: ["phone", "mobile", "contact number", "phone number", "whatsapp"],
  college: ["college", "university", "institute"],
  srn: ["srn", "student id", "registration number", "roll number", "usn"],
  degree: ["degree", "qualification"],
  course: ["course", "program", "branch"],
  specialization: ["specialization", "major", "stream"],
  cgpa: ["cgpa", "gpa"],
  tenthPercentage: ["10th", "class 10", "ssc", "x percentage", "10th percentage"],
  twelfthPercentage: ["12th", "class 12", "hsc", "xii percentage", "12th percentage"],
  graduationYear: ["graduation year", "passing year", "year of graduation"],
  linkedin: ["linkedin"],
  github: ["github", "git hub"],
  portfolio: ["portfolio", "website", "personal site"],
  location: ["location", "city", "current city"],
  address: ["address", "residential address"],
  experienceYears: ["experience", "years of experience"],
  skills: ["skills", "technical skills", "key skills"],
  resumeUrl: ["resume", "cv", "resume link", "drive link"]
};

const DEFAULT_SETTINGS = {
  autofillEnabled: true,
  autoFillOnPageLoad: false,
  skipIfFieldHasValue: true
};

function getStorage(defaults) {
  return new Promise((resolve) => chrome.storage.local.get(defaults, resolve));
}

function normalize(text) {
  return (text || "").toLowerCase().replace(/[_\-:]+/g, " ").replace(/\s+/g, " ").trim();
}

function getFieldDescriptor(element) {
  const attrs = [
    element.name,
    element.id,
    element.placeholder,
    element.getAttribute("aria-label"),
    element.getAttribute("autocomplete"),
    element.getAttribute("data-testid"),
    element.getAttribute("title")
  ]
    .filter(Boolean)
    .join(" ");

  let labelText = "";

  if (element.id) {
    const explicitLabel = document.querySelector(`label[for=\"${CSS.escape(element.id)}\"]`);
    if (explicitLabel) {
      labelText += ` ${explicitLabel.textContent || ""}`;
    }
  }

  const wrappingLabel = element.closest("label");
  if (wrappingLabel) {
    labelText += ` ${wrappingLabel.textContent || ""}`;
  }

  // Google Forms keeps the question title in the listitem container.
  const questionContainer = element.closest("div[role='listitem']");
  if (questionContainer) {
    const questionNode = questionContainer.querySelector(
      "[role='heading'], .M7eMe, [jsname='r4nke'], legend"
    );
    if (questionNode) {
      labelText += ` ${questionNode.textContent || ""}`;
    }
  }

  return normalize(`${attrs} ${labelText}`);
}

function findMappedField(descriptor) {
  for (const [key, tokens] of Object.entries(FIELD_MAP)) {
    if (tokens.some((token) => descriptor.includes(token))) {
      return key;
    }
  }
  return null;
}

function findCustomFieldValue(descriptor, customFields) {
  for (const field of customFields) {
    const aliases = Array.isArray(field.aliases) ? field.aliases : [];
    const matchTokens = [field.key, field.label, ...aliases]
      .filter(Boolean)
      .map(normalize)
      .filter(Boolean);

    if (matchTokens.some((token) => descriptor.includes(token))) {
      return field.value || "";
    }
  }
  return "";
}

function setElementValue(element, value) {
  if (element.isContentEditable || element.getAttribute("role") === "textbox") {
    element.focus();
    element.textContent = String(value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.blur();
    return 1;
  }

  const tag = element.tagName.toLowerCase();
  const type = (element.type || "").toLowerCase();

  if (type === "checkbox") {
    const shouldCheck = ["true", "yes", "1", "checked"].includes(String(value).toLowerCase());
    element.checked = shouldCheck;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return shouldCheck ? 1 : 0;
  }

  if (type === "radio") {
    const group = document.querySelectorAll(`input[type=\"radio\"][name=\"${CSS.escape(element.name)}\"]`);
    const target = String(value).toLowerCase();

    for (const option of group) {
      const optionDescriptor = normalize(`${option.value} ${option.getAttribute("aria-label") || ""}`);
      const optionLabel = option.id
        ? normalize(document.querySelector(`label[for=\"${CSS.escape(option.id)}\"]`)?.textContent || "")
        : "";
      if (optionDescriptor.includes(target) || optionLabel.includes(target)) {
        option.checked = true;
        option.dispatchEvent(new Event("change", { bubbles: true }));
        return 1;
      }
    }
    return 0;
  }

  if (tag === "select") {
    const target = String(value).toLowerCase();
    const option = Array.from(element.options).find((opt) =>
      normalize(`${opt.value} ${opt.textContent}`).includes(target)
    );

    if (!option) {
      return 0;
    }

    element.value = option.value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return 1;
  }

  element.focus();

  // Use native setter so framework-controlled inputs (including Google Forms internals)
  // react to changes exactly like a user typing.
  const prototype = tag === "textarea" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (valueSetter) {
    valueSetter.call(element, String(value));
  } else {
    element.value = String(value);
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.blur();
  return 1;
}

function isFillableElement(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const tag = element.tagName.toLowerCase();
  const isEditableDiv = element.getAttribute("role") === "textbox" || element.isContentEditable;
  if (!["input", "textarea", "select", "div"].includes(tag) || (tag === "div" && !isEditableDiv)) {
    return false;
  }

  if (element.disabled || element.readOnly) {
    return false;
  }

  const type = (element.type || "").toLowerCase();
  if (["password", "file", "hidden", "submit", "button", "image"].includes(type)) {
    return false;
  }

  return true;
}

async function fillForm() {
  const storage = await getStorage({
    [FILIFY_KEYS.profile]: {},
    [FILIFY_KEYS.customFields]: [],
    [FILIFY_KEYS.settings]: DEFAULT_SETTINGS
  });

  const profile = storage[FILIFY_KEYS.profile] || {};
  const customFields = Array.isArray(storage[FILIFY_KEYS.customFields]) ? storage[FILIFY_KEYS.customFields] : [];
  const settings = { ...DEFAULT_SETTINGS, ...(storage[FILIFY_KEYS.settings] || {}) };

  if (!settings.autofillEnabled) {
    return { filledFields: 0, reason: "Autofill is disabled in settings." };
  }

  const elements = Array.from(
    document.querySelectorAll("input, textarea, select, div[role='textbox'], [contenteditable='true']")
  ).filter(isFillableElement);
  let filledFields = 0;

  for (const element of elements) {
    if (settings.skipIfFieldHasValue && String(element.value || "").trim()) {
      continue;
    }

    const descriptor = getFieldDescriptor(element);
    const mappedKey = findMappedField(descriptor);

    let value = "";
    if (mappedKey && profile[mappedKey]) {
      value = profile[mappedKey];
    } else {
      value = findCustomFieldValue(descriptor, customFields);
    }

    if (!value) {
      continue;
    }

    filledFields += setElementValue(element, value);
  }

  chrome.runtime.sendMessage({
    type: "FILIFY_LOG_APPLICATION",
    payload: {
      filledFields,
      pageTitle: document.title,
      pageUrl: location.href
    }
  });

  return { filledFields };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "FILIFY_FILL_FORM") {
    fillForm().then(sendResponse);
    return true;
  }
  return false;
});

(async function initAutofill() {
  const { settings } = await getStorage({ settings: DEFAULT_SETTINGS });
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };

  if (!merged.autofillEnabled || !merged.autoFillOnPageLoad) {
    return;
  }

  setTimeout(() => {
    fillForm();
  }, 900);
})();
