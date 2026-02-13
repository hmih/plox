# Plox: Nuclear Stealth Flag Interception

Plox is a high-stealth browser extension and backend system designed to provide geographic context for X.com handles without leaving a detectable footprint. It operates via **Data-Layer Interception**, patching GraphQL responses in memory before they are rendered by the UI.

## System Prelude: Goals & Priorities

The primary objective of Plox is **Nuclear Stealth**. Detection by X.com's anti-tamper scripts can lead to user bans. Therefore, the system is built on these core priorities:

1.  **Zero Footprint:** No DOM mutations, no custom attributes, and no style injections. The DOM remains 100% identical to its original state.
2.  **Data-Layer Interception:** Flags are injected by patching the raw JSON data received from X.com's APIs.
3.  **Low Latency:** Interception and patching must occur in under 5ms to avoid UI stutter.
4.  **Privacy & Security:** Communication between browser worlds is isolated via private `MessageChannel` pipes.

---

## Extension Architecture (Frontend)

The extension is split across three isolated execution environments to balance security and API access.

### 1. The Interceptor (`MAIN` world)
*   **File:** `extension/src/interceptor.ts`
*   **Responsibility:** The most critical component. It runs in the same context as X.com's own scripts.
*   **Mechanism:** Proxies `window.fetch` and `window.XMLHttpRequest` to intercept GraphQL responses (e.g., `UserByScreenName`, `TweetResultByRestId`).
*   **Patching:** Recursively traverses JSON responses and appends location-based flag emojis directly to the `name` field of user objects.
*   **Stealth:** Masks its proxies to look like native code (`fetch.toString() === "function fetch() { [native code] }"`).

### 2. The Bridge (`ISOLATED` world)
*   **File:** `extension/src/content.ts`
*   **Responsibility:** Acts as a secure relay between the Interceptor and the Extension Background.
*   **Communication:** Establishes a private `MessageChannel` with the Interceptor. This eliminates the need for detectable `window.postMessage` broadcasts.
*   **Privacy:** Ensures that site scripts cannot observe or tamper with discovery and update messages.

### 3. The Orchestrator (`Background` Service Worker)
*   **File:** `extension/src/background.ts`
*   **Responsibility:** Manages state, caching, and external API communication.
*   **Logic:** Receives discovered handles, queries the Plox Server, caches results in memory, and pushes updates back through the Bridge to the Interceptor.

---

## Backend Architecture (Data)

The backend is a lightweight Python service designed for high concurrency and thread safety.

### 1. The API (`server/app.py`)
*   **Responsibility:** Provides the `/met` endpoint for handle lookups and registration.
*   **Concurrency:** Uses Flask's `g` context to manage request-scoped, thread-safe SQLite connections.
*   **Conflict Handling:** Gracefully handles race conditions during concurrent handle registrations via `IntegrityError` catches.

### 2. Persistence (`server/db.py`)
*   **Responsibility:** Database management and data integrity.
*   **Storage:** SQLite in WAL (Write-Ahead Logging) mode to support concurrent read/write operations without locking.
*   **Normalization:** Strictly enforces lowercasing and stripping of usernames to prevent duplicate entries.

---

## Appendix: Implementation Details

### Messaging Flow (Handshake)
1.  **Init:** `content.ts` creates a `MessageChannel` and sends one port to `interceptor.ts` via a single `__INITIAL_STATE__` message.
2.  **Sync:** `interceptor.ts` uses the private port to send `__DATA_LAYER_SYNC__` messages when new handles are discovered.
3.  **Update:** `content.ts` pushes flags back to the Interceptor via `__DATA_LAYER_UPDATE__`.

### Stealth Mandates
*   **NO DOM MUTATIONS:** Never use `document.createElement` or similar.
*   **NO CUSTOM ATTRIBUTES:** No `data-plox-*` attributes.
*   **NO STYLE INJECTION:** No CSS targeting X.com internal classes.
*   **ZERO FOOTPRINT:** The DOM must be indistinguishable from a clean X.com instance.

### Development Suite
*   **Environment:** Always use `nix-shell --pure`.
*   **Build:** `make build`
*   **Extension Tests:** `make test` (Playwright integration)
*   **Server Tests:** `make server-test` (Pytest)
*   **Audit Command:** Run `fetch.toString()` in the browser console; it must return native code signature.
