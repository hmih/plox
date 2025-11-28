const USERNAME_PATTERN = /@([a-zA-Z0-9_]{1,15})/;
const FLAG_CLASS = "xcom-flag-badge";
const STYLE_TAG_ID = "xcom-flag-style";
const PROFILE_CACHE = new Map();
const COLLECTED_USERNAMES = new Set();
const REGION_FLAGS = {
  "north america": "🇺🇸",
  "south america": "LAT",
  "latin america": "LAT",
  "central america": "LAT",
  "europe": "🇪🇺",
  "asia": "🌏",
  "africa": "🌍",
  "middle east": "🌍",
  "worldwide": "🌐",
  "global": "🌐",
  "oceania": "🌏",
  "australia": "🇦🇺",
  "new zealand": "🇳🇿"
};
const COUNTRY_CODE_BY_NAME = {
  "united states": "US",
  "usa": "US",
  "u.s.": "US",
  "united kingdom": "GB",
  "uk": "GB",
  "canada": "CA",
  "mexico": "MX",
  "brazil": "BR",
  "argentina": "AR",
  "colombia": "CO",
  "chile": "CL",
  "peru": "PE",
  "spain": "ES",
  "portugal": "PT",
  "france": "FR",
  "germany": "DE",
  "italy": "IT",
  "netherlands": "NL",
  "belgium": "BE",
  "sweden": "SE",
  "norway": "NO",
  "finland": "FI",
  "denmark": "DK",
  "ireland": "IE",
  "switzerland": "CH",
  "austria": "AT",
  "poland": "PL",
  "czech republic": "CZ",
  "hungary": "HU",
  "romania": "RO",
  "bulgaria": "BG",
  "greece": "GR",
  "turkey": "TR",
  "russia": "RU",
  "ukraine": "UA",
  "china": "CN",
  "india": "IN",
  "japan": "JP",
  "south korea": "KR",
  "singapore": "SG",
  "hong kong": "HK",
  "taiwan": "TW",
  "indonesia": "ID",
  "philippines": "PH",
  "malaysia": "MY",
  "thailand": "TH",
  "vietnam": "VN",
  "pakistan": "PK",
  "australia": "AU",
  "new zealand": "NZ",
  "nigeria": "NG",
  "kenya": "KE",
  "south africa": "ZA",
  "egypt": "EG",
  "morocco": "MA",
  "saudi arabia": "SA",
  "united arab emirates": "AE",
  "israel": "IL",
  "qatar": "QA",
  "kuwait": "KW",
  "bahrain": "BH"
};

const injectStylesheet = () => {
  if (document.getElementById(STYLE_TAG_ID)) {
    return;
  }

  const style = document.createElement("link");
  style.id = STYLE_TAG_ID;
  style.rel = "stylesheet";
  style.type = "text/css";
  style.href = chrome.runtime.getURL("styles.css");
  document.head.appendChild(style);
};

const alpha2ToFlag = (code) =>
  code
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .split("")
    .map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join("");

const normalizeLocation = (raw) => raw?.trim().toLowerCase() ?? "";

const locationToEmoji = (location) => {
  if (!location) {
    return null;
  }

  const normalized = normalizeLocation(location);

  if (REGION_FLAGS[normalized]) {
    return REGION_FLAGS[normalized];
  }

  const simplified = normalized.replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

  const directMatch = COUNTRY_CODE_BY_NAME[simplified] ?? COUNTRY_CODE_BY_NAME[normalized];
  if (directMatch) {
    return alpha2ToFlag(directMatch);
  }

  const fuzzyMatch = Object.keys(COUNTRY_CODE_BY_NAME).find((key) =>
    simplified.includes(key)
  );
  if (fuzzyMatch) {
    return alpha2ToFlag(COUNTRY_CODE_BY_NAME[fuzzyMatch]);
  }

  return null;
};

const parseLocationFromAbout = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const spans = Array.from(doc.querySelectorAll("span"));
  const label = spans.find(
    (span) => normalizeLocation(span.textContent) === "account based in"
  );

  if (!label) {
    return null;
  }

  // Try to find the next meaningful text node after the label
  const siblings = label.parentElement
    ? Array.from(label.parentElement.querySelectorAll("span"))
    : [];

  if (siblings.length > 1) {
    const labelIndex = siblings.indexOf(label);
    for (let i = labelIndex + 1; i < siblings.length; i += 1) {
      const text = siblings[i].textContent?.trim();
      if (text) {
        return text;
      }
    }
  }

  let pointer = label.parentElement?.nextElementSibling;
  while (pointer) {
    const text = pointer.textContent?.trim();
    if (text) {
      return text;
    }
    pointer = pointer.nextElementSibling;
  }

  return null;
};

const fetchLocationForUser = async (username) => {
  try {
    const response = await fetch(`https://x.com/${username}/about`, {
      credentials: "include"
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return parseLocationFromAbout(html);
  } catch (error) {
    return null;
  }
};

const getFlagForUser = (username) => {
  const key = username.toLowerCase();

  if (!PROFILE_CACHE.has(key)) {
    const promise = fetchLocationForUser(key).then((location) => {
      const flag = locationToEmoji(location) ?? "🌐";
      return flag ? { flag, location } : null;
    });

    PROFILE_CACHE.set(key, promise);
  }

  return PROFILE_CACHE.get(key);
};

const injectFlag = (element, flag) => {
  if (!element || !document.contains(element)) {
    return;
  }

  const existing = element.querySelector(`.${FLAG_CLASS}`);
  if (existing) {
    existing.textContent = `${flag} `;
    return;
  }

  const flagSpan = document.createElement("span");
  flagSpan.className = FLAG_CLASS;
  flagSpan.textContent = `${flag} `;
  flagSpan.setAttribute("aria-hidden", "true");

  const firstChild = Array.from(element.childNodes).find((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes("@")) {
      return true;
    }
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      node.textContent?.includes("@")
    ) {
      return true;
    }
    return false;
  });

  element.insertBefore(flagSpan, firstChild ?? element.firstChild);
};

const annotateHandleElement = (element, username) => {
  element.dataset.xFlagStatus = "pending";

  getFlagForUser(username)
    .then((result) => {
      if (!result || !result.flag) {
        element.dataset.xFlagStatus = "error";
        return;
      }

      injectFlag(element, result.flag);
      element.dataset.xFlagStatus = "done";
    })
    .catch(() => {
      element.dataset.xFlagStatus = "error";
    });
};

const handleCandidate = (element) => {
  if (!element || element.dataset.xFlagStatus === "pending") {
    return;
  }

  const text = element.textContent ?? "";
  const match = text.match(USERNAME_PATTERN);

  if (!match) {
    return;
  }

  const username = match[1];
  if (!username) {
    return;
  }

  if (element.querySelector(`.${FLAG_CLASS}`)) {
    return;
  }

  annotateHandleElement(element, username);
};

const scanForHandles = (root) => {
  if (!root) {
    return;
  }

  const processSpan = (span) => {
    if (span) {
      handleCandidate(span);
    }
  };

  if (root.nodeType === Node.TEXT_NODE) {
    processSpan(root.parentElement);
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) {
    if (root.tagName === "SPAN") {
      processSpan(root);
    }
    root.querySelectorAll("span").forEach(processSpan);
  }
};

const startObserving = () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        scanForHandles(node);
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
};

const init = () => {
  injectStylesheet();
  scanForHandles(document.body);
  startObserving();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
