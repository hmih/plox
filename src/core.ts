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

export const parseLocationFromHtml = (html: string): string | null => {
    if (!html) throw new Error("Input HTML is empty or null");

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

    // Fallbacks
    const uiMatch = html.match(/data-testid="UserLocation"[^>]*>([^<]+)</);
    if (uiMatch && uiMatch[1]) return uiMatch[1].trim();

    const jsonMatch = html.match(/"contentLocation":{"@type":"Place","name":"(.*?)"}/);
    if (jsonMatch && jsonMatch[1]) return jsonMatch[1].trim();

    return null;
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
        const offset = 127397;
        return (
            String.fromCodePoint(code.charCodeAt(0) + offset) +
            String.fromCodePoint(code.charCodeAt(1) + offset)
        );
    }

    return "🏳️";
};

export const generateGaussianDelay = (min: number, max: number): number => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    let z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    const mean = (min + max) / 2;
    const stdDev = (max - min) / 6;
    return Math.max(min, Math.min(max, Math.round(z * stdDev + mean)));
};
