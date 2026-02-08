"use strict";
(() => {
  // src/core.ts
  var REGION_FLAGS = {
    "united states": "\u{1F1FA}\u{1F1F8}",
    usa: "\u{1F1FA}\u{1F1F8}",
    uk: "\u{1F1EC}\u{1F1E7}",
    "united kingdom": "\u{1F1EC}\u{1F1E7}",
    canada: "\u{1F1E8}\u{1F1E6}",
    germany: "\u{1F1E9}\u{1F1EA}",
    france: "\u{1F1EB}\u{1F1F7}",
    australia: "\u{1F1E6}\u{1F1FA}",
    japan: "\u{1F1EF}\u{1F1F5}",
    brazil: "\u{1F1E7}\u{1F1F7}",
    india: "\u{1F1EE}\u{1F1F3}",
    china: "\u{1F1E8}\u{1F1F3}",
    europe: "\u{1F1EA}\u{1F1FA}",
    asia: "\u{1F30F}",
    africa: "\u{1F30D}",
    global: "\u{1F310}",
    austria: "\u{1F1E6}\u{1F1F9}"
  };
  var getFlagEmoji = (locationName) => {
    if (!locationName) return "\u{1F3F3}\uFE0F";
    const cleanName = locationName.trim();
    const lower = cleanName.toLowerCase();
    for (const [key, emoji] of Object.entries(REGION_FLAGS)) {
      if (lower.includes(key)) return emoji;
    }
    const countryCodeMatch = cleanName.match(/\b([A-Z]{2})\b/);
    if (countryCodeMatch) {
      const code = countryCodeMatch[1];
      if (code) {
        const offset = 127397;
        return String.fromCodePoint(code.charCodeAt(0) + offset) + String.fromCodePoint(code.charCodeAt(1) + offset);
      }
    }
    return "\u{1F3F3}\uFE0F";
  };

  // src/background.ts
  var PLOX_SERVER = true ? "https://plox.krepost.xy" : "https://plox.krepost.xy";
  var cache = /* @__PURE__ */ new Map();
  var pending = /* @__PURE__ */ new Set();
  var performInvestigation = async (handle, tabId, elementId) => {
    if (cache.has(handle)) {
      const cached = cache.get(handle);
      if (cached) {
        console.log(`[Plox] Cache hit for @${handle}: ${cached.flag}`);
        chrome.tabs.sendMessage(tabId, {
          action: "visualizeFlag",
          elementId,
          flag: cached.flag,
          location: cached.location
        });
        return;
      }
    }
    if (pending.has(handle)) {
      console.debug(`[Plox] @${handle} already pending, skipping`);
      return;
    }
    pending.add(handle);
    try {
      const url = `${PLOX_SERVER}/met?username=${encodeURIComponent(handle)}`;
      console.log(`[Plox] Querying server for @${handle}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      console.log(`[Plox] Server response for @${handle}:`, data);
      if (data.processed && data.location) {
        const flag = getFlagEmoji(data.location);
        cache.set(handle, { location: data.location, flag });
        console.log(`[Plox] @${handle} -> ${data.location} ${flag}`);
        chrome.tabs.sendMessage(tabId, {
          action: "visualizeFlag",
          elementId,
          flag,
          location: data.location
        });
      } else {
        console.log(`[Plox] @${handle} registered but not yet processed`);
      }
    } catch (err) {
      console.error(`[Plox] Error for @${handle}:`, err.message);
    } finally {
      pending.delete(handle);
    }
  };
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender) => {
      if (request.action === "processHandle" && sender.tab && sender.tab.id !== void 0) {
        performInvestigation(request.handle, sender.tab.id, request.elementId);
      }
      return true;
    });
  }
})();
