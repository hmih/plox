"use strict";
(() => {
  // src/content.ts
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (data && typeof data === "object" && data.type === "PLOX_DISCOVERED") {
      const { handle } = data;
      chrome.runtime.sendMessage({
        action: "processHandle",
        handle,
        elementId: "graphql-injected"
        // Legacy parameter, not used in nuclear mode
      });
    }
  });
  chrome.runtime.onMessage.addListener((message) => {
    const msg = message;
    if (msg.action === "visualizeFlag") {
      const update = {
        type: "PLOX_FLAG_UPDATE",
        handle: msg.handle ?? "",
        flag: msg.flag
      };
      window.postMessage(update, "*");
    } else if (msg.action === "lookupFailed") {
      window.postMessage(
        {
          type: "PLOX_RETRY",
          handle: msg.handle
        },
        "*"
      );
    }
  });
  console.log("[Plox] Bridge script initialized");
})();
