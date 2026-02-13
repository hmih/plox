# Plox: Developer Agent Guidelines

Plox is a high-stealth Chrome Manifest V3 extension paired with a Python/Flask server. It injects location-based flag emojis into X.com handles via Data-Layer Interception.

## Development Environment

All development tasks MUST be executed within the provided Nix shell to ensure dependency consistency.

- **Enter Environment:** `nix-shell --pure`
- **Build Extension:** `make build` (Bundles `dist/background.js`, `dist/content.js`, `dist/interceptor.js`)
- **Format Code:** `make format` (Runs Prettier for TS/JS and shfmt for scripts)
- **Type Check:** `cd extension && npx tsc --noEmit`

### Testing
- **Run All Tests (Ext):** `make test`
- **Run Single Test (Ext):** `cd extension && npx playwright test tests/<filename>.spec.ts`
- **Run All Tests (Srv):** `make server-test`
- **Run Single Test (Srv):** `cd server && python3 -m pytest tests/<filename>.py -v`

---

## Stealth Mandates (CRITICAL)

Plox uses **Nuclear Stealth (Data-Layer Interception)**. Failure to follow these rules will result in user detection and bans.

1. **NO DOM MUTATIONS:** Never use `document.createElement`, `el.prepend`, or `el.appendChild` to inject flags.
2. **NO CUSTOM ATTRIBUTES:** Never use `data-plox-*` or any other custom attributes on X.com elements.
3. **NO STYLE INJECTION:** Do not inject CSS that targets X.com's internal class names.
4. **DATA-LAYER ONLY:** Flags must be injected by patching GraphQL JSON responses in the `MAIN` world interceptor.
5. **ZERO FOOTPRINT:** The DOM must remain 100% identical to its original state. Verify with `document.querySelectorAll('*')` audits.

---

## Code Style Guidelines

### TypeScript (Extension)
- **Strict Mode:** Use `strict` TypeScript. Avoid `any` at all costs; use `unknown` with type guards.
- **World Isolation:**
    - `interceptor.ts`: Runs in `MAIN` world. Proxies `fetch`, patches JSON. No chrome.* APIs.
    - `content.ts`: Runs in `ISOLATED` world. Acts as a bridge between `MAIN` and background.
- **Async Hydration:** If a location is not in the `MAIN` world `Map` cache, pass the JSON through instantly and fetch the data in the background.
- **Stealth Proxy:** Mask `fetch` proxies by overriding `toString()` and `.name` to look like `[native code]`.
- **In-Place Patching:** Modify JSON objects in-place to minimize memory overhead.

### Python (Server)
- **Formatting:** Code must be formatted with `black`.
- **Database:** Use `db.py` helpers for SQLite. Always use WAL mode for concurrent access.
- **Normalization:** Always lowercase and strip usernames before DB queries or insertions.

---

## Messaging Architecture

1. Discovery: interceptor.ts (MAIN) finds handle in JSON -> window.postMessage -> content.ts (ISOLATED).
2. Lookup: content.ts -> chrome.runtime.sendMessage -> background.ts.
3. Query: background.ts -> Plox Server API (GET /met).
4. Update: background.ts -> chrome.tabs.sendMessage -> content.ts.
5. Hydration: content.ts -> window.postMessage -> interceptor.ts (updates local Map for next render).

---

## Git & Workflow

- **Commit Messages:** Lowercase, action-oriented (e.g., "fix fetch proxy", "add user path").
- **Secrets:** Never commit `.env` or SQLite DB files.
- **Refactoring:** When refactoring, always use `npx playwright test` to verify the "Nuclear Stealth" logic remains intact.
- **Naming:** Use `camelCase` for TS/JS variables and `snake_case` for Python.

---

## Server Management
- **Start:** `make server-up` (Runs Docker Compose)
- **Stop:** `make server-down`
- **Logs:** `make server-logs`
- **Local Run:** `cd server && python3 app.py` (Requires `pip install flask`)

---

## Stealth & Performance Auditing

To verify that the extension remains undetected, use the following techniques during development:

- **DOM Audit:** Run `document.querySelectorAll('*')` in the X.com console and verify no custom attributes or Plox-specific nodes exist.
- **Latency Check:** The interceptor logs patching time to the console. Ensure this remains below **5ms** for large timeline responses.
- **Proxy Integrity:** Check `fetch.toString()` in the browser console. It must return exactly `function fetch() { [native code] }`.
- **Network Privacy:** Ensure no handles are leaked via URL parameters to non-Plox domains.

## Common Troubleshooting

- **Flags not appearing:**
    - Check if the handle is in the server DB (`GET /met?username=...`).
    - Verify that `interceptor.js` is loaded in the `MAIN` world (check `Sources` tab in DevTools).
    - Ensure `window.postMessage` bridge is active between worlds.
- **Build Errors:**
    - Always use `nix-shell --pure` if `npm` or `node` are missing.
    - If `esbuild` platform errors occur, run `npm install` inside the nix-shell.
- **Server issues:**
    - Check docker logs with `make server-logs`.
    - Verify SQLite WAL mode is enabled if database locks occur.

## Collaboration Protocol

- **Proactive Search:** Before adding new features, use `grep` to find existing patterns in `interceptor.ts`.
- **Minimalism:** Avoid adding external dependencies to the extension `src/` folder to keep bundle sizes small and stealthy.
- **Security:** Never expose the `PLOX_SERVER_URL` in commit messages or public documentation if it points to a production instance.

## File Structure Overview

### Extension (`/extension`)
- **`src/interceptor.ts`**: The most critical file. Contains the `fetch` proxy and the JSON recursive patching logic. Runs in the `MAIN` world.
- **`src/content.ts`**: The bridge script. Listens for messages from the interceptor and communicates with the background script. Runs in the `ISOLATED` world.
- **`src/background.ts`**: The service worker. Handles network requests to the Plox server and manages an in-memory cache of handle-to-location mappings.
- **`src/core.ts`**: Shared utility functions, including the flag emoji generator.
- **`dist/`**: Contains the compiled bundles. Do not edit files here directly.
- **`tests/`**: Playwright integration tests. Use `.mhtml` files for realistic offline testing.

### Server (`/server`)
- **`app.py`**: Flask application defining the `/met` endpoint for handle lookups and registration.
- **`db.py`**: Core database logic using SQLite. Implements the schema and connection pooling.
- **`worker.py`**: A background process for processing handles that haven't been geolocated yet (currently dry-run).
- **`Dockerfile` / `docker-compose.yaml`**: Containerization logic for the server and database.
- **`tests/`**: Python unit and integration tests using `pytest`.

### Root (`/`)
- **`shell.nix`**: Pinned development environment configuration.
- **`Makefile`**: Global task runner for build, test, and management operations.
- **`AGENTS.md`**: This file (guidelines for coding agents).
