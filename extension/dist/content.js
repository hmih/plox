"use strict";
(() => {
  // src/content.ts
  var setupBridge = (port) => {
    port.onmessage = (event) => {
      const data = event.data;
      if (data.type === "__DATA_LAYER_SYNC__") {
        const { handle } = data;
        chrome.storage.local.get([`cache:${handle}`], (result) => {
          const cached = result[`cache:${handle}`];
          if (cached) {
            port.postMessage({
              type: "__DATA_LAYER_UPDATE__",
              handle,
              flag: cached.flag
            });
          } else {
            chrome.runtime.sendMessage({
              action: "processHandle",
              handle,
              elementId: "graphql-injected"
            });
          }
        });
      }
    };
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === "visualizeFlag") {
        port.postMessage({
          type: "__DATA_LAYER_UPDATE__",
          handle: message.handle ?? "",
          flag: message.flag
        });
      } else if (message.action === "lookupFailed") {
        port.postMessage({
          type: "__DATA_LAYER_RETRY__",
          handle: message.handle
        });
      }
    });
  };
  var checkHandshake = () => {
    const handshakeId = document.documentElement.getAttribute("data-x-compat-id");
    if (handshakeId) {
      const channel = new MessageChannel();
      document.dispatchEvent(
        new CustomEvent(handshakeId, { detail: channel.port2 })
      );
      setupBridge(channel.port1);
      return true;
    }
    return false;
  };
  var observer = new MutationObserver((mutations) => {
    if (checkHandshake()) {
      observer.disconnect();
    }
  });
  if (!checkHandshake()) {
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-x-compat-id"]
    });
  }
})();
