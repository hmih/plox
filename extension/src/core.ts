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
