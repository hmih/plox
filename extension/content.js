(() => {
  // 1. RANDOMIZATION UTILITIES
  // We generate random strings so the site cannot query specific IDs/Classes
  const generateId = () => "x" + Math.random().toString(36).substr(2, 9);

  const CONSTANTS = {
    POPUP_HOST_ID: generateId(),
    FLAG_CLASS: generateId(), // Random class for the flag
    ATTR_PROCESSED: "data-" + generateId(), // Random attribute to mark processed nodes
  };

  // 2. INTERNAL STATE
  const PROCESSED_ELEMENTS = new WeakSet();
  const COLLECTED_USERNAMES = new Set();
  let FIRST_USERNAME_PROCESSED = false;
  let MUTATION_OBSERVER = null;

  // Store reference to the Shadow Root so we can update the popup later
  let POPUP_SHADOW_ROOT = null;

  // 3. DATA LISTS (Kept same as your original)
  const REGION_FLAGS = {
    "north america": "🇺🇸",
    "south america": "LAT",
    "latin america": "LAT",
    "central america": "LAT",
    europe: "🌏",
    asia: "🌏",
    africa: "🌍",
    "middle east": "🌍",
    worldwide: "🌐",
    global: "🌐",
    oceania: "🌐",
    australia: "🌏",
    "new zealand": "🌏",
  };

  const COUNTRY_CODE_BY_NAME = {
    "United States": "US",
    USA: "US",
    "U.S.": "US",
    "United Kingdom": "GB",
    UK: "GB",
    Canada: "CA",
    Mexico: "MX",
    Brazil: "BR",
    Argentina: "AR",
    Colombia: "CO",
    Chile: "CL",
    Peru: "PE",
    Spain: "ES",
    Portugal: "PT",
    France: "FR",
    Germany: "DE",
    Italy: "IT",
    Netherlands: "NL",
    Belgium: "BE",
    Sweden: "SE",
    Norway: "NO",
    Finland: "FI",
    Denmark: "DK",
    Ireland: "IE",
    Switzerland: "CH",
    Austria: "AT",
    Poland: "PL",
    "Czech Republic": "CZ",
    Hungary: "HU",
    Romania: "RO",
    Bulgaria: "BG",
    Greece: "GR",
    Turkey: "TR",
    Russia: "RU",
    Ukraine: "UA",
    China: "CN",
    India: "IN",
    Japan: "JP",
    "South Korea": "KR",
    Singapore: "SG",
    "Hong Kong": "HK",
    Taiwan: "TW",
    Indonesia: "ID",
    Philippines: "PH",
    Malaysia: "MY",
    Thailand: "TH",
    Vietnam: "VN",
    Pakistan: "PK",
    Australia: "AU",
    "New Zealand": "NZ",
    Nigeria: "NG",
    Kenya: "KE",
    "South Africa": "ZA",
    Egypt: "EG",
    Morocco: "MA",
    "Saudi Arabia": "SA",
    "United Arab Emirates": "AE",
    Israel: "IL",
    Qatar: "QA",
    Kuwait: "KW",
    Bahrain: "BH",
  };

  // 4. CSS STYLES (Injected as string to avoid chrome-extension:// requests)
  const POPUP_CSS = `
    .xcom-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      background: #000;
      color: #fff;
      border: 1px solid #333;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      font-size: 14px;
      display: none; /* Hidden by default */
    }
    .header {
      padding: 12px 16px;
      border-bottom: 1px solid #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: bold;
    }
    .close-btn {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      font-size: 20px;
    }
    .content {
      padding: 16px;
      max-height: 400px;
      overflow-y: auto;
    }
    .detected-row {
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #333;
    }
    .username { color: #1d9bf0; margin-right: 8px; }
    .location { color: #e7e9ea; }
    .country-tag {
      display: inline-block;
      padding: 4px 8px;
      margin: 2px;
      background: #16181c;
      border-radius: 4px;
      font-size: 12px;
      color: #71767b;
    }
    .country-tag.highlight {
      background: #00ba7c33;
      color: #00ba7c;
      border: 1px solid #00ba7c;
    }
  `;

  // 5. HELPER FUNCTIONS
  const alpha2ToFlag = (code) =>
    code
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .split("")
      .map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
      .join("");

  const normalizeLocation = (raw) => raw?.trim().toLowerCase() ?? "";

  const locationToEmoji = (location) => {
    if (!location) return null;
    const normalized = normalizeLocation(location);

    if (REGION_FLAGS[normalized]) return REGION_FLAGS[normalized];

    const simplified = normalized
      .replace(/[^a-z ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Exact/Simplified Match
    const directMatch = Object.keys(COUNTRY_CODE_BY_NAME).find(
      (key) =>
        normalizeLocation(key) === simplified ||
        normalizeLocation(key) === normalized,
    );
    if (directMatch) return alpha2ToFlag(COUNTRY_CODE_BY_NAME[directMatch]);

    // Fuzzy Match
    const fuzzyMatch = Object.keys(COUNTRY_CODE_BY_NAME).find((key) =>
      simplified.includes(normalizeLocation(key)),
    );
    if (fuzzyMatch) return alpha2ToFlag(COUNTRY_CODE_BY_NAME[fuzzyMatch]);

    return null;
  };

  // 6. DOM MANIPULATION (The Safe Way)

  const appendFlag = (element, flag) => {
    if (!element || !document.contains(element)) return;

    // Check if we already appended a sibling to this specific element
    // We use a custom attribute on the element to track it without querying class names
    if (element.getAttribute(CONSTANTS.ATTR_PROCESSED)) return;

    const flagSpan = document.createElement("span");
    flagSpan.textContent = ` ${flag}`;
    flagSpan.className = CONSTANTS.FLAG_CLASS; // Random class name
    flagSpan.style.fontStyle = "normal";
    flagSpan.style.marginLeft = "4px";

    // SAFETY: We insert AFTER the element, not INSIDE it.
    // Inserting inside breaks React's hydration of the username text node.
    if (element.parentNode) {
      element.parentNode.insertBefore(flagSpan, element.nextSibling);
      element.setAttribute(CONSTANTS.ATTR_PROCESSED, "true");
    }
  };

  const processUsername = (element, username) => {
    if (FIRST_USERNAME_PROCESSED) return;

    const key = username.toLowerCase();
    FIRST_USERNAME_PROCESSED = true;

    COLLECTED_USERNAMES.add(key);
    updateLocationsPopup();

    if (MUTATION_OBSERVER) {
      MUTATION_OBSERVER.disconnect();
      MUTATION_OBSERVER = null;
    }

    chrome.runtime.sendMessage(
      { action: "getLocation", username: key },
      (response) => {
        if (chrome.runtime.lastError) return;

        if (response && response.location) {
          const flag = locationToEmoji(response.location) ?? "🌐";
          appendFlag(element, flag);
        }
        updateLocationsPopup();
      },
    );
  };

  const handleCandidate = (element) => {
    if (!element || PROCESSED_ELEMENTS.has(element)) return;

    const text = element.textContent ?? "";
    // Only process if it looks exactly like a handle to avoid false positives in bio text
    if (!text.startsWith("@")) return;

    const match = text.match(/@([a-zA-Z0-9_]{1,15})/);
    if (!match) return;

    const username = match[1];
    PROCESSED_ELEMENTS.add(element);
    processUsername(element, username);
  };

  const scanForHandles = (root) => {
    if (!root || FIRST_USERNAME_PROCESSED) return;

    // Twitter uses specific span structures. We look for spans starting with @
    const nodes = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (node) => {
        if (node.tagName === "SPAN" && node.textContent.startsWith("@")) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    });

    let currentNode;
    while ((currentNode = nodes.nextNode())) {
      handleCandidate(currentNode);
      if (FIRST_USERNAME_PROCESSED) break;
    }
  };

  const startObserving = () => {
    if (FIRST_USERNAME_PROCESSED) return;

    MUTATION_OBSERVER = new MutationObserver((mutations) => {
      if (FIRST_USERNAME_PROCESSED) {
        MUTATION_OBSERVER.disconnect();
        MUTATION_OBSERVER = null;
        return;
      }

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            scanForHandles(node);
          }
        }
      }
    });

    MUTATION_OBSERVER.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  // 7. SHADOW DOM POPUP (Stealth Mode)

  const createLocationsPopup = () => {
    // Check if host already exists
    if (document.getElementById(CONSTANTS.POPUP_HOST_ID)) return;

    // Create the host - this sits in the light DOM but is empty
    const host = document.createElement("div");
    host.id = CONSTANTS.POPUP_HOST_ID;
    document.body.appendChild(host);

    // Create Shadow Root (Closed mode hides it from JS on the page)
    const shadow = host.attachShadow({ mode: "closed" });
    POPUP_SHADOW_ROOT = shadow; // Save reference

    // Inject Styles inside Shadow DOM
    const style = document.createElement("style");
    style.textContent = POPUP_CSS;
    shadow.appendChild(style);

    // Create Container
    const container = document.createElement("div");
    container.className = "xcom-container";
    container.innerHTML = `
      <div class="header">
        <span>Detected Locations</span>
        <button class="close-btn">×</button>
      </div>
      <div class="content"></div>
    `;

    // Event Listeners (Must be attached within shadow context)
    container.querySelector(".close-btn").addEventListener("click", () => {
      container.style.display = "none";
    });

    shadow.appendChild(container);
  };

  const getUniqueCountryNames = () => {
    const uniqueCountries = new Set();
    Object.entries(COUNTRY_CODE_BY_NAME).forEach(([name, code]) => {
      uniqueCountries.add(name);
    });
    return Array.from(uniqueCountries).sort();
  };

  const updateLocationsPopup = () => {
    if (!POPUP_SHADOW_ROOT) createLocationsPopup();
    if (!POPUP_SHADOW_ROOT) return; // Safety check

    const container = POPUP_SHADOW_ROOT.querySelector(".xcom-container");
    const content = POPUP_SHADOW_ROOT.querySelector(".content");

    chrome.runtime.sendMessage({ action: "getAllLocations" }, (response) => {
      if (!response) return;

      const sortedUsernames = Array.from(COLLECTED_USERNAMES).sort();
      const allCountries = getUniqueCountryNames();

      // Determine currently detected location
      const detectedLocation =
        sortedUsernames.length > 0
          ? response.locations?.[sortedUsernames[0]]
          : null;

      let html = "";

      if (sortedUsernames.length > 0) {
        const username = sortedUsernames[0];
        const locationText = detectedLocation
          ? detectedLocation
          : detectedLocation === null
            ? "Not found"
            : "Fetching...";

        html += `<div class="detected-row">
          <span class="username">@${username}</span>
          <span class="location">${locationText}</span>
        </div>`;
      }

      html += `<div>
        <div style="margin-bottom:8px; color:#888; font-size:12px">Recognized Countries</div>
        <div>
          ${allCountries
            .map((country) => {
              const isDetected =
                detectedLocation &&
                normalizeLocation(detectedLocation) ===
                  normalizeLocation(country);
              return `<span class="country-tag ${isDetected ? "highlight" : ""}">${country}</span>`;
            })
            .join("")}
        </div>
      </div>`;

      content.innerHTML = html;
      container.style.display = "block";
    });
  };

  // 8. INITIALIZATION
  const init = () => {
    createLocationsPopup();
    scanForHandles(document.body);
    startObserving();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
