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
*   **Hardening:** Uses Descriptor Integrity to hide the proxy. No global symbols are used; internal state is closure-bound.
*   **Response Proxying:** Wraps the `Response` object itself to trap `.json()` calls, modifying data in-place without cloning (reducing memory footprint and latency).
*   **Patching:** Recursively traverses JSON responses and appends location-based flag emojis to user `name` fields.

### 2. The Bridge (`ISOLATED` world)
*   **File:** `extension/src/content.ts`
*   **Role:** Acts as a secure intermediary.
*   **Handshake:** Scans for a transient, non-enumerable `Symbol` on `document` to receive the session ID, establishing a private channel without DOM attribute artifacts.
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
*   **Build:** `make build`
*   **Test Suite:** `make test` (Extension) and `make server-test` (Server)
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

**Phase 2: The Silent Handshake (Zero-Footprint)**
*   **Logic:** Establish a communication bridge between the `MAIN` world (Interceptor) and `ISOLATED` world (Content Script) without events or DOM attributes.
    1.  Interceptor defines a local `Symbol` on `document`.
    2.  This Symbol uses a `get` accessor (trap).
    3.  Bridge scans `Object.getOwnPropertySymbols(document)` to find the key.
    4.  Bridge reads the property: `document[Symbol]`.
    5.  The `get` trap fires, executing a closure that accepts the Bridge's `MessagePort`, establishes the link, and immediately `delete`s the Symbol from `document`.
*   **Result:** No `CustomEvent` dispatched. No `addEventListener`. No lingering DOM attributes.

**Phase 3: Iframe Immunization (Cross-Realm Defense)**
*   **Logic:** Intercept `document.createElement`.
*   **Action:** If an `<iframe>` is created:
    1.  Detect the creation immediately.
    2.  Recursively inject the **Phase 1 Native Vault** and **Phase 4 Proxies** into the new iframe's `contentWindow` *before* the site's scripts can access it.
*   **Goal:** Ensure `window.fetch === iframe.contentWindow.fetch` evaluates to `true`, defeating "Cross-Realm" integrity checks.

**Phase 4: Recursive Response Proxying & Hardening**
*   **Proxy Strategy:** Wrap the global `fetch` and `XMLHttpRequest`.
*   **Recursion:** Do not clone responses. Instead, wrap the `Response` object in a Proxy. Trap the `.json()` method.
*   **In-Place Patching:** When `.json()` is called, await the parsing, modify the object *in-place* (mutating the keys), and return the mutated object. This avoids the memory overhead of `response.clone()`.
*   **Descriptor Perfection:** Use a `harden` helper to copy the exact `value`, `writable`, `enumerable`, and `configurable` descriptors from the native original to the proxy, including masking `toString()` to return `[native code]`.

### 3. Data Layer Logic
*   **Target:** X.com GraphQL responses.
*   **Traversal:** Recursively scan JSON objects for keys: `data`, `user`, `legacy`, `user_results`, `result`, `core`, `instructions`, `entries`, `itemContent`, `tweet_results`.
*   **Modification:** Identify objects with `screen_name` and `name`. If a location match is found in the cache, append the flag emoji to `name` string.
*   **Protocol:** Uses **Opaque Integers** (0, 1, 2) for internal messaging to avoid identifiable string tokens in memory.

### 4. Backend Specification
*   **Stack:** Python (Flask) + SQLite.
*   **Concurrency:** SQLite must run in **WAL (Write-Ahead Logging)** mode to support concurrent reads/writes without locking.
*   **Interface:** `/met?username=HANDLE`. Returns `{ processed: bool, location: string | null }`.
