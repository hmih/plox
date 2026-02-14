import {
  GhostCmd,
  BusCmd,
  log,
  normalizeHandle,
  GhostMessage,
  BusMessage,
  HANDSHAKE_POOL,
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

const scheduleChameleonHandshake = () => {
  const channel = new MessageChannel();

  // Bridge Setup
  setupBridge(channel.port1);

  // CHAMELEON HANDSHAKE: Pick a random persona
  const persona =
    HANDSHAKE_POOL[Math.floor(Math.random() * HANDSHAKE_POOL.length)];

  // Calculate Jitter
  const [min, max] = persona.delayRange;
  const jitter = Math.floor(Math.random() * (max - min + 1)) + min;

  log(`Scheduling handshake (${persona.source}) with ${jitter}ms jitter`);

  setTimeout(() => {
    // Execute Handshake with persona data + Magic Byte (our MessagePort)
    // Structure: { source: "...", payload: { ... } }
    // This wraps the payload to match the updated Interceptor expectation
    window.postMessage(
      {
        source: persona.source,
        payload: persona.payload,
      },
      "*",
      [channel.port2],
    );
  }, jitter);
};

if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(() => scheduleChameleonHandshake());
} else {
  scheduleChameleonHandshake();
}
