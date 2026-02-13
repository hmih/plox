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
