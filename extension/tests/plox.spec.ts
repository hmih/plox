import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { extractHtmlFromMhtml, setupChromeMock } from "./plox_test_helper";
import { BusCmd } from "../src/core";

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

  // Mock the Plox Server for realKalos
  await page.route("**/met?username=realkalos", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        username: "realkalos",
        processed: true,
        location: "Europe",
      }),
    });
  });

  await setupChromeMock(page, BusCmd);

  const distDir = process.env.PRODUCTION === "true" ? "dist/prod" : "dist/dev";
  const interceptorJs = fs.readFileSync(
    path.join(__dirname, `../${distDir}/interceptor.js`),
    "utf8",
  );
  const contentJs = fs.readFileSync(
    path.join(__dirname, `../${distDir}/content.js`),
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

  // WAIT FOR JITTER + HANDSHAKE + PROCESSING
  // With Stealth Jitter (max 1500ms) + Sentry Jitter + Processing, we need ample time.
  await page.waitForTimeout(3000);

  const patchedJson = await page.evaluate(async () => {
    const resp = await fetch("https://x.com/i/api/graphql/User");
    return await resp.json();
  });

  const name = patchedJson.data.user.result.legacy.name;
  expect(name).toContain("🇩🇪"); // The mock always returns Germany flag in setupChromeMock
  expect(name).toContain("Kalos");

  console.log("✅ Playwright test passed!");
});
