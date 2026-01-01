import * as fs from "fs";
import * as path from "path";
import { JSDOM } from "jsdom";
import fetch from "node-fetch-commonjs";
import * as utils from "./plox_test_helper";

// Set up global environment for the extension logic
(globalThis as any).TEST_ENV = true;
(globalThis as any).fetch = fetch;
(globalThis as any).chrome = {
    runtime: {
        onMessage: {
            addListener: () => { },
        },
    },
    tabs: {
        sendMessage: (tabId: number, message: any) => {
            console.log(`[Test Mock] Message sent to content script:`, message);
            (globalThis as any).lastSentMessage = message;
        },
    },
};

// Import ACTUAL extension logic
import * as extensionWorker from "../src/background";

const TEST_DATE = "2025-12-27";
const TARGET_HANDLE = "realKalos"; // worker expects handle without @

async function runTest() {
    console.log(`[${TEST_DATE}] 🧪 Running REAL LOGIC Integration Test...`);

    const mainFilePath = path.join(__dirname, `${TEST_DATE}.mhtml`);
    const aboutFilePath = path.join(__dirname, `${TEST_DATE}-about.mhtml`);

    // 1. Mock Fetch to return our saved data
    (globalThis as any).fetch = async (url: string) => {
        console.log(`[Test Mock] Intercepted fetch for: ${url}`);
        if (url.includes(TARGET_HANDLE)) {
            const content = fs.readFileSync(aboutFilePath, "utf8");
            const html = utils.extractHtmlFromMhtml(content);
            return {
                ok: true,
                status: 200,
                text: async () => html,
            };
        }
        return { ok: false, status: 404 };
    };

    // 2. Prepare Main Page (Simulation of browser tab)
    const mainMhtml = fs.readFileSync(mainFilePath, "utf8");
    const mainHtml = utils.extractHtmlFromMhtml(mainMhtml);
    if (!mainHtml) throw new Error("Could not extract HTML from MHTML");
    const dom = new JSDOM(mainHtml);
    (globalThis as any).document = dom.window.document;

    // 3. Trigger Investigation using actual background.js function
    console.log(`[${TEST_DATE}] Triggering performInvestigation for ${TARGET_HANDLE}`);
    await extensionWorker.performInvestigation(TARGET_HANDLE, 1, "test-element-id");

    // 4. Verify result sent back to tab
    const msg = (globalThis as any).lastSentMessage;
    if (!msg) {
        throw new Error("No message was sent back to the content script.");
    }

    console.log(`[${TEST_DATE}] Result received from worker: Flag=${msg.flag}, Loc=${msg.location}`);

    if (msg.flag === "🇪🇺" && msg.location === "Eastern Europe (Non-EU)") {
        console.log("🎉 TEST PASSED: Extension logic correctly identified the person's location from file.");
    } else {
        throw new Error(`Test mismatch. Received: ${msg.flag} / ${msg.location}`);
    }
}

runTest().catch((err) => {
    console.error(`[${TEST_DATE}] ❌ FATAL ERROR:`, err.message);
    process.exit(1);
});
