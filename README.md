# Plox: Total Stealth Data Interception

Plox is an advanced browser extension and backend system designed to provide geographic context for X.com handles while remaining entirely invisible to anti-tamper scripts. It operates via **Data-Layer Interception**, patching GraphQL responses in memory before they reach the UI.

## Core Philosophy: Nuclear Stealth

X.com employs sophisticated detection mechanisms. Plox is built to evade these through four non-negotiable pillars:

1.  **Zero DOM Footprint:** No custom elements, no injected styles, and no data-attributes. The DOM remains 100% identical to its native state.
2.  **Network-Level Patching:** We modify the raw JSON data received from X.com APIs (`fetch` and `XHR`). The UI renders the injected flags naturally as part of the handle's name string.
3.  **Invisible Communication:** Browser worlds communicate via private `MessageChannel` pipes established through a transient "Ghost Handshake," leaving no trace on the `window` message bus.
4.  **Native Mimicry:** All proxies are hardened to match native property descriptors and `toString()` signatures.

---

## Extension Architecture

The extension is split across three isolated execution environments to balance security and functionality.

### 1. The Interceptor (`MAIN` world)
*   **File:** `extension/src/interceptor.ts`
*   **Role:** Runs in X.com's own context. Proxies `fetch` and `XMLHttpRequest`.
*   **Stealth:** Uses a **Global Lie Map** to hook `Function.prototype.toString`. This allows proxies to recursively pass introspection checks (e.g., `fetch.toString().toString()` returns `[native code]`).
*   **Response Proxying:** Wraps the `Response` object itself to trap `.json()` calls, modifying data in-place without cloning (reducing memory footprint and latency).
*   **Patching:** Recursively traverses JSON responses and appends location-based flag emojis to user `name` fields.

### 2. The Bridge (`ISOLATED` world)
*   **File:** `extension/src/content.ts`
*   **Role:** Acts as a secure intermediary.
*   **Handshake:** Camouflages the connection as a standard "ReactDevTools" setup event to blend in with X.com's React-heavy environment.
*   **Stealth Caching:** Checks `chrome.storage.local` before messaging the background, enabling instant hydration for known handles.

### 3. The Orchestrator (`Background` Service Worker)
*   **File:** `extension/src/background.ts`
*   **Role:** Manages persistent state and server communication.
*   **Sync:** Fetches data from the Plox Server and synchronizes it to local storage for the Bridge.

---

## Backend Architecture

### 1. API (`server/app.py`)
*   **Role:** Provides the `/met` endpoint for handle lookups.
*   **Concurrency:** Thread-safe SQLite connections via Flask's `g` context. Handles concurrent registration conflicts gracefully.

### 2. Persistence (`server/db.py`)
*   **Role:** SQLite management.
*   **Mode:** Uses WAL (Write-Ahead Logging) to allow concurrent read/write operations without database locks.

---

## Appendix: Operational Details

### The Ghost Handshake
1.  **Interceptor** generates a random ID and stores it in a non-enumerable `Symbol` on `document`.
2.  **Bridge** discovers the symbol via `Object.getOwnPropertySymbols(document)`, retrieves the ID, and dispatches a `CustomEvent(id, { detail: port })`.
3.  **Interceptor** receives the port, establishes the private channel, and immediately deletes the Symbol to scrub the footprint.

### Development Environment
*   **Bootstrap:** `nix-shell --pure`
*   **Build:** `make extension-build` (Builds both dev and prod)
*   **Test Suite:** `make extension-test` (Runs dev tests then prod tests)
*   **Audit:** Verify stealth by running `fetch.toString()` in the console; it must return `function fetch() { [native code] }`.

---

## Appendix: The Plox Blueprint (God Prompt)

> **SYSTEM INSTRUCTION:** The following specification represents the "DNA" of the Plox architecture. It is designed to allow an advanced LLM to reconstruct the system's core logic from scratch without seeing the original code.

### 1. System Context
Develop a browser extension ("System Font Compatibility Layer") that invisibly intercepts X.com's data layer to inject geographic context (flags) into user handles. The system must operate under **Nuclear Stealth** rules, defeating advanced anti-tamper scripts (Cross-Realm checks, Prototype scanning, DOM MutationObservers).

### 2. The 4-Phase Stealth Architecture

**Phase 1: Native Safeguarding (The Clean Room)**
*   **Logic:** At `document_start` (Main World), immediately capture references to critical native globals (`JSON`, `Object`, `Function`, `MessagePort`, `Proxy`, `Reflect`, `document`, `window`) into a private closure.
*   **Constraint:** All subsequent extension logic must *only* use these captured references. Never access global `window` properties during runtime, as X.com may have monkey-patched them to log activity.

**Phase 2: The Camouflaged Handshake**
*   **Logic:** Establish a communication bridge between `MAIN` and `ISOLATED` worlds using traffic camouflage.
*   **Mechanism:** Instead of custom events (detectable), the Bridge dispatches a `window.postMessage` with `source: "ReactDevTools_connect_v4"`.
*   **Interception:** The Interceptor captures this specific event pattern (common in React apps), halts propagation (`stopImmediatePropagation`), and extracts the `MessagePort`.
*   **Result:** Connection looks like standard React DevTools initialization traffic to any observer.

**Phase 3: Iframe Immunization (Prototype Hook)**
*   **Logic:** Secure cross-realm access without proxying `document.createElement` (which causes "Illegal Invocation" crashes).
*   **Mechanism:** Hook `HTMLIFrameElement.prototype.contentWindow` using a getter.
*   **Action:** When `iframe.contentWindow` is accessed:
    1.  Call the original native getter.
    2.  Check if the returned window is already immunized.
    3.  If not, inject the **Phase 4 Proxies** (fetch/XHR) into the new window context.
    4.  Register the new window in a `WeakSet` to prevent re-patching.
*   **Stealth:** The hook itself is registered in the **Lie Map**, so `Object.getOwnPropertyDescriptor(...).get.toString()` returns `[native code]`.

**Phase 4: The Lie Map (Deep Stealth)**
*   **The Meta-Problem:** Standard proxies fail recursive inspection (`fetch.toString().toString()` reveals code).
*   **Solution:** Do not patch individual objects' `toString`. Instead, patch the source of truth: `Function.prototype.toString`.
*   **The Lie Map:** Maintain a private `WeakMap<Function, string>` mapping proxies to their original native source strings.
*   **Global Hook:** The patched `Function.prototype.toString`:
    1.  Checks if `this` is in the Lie Map.
    2.  If yes, returns the stored "Lie" (native string).
    3.  If no, calls the real native `toString`.
*   **The Ouroboros:** The Global Hook registers *itself* in the Lie Map, so inspecting the inspector reveals `[native code]`.

### 3. Data Layer Logic
*   **Target:** X.com GraphQL responses.
*   **Traversal:** Recursively scan JSON objects for keys: `data`, `user`, `legacy`, `user_results`, `result`, `core`, `instructions`, `entries`, `itemContent`, `tweet_results`.
*   **Modification:** Identify objects with `screen_name` and `name`. If a location match is found in the cache, append the flag emoji to `name` string.
*   **Protocol:** Uses dual-channel **Opaque Integers**:
    *   **GHOST (0-2):** Interceptor <-> Bridge.
    *   **BUS (4-6):** Bridge <-> Background.

### 4. Backend Specification
*   **Stack:** Python (Flask) + SQLite.
*   **Concurrency:** SQLite must run in **WAL (Write-Ahead Logging)** mode to support concurrent reads/writes without locking.
*   **Interface:** `/met?username=HANDLE`. Returns `{ processed: bool, location: string | null }`.
