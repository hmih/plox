/**
 * Bridge between MAIN world (Interceptor) and Extension Background
 */
const setupBridge = (port: MessagePort) => {
  port.onmessage = (event) => {
    const data = event.data as Record<string, unknown>;
    if (data.type === "__DATA_LAYER_SYNC__") {
      const { handle } = data as { handle: string };

      // Stealth Caching: Check storage before messaging background
      chrome.storage.local.get([`cache:${handle}`], (result) => {
        const cached = result[`cache:${handle}`];
        if (cached) {
          port.postMessage({
            type: "__DATA_LAYER_UPDATE__",
            handle,
            flag: cached.flag,
          });
        } else {
          chrome.runtime.sendMessage({
            action: "processHandle",
            handle,
            elementId: "graphql-injected",
          });
        }
      });
    }
  };

  chrome.runtime.onMessage.addListener((message: any) => {
    if (message.action === "visualizeFlag") {
      port.postMessage({
        type: "__DATA_LAYER_UPDATE__",
        handle: message.handle ?? "",
        flag: message.flag,
      });
    } else if (message.action === "lookupFailed") {
      port.postMessage({
        type: "__DATA_LAYER_RETRY__",
        handle: message.handle,
      });
    }
  });
};

const checkHandshake = () => {
  // Scan for the handshake symbol
  const syms = Object.getOwnPropertySymbols(document);
  const handshakeSym = syms.find(s => s.toString() === "Symbol(x-compat-handshake)");
  
  if (handshakeSym) {
    // @ts-ignore
    const handshakeId = document[handshakeSym] as string;
    
    if (handshakeId) {
      const channel = new MessageChannel();
      document.dispatchEvent(
        new CustomEvent(handshakeId, { detail: channel.port2 }),
      );
      setupBridge(channel.port1);
      return true;
    }
  }
  return false;
};

// Polling fallback since we can't observe Symbols with MutationObserver
const initHandshake = () => {
  if (checkHandshake()) return;
  
  // Poll briefly for the symbol to appear (MAIN world race condition)
  const interval = setInterval(() => {
    if (checkHandshake()) {
      clearInterval(interval);
    }
  }, 50);
  
  // Give up after 5 seconds
  setTimeout(() => clearInterval(interval), 5000);
};

initHandshake();
