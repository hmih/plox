import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { parseLocationFromHtml, getFlagEmoji } from "../src/core";

test.describe("Plox Refactoring Guard", () => {
    let contentJs: string;
    let backgroundJs: string;
    let stylesCss: string;

    test.beforeAll(() => {
        contentJs = fs.readFileSync(path.join(__dirname, "../extension/content.js"), "utf8");
        backgroundJs = fs.readFileSync(path.join(__dirname, "../extension/background.js"), "utf8");
        stylesCss = fs.readFileSync(path.join(__dirname, "../extension/styles.css"), "utf8");
    });

    test("Full flow: Main thread (scan) -> Worker (fetch/parse) -> Main thread (display)", async ({ page }) => {
        page.on('console', msg => console.log(`[PAGE CONSOLE] ${msg.text()}`));

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

        await page.route("**/testuser1/about", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "text/html",
                body: `<html><body><div>Account based in Germany</div></body></html>`
            });
        });

        await page.route("**/testuser2/about", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "text/html",
                body: `<html><body><div>Account based in United States</div></body></html>`
            });
        });

        await page.evaluate(() => {
            const listeners: any[] = [];
            (window as any).chrome = {
                runtime: {
                    onMessage: {
                        addListener: (fn: any) => listeners.push(fn)
                    },
                    sendMessage: async (msg: any) => {
                        window.postMessage({ type: "TO_BACKGROUND", msg }, "*");
                    }
                },
                tabs: {
                    sendMessage: (tabId: number, msg: any) => {
                        listeners.forEach(fn => fn(msg));
                    }
                }
            };

            (window as any).chrome.tabs.query = (queryInfo: any, cb: any) => cb([{ id: 1 }]);

            window.addEventListener("message", (event) => {
                if (event.data.type === "TO_BACKGROUND") {
                    if ((window as any).backgroundMsgListener) {
                        (window as any).backgroundMsgListener(event.data.msg, { tab: { id: 1 } });
                    }
                }
            });
        });

        let modifiedBackgroundJs = backgroundJs
            .replace(/chrome\.runtime\.onMessage\.addListener\(/, "window.backgroundMsgListener = (")
            .replace(/const delay = generateGaussianDelay\(.*?\);/g, "const delay = 0;")
            .replace(/var delay = generateGaussianDelay\(.*?\);/g, "var delay = 0;");

        await page.addScriptTag({ content: modifiedBackgroundJs });
        await page.addScriptTag({ content: contentJs });

        const user1Badge = page.locator('span:has-text("@testuser1") .plox-flag-badge');
        await expect(user1Badge).toBeVisible({ timeout: 10000 });
        await expect(user1Badge).toHaveText("🇩🇪");

        const user2Badge = page.locator('span:has-text("@testuser2") .plox-flag-badge');
        await expect(user2Badge).toBeVisible({ timeout: 10000 });
        await expect(user2Badge).toHaveText("🇺🇸");

        console.log("✅ Main thread fetching and display verified.");
    });

    test("Worker thread parsing logic robustness", async () => {
        const testCases = [
            { html: "<div>Account based in Japan</div>", expectedLoc: "Japan", expectedFlag: "🇯🇵" },
            { html: "<div>Account based in United Kingdom</div>", expectedLoc: "United Kingdom", expectedFlag: "🇬🇧" },
            { html: '<div data-testid="UserLocation">Berlin, Germany</div>', expectedLoc: "Berlin, Germany", expectedFlag: "🇩🇪" },
            { html: '{"contentLocation":{"@type":"Place","name":"Paris, France"}}', expectedLoc: "Paris, France", expectedFlag: "🇫🇷" }
        ];

        testCases.forEach(tc => {
            const loc = parseLocationFromHtml(tc.html);
            const flag = getFlagEmoji(loc);
            expect(loc, `Failed for ${tc.html.substring(0, 20)}`).toContain(tc.expectedLoc);
            expect(flag).toBe(tc.expectedFlag);
        });

        console.log("✅ Worker thread parsing logic verified.");
    });
});
