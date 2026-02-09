import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { getFlagEmoji } from "../src/core";

test.describe("Plox Refactoring Guard", () => {
  let contentJs: string;
  let backgroundJs: string;
  let stylesCss: string;

  test.beforeAll(() => {
    contentJs = fs.readFileSync(
      path.join(__dirname, "../dist/content.js"),
      "utf8",
    );
    backgroundJs = fs.readFileSync(
      path.join(__dirname, "../dist/background.js"),
      "utf8",
    );
    stylesCss = fs.readFileSync(
      path.join(__dirname, "../dist/styles.css"),
      "utf8",
    );
  });

  test("Full flow: Main thread (scan) -> Worker (server query) -> Main thread (display)", async ({
    page,
  }) => {
    page.on("console", (msg) => console.log(`[PAGE CONSOLE] ${msg.text()}`));

    await page.setContent(`
            <html>
                <head>
                    <style>${stylesCss}</style>
                </head>
                <body>
                    <div id="timeline">
                        <div data-testid="User-Names">
                            <span>Name</span>
                            <span>@testuser1</span>
                        </div>
                        <div dir="ltr">
                            <span>@testuser2</span>
                        </div>
                    </div>
                </body>
            </html>
        `);

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

    await page.route("**/met?username=testuser2", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          username: "testuser2",
          processed: true,
          location: "United States",
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
            window.postMessage({ type: "TO_BACKGROUND", msg }, "*");
          },
        },
        tabs: {
          sendMessage: (_tabId: number, msg: any) => {
            listeners.forEach((fn) => fn(msg));
          },
        },
      };

      (window as any).chrome.tabs.query = (_queryInfo: any, cb: any) =>
        cb([{ id: 1 }]);

      window.addEventListener("message", (event) => {
        if (event.data.type === "TO_BACKGROUND") {
          if ((window as any).backgroundMsgListener) {
            (window as any).backgroundMsgListener(event.data.msg, {
              tab: { id: 1 },
            });
          }
        }
      });
    });

    let modifiedBackgroundJs = backgroundJs.replace(
      /chrome\.runtime\.onMessage\.addListener\(/,
      "window.backgroundMsgListener = (",
    );

    await page.addScriptTag({ content: modifiedBackgroundJs });
    await page.addScriptTag({ content: contentJs });

    const user1Badge = page.locator(
      'span:has-text("@testuser1") .plox-flag-badge',
    );
    await expect(user1Badge).toBeVisible({ timeout: 10000 });
    await expect(user1Badge).toHaveText("🇩🇪");

    const user2Badge = page.locator(
      'span:has-text("@testuser2") .plox-flag-badge',
    );
    await expect(user2Badge).toBeVisible({ timeout: 10000 });
    await expect(user2Badge).toHaveText("🇺🇸");

    console.log("✅ Main thread fetching and display verified.");
  });

  test("getFlagEmoji mapping robustness", async () => {
    const testCases = [
      { location: "Japan", expectedFlag: "🇯🇵" },
      { location: "United Kingdom", expectedFlag: "🇬🇧" },
      { location: "Berlin, Germany", expectedFlag: "🇩🇪" },
      { location: "Paris, France", expectedFlag: "🇫🇷" },
      { location: null, expectedFlag: "🏳️" },
    ];

    testCases.forEach((tc) => {
      const flag = getFlagEmoji(tc.location);
      expect(flag).toBe(tc.expectedFlag);
    });

    console.log("✅ getFlagEmoji mapping verified.");
  });
});
