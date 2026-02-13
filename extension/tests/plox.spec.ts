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

  // 4. Mock chrome.runtime APIs and inject background logic directly into the page context
  await page.evaluate(
    ({ location, flag }: { location: string; flag: string }) => {
      (window as any).chrome = {
        runtime: {
          sendMessage: async (msg: any) => {
            console.log("[Test Mock] Content script sent message:", msg);
            if (msg.action === "processHandle" && msg.handle.toLowerCase() === "realkalos") {
              // Wait a bit to simulate processing
              setTimeout(() => {
                const update = {
                  action: "visualizeFlag",
                  handle: msg.handle,
                  flag: flag,
                  location: location,
                };
                listeners.forEach((fn) => fn(update));
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

      // Handle the private channel handshake in the test mock
      window.addEventListener("message", (event) => {
        if (event.data && event.data.type === "__INITIAL_STATE__" && event.ports[0]) {
           const port = event.ports[0];
           port.onmessage = (e: any) => {
              if (e.data.type === "__DATA_LAYER_SYNC__") {
                 window.chrome.runtime.sendMessage(e.data);
              }
           };
        }
      });
    },
    {
      location: "Eastern Europe (Non-EU)",
      flag: "🇪🇺",
    },
  );

  // 5. Inject the bundled scripts
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

  // 6. Mock a GraphQL fetch
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

  // 7. Trigger discovery
  await page.evaluate(async () => {
    await fetch("https://x.com/i/api/graphql/User");
  });

  // 8. Wait for async processing
  await page.waitForTimeout(500);

  // 9. Verification fetch
  const patchedJson = await page.evaluate(async () => {
    const resp = await fetch("https://x.com/i/api/graphql/User");
    return await resp.json();
  });

  const name = patchedJson.data.user.result.legacy.name;
  expect(name).toContain("🇪🇺");
  expect(name).toContain("Kalos");

  console.log("✅ Playwright test passed!");
});
