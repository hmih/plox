/**
 * Bridge between MAIN world (Interceptor) and Extension Background
 */
interface DiscoveryMessage {
  type: "__DATA_LAYER_SYNC__";
  handle: string;
}

interface FlagUpdateMessage {
  type: "__DATA_LAYER_UPDATE__";
  handle: string;
  flag: string;
}

const channel = new MessageChannel();
const port = channel.port1;

// Send the other port to the MAIN world Interceptor
window.postMessage({ type: "__INITIAL_STATE__" }, "*", [channel.port2]);

port.onmessage = (event) => {
  const data = event.data as Record<string, unknown>;
  if (data.type === "__DATA_LAYER_SYNC__") {
    const { handle } = data as any;
    chrome.runtime.sendMessage({
      action: "processHandle",
      handle,
      elementId: "graphql-injected",
    });
  }
};

chrome.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as any;
  if (msg.action === "visualizeFlag") {
    // Only send over the private channel
    port.postMessage({
      type: "__DATA_LAYER_UPDATE__",
      handle: msg.handle ?? "",
      flag: msg.flag,
    });
  } else if (msg.action === "lookupFailed") {
    port.postMessage({
      type: "__DATA_LAYER_RETRY__",
      handle: msg.handle,
    });
  }
});

console.log("[Plox] Bridge script initialized");
