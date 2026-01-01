import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Helper to decode MHTML
const decodeQuotedPrintable = (text: string): string => {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
};

const extractHtmlFromMhtml = (mhtmlContent: string): string | null => {
  const parts = mhtmlContent.split("--MultipartBoundary");
  const htmlPart = parts.find((p) => p.includes("Content-Type: text/html"));
  if (!htmlPart) return null;
  const bodyEncoded =
    htmlPart.split("\r\n\r\n")[1] || htmlPart.split("\n\n")[1];
  return decodeQuotedPrintable(bodyEncoded);
};

test("realistic extension simulation on realKalos account", async ({
  page,
}) => {
  const TEST_DATE = "2025-12-27";
  const mainMhtml = fs.readFileSync(
    path.join(__dirname, `${TEST_DATE}.mhtml`),
    "utf8",
  );
  const aboutMhtml = fs.readFileSync(
    path.join(__dirname, `${TEST_DATE}-about.mhtml`),
    "utf8",
  );

  const mainHtml = extractHtmlFromMhtml(mainMhtml);
  const aboutHtml = extractHtmlFromMhtml(aboutMhtml);

  if (!mainHtml || !aboutHtml)
    throw new Error("Could not extract HTML from MHTML");

  // 1. Mock the about page network request
  await page.route(`**/realKalos/about`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: aboutHtml,
    });
  });

  // 2. Set the content
  await page.setContent(mainHtml);

  // 3. Inject CSS
  const css = fs.readFileSync(
    path.join(__dirname, "../extension/styles.css"),
    "utf8",
  );
  await page.addStyleTag({ content: css });

  // 4. Mock chrome.runtime APIs and inject background logic directly into the page context
  await page.evaluate(
    ({ location, flag }: { location: string; flag: string }) => {
      (window as any).chrome = {
        runtime: {
          sendMessage: async (msg: any) => {
            console.log("[Test Mock] Content script sent message:", msg);
            if (msg.action === "processHandle" && msg.handle === "realKalos") {
              // Wait a bit to simulate processing
              setTimeout(() => {
                window.postMessage(
                  {
                    source: "plox-mock-worker",
                    action: "visualizeFlag",
                    elementId: msg.elementId,
                    flag: flag,
                    location: location,
                  },
                  "*",
                );
              }, 100);
            }
          },
        },
      };

      // Bridge to standard chrome.runtime.onMessage
      const listeners: any[] = [];
      (window as any).chrome.runtime.onMessage = {
        addListener: (fn: any) => listeners.push(fn),
      };

      window.addEventListener("message", (event) => {
        if (event.data && event.data.source === "plox-mock-worker") {
          listeners.forEach((fn) => fn(event.data));
        }
      });
    },
    {
      location: "Eastern Europe (Non-EU)",
      flag: "🇪🇺",
    },
  );

  // 5. Inject the bundled content script
  const contentJs = fs.readFileSync(
    path.join(__dirname, "../extension/content.js"),
    "utf8",
  );
  await page.addScriptTag({ content: contentJs });

  // 6. Wait for the flag to appear
  const handleSelector = '[data-plox-processed="true"]';
  await page.waitForSelector(handleSelector, { timeout: 5000 });

  // 7. Verification
  const text = await page.innerText('span:has-text("@realKalos")');
  console.log("Final UI Text:", text);

  expect(text).toContain("🇪🇺");
  expect(text).toContain("@realKalos");

  console.log("✅ Playwright test passed!");
});
