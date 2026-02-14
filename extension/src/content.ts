/**
 * Bridge between MAIN world (Interceptor) and Extension Background
 */
import {
  GhostCmd,
  BusCmd,
  log,
  normalizeHandle,
  GhostMessage,
  BusMessage,
} from "./core";

const setupBridge = (port: MessagePort) => {
  port.onmessage = (event) => {
    const data = event.data as GhostMessage;
    if (data.type === GhostCmd.SYNC) {
      const handle = normalizeHandle(data.handle);

      // Stealth Caching: Check storage before messaging background
      chrome.storage.local.get([`cache:${handle}`], (result) => {
        const cached = result[`cache:${handle}`];
        if (cached) {
          log(`Cache hit for ${handle}`);
          const msg: GhostMessage = {
            type: GhostCmd.UPDATE,
            handle,
            flag: cached.flag,
          };
          port.postMessage(msg);
        } else {
          log(`Requesting lookup for ${handle}`);
          const msg: BusMessage = { action: BusCmd.PROCESS, handle };
          chrome.runtime.sendMessage(msg);
        }
      });
    }
  };

  chrome.runtime.onMessage.addListener((message: BusMessage) => {
    if (message.action === BusCmd.UPDATE && message.flag) {
      log(`Received update for ${message.handle}`);
      const msg: GhostMessage = {
        type: GhostCmd.UPDATE,
        handle: message.handle,
        flag: message.flag,
      };
      port.postMessage(msg);
    } else if (message.action === BusCmd.RETRY) {
      const msg: GhostMessage = {
        type: GhostCmd.RETRY,
        handle: message.handle,
      };
      port.postMessage(msg);
    }
  });
};

const initHandshake = () => {
  const channel = new MessageChannel();

  // Bridge Setup
  setupBridge(channel.port1);

  // Execute Handshake
  // Camouflaged as React DevTools connection
  window.postMessage(
    {
      source: "ReactDevTools_connect_v4",
    },
    "*",
    [channel.port2],
  );
};

initHandshake();
