(() => {
  // ---------------------------------------------------------------------------
  // 1. CONFIGURATION
  // ---------------------------------------------------------------------------

  // Set to TRUE to see errors in the popup and send them to background console.
  // Set to FALSE for "Production" to be maximum stealth.
  const DEBUG_MODE = true;

  // Wrap entire script in a trap to prevent global console leaks
  try {
    const generateRandomString = () =>
      Math.random().toString(36).substring(2, 10);

    const CONFIG = {
      // Randomize IDs and Classes so x.com cannot hardcode selectors against them
      POPUP_HOST_ID: "h-" + generateRandomString(),
      FLAG_CLASS: "f-" + generateRandomString(),
      // Use a random data attribute to track processed elements internally
      ATTR_PROCESSED: "data-" + generateRandomString(),
      // Jitter timing (ms) - mimicks human processing speed
      MIN_DELAY: 331,
      MAX_DELAY: 1438,
    };

    // Internal state
    const PROCESSED_NODES = new WeakSet(); // WeakSet leaves no trace on the DOM objects
    const COLLECTED_USERNAMES = new Set();
    let POPUP_SHADOW_ROOT = null;
    let MUTATION_OBSERVER = null;
    let IS_FIRST_RUN = true;
    let hasProcessedFirstUser = false;

    // ---------------------------------------------------------------------------
    // 2. STYLES (Injected directly into Shadow DOM)
    // ---------------------------------------------------------------------------

    const SHADOW_STYLES = `
      .popup-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 320px;
        background: #000000;
        border: 1px solid #2f3336;
        border-radius: 16px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        z-index: 2147483647;
        box-shadow: 0 8px 16px rgba(255, 255, 255, 0.1);
        color: #e7e9ea;
        display: none;
        overflow: hidden;
      }
      .popup-header {
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.05);
        border-bottom: 1px solid #2f3336;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 700;
        font-size: 15px;
      }
      .close-btn {
        background: transparent;
        border: none;
        color: #71767b;
        cursor: pointer;
        font-size: 20px;
        padding: 4px;
      }
      .close-btn:hover { color: #fff; }
      .popup-content { padding: 16px; max-height: 50vh; overflow-y: auto; }
      .user-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid #2f3336;
      }
      .handle { color: #1d9bf0; }
      .flag-list { display: flex; flex-wrap: wrap; gap: 6px; }
      .country-badge {
        font-size: 12px;
        padding: 4px 8px;
        background: #16181c;
        border-radius: 9999px;
        color: #71767b;
        border: 1px solid transparent;
      }
      .country-badge.active {
        background: rgba(0, 186, 124, 0.1);
        color: #00ba7c;
        border-color: rgba(0, 186, 124, 0.3);
      }
      /* Debug Log Styles */
      .debug-log {
        margin-top: 0;
        padding: 8px;
        background: #150000;
        color: #ff8888;
        font-family: monospace;
        font-size: 11px;
        max-height: 100px;
        overflow-y: auto;
        border-top: 1px solid #440000;
        display: none;
      }
    `;

    // ---------------------------------------------------------------------------
    // 3. UTILITIES & LOGGING
    // ---------------------------------------------------------------------------

    const safeLog = (error, context = "General") => {
      if (!DEBUG_MODE) return;

      // 1. Send to Background (Invisible to site)
      const errorMsg =
        error && error.message ? error.message : error.toString();
      const stack = error && error.stack ? error.stack : "No stack";

      chrome.runtime.sendMessage({
        action: "logError",
        error: errorMsg,
        stack: stack,
        context: context,
      });

      // 2. Show in Shadow DOM Popup (Visible to you)
      if (POPUP_SHADOW_ROOT) {
        const logContainer = POPUP_SHADOW_ROOT.querySelector(".debug-log");
        const container = POPUP_SHADOW_ROOT.querySelector(".popup-container");
        if (logContainer && container) {
          const entry = document.createElement("div");
          entry.style.borderBottom = "1px solid #440000";
          entry.style.marginBottom = "4px";
          entry.innerHTML = `<strong style="color:#ff5555">${context}:</strong> ${errorMsg}`;
          logContainer.appendChild(entry);
          logContainer.style.display = "block";
          container.style.display = "block"; // Force popup open on error
        }
      }
    };

    const isVisible = (elem) => {
      if (!elem) return false;
      const style = window.getComputedStyle(elem);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        elem.offsetParent !== null
      );
    };

    // ---------------------------------------------------------------------------
    // 4. DATA MAPPING
    // ---------------------------------------------------------------------------

    const REGION_FLAGS = {
      "north america": "🇺🇸",
      "south america": "LAT",
      "latin america": "LAT",
      "central america": "LAT",
      europe: "🇪🇺",
      asia: "🌏",
      africa: "🌍",
      "middle east": "🌍",
      worldwide: "🌐",
      global: "🌐",
      oceania: "🌏",
      australia: "🇦🇺",
      "new zealand": "🇳🇿",
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

      const directMatch = Object.keys(COUNTRY_CODE_BY_NAME).find(
        (key) =>
          normalizeLocation(key) === simplified ||
          normalizeLocation(key) === normalized,
      );
      if (directMatch) return alpha2ToFlag(COUNTRY_CODE_BY_NAME[directMatch]);

      const fuzzyMatch = Object.keys(COUNTRY_CODE_BY_NAME).find((key) =>
        simplified.includes(normalizeLocation(key)),
      );
      if (fuzzyMatch) return alpha2ToFlag(COUNTRY_CODE_BY_NAME[fuzzyMatch]);

      return null;
    };

    // ---------------------------------------------------------------------------
    // 5. UI INJECTION
    // ---------------------------------------------------------------------------

    const createLocationsPopup = () => {
      if (document.getElementById(CONFIG.POPUP_HOST_ID)) return;

      const host = document.createElement("div");
      host.id = CONFIG.POPUP_HOST_ID;
      host.style.position = "fixed";
      host.style.zIndex = "2147483647"; // Max z-index
      document.body.appendChild(host);

      // CLOSED Shadow Root prevents page JS from seeing inside
      const shadow = host.attachShadow({ mode: "closed" });
      POPUP_SHADOW_ROOT = shadow;

      const styleEl = document.createElement("style");
      styleEl.textContent = SHADOW_STYLES;
      shadow.appendChild(styleEl);

      const wrapper = document.createElement("div");
      wrapper.className = "popup-container";
      wrapper.innerHTML = `
        <div class="popup-header">
          <span>Location Intel</span>
          <button class="close-btn">×</button>
        </div>
        <div class="popup-content"></div>
        <div class="debug-log"></div>
      `;

      wrapper.querySelector(".close-btn").onclick = () => {
        wrapper.style.display = "none";
      };

      shadow.appendChild(wrapper);
    };

    const updateLocationsPopup = () => {
      if (!POPUP_SHADOW_ROOT) createLocationsPopup();
      if (!POPUP_SHADOW_ROOT) return;

      chrome.runtime.sendMessage({ action: "getAllLocations" }, (response) => {
        if (chrome.runtime.lastError) {
          safeLog(chrome.runtime.lastError.message, "updateLocationsPopup");
          return;
        }
        if (!response) return;

        const container = POPUP_SHADOW_ROOT.querySelector(".popup-container");
        const content = POPUP_SHADOW_ROOT.querySelector(".popup-content");

        const sortedUsernames = Array.from(COLLECTED_USERNAMES).sort();
        const detectedLocation =
          sortedUsernames.length > 0
            ? response.locations?.[sortedUsernames[0]]
            : null;

        let html = "";

        if (sortedUsernames.length > 0) {
          const username = sortedUsernames[0];
          html += `
            <div class="user-row">
              <span class="handle">@${username}</span>
              <span>${detectedLocation || "Unknown"}</span>
            </div>
          `;
        }
        content.innerHTML = html;
        container.style.display = "block";
      });
    };

    const appendFlag = (targetElement, flag) => {
      if (!targetElement || !document.contains(targetElement)) return;

      if (PROCESSED_NODES.has(targetElement)) return;
      PROCESSED_NODES.add(targetElement);

      // Jitter: Random delay to look human
      const delay =
        Math.random() * (CONFIG.MAX_DELAY - CONFIG.MIN_DELAY) +
        CONFIG.MIN_DELAY;

      setTimeout(() => {
        if (!document.contains(targetElement)) return;

        const span = document.createElement("span");
        span.textContent = ` ${flag}`;
        span.className = CONFIG.FLAG_CLASS; // Random class
        span.style.fontStyle = "normal";
        span.style.marginLeft = "4px";
        span.style.opacity = "0.9";

        // SIBLING INJECTION (React Safe)
        if (targetElement.parentNode) {
          targetElement.parentNode.insertBefore(
            span,
            targetElement.nextSibling,
          );
        }
      }, delay);
    };

    // ---------------------------------------------------------------------------
    // 6. CORE LOGIC
    // ---------------------------------------------------------------------------

    const processUsername = (element, username) => {
      try {
        if (hasProcessedFirstUser) return;
        hasProcessedFirstUser = true;

        const key = username.toLowerCase();
        COLLECTED_USERNAMES.add(key);

        if (IS_FIRST_RUN) {
          IS_FIRST_RUN = false;
          updateLocationsPopup();
        }

        chrome.runtime.sendMessage(
          { action: "getLocation", username: key },
          (response) => {
            if (chrome.runtime.lastError) {
              safeLog(chrome.runtime.lastError.message, "getLocation Message");
              return;
            }
            if (response?.location) {
              const flag = locationToEmoji(response.location);
              if (flag) appendFlag(element, flag);
            }
          },
        );
      } catch (e) {
        safeLog(e, "processUsername");
      }
    };

    const handleCandidate = (element) => {
      try {
        if (PROCESSED_NODES.has(element)) return;

        // Anti-honeypot check
        if (!isVisible(element)) return;

        const text = element.textContent;
        // Strict pattern matching to avoid false positives
        if (!text || !text.startsWith("@") || text.includes(" ")) return;

        const match = text.match(/^@([a-zA-Z0-9_]{1,15})$/);
        if (match) {
          processUsername(element, match[1]);
        }
      } catch (e) {
        safeLog(e, "handleCandidate");
      }
    };

    const scanRoot = (root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (node) => {
          if (node.tagName === "SPAN" && node.textContent.startsWith("@")) {
            // Check if inside a tweet article.
            if (node.closest('article[data-testid="tweet"]')) {
              return NodeFilter.FILTER_ACCEPT;
            }
          }
          return NodeFilter.FILTER_SKIP;
        },
      });

      while (walker.nextNode()) {
        handleCandidate(walker.currentNode);
      }
    };

    const initObserver = () => {
      if (MUTATION_OBSERVER) return;

      MUTATION_OBSERVER = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              scanRoot(node);
            }
          }
        }
      });

      MUTATION_OBSERVER.observe(document.body, {
        childList: true,
        subtree: true,
      });
    };

    const main = () => {
      createLocationsPopup();
      scanRoot(document.body);
      initObserver();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", main, { once: true });
    } else {
      main();
    }
  } catch (e) {
    // If the global scope crashes, try to send one last message
    if (DEBUG_MODE) {
      chrome.runtime.sendMessage({
        action: "logError",
        error: e.toString(),
        context: "FATAL CRASH",
      });
    }
  }
})();
