import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

test.describe("Nuclear Stealth Verification", () => {
  let interceptorJs: string;

  test.beforeAll(() => {
    const distDir =
      process.env.PRODUCTION === "true" ? "dist/prod" : "dist/dev";
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
      const fetchDescriptor = Object.getOwnPropertyDescriptor(
        window.fetch,
        "toString",
      );

      return {
        fetchIsNative: nativePattern.test(fetchStr),
        fetchToStringIsNative: nativePattern.test(fetchToStringStr),
        globalToStringIsNative: nativePattern.test(globalToStringStr),
        fetchHasOwnToString: !!fetchDescriptor,
        fetchName: window.fetch.name,
        // @ts-ignore
        leakedArtifacts: Object.getOwnPropertyNames(window).filter(
          (k) => k.includes("_plox") || k.includes("lies"),
        ),
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
      const getterDescriptor = Object.getOwnPropertyDescriptor(
        HTMLIFrameElement.prototype,
        "contentWindow",
      );
      // @ts-ignore
      const getterStr = getterDescriptor?.get?.toString() || "";
      const getterToStringStr =
        getterDescriptor?.get?.toString.toString() || "";

      // 2. Functional check (Illegal Invocation prevention)
      const iframe = document.createElement("iframe");
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
        iframeHasArtifact: !!win._plox_proxied,
      };
    });

    expect(report.getterIsNative).toBe(true);
    expect(report.getterMetaIsNative).toBe(true);
    expect(report.iframeWorks).toBe(true);
    expect(report.innerFetchIsNative).toBe(true);
    expect(report.iframeHasArtifact).toBe(false);

    console.log("✅ Iframe Immunization verified: Functional and Invisible.");
  });

  test("Advanced Cross-Realm & Constructor Identity (Vulnerability Probe)", async ({
    page,
  }) => {
    await page.setContent("<html><body></body></html>");
    await page.addScriptTag({ content: interceptorJs });

    const report = await page.evaluate(() => {
      // 1. XHR Identity Check
      const xhr = new XMLHttpRequest();
      const xhrConstructorIsFake = xhr.constructor === XMLHttpRequest;

      // 2. Iframe Deep Stealth
      const iframe = document.createElement("iframe");
      document.body.appendChild(iframe);
      const win = iframe.contentWindow as any;

      // If we haven't patched the iframe's Function.prototype.toString,
      // this meta-check will return the NATIVE toString source, not our lie.
      // Or if we haven't patched XHR in the iframe at all.
      const iframeXHR = new win.XMLHttpRequest();
      const iframeXhrIsPatched = iframeXHR.constructor === XMLHttpRequest; // Should match our main world proxy? Or its own?

      // Check if Function.prototype.toString is hooked inside iframe
      // If it's native, it won't know about our "Lies"
      const innerGlobalToString = win.Function.prototype.toString.toString();
      const isInnerGlobalToStringHooked =
        innerGlobalToString.includes("[native code]") &&
        !innerGlobalToString.includes("lies");

      const xhrInstance = new win.XMLHttpRequest();
      const openName = xhrInstance.open.name;

      return {
        xhrConstructorMatches: xhrConstructorIsFake,
        iframeXHRIsPatched: xhrInstance.open.toString().includes("native code"),
        iframeGlobalToStringIsHooked: isInnerGlobalToStringHooked,
        xhrOpenName: openName,
      };
    });

    // These are strict stealth requirements
    expect(
      report.xhrConstructorMatches,
      "XHR instance constructor should match the global XMLHttpRequest proxy",
    ).toBe(true);

    // Verify Deep Stealth Fixes:
    expect(
      report.iframeXHRIsPatched,
      "XHR inside iframe should be patched (hidden source)",
    ).toBe(true);
    expect(
      report.iframeGlobalToStringIsHooked,
      "Iframe Function.prototype.toString must be hooked",
    ).toBe(true);

    console.log("XHR Open Name:", report.xhrOpenName);
    expect(report.xhrOpenName, "XHR.open.name must match native").toBe("open");
  });
});
