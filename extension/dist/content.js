"use strict";
(() => {
  // src/core.ts
  var GhostCmd = {
    SYNC: 0,
    UPDATE: 1,
    RETRY: 2
  };
  var BusCmd = {
    PROCESS: 4,
    UPDATE: 5,
    RETRY: 6
  };
  var log = (msg, ...args) => {
    if (true) {
      console.log(`[PLOX] ${msg}`, ...args);
    }
  };

  // src/content.ts
  var setupBridge = (port) => {
    port.onmessage = (event) => {
      const data = event.data;
      if (data.type === GhostCmd.SYNC) {
        const { handle } = data;
        if (typeof chrome !== "undefined" && chrome.storage) {
          chrome.storage.local.get([`cache:${handle}`], (result) => {
            const cached = result[`cache:${handle}`];
            if (cached) {
              log(`Cache hit for ${handle}`);
              port.postMessage({
                type: GhostCmd.UPDATE,
                handle,
                flag: cached.flag
              });
            } else {
              log(`Requesting lookup for ${handle}`);
              chrome.runtime.sendMessage({
                action: BusCmd.PROCESS,
                handle,
                elementId: "graphql-injected"
              });
            }
          });
        }
      }
    };
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === BusCmd.UPDATE) {
        log(`Received update for ${message.handle}`);
        port.postMessage({
          type: GhostCmd.UPDATE,
          handle: message.handle ?? "",
          flag: message.flag
        });
      } else if (message.action === BusCmd.RETRY) {
        port.postMessage({
          type: GhostCmd.RETRY,
          handle: message.handle
        });
      }
    });
  };
  var checkHandshake = () => {
    const syms = Object.getOwnPropertySymbols(document);
    const handshakeSym = syms.find((s) => s.description === "x-compat-handshake" || s.toString().includes("x-compat-handshake"));
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
