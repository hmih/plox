import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { getFlagEmoji } from "../src/core";

test.describe("Plox Refactoring Guard", () => {
  let contentJs: string;
  let backgroundJs: string;
  let interceptorJs: string;

  test.beforeAll(() => {
    contentJs = fs.readFileSync(
      path.join(__dirname, "../dist/content.js"),
      "utf8",
    );
    backgroundJs = fs.readFileSync(
      path.join(__dirname, "../dist/background.js"),
      "utf8",
    );
    interceptorJs = fs.readFileSync(
      path.join(__dirname, "../dist/interceptor.js"),
      "utf8",
    );
  });

  test("Data-layer patching via Interceptor", async ({
    page,
  }) => {
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

    await page.evaluate(() => {
      const listeners: any[] = [];
      (window as any).chrome = {
        runtime: {
          onMessage: {
            addListener: (fn: any) => listeners.push(fn),
          },
          sendMessage: async (msg: any) => {
            // Simulate background processing
            if (msg.action === "processHandle") {
               const resp = await fetch(`https://plox.krepost.xy/met?username=${msg.handle}`);
               const data = await resp.json();
               if (data.processed) {
                 listeners.forEach(fn => fn({
                   action: "visualizeFlag",
                   handle: msg.handle,
                   flag: "🇩🇪"
                 }));
               }
            }
          },
        },
      };

      // Handle the private channel handshake in the test mock
      window.addEventListener("message", (event) => {
        if (event.data && event.data.type === "__INITIAL_STATE__" && event.ports[0]) {
           const port = event.ports[0];
           port.onmessage = (e: any) => {
              if (e.data.type === "__DATA_LAYER_SYNC__") {
                 window.chrome.runtime.sendMessage(e.data);
              }
           };
           // Store port to send updates back
           (window as any).testMessagePort = port;
        }
      });
    });

    // Inject scripts
    await page.addScriptTag({ content: interceptorJs });
    await page.addScriptTag({ content: contentJs });

    // 1. Trigger discovery by making a fetch call (first time, no flag yet)
    await page.evaluate(async () => {
      await fetch("https://x.com/i/api/graphql/UserByScreenName");
    });

    // 2. Wait for the discovery -> background -> bridge -> interceptor flow
    // We'll wait until the interceptor has the flag in its internal map.
    // Since we can't easily check internal state, we'll wait a bit and then fetch again.
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
      // Direct REGION_FLAGS matches
      { location: "Japan", expectedFlag: "🇯🇵" },
      { location: "United Kingdom", expectedFlag: "🇬🇧" },
      // Substring matches (city, country)
      { location: "Berlin, Germany", expectedFlag: "🇩🇪" },
      { location: "Paris, France", expectedFlag: "🇫🇷" },
      // ISO country code fallback
      { location: "JP", expectedFlag: "🇯🇵" },
      { location: "Lives in BR", expectedFlag: "🇧🇷" },
      // Null / empty / no match → white flag
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
