"use strict";
(() => {
  // src/content.ts
  var nextId = 1;
  var injectFlag = (elementId, flag, location) => {
    const el = document.querySelector(
      `[data-plox-id="${elementId}"]`
    );
    if (!el || el.dataset["ploxProcessed"] === "true") return;
    const badge = document.createElement("span");
    badge.className = "plox-flag-badge";
    badge.textContent = flag;
    badge.title = location || "Unknown Location";
    el.prepend(badge);
    el.dataset["ploxProcessed"] = "true";
  };
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "visualizeFlag") {
      console.log(
        `[Plox] Flag for ${message.elementId}: ${message.flag} (${message.location})`
      );
      injectFlag(message.elementId, message.flag, message.location);
    }
  });
  var HANDLE_SELECTOR = [
    '[data-testid="User-Names"] span:last-child:not([data-plox-id])',
    'div[dir="ltr"] > span:first-child:not([data-plox-id])'
  ].join(", ");
  var scanForHandles = () => {
    const handleElements = document.querySelectorAll(HANDLE_SELECTOR);
    for (const el of handleElements) {
      const text = el.innerText;
      if (!text.startsWith("@")) continue;
      const handle = text.substring(1);
      const elementId = `plox-${nextId++}`;
      el.dataset["ploxId"] = elementId;
      console.debug(`[Plox] Discovered @${handle} (${elementId})`);
      chrome.runtime.sendMessage({
        action: "processHandle",
        handle,
        elementId
      });
    }
  };
  var scanPending = false;
  var scheduleScan = () => {
    if (scanPending) return;
    scanPending = true;
    requestIdleCallback(
      () => {
        scanPending = false;
        scanForHandles();
      },
      { timeout: 500 }
    );
  };
  var observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
  scanForHandles();
})();
