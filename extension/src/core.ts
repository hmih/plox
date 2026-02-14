// GHOST Protocol: Interceptor <-> Bridge (Private Channel)
// Using obfuscated integer codes to blend in with generic minified traffic
export const GhostCmd = {
  SYNC: 201,
  UPDATE: 202,
  RETRY: 204,
} as const;

// BUS Protocol: Bridge <-> Background (Chrome Runtime)
export const BusCmd = {
  PROCESS: 401,
  UPDATE: 402,
  RETRY: 406,
} as const;

export interface GhostMessage {
  type: (typeof GhostCmd)[keyof typeof GhostCmd];
  handle: string;
  flag?: string;
}

export interface BusMessage {
  action: (typeof BusCmd)[keyof typeof BusCmd];
  handle: string;
  flag?: string;
  location?: string | null;
}

// Build-time definition for development mode
declare const __DEV__: boolean;

export const normalizeHandle = (handle: string): string =>
  handle.trim().toLowerCase();

export const GRAPHQL_TARGET_KEYS = [
  "data",
  "user",
  "legacy",
  "user_results",
  "result",
  "core",
  "instructions",
  "entries",
  "content",
  "itemContent",
  "tweet_results",
  "globalObjects",
  "users",
];

export const MAX_RECURSION_DEPTH = 20;

export const log = (msg: string, logger?: any, ...args: any[]) => {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const l = logger || console;
    l.log(`[PLOX] ${msg}`, ...args);
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
