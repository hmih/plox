import { getFlagEmoji } from "./core";

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
    console.log(`[Plox] Cache hit for @${handle}: ${cached.flag}`);
    chrome.tabs.sendMessage(tabId, {
      action: "visualizeFlag",
      elementId,
      flag: cached.flag,
      location: cached.location,
    });
    return;
  }

  if (pending.has(handle)) {
    console.debug(`[Plox] @${handle} already pending, skipping`);
    return;
  }
  pending.add(handle);

  try {
    const url = `${PLOX_SERVER}/met?username=${encodeURIComponent(handle)}`;
    console.log(`[Plox] Querying server for @${handle}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data: {
      username: string;
      processed: boolean;
      location: string | null;
    } = await response.json();

    console.log(`[Plox] Server response for @${handle}:`, data);

    if (data.processed && data.location) {
      const flag = getFlagEmoji(data.location);
      cache.set(handle, { location: data.location, flag });

      console.log(`[Plox] @${handle} -> ${data.location} ${flag}`);

      chrome.tabs.sendMessage(tabId, {
        action: "visualizeFlag",
        elementId,
        flag,
        location: data.location,
      });
    } else {
      console.log(`[Plox] @${handle} registered but not yet processed`);
    }
  } catch (err) {
    console.error(`[Plox] Error for @${handle}:`, err);
  } finally {
    pending.delete(handle);
  }
};

if (
  typeof chrome !== "undefined" &&
  chrome.runtime &&
  chrome.runtime.onMessage
) {
  chrome.runtime.onMessage.addListener((request, sender) => {
    if (request.action !== "processHandle") return;
    if (!sender.tab?.id) {
      console.warn("[Plox] processHandle received without tab id");
      return;
    }
    performInvestigation(request.handle, sender.tab.id, request.elementId);
  });
}
