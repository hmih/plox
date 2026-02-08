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

export const getFlagEmoji = (locationName: string | null): string => {
  if (!locationName) return "🏳️";
  const cleanName = locationName.trim();
  const lower = cleanName.toLowerCase();

  for (const [key, emoji] of Object.entries(REGION_FLAGS)) {
    if (lower.includes(key)) return emoji;
  }

  const countryCodeMatch = cleanName.match(/\b([A-Z]{2})\b/);
  if (countryCodeMatch) {
    const code = countryCodeMatch[1];
    if (code) {
      const offset = 127397;
      return (
        String.fromCodePoint(code.charCodeAt(0) + offset) +
        String.fromCodePoint(code.charCodeAt(1) + offset)
      );
    }
  }

  return "🏳️";
};
