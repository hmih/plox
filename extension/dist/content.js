"use strict";
(() => {
  // src/content.ts
  var Cmd = {
    SYNC: 0,
    UPDATE: 1,
    RETRY: 2,
    PROCESS: 3
  };
  var setupBridge = (port) => {
    port.onmessage = (event) => {
      const data = event.data;
      if (data.type === Cmd.SYNC) {
        const { handle } = data;
        if (typeof chrome !== "undefined" && chrome.storage) {
          chrome.storage.local.get([`cache:${handle}`], (result) => {
            const cached = result[`cache:${handle}`];
            if (cached) {
              port.postMessage({
                type: Cmd.UPDATE,
                handle,
                flag: cached.flag
              });
            } else {
              chrome.runtime.sendMessage({
                action: Cmd.PROCESS,
                handle,
                elementId: "graphql-injected"
              });
            }
          });
        }
      }
    };
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === Cmd.UPDATE) {
        port.postMessage({
          type: Cmd.UPDATE,
          handle: message.handle ?? "",
          flag: message.flag
        });
      } else if (message.action === Cmd.RETRY) {
        port.postMessage({
          type: Cmd.RETRY,
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
