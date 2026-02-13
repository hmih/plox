import { getFlagEmoji, BusCmd, log } from "./core";

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

export const performInvestigation = async (
  handle: string,
  tabId: number,
  elementId: string,
) => {
  const cached = cache.get(handle);
  if (cached) {
    chrome.tabs.sendMessage(tabId, {
      action: BusCmd.UPDATE,
      handle,
      elementId,
      flag: cached.flag,
      location: cached.location,
    });
    return;
  }

  if (pending.has(handle)) {
    return;
  }
  pending.add(handle);

  try {
    const url = `${PLOX_SERVER}/met?username=${encodeURIComponent(handle)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data: {
      username: string;
      processed: boolean;
      location: string | null;
    } = (await response.json()) as {
      username: string;
      processed: boolean;
      location: string | null;
    };

    if (data.processed && data.location) {
      const flag = getFlagEmoji(data.location);
      const entry = { location: data.location, flag };
      cache.set(handle, entry);

      // Stealth Caching: Sync to storage for content script access
      chrome.storage.local.set({ [`cache:${handle}`]: entry });

      chrome.tabs.sendMessage(tabId, {
        action: BusCmd.UPDATE,
        handle,
        elementId,
        flag,
        location: data.location,
      });
    }
  } catch (err) {
    log(`Lookup failed for ${handle}:`, err);
    chrome.tabs.sendMessage(tabId, {
      action: BusCmd.RETRY,
      handle,
    });
  } finally {
    pending.delete(handle);
  }
};

interface PloxMessage {
  action: number;
  handle: string;
  elementId: string;
}

if (
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  chrome.runtime.onMessage
) {
  chrome.runtime.onMessage.addListener(
    (request: PloxMessage, sender: chrome.runtime.MessageSender) => {
      if (request.action !== BusCmd.PROCESS) return;
      if (!sender.tab?.id) {
        return;
      }
      performInvestigation(request.handle, sender.tab.id, request.elementId);
    },
  );
}
