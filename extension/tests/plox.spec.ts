import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { extractHtmlFromMhtml } from "./plox_test_helper";

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

  await page.route(`**/realKalos/about`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: aboutHtml,
    });
  });

  await page.setContent(mainHtml);

  await page.evaluate(
    ({ location, flag }: { location: string; flag: string }) => {
      const listeners: any[] = [];
      const storage: Record<string, any> = {};
      
      // Force overwrite of chrome object
      try {
        // @ts-ignore
        delete window.chrome;
      } catch (e) {}

      const mockChrome = {
        runtime: {
          sendMessage: async (msg: any) => {
            console.log("[Test Mock] Content script sent message:", msg);
            if (
              msg.action === 3 && // processHandle
              msg.handle.toLowerCase() === "realkalos"
            ) {
              setTimeout(() => {
                storage[`cache:${msg.handle}`] = { location, flag };
                const update = {
                  action: 1, // visualizeFlag
                  handle: msg.handle,
                  flag: flag,
                  location: location,
                };
                listeners.forEach((fn) => fn(update));
              }, 100);
            }
          },
          onMessage: {
            addListener: (fn: any) => listeners.push(fn),
          }
        },
        storage: {
          local: {
            get: (keys: string[], cb: any) => {
              const res: any = {};
              keys.forEach((k) => {
                if (storage[k]) res[k] = storage[k];
              });
              setTimeout(() => cb(res), 0);
            },
            set: (items: any) => {
              Object.assign(storage, items);
            },
          },
        },
      };

      Object.defineProperty(window, 'chrome', {
        value: mockChrome,
        writable: true,
        configurable: true
      });
    },
    {
      location: "Eastern Europe (Non-EU)",
      flag: "🇪🇺",
    },
  );

  const interceptorJs = fs.readFileSync(
    path.join(__dirname, "../dist/interceptor.js"),
    "utf8",
  );
  const contentJs = fs.readFileSync(
    path.join(__dirname, "../dist/content.js"),
    "utf8",
  );
  await page.addScriptTag({ content: interceptorJs });
  await page.addScriptTag({ content: contentJs });

  await page.route("**/i/api/graphql/User", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          user: {
            result: {
              legacy: {
                screen_name: "realKalos",
                name: "Kalos",
              },
            },
          },
        },
      }),
    });
  });

  await page.evaluate(async () => {
    const resp = await fetch("https://x.com/i/api/graphql/User");
    await resp.json(); // Consume to trigger interceptor
  });

  await page.waitForTimeout(500);

  const patchedJson = await page.evaluate(async () => {
    const resp = await fetch("https://x.com/i/api/graphql/User");
    return await resp.json();
  });

  const name = patchedJson.data.user.result.legacy.name;
  expect(name).toContain("🇪🇺");
  expect(name).toContain("Kalos");

  console.log("✅ Playwright test passed!");
});
