/**
 * Bridge between MAIN world (Interceptor) and Extension Background
 */
interface DiscoveryMessage {
  type: "PLOX_DISCOVERED";
  handle: string;
}

interface FlagUpdateMessage {
  type: "PLOX_FLAG_UPDATE";
  handle: string;
  flag: string;
}

window.addEventListener("message", (event: MessageEvent) => {
  const data = event.data as unknown;
  if (
    data &&
    typeof data === "object" &&
    (data as Record<string, unknown>).type === "PLOX_DISCOVERED"
  ) {
    const { handle } = data as DiscoveryMessage;
    // Relay handle discovery to background.ts
    chrome.runtime.sendMessage({
      action: "processHandle",
      handle,
      elementId: "graphql-injected", // Legacy parameter, not used in nuclear mode
    });
  }
});

/**
 * Listen for updates from background.ts
 */
interface VisualizeFlagMessage {
  action: "visualizeFlag";
  handle?: string;
  flag: string;
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as any;
  if (msg.action === "visualizeFlag") {
    // Relay flag data back to the MAIN world Interceptor
    const update: FlagUpdateMessage = {
      type: "PLOX_FLAG_UPDATE",
      handle: msg.handle ?? "",
      flag: msg.flag,
    };
    window.postMessage(update, "*");
  } else if (msg.action === "lookupFailed") {
    // Tell interceptor to clear this handle from pending so it can try again
    window.postMessage(
      {
        type: "PLOX_RETRY",
        handle: msg.handle,
      },
      "*",
    );
  }
});


console.log("[Plox] Bridge script initialized");
