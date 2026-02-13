/**
 * Bridge between MAIN world (Interceptor) and Extension Background
 */
const Cmd = {
  SYNC: 0,
  UPDATE: 1,
  RETRY: 2
} as const;

const setupBridge = (port: MessagePort) => {
  port.onmessage = (event) => {
    const data = event.data as Record<string, unknown>;
    if (data.type === Cmd.SYNC) {
      const { handle } = data as { handle: string };

      // Stealth Caching: Check storage before messaging background
      if (typeof chrome !== "undefined" && chrome.storage) {
        chrome.storage.local.get([`cache:${handle}`], (result) => {
          const cached = result[`cache:${handle}`];
          if (cached) {
            port.postMessage({
              type: Cmd.UPDATE,
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
    }
  };

  chrome.runtime.onMessage.addListener((message: any) => {
    if (message.action === "visualizeFlag") {
      port.postMessage({
        type: Cmd.UPDATE,
        handle: message.handle ?? "",
        flag: message.flag,
      });
    } else if (message.action === "lookupFailed") {
      port.postMessage({
        type: Cmd.RETRY,
        handle: message.handle,
      });
    }
  });
};

const checkHandshake = () => {
  // Scan for the handshake symbol using Object.getOwnPropertySymbols
  // This bypasses DOM attributes and event listeners entirely
  const syms = Object.getOwnPropertySymbols(document);
  const handshakeSym = syms.find(s => s.description === "x-compat-handshake" || s.toString().includes("x-compat-handshake"));
  
  if (handshakeSym) {
    // Accessing the property triggers the Interceptor's 'get' trap
    // @ts-ignore
    const secureInterface = document[handshakeSym];
    
    if (secureInterface && typeof secureInterface.connect === 'function') {
      const channel = new MessageChannel();
      
      // Execute the Silent Handshake
      secureInterface.connect(channel.port2);
      
      setupBridge(channel.port1);
      return true;
    }
  }
  return false;
};

// Polling strategy:
// Since we are running at document_idle (or later), the interceptor (document_start)
// should have already placed the symbol. However, to be robust against race conditions
// or delayed injections, we poll briefly.
const initHandshake = () => {
  if (checkHandshake()) return;
  
  const interval = setInterval(() => {
    if (checkHandshake()) {
      clearInterval(interval);
    }
  }, 50);
  
  // Give up after 5 seconds
  setTimeout(() => clearInterval(interval), 5000);
};

initHandshake();
