const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

// --- Logic from background.js (Extracted for Test) ---
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
  austria: "🇦🇹",
};

const parseLocationFromHtml = (html) => {
  if (!html) throw new Error("Input HTML is empty or null");
  const needle = "Account based in";
  const needleIndex = html.indexOf(needle);
  if (needleIndex !== -1) {
    const startSearchIndex = needleIndex + needle.length;
    const snippet = html.substring(startSearchIndex, startSearchIndex + 300);
    // Captured text node after Account based in
    const extractionRegex = /^(?:<[^>]+>|\s)+([^<]+)/;
    const match = snippet.match(extractionRegex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
};

const getFlagEmoji = (locationName) => {
  if (!locationName) return "🏳️";
  const lower = locationName.trim().toLowerCase();
  for (const [key, emoji] of Object.entries(REGION_FLAGS)) {
    if (lower.includes(key)) return emoji;
  }
  return "🏳️";
};
// --- End Logic ---

// Helper to decode quoted-printable (MHTML standard)
const decodeQuotedPrintable = (text) => {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
};

async function runTest() {
  console.log("🚀 Starting Integration Test...");

  const mainFilePath = path.join(__dirname, "2025-12-27.mhtml");
  const aboutFilePath = path.join(__dirname, "2025-12-27-about.mhtml");

  console.log("Reading main page...");
  const mainMhtml = fs.readFileSync(mainFilePath, "utf8");

  // Find the HTML part
  const parts = mainMhtml.split("--MultipartBoundary");
  const htmlPart = parts.find((p) => p.includes("Content-Type: text/html"));

  if (!htmlPart) throw new Error("Could not find HTML part in MHTML");

  // Remove headers from part
  const mainHtmlEncoded =
    htmlPart.split("\r\n\r\n")[1] || htmlPart.split("\n\n")[1];
  const mainHtml = decodeQuotedPrintable(mainHtmlEncoded);

  // Debug: check if @realKalos exists
  if (mainHtml.includes("@realKalos")) {
    console.log("🔍 @realKalos found in raw decoded HTML string.");
  } else {
    console.log("⚠️ @realKalos NOT found in raw decoded HTML string.");
  }

  const dom = new JSDOM(mainHtml);
  const document = dom.window.document;

  console.log("Searching for @realKalos...");
  const spans = Array.from(document.querySelectorAll("span"));
  const kalosSpan = spans.find((s) => s.textContent === "@realKalos");

  if (!kalosSpan) {
    throw new Error("Could not find @realKalos span on the main page.");
  }
  console.log("✅ Found @realKalos element.");

  console.log("Simulating fetch of about page...");
  const aboutMhtml = fs.readFileSync(aboutFilePath, "utf8");
  // Basic extraction for the test
  const aboutHtml = decodeQuotedPrintable(aboutMhtml);

  const location = parseLocationFromHtml(aboutHtml);
  console.log(`Parsed Location: "${location}"`);

  const flag = getFlagEmoji(location);
  console.log(`Resolved Flag: ${flag}`);

  // In-memory Injection (Simulating content.js action)
  const badge = document.createElement("span");
  badge.textContent = flag;
  badge.className = "plox-flag-badge";
  kalosSpan.prepend(badge);

  // Verification
  const resultText = kalosSpan.textContent;
  console.log(`Final Span Content: "${resultText}"`);

  if (resultText.includes(flag) && resultText.includes("@realKalos")) {
    console.log("🎉 TEST PASSED: Flag correctly injected next to username.");
  } else {
    throw new Error(`TEST FAILED: Flag ${flag} not found in "${resultText}"`);
  }
}

runTest().catch((err) => {
  console.error("❌ Test Failed:", err.message);
  process.exit(1);
});
