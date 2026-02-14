import { getFlagEmoji, BusCmd, log, normalizeHandle, BusMessage } from "./core";

declare const PLOX_SERVER_URL: string;
const PLOX_SERVER =
  typeof PLOX_SERVER_URL !== "undefined"
    ? PLOX_SERVER_URL
    : "https://plox.krepost.xy";

export const cache = new Map<
  string,
  { location: string | null; flag: string }
>();
export const pending = new Set<string>();

const lookupQueue = new Map<string, Set<number>>();
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const BATCH_MIN_MS = 500;
const BATCH_MAX_MS = 1500;

const processQueue = async () => {
  const queue = new Map(lookupQueue);
  lookupQueue.clear();
  flushTimeout = null;

  for (const [handle, tabIds] of queue.entries()) {
    if (pending.has(handle)) continue;
    pending.add(handle);

    // Process each handle asynchronously to avoid blocking
    (async () => {
      try {
        const url = `${PLOX_SERVER}/met?username=${encodeURIComponent(handle)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);

        const data: {
          processed: boolean;
          location: string | null;
        } = await response.json();

        if (data.processed && data.location) {
          const flag = getFlagEmoji(data.location);
          const entry = { location: data.location, flag };
          cache.set(handle, entry);
          chrome.storage.local.set({ [`cache:${handle}`]: entry });

          const msg: BusMessage = {
            action: BusCmd.UPDATE,
            handle,
            flag,
            location: data.location,
          };
          for (const tabId of tabIds) {
            chrome.tabs.sendMessage(tabId, msg);
          }
        }
      } catch (err) {
        log(`Lookup failed for ${handle}:`, undefined, err);
        const msg: BusMessage = { action: BusCmd.RETRY, handle };
        for (const tabId of tabIds) {
          chrome.tabs.sendMessage(tabId, msg);
        }
      } finally {
        pending.delete(handle);
      }
    })();
  }
};

const scheduleFlush = () => {
  if (flushTimeout) return;
  const jitter =
    Math.floor(Math.random() * (BATCH_MAX_MS - BATCH_MIN_MS + 1)) +
    BATCH_MIN_MS;
  flushTimeout = setTimeout(processQueue, jitter);
};

export const performInvestigation = async (handle: string, tabId: number) => {
  const normalized = normalizeHandle(handle);
  const cached = cache.get(normalized);

  if (cached) {
    const msg: BusMessage = {
      action: BusCmd.UPDATE,
      handle: normalized,
      flag: cached.flag,
      location: cached.location,
    };
    chrome.tabs.sendMessage(tabId, msg);
    return;
  }

  // Enqueue instead of immediate fetch
  if (!lookupQueue.has(normalized)) {
    lookupQueue.set(normalized, new Set());
  }
  lookupQueue.get(normalized)!.add(tabId);
  scheduleFlush();
};

chrome.runtime.onMessage.addListener(
  (request: BusMessage, sender: chrome.runtime.MessageSender) => {
    if (request.action !== BusCmd.PROCESS || !sender.tab?.id) return;
    performInvestigation(request.handle, sender.tab.id);
  },
);
