"use strict";
(() => {
  // src/content.ts
  var channel = new MessageChannel();
  var port = channel.port1;
  window.postMessage({ type: "__INITIAL_STATE__" }, "*", [channel.port2]);
  port.onmessage = (event) => {
    const data = event.data;
    if (data.type === "__DATA_LAYER_SYNC__") {
      const { handle } = data;
      chrome.runtime.sendMessage({
        action: "processHandle",
        handle,
        elementId: "graphql-injected"
      });
    }
  };
  chrome.runtime.onMessage.addListener((message) => {
    const msg = message;
    if (msg.action === "visualizeFlag") {
      port.postMessage({
        type: "__DATA_LAYER_UPDATE__",
        handle: msg.handle ?? "",
        flag: msg.flag
      });
    } else if (msg.action === "lookupFailed") {
      port.postMessage({
        type: "__DATA_LAYER_RETRY__",
        handle: msg.handle
      });
    }
  });
  console.log("[Plox] Bridge script initialized");
})();
