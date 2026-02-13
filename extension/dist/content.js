"use strict";
(() => {
  // src/content.ts
  var setupBridge = (port) => {
    console.log("[Content] Bridge setup complete.");
    port.onmessage = (event) => {
      const data = event.data;
      console.log("[Content] Bridge received message:", data.type);
      if (data.type === "__DATA_LAYER_SYNC__") {
        const { handle } = data;
        console.log(`[Content] SYNC requested for ${handle}`);
        if (typeof chrome !== "undefined" && chrome.storage) {
          chrome.storage.local.get([`cache:${handle}`], (result) => {
            console.log(`[Content] Storage result for ${handle}:`, result);
            const cached = result[`cache:${handle}`];
            if (cached) {
              port.postMessage({
                type: "__DATA_LAYER_UPDATE__",
                handle,
                flag: cached.flag
              });
            } else {
              console.log(`[Content] Sending processHandle to background for ${handle}`);
              chrome.runtime.sendMessage({
                action: "processHandle",
                handle,
                elementId: "graphql-injected"
              });
            }
          });
        } else {
          console.error("[Content] chrome.storage is missing!");
        }
      }
    };
    chrome.runtime.onMessage.addListener((message) => {
      console.log("[Content] Received runtime message:", message.action);
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
    console.log("[Content] Message listener added.");
  };
  var checkHandshake = () => {
    const syms = Object.getOwnPropertySymbols(document);
    console.log("[Content] Scanning symbols on document. Found:", syms.length, syms.map((s) => s.toString()));
    const handshakeSym = syms.find((s) => s.description === "x-compat-handshake" || s.toString().includes("x-compat-handshake"));
    if (handshakeSym) {
      console.log("[Content] Found handshake symbol:", handshakeSym.toString());
      const secureInterface = document[handshakeSym];
      if (secureInterface && typeof secureInterface.connect === "function") {
        console.log("[Content] Connecting via secure interface...");
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
