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
    austria: "\u{1F1E6}\u{1F1F9}",
  };
  var parseLocationFromHtml = (html) => {
    if (!html) throw new Error("Input HTML is empty or null");
    const needle = "Account based in";
    const needleIndex = html.indexOf(needle);
    if (needleIndex !== -1) {
      const startSearchIndex = needleIndex + needle.length;
      const snippet = html.substring(startSearchIndex, startSearchIndex + 300);
      const extractionRegex = /^(?:<[^>]+>|\s)+([^<]+)/;
      const match = snippet.match(extractionRegex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    const uiMatch = html.match(/data-testid="UserLocation"[^>]*>([^<]+)</);
    if (uiMatch && uiMatch[1]) return uiMatch[1].trim();
    const jsonMatch = html.match(
      /"contentLocation":{"@type":"Place","name":"(.*?)"}/,
    );
    if (jsonMatch && jsonMatch[1]) return jsonMatch[1].trim();
    return null;
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
      const offset = 127397;
      return (
        String.fromCodePoint(code.charCodeAt(0) + offset) +
        String.fromCodePoint(code.charCodeAt(1) + offset)
      );
    }
    return "\u{1F3F3}\uFE0F";
  };
  var generateGaussianDelay = (min, max) => {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    let z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    const mean = (min + max) / 2;
    const stdDev = (max - min) / 6;
    return Math.max(min, Math.min(max, Math.round(z * stdDev + mean)));
  };

  // src/background.ts
  var cache = /* @__PURE__ */ new Map();
  var pending = /* @__PURE__ */ new Set();
  var performInvestigation = async (handle, tabId, elementId) => {
    if (cache.has(handle)) {
      const cached = cache.get(handle);
      if (cached) {
        const { location, flag } = cached;
        chrome.tabs.sendMessage(tabId, {
          action: "visualizeFlag",
          elementId,
          flag,
          location,
        });
        return;
      }
    }
    if (pending.has(handle)) {
      console.debug(
        `[Worker] @${handle} is already being investigated. Skipping redundant request.`,
      );
      return;
    }
    pending.add(handle);
    console.log(
      `\u{1F575}\uFE0F [Investigator] Starting fresh check for @${handle}`,
    );
    try {
      const delay = generateGaussianDelay(1e3, 3e3);
      if (typeof globalThis.TEST_ENV === "undefined") {
        await new Promise((r) => setTimeout(r, delay));
      }
      const url = `https://x.com/${handle}/about`;
      console.log(`[Worker] Fetching ${url}`);
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "text/html",
          "Upgrade-Insecure-Requests": "1",
          "User-Agent":
            typeof navigator !== "undefined"
              ? navigator.userAgent
              : "PloxBot/1.0",
        },
      });
      if (!response.ok)
        throw new Error(`Fetch failed with status ${response.status}`);
      const html = await response.text();
      const location = parseLocationFromHtml(html);
      if (!location) {
        console.warn(
          `[Worker] Could not parse location for @${handle}. Raw HTML Snippet: ${html.substring(0, 500)}`,
        );
        throw new Error("Location extraction failed");
      }
      const flag = getFlagEmoji(location);
      cache.set(handle, { location, flag });
      console.log(`\u2705 [Success] @${handle} -> ${location} ${flag}`);
      chrome.tabs.sendMessage(tabId, {
        action: "visualizeFlag",
        elementId,
        flag,
        location,
      });
    } catch (err) {
      console.error(`\u274C [Error] @${handle}:`, err.message);
    } finally {
      pending.delete(handle);
    }
  };
  if (
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.onMessage
  ) {
    chrome.runtime.onMessage.addListener((request, sender) => {
      if (
        request.action === "processHandle" &&
        sender.tab &&
        sender.tab.id !== void 0
      ) {
        performInvestigation(request.handle, sender.tab.id, request.elementId);
      }
      return true;
    });
  }
})();
