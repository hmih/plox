import { parseLocationFromHtml, getFlagEmoji, generateGaussianDelay } from "./core";

export const cache = new Map<string, { location: string; flag: string }>();
export const pending = new Set<string>();

export const performInvestigation = async (handle: string, tabId: number, elementId: string) => {
    // 1. Check Cache
    if (cache.has(handle)) {
        const cached = cache.get(handle);
        if (cached) {
            const { location, flag } = cached;
            chrome.tabs.sendMessage(tabId, { action: "visualizeFlag", elementId, flag, location });
            return;
        }
    }

    // 2. Prevent Duplicate Concurrent Fetches
    if (pending.has(handle)) {
        console.debug(`[Worker] @${handle} is already being investigated. Skipping redundant request.`);
        return;
    }
    pending.add(handle);

    console.log(`🕵️ [Investigator] Starting fresh check for @${handle}`);

    try {
        const delay = generateGaussianDelay(1000, 3000);
        // We skip delay if we're in a test environment (simulated via missing generateGaussianDelay or global)
        if (typeof (globalThis as any).TEST_ENV === "undefined") {
            await new Promise((r) => setTimeout(r, delay));
        }

        const url = `https://x.com/${handle}/about`;
        console.log(`[Worker] Fetching ${url}`);

        const response = await fetch(url, {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "text/html",
                "Upgrade-Insecure-Requests": "1",
                "User-Agent": typeof navigator !== "undefined" ? navigator.userAgent : "PloxBot/1.0",
            },
        });

        if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);

        const html = await response.text();
        const location = parseLocationFromHtml(html);

        if (!location) {
            console.warn(`[Worker] Could not parse location for @${handle}. Raw HTML Snippet: ${html.substring(0, 500)}`);
            throw new Error("Location extraction failed");
        }

        const flag = getFlagEmoji(location);
        cache.set(handle, { location, flag });

        console.log(`✅ [Success] @${handle} -> ${location} ${flag}`);

        chrome.tabs.sendMessage(tabId, { action: "visualizeFlag", elementId, flag, location });
    } catch (err: any) {
        console.error(`❌ [Error] @${handle}:`, err.message);
    } finally {
        pending.delete(handle);
    }
};

if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender) => {
        if (request.action === "processHandle" && sender.tab && sender.tab.id !== undefined) {
            performInvestigation(request.handle, sender.tab.id, request.elementId);
        }
        return true;
    });
}
