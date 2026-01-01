export const REGION_FLAGS: Record<string, string> = {
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
  austria: "🇦🇹",
};

/**
 * Decodes MHTML quoted-printable encoding
 */
export const decodeQuotedPrintable = (text: string): string => {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
};

/**
 * Extracts the HTML body from an MHTML file
 */
export const extractHtmlFromMhtml = (mhtmlContent: string): string | null => {
  const parts = mhtmlContent.split("--MultipartBoundary");
  const htmlPart = parts.find((p) => p.includes("Content-Type: text/html"));
  if (!htmlPart) return null;

  const bodyEncoded =
    htmlPart.split("\r\n\r\n")[1] || htmlPart.split("\n\n")[1];
  if (!bodyEncoded) return null;
  return decodeQuotedPrintable(bodyEncoded);
};

/**
 * Parsing logic (from background.js)
 */
export const parseLocationFromHtml = (html: string | null): string | null => {
  if (!html) return null;
  const needle = "Account based in";
  const needleIndex = html.indexOf(needle);
  if (needleIndex !== -1) {
    const startSearchIndex = needleIndex + needle.length;
    const snippet = html.substring(startSearchIndex, startSearchIndex + 300);
    const extractionRegex = /^(?:<[^>]+>|\s)+([^<]+)/;
    const match = snippet.match(extractionRegex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
};

/**
 * Flag mapping (from background.js)
 */
export const getFlagEmoji = (locationName: string | null): string => {
  if (!locationName) return "🏳️";
  const lower = locationName.trim().toLowerCase();
  for (const [key, emoji] of Object.entries(REGION_FLAGS)) {
    if (lower.includes(key)) return emoji;
  }
  return "🏳️";
};
