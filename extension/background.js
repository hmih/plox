const PROFILE_CACHE = new Map(); // In-memory cache for current session (Promises & Results)
const USERNAME_LOCATIONS = new Map(); // Quick lookup for popup
const CACHE_KEY = "xcom_loc_cache_v1";

// Load persisted cache on startup
chrome.storage.local.get([CACHE_KEY], (result) => {
  if (result[CACHE_KEY]) {
    Object.entries(result[CACHE_KEY]).forEach(([user, loc]) => {
      USERNAME_LOCATIONS.set(user, loc);
      PROFILE_CACHE.set(user, loc);
    });
  }
});

const saveToStorage = () => {
  // Debounce saving to storage to avoid hitting write limits
  chrome.storage.local.set({ 
    [CACHE_KEY]: Object.fromEntries(USERNAME_LOCATIONS) 
  });
};

const normalizeLocation = (raw) => raw?.trim().toLowerCase() ?? "";

// CRITICAL FIX: Service Workers cannot use DOMParser. 
// We must use Regex to parse the text response.
const parseLocationFromHtml = (html) => {
  try {
    // 1. Sanitize simple whitespace
    const text = html.replace(/\s+/g, " ");

    // 2. Regex to find the pattern seen in X.com's "About" modal
    // Pattern: "Account based in" -> [Tags/Whitespace] -> [Target Location Text] -> [Closing Tag]
    // This looks for: >Account based in< ...next span...>Location<
    const regex = />\s*Account based in\s*<.*?\/span>.*?<span[^>]*>(.*?)<\/span>/i;
    
    const match = text.match(regex);
    
    if (match && match[1]) {
      // Decode HTML entities if necessary (basic ones)
      return match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
    }
    return null;
  } catch (e) {
    console.error("Regex Parse Error", e);
    return null;
  }
};

const fetchLocationForUser = async (username) => {
  try {
    // Add a random delay (jitter) to background requests too, 
    // just in case they correlate scrolling speed with request speed.
    await new Promise(r => setTimeout(r, Math.random() * 500));

    const response = await fetch(`https://x.com/${username}/about`, {
      credentials: "include", // Required for auth
      headers: {
        // Headers are mostly managed by the browser, but we ensure we look like a navigation
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      // If 429 (Rate Limit), we should probably cool down, but returning null for now is safe
      return null;
    }

    const html = await response.text();
    return parseLocationFromHtml(html);
  } catch (error) {
    console.error(`Fetch error for ${username}:`, error);
    return null;
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // -------------------------------------------------------------------------
  // 1. ERROR LOGGING (From Content Script)
  // -------------------------------------------------------------------------
  if (request.action === "logError") {
    // This logs to the Service Worker Console (Inspect Views -> Service Worker)
    // Completely invisible to the webpage.
    console.group(`🚨 Content Script Error: ${request.context}`);
    console.error(request.error);
    if (request.stack) console.log(request.stack);
    console.groupEnd();
    return false; // No response needed
  }

  // -------------------------------------------------------------------------
  // 2. LOCATION FETCHING
  // -------------------------------------------------------------------------
  if (request.action === "getLocation") {
    const username = request.username.toLowerCase();

    // Check Memory Cache / Persisted Cache
    if (PROFILE_CACHE.has(username)) {
      const cached = PROFILE_CACHE.get(username);
      
      // If it's a pending Promise (already fetching), chain onto it
      if (cached instanceof Promise) {
        cached.then((location) => {
          sendResponse({ location });
        });
        return true; // Keep channel open
      }
      
      // If it's a Result string
      sendResponse({ location: cached });
      return false;
    }

    // Start new Fetch
    const promise = fetchLocationForUser(username).then((location) => {
      // Update caches
      PROFILE_CACHE.set(username, location || null);
      USERNAME_LOCATIONS.set(username, location || null);
      
      // Persist to local storage
      if (location) saveToStorage();
      
      return location;
    });

    PROFILE_CACHE.set(username, promise);
    
    promise.then((location) => {
      sendResponse({ location });
    });

    return true; // Keep channel open for async response
  }

  // -------------------------------------------------------------------------
  // 3. POPUP DATA
  // -------------------------------------------------------------------------
  if (request.action === "getAllLocations") {
    sendResponse({ locations: Object.fromEntries(USERNAME_LOCATIONS) });
    return false;
  }

  return false;
});
