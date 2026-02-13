// GHOST Protocol: Interceptor <-> Bridge (Private Channel)
// Using obfuscated integer codes to blend in with generic minified traffic
export const GhostCmd = {
  SYNC: 201, // was 0
  UPDATE: 202, // was 1
  RETRY: 204, // was 2
} as const;

// BUS Protocol: Bridge <-> Background (Chrome Runtime)
export const BusCmd = {
  PROCESS: 401, // was 4
  UPDATE: 402, // was 5
  RETRY: 406, // was 6
} as const;

// Build-time definition for development mode
declare const __DEV__: boolean;

export const log = (msg: string, ...args: any[]) => {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log(`[PLOX] ${msg}`, ...args);
  }
};

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

const REGIONAL_INDICATOR_OFFSET = 127397;

export const getFlagEmoji = (locationName: string | null): string => {
  if (!locationName) return "🏳️";
  const trimmed = locationName.trim();
  const lower = trimmed.toLowerCase();

  for (const [key, emoji] of Object.entries(REGION_FLAGS)) {
    if (lower.includes(key)) return emoji;
  }

  const code = trimmed.match(/\b([A-Z]{2})\b/)?.[1];
  if (code) {
    return (
      String.fromCodePoint(code.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET) +
      String.fromCodePoint(code.charCodeAt(1) + REGIONAL_INDICATOR_OFFSET)
    );
  }

  return "🏳️";
};
