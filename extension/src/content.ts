/**
 * Bridge between MAIN world (Interceptor) and Extension Background
 */
import { GhostCmd, BusCmd, log } from "./core";

const setupBridge = (port: MessagePort) => {
  port.onmessage = (event) => {
    const data = event.data as Record<string, unknown>;
    if (data.type === GhostCmd.SYNC) {
      const { handle } = data as { handle: string };

      // Stealth Caching: Check storage before messaging background
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get([`cache:${handle}`], (result) => {
          const cached = result[`cache:${handle}`];
          if (cached) {
            log(`Cache hit for ${handle}`);
            port.postMessage({
              type: GhostCmd.UPDATE,
              handle,
              flag: cached.flag,
            });
          } else {
            log(`Requesting lookup for ${handle}`);
            chrome.runtime.sendMessage({
              action: BusCmd.PROCESS,
              handle,
              elementId: "graphql-injected",
            });
          }
        });
      }
    }
  };

  chrome.runtime.onMessage.addListener((message: any) => {
    if (message.action === BusCmd.UPDATE) {
      log(`Received update for ${message.handle}`);
      port.postMessage({
        type: GhostCmd.UPDATE,
        handle: message.handle ?? "",
        flag: message.flag,
      });
    } else if (message.action === BusCmd.RETRY) {
      port.postMessage({
        type: GhostCmd.RETRY,
        handle: message.handle,
      });
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
