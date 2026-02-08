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
 * Flag mapping (from core.ts)
 */
export const getFlagEmoji = (locationName: string | null): string => {
  if (!locationName) return "🏳️";
  const lower = locationName.trim().toLowerCase();
  for (const [key, emoji] of Object.entries(REGION_FLAGS)) {
    if (lower.includes(key)) return emoji;
  }
  return "🏳️";
};
