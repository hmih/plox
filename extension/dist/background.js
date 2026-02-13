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
  var REGIONAL_INDICATOR_OFFSET = 127397;
  var getFlagEmoji = (locationName) => {
    if (!locationName) return "\u{1F3F3}\uFE0F";
    const trimmed = locationName.trim();
    const lower = trimmed.toLowerCase();
    for (const [key, emoji] of Object.entries(REGION_FLAGS)) {
      if (lower.includes(key)) return emoji;
    }
    const code = trimmed.match(/\b([A-Z]{2})\b/)?.[1];
    if (code) {
      return String.fromCodePoint(code.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET) + String.fromCodePoint(code.charCodeAt(1) + REGIONAL_INDICATOR_OFFSET);
    }
    return "\u{1F3F3}\uFE0F";
  };

  // src/background.ts
  var PLOX_SERVER = true ? "https://plox.krepost.xy" : "https://plox.krepost.xy";
  var cache = /* @__PURE__ */ new Map();
  var pending = /* @__PURE__ */ new Set();
  var performInvestigation = async (handle, tabId, elementId) => {
    const cached = cache.get(handle);
    if (cached) {
      chrome.tabs.sendMessage(tabId, {
        action: "visualizeFlag",
        handle,
        elementId,
        flag: cached.flag,
        location: cached.location
      });
      return;
    }
    if (pending.has(handle)) {
      return;
    }
    pending.add(handle);
    try {
      const url = `${PLOX_SERVER}/met?username=${encodeURIComponent(handle)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      if (data.processed && data.location) {
        const flag = getFlagEmoji(data.location);
        const entry = { location: data.location, flag };
        cache.set(handle, entry);
        chrome.storage.local.set({ [`cache:${handle}`]: entry });
        chrome.tabs.sendMessage(tabId, {
          action: "visualizeFlag",
          handle,
          elementId,
          flag,
          location: data.location
        });
      }
    } catch (err) {
      chrome.tabs.sendMessage(tabId, {
        action: "lookupFailed",
        handle
      });
    } finally {
      pending.delete(handle);
    }
  };
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(
      (request, sender) => {
        if (request.action !== "processHandle") return;
        if (!sender.tab?.id) {
          return;
        }
        performInvestigation(request.handle, sender.tab.id, request.elementId);
      }
    );
  }
})();
