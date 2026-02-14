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

  if (pending.has(normalized)) return;
  pending.add(normalized);

  try {
    const url = `${PLOX_SERVER}/met?username=${encodeURIComponent(normalized)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);

    const data: {
      processed: boolean;
      location: string | null;
    } = await response.json();

    if (data.processed && data.location) {
      const flag = getFlagEmoji(data.location);
      const entry = { location: data.location, flag };
      cache.set(normalized, entry);

      // Stealth Caching: Sync to storage for content script access
      chrome.storage.local.set({ [`cache:${normalized}`]: entry });

      const msg: BusMessage = {
        action: BusCmd.UPDATE,
        handle: normalized,
        flag,
        location: data.location,
      };
      chrome.tabs.sendMessage(tabId, msg);
    }
  } catch (err) {
    log(`Lookup failed for ${normalized}:`, undefined, err);
    const msg: BusMessage = { action: BusCmd.RETRY, handle: normalized };
    chrome.tabs.sendMessage(tabId, msg);
  } finally {
    pending.delete(normalized);
  }
};

chrome.runtime.onMessage.addListener(
  (request: BusMessage, sender: chrome.runtime.MessageSender) => {
    if (request.action !== BusCmd.PROCESS || !sender.tab?.id) return;
    performInvestigation(request.handle, sender.tab.id);
  },
);
