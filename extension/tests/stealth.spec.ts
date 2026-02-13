import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

test.describe("Nuclear Stealth Verification", () => {
  let interceptorJs: string;

  test.beforeAll(() => {
    const distDir = process.env.PRODUCTION === "true" ? "dist/prod" : "dist/dev";
    console.log(`[TEST] Using distribution: ${distDir}`);
    interceptorJs = fs.readFileSync(
      path.join(__dirname, `../${distDir}/interceptor.js`),
      "utf8",
    );
  });

  test("Global Lie Map Integrity (Meta-Stealth)", async ({ page }) => {
    await page.setContent("<html><body></body></html>");
    
    // Inject only the interceptor to isolate stealth capabilities
    await page.addScriptTag({ content: interceptorJs });

    const report = await page.evaluate(() => {
      const nativePattern = /\{\s*\[native code\]\s*\}/;
      
      const fetchStr = window.fetch.toString();
      const fetchToStringStr = window.fetch.toString.toString();
      const globalToStringStr = Function.prototype.toString.toString();
      
      // Check for property leakage (The "Own Property" Tell)
      const fetchDescriptor = Object.getOwnPropertyDescriptor(window.fetch, "toString");
      
      return {
        fetchIsNative: nativePattern.test(fetchStr),
        fetchToStringIsNative: nativePattern.test(fetchToStringStr),
        globalToStringIsNative: nativePattern.test(globalToStringStr),
        fetchHasOwnToString: !!fetchDescriptor,
        fetchName: window.fetch.name,
        // @ts-ignore
        leakedArtifacts: Object.getOwnPropertyNames(window).filter(k => k.includes("_plox") || k.includes("lies")),
      };
    });

    expect(report.fetchIsNative).toBe(true);
    expect(report.fetchToStringIsNative).toBe(true);
    expect(report.globalToStringIsNative).toBe(true);
    expect(report.fetchHasOwnToString).toBe(false);
    expect(report.fetchName).toBe("fetch");
    expect(report.leakedArtifacts).toEqual([]);
    
    console.log("✅ Meta-Stealth verified: Recursion hidden, no artifacts.");
  });

  test("Iframe Immunization & Prototype Stealth", async ({ page }) => {
    await page.setContent("<html><body></body></html>");
    await page.addScriptTag({ content: interceptorJs });

    const report = await page.evaluate(() => {
      const nativePattern = /\{\s*\[native code\]\s*\}/;
      
      // 1. Check the prototype hook itself
      const getterDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
      // @ts-ignore
      const getterStr = getterDescriptor?.get?.toString() || "";
      const getterToStringStr = getterDescriptor?.get?.toString.toString() || "";

      // 2. Functional check (Illegal Invocation prevention)
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      const win = iframe.contentWindow;

      // 3. Check deeper stealth inside the iframe
      // @ts-ignore
      const innerFetchStr = win.fetch.toString();

      return {
        getterIsNative: nativePattern.test(getterStr),
        getterMetaIsNative: nativePattern.test(getterToStringStr),
        iframeWorks: !!win,
        innerFetchIsNative: nativePattern.test(innerFetchStr),
        // @ts-ignore
        iframeHasArtifact: !!win._plox_proxied
      };
    });

    expect(report.getterIsNative).toBe(true);
    expect(report.getterMetaIsNative).toBe(true);
    expect(report.iframeWorks).toBe(true);
    expect(report.innerFetchIsNative).toBe(true);
    expect(report.iframeHasArtifact).toBe(false);

    console.log("✅ Iframe Immunization verified: Functional and Invisible.");
  });
});
