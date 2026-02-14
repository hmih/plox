import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { getFlagEmoji, BusCmd } from "../src/core";
import { setupChromeMock } from "./plox_test_helper";

test.describe("Plox Refactoring Guard", () => {
  let contentJs: string;
  let backgroundJs: string;
  let interceptorJs: string;

  test.beforeAll(() => {
    const distDir =
      process.env.PRODUCTION === "true" ? "dist/prod" : "dist/dev";
    console.log(`[TEST] Using distribution: ${distDir}`);

    contentJs = fs.readFileSync(
      path.join(__dirname, `../${distDir}/content.js`),
      "utf8",
    );
    backgroundJs = fs.readFileSync(
      path.join(__dirname, `../${distDir}/background.js`),
      "utf8",
    );
    interceptorJs = fs.readFileSync(
      path.join(__dirname, `../${distDir}/interceptor.js`),
      "utf8",
    );
  });

  test("Data-layer patching via Interceptor", async ({ page }) => {
    page.on("console", (msg) => console.log(`[PAGE CONSOLE] ${msg.text()}`));

    await page.setContent(`
            <html>
                <body>
                    <div id="status">Ready</div>
                </body>
            </html>
        `);

    // Mock the Plox Server
    await page.route("**/met?username=testuser1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          username: "testuser1",
          processed: true,
          location: "Germany",
        }),
      });
    });

    // Mock X.com GraphQL API
    await page.route("**/i/api/graphql/UserByScreenName", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            user: {
              result: {
                legacy: {
                  screen_name: "testuser1",
                  name: "Test User 1",
                },
              },
            },
          },
        }),
      });
    });

    await setupChromeMock(page, BusCmd);

    // Inject scripts
    await page.addScriptTag({ content: interceptorJs });
    await page.addScriptTag({ content: contentJs });

    // 1. Trigger discovery by making a fetch call (first time, no flag yet)
    await page.evaluate(async () => {
      const resp = await fetch("https://x.com/i/api/graphql/UserByScreenName");
      await resp.json(); // Consuming the body triggers the interceptor
    });

    // 2. Wait for the flow
    await page.waitForTimeout(500);

    // 3. Second fetch should return patched data
    const patchedJson = await page.evaluate(async () => {
      const resp = await fetch("https://x.com/i/api/graphql/UserByScreenName");
      return await resp.json();
    });

    const name = patchedJson.data.user.result.legacy.name;
    expect(name).toContain("🇩🇪");
    expect(name).toContain("Test User 1");

    console.log("✅ Data-layer patching verified.");
  });

  test("getFlagEmoji mapping robustness", async () => {
    const testCases: { location: string | null; expectedFlag: string }[] = [
      { location: "Japan", expectedFlag: "🇯🇵" },
      { location: "United Kingdom", expectedFlag: "🇬🇧" },
      { location: "Berlin, Germany", expectedFlag: "🇩🇪" },
      { location: "Paris, France", expectedFlag: "🇫🇷" },
      { location: "JP", expectedFlag: "🇯🇵" },
      { location: "Lives in BR", expectedFlag: "🇧🇷" },
      { location: null, expectedFlag: "🏳️" },
      { location: "", expectedFlag: "🏳️" },
      { location: "   ", expectedFlag: "🏳️" },
      { location: "Somewhere unknown", expectedFlag: "🏳️" },
    ];

    for (const tc of testCases) {
      expect(getFlagEmoji(tc.location)).toBe(tc.expectedFlag);
    }
  });
});
