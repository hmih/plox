// ---------------------------------------------------------------------------
// 1. CONSTANTS & MAPPINGS
// ---------------------------------------------------------------------------
const REGION_FLAGS = {
  "united states": "🇺🇸",
  usa: "🇺🇸",
  uk: "🇬🇧",
  "united kingdom": "🇬🇧",
  canada: "🇨🇦",
  germany: "🇩🇪",
  france: "🇫🇷",
  australia: "🇦🇺",
  japan: "🇯🇵",
  brazil: "🇧🇷",
  india: "🇮🇳",
  china: "🇨🇳",
  europe: "🇪🇺",
  asia: "🌏",
  africa: "🌍",
  global: "🌐",
};

// ---------------------------------------------------------------------------
// 2. PARSING LOGIC
// ---------------------------------------------------------------------------

/**
 * Parses the raw text content to find a username immediately followed by the '·' symbol.
 * * Logic:
 * On X.com, the header is strictly: [Name] [Verified] [@handle] [·] [Time]
 * We look for the pattern: @handle followed by whitespace and the dot.
 * * Regex Explanation:
 * @             -> Literal @
 * ([a-zA-Z0-9_]+)-> Capture the handle (alphanumeric + underscore)
 * \s* -> Allow 0 or more whitespace characters
 * [·\u00b7]     -> Match the interpunct dot (literal or unicode)
 */
const extractHandleFromText = (text) => {
  const regex = /(@[a-zA-Z0-9_]{1,15})\s*[·\u00b7]/;
  const match = text.match(regex);

  if (match && match[1]) {
    // Return the username without the '@'
    return match[1].substring(1);
  }
  return null;
};

const parseLocationFromHtml = (html) => {
  try {
    // 1. Data-TestID Method (Most reliable for server-rendered content)
    const uiMatch = html.match(/data-testid="UserLocation"[^>]*>([^<]+)</);
    if (uiMatch && uiMatch[1]) return uiMatch[1].trim();

    // 2. Schema.org JSON Method (Hidden in script tags)
    // This is often how data is passed in React hydration
    const jsonMatch = html.match(
      /"contentLocation":{"@type":"Place","name":"(.*?)"}/,
    );
    if (jsonMatch && jsonMatch[1]) return jsonMatch[1].trim();

    return null;
  } catch (e) {
    return null;
  }
};

const getFlagEmoji = (locationName) => {
  if (!locationName) return "🏳️";
  const lower = locationName.toLowerCase();

  // Region Match
  for (const [key, emoji] of Object.entries(REGION_FLAGS)) {
    if (lower.includes(key)) return emoji;
  }

  // ISO Code Match (e.g. "Vienna, AT")
  const countryCodeMatch = locationName.match(/\b([A-Z]{2})\b/);
  if (countryCodeMatch) {
    const code = countryCodeMatch[1];
    const offset = 127397;
    return (
      String.fromCodePoint(code.charCodeAt(0) + offset) +
      String.fromCodePoint(code.charCodeAt(1) + offset)
    );
  }

  return "🏳️";
};

// ---------------------------------------------------------------------------
// 3. CORE INVESTIGATION LOGIC
// ---------------------------------------------------------------------------

// We use a simple variable to ensure we only log ONE user per session (as requested)
let HAS_PROCESSED_USER = false;

const performInvestigation = async (username) => {
  if (HAS_PROCESSED_USER) return;
  HAS_PROCESSED_USER = true; // Lock immediately

  try {
    // Stealth Delay: Wait 0.5s - 1.5s before firing the request
    const delay = Math.floor(Math.random() * 1000) + 500;
    await new Promise((r) => setTimeout(r, delay));

    console.log(
      `🕵️ Detected @${username} (verified via '·'). Fetching profile...`,
    );

    const response = await fetch(`https://x.com/${username}`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "text/html" },
    });

    if (!response.ok) {
      console.log("❌ Fetch failed:", response.status);
      return;
    }

    const html = await response.text();
    const location = parseLocationFromHtml(html);
    const flag = getFlagEmoji(location);

    if (location) {
      console.log(`✅ ${username} -> ${location} ${flag}`);
    } else {
      console.log(`⚠️ ${username} -> Location Hidden/Unknown`);
    }
  } catch (err) {
    console.error("Investigation Error:", err);
  }
};

// ---------------------------------------------------------------------------
// 4. MESSAGE LISTENER
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzePageText") {
    // 1. If we already found someone, tell content script to sleep forever.
    if (HAS_PROCESSED_USER) {
      sendResponse({ stopLooking: true });
      return;
    }

    // 2. Parse the text in the background
    const username = extractHandleFromText(request.textContent);

    if (username) {
      // 3. Found a target! Start investigation.
      performInvestigation(username);

      // 4. Tell content script to stop scanning.
      sendResponse({ stopLooking: true });
    } else {
      // 5. Nothing found yet, keep scanning.
      sendResponse({ stopLooking: false });
    }
  }
  return true; // Keep channel open
});
