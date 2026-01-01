"use strict";
(() => {
  // src/content.ts
  var nextId = 1;
  var injectFlag = (elementId, flag, location) => {
    const el = document.querySelector(`[data-plox-id="${elementId}"]`);
    if (!el || el.dataset.ploxProcessed === "true") return;
    const badge = document.createElement("span");
    badge.className = "plox-flag-badge";
    badge.textContent = flag;
    badge.title = location || "Unknown Location";
    el.prepend(badge);
    el.dataset.ploxProcessed = "true";
  };
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "visualizeFlag") {
      injectFlag(message.elementId, message.flag, message.location);
    }
  });
  var scanForHandles = () => {
    const handleElements = document.querySelectorAll(
      '[data-testid="User-Names"] span:last-child, div[dir="ltr"] > span:first-child'
    );
    handleElements.forEach((el) => {
      const htmlEl = el;
      const text = htmlEl.innerText;
      if (text.startsWith("@") && !htmlEl.dataset.ploxId) {
        const handle = text.substring(1);
        const elementId = `plox-${nextId++}`;
        htmlEl.dataset.ploxId = elementId;
        chrome.runtime.sendMessage({ action: "processHandle", handle, elementId });
      }
    });
  };
  var observer = new MutationObserver(() => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(scanForHandles, { timeout: 500 });
    } else {
      setTimeout(scanForHandles, 200);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  scanForHandles();
})();
