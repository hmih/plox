const PROFILE_CACHE = new Map();
const USERNAME_LOCATIONS = new Map();

const normalizeLocation = (raw) => raw?.trim().toLowerCase() ?? "";

const parseLocationFromAbout = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  
  // First find the div with aria-label="Home timeline"
  const homeTimelineDiv = Array.from(doc.querySelectorAll("div")).find(
    (div) => div.getAttribute("aria-label") === "Home timeline"
  );

  if (!homeTimelineDiv) {
    return null;
  }

  // Search for "Account based in" within that div
  const spans = Array.from(homeTimelineDiv.querySelectorAll("span"));
  const label = spans.find(
    (span) => normalizeLocation(span.textContent) === "account based in"
  );

  if (!label) {
    return null;
  }

  // Get the next sibling span with text
  const siblings = label.parentElement
    ? Array.from(label.parentElement.querySelectorAll("span"))
    : [];

  if (siblings.length > 1) {
    const labelIndex = siblings.indexOf(label);
    if (labelIndex + 1 < siblings.length) {
      const text = siblings[labelIndex + 1].textContent?.trim();
      if (text) {
        return text;
      }
    }
  }

  return null;
};

const fetchLocationForUser = async (username) => {
  try {
    const response = await fetch(`https://x.com/${username}/about`, {
      credentials: "include"
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return parseLocationFromAbout(html);
  } catch (error) {
    return null;
  }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getLocation") {
    const username = request.username.toLowerCase();

    if (PROFILE_CACHE.has(username)) {
      const cached = PROFILE_CACHE.get(username);
      if (cached instanceof Promise) {
        cached.then((location) => {
          sendResponse({ location });
        });
        return true;
      }
      sendResponse({ location: cached });
      return false;
    }

    const promise = fetchLocationForUser(username).then((location) => {
      PROFILE_CACHE.set(username, location || null);
      USERNAME_LOCATIONS.set(username, location || null);
      return location;
    });

    PROFILE_CACHE.set(username, promise);
    promise.then((location) => {
      sendResponse({ location });
    });

    return true;
  }

  if (request.action === "getAllLocations") {
    sendResponse({ locations: Object.fromEntries(USERNAME_LOCATIONS) });
    return false;
  }

  return false;
});

