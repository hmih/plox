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
    const syms = Object.getOwnPropertySymbols(document);
    const handshakeSym = syms.find((s) => s.toString() === "Symbol(x-compat-handshake)");
    if (handshakeSym) {
      const secureInterface = document[handshakeSym];
      if (secureInterface && typeof secureInterface.connect === "function") {
        const channel = new MessageChannel();
        secureInterface.connect(channel.port2);
        setupBridge(channel.port1);
        return true;
      }
    }
    return false;
  };
  var initHandshake = () => {
    if (checkHandshake()) return;
    const interval = setInterval(() => {
      if (checkHandshake()) {
        clearInterval(interval);
      }
    }, 50);
    setTimeout(() => clearInterval(interval), 5e3);
  };
  initHandshake();
})();
