# Plox: Developer Agent Handbook

This document provides operational protocols and bootstrapping instructions for AI agents working on the Plox project. It prioritizes system safety and stealth integrity.

## Agent Bootstrap Protocol

Follow these steps at the start of every session:

1.  **Environment Check:** Enter the pure Nix shell:
    ```sh
    nix-shell --pure
    ```
2.  **State Verification:** Run the test suite to ensure the baseline is stable:
    ```sh
    make build && make test && make server-test
    ```
3.  **Stealth Audit:** Verify that no new footprints have been introduced.
    - Check `extension/src/` for any `document.createElement` or `styles.css` imports.
    - Ensure `interceptor.ts` does NOT use `Symbol.for()` (global registry pollution).
    - Verify `fetch` proxy uses in-place `.json()` hooking, not `.clone()`.

---

## The Stealth Mandates (CRITICAL)

Plox uses **Nuclear Stealth**. Violation of these rules is a critical failure.

1.  **NO DOM MUTATIONS:** Never use `appendChild`, `prepend`, or `innerHTML`.
2.  **NO PERSISTENT ATTRIBUTES:** Never use `data-plox-*` or custom IDs.
3.  **NO GLOBAL POLLUTION:** Do not use `Symbol.for()` or exposed global variables. Use closure-bound state or transient non-enumerable properties.
4.  **PROXY INTEGRITY:** Functions like `fetch` must look native to `toString()` and descriptor inspection.
5.  **ZERO FOOTPRINT:** The DOM must be 100% identical to its original state after the handshake.

---

## Operational Workflow

### Documentation Synchronization Mandate (CRITICAL)
The `README.md` serves as a "Living Manifest." Agents must strictly adhere to this sync protocol:
1.  **Code Change:** If you modify `interceptor.ts`, `content.ts`, or backend logic, you MUST update the human-readable summary in `README.md`.
2.  **Blueprint Update:** If you alter the *architecture* (e.g., changing the handshake mechanism or proxy strategy), you MUST update the **God Prompt Appendix** in `README.md`.
3.  **Verification:** Before closing a session, verify that the God Prompt accurately describes the *logic* of the current implementation, allowing a fresh LLM to reconstruct the system from the prompt alone.

### Interceptor Development (`MAIN` World)
- **Recursive Patching:** Maintain the `patchUserObjects` recursion list. Ensure common GraphQL keys like `data`, `user`, and `legacy` are covered.
- **In-Place Modification:** Modify JSON objects in-place to minimize detection via memory/timing analysis.
- **Proxy Hardening:** Always use the `harden` helper for any new proxies.

### Bridge Development (`ISOLATED` World)
- **Ghost Handshake:** Use `Object.getOwnPropertySymbols(document)` to discover the handshake ID. Avoid `MutationObserver` for the initial handshake to prevent attribute race conditions.
- **Stealth Caching:** Always check `chrome.storage.local` before querying the background script.

### Background Development (Service Worker)
- **Normalization:** Always lowercase and strip handles before server queries or cache insertion.
- **Sync:** Ensure geolocated data is synced to `chrome.storage.local` for the Bridge.

---

## Verification & Auditing

### Automated Testing
- **Refactor Guard:** Run `npx playwright test tests/refactor_guard.spec.ts` after any change to the interception logic.
- **Realistic Simulation:** Use `tests/plox.spec.ts` to verify patching against real MHTML snapshots of X.com.

### Manual Audit Protocol
Run these in the browser console during development:
- `fetch.toString()`: Must return `function fetch() { [native code] }`.
- `Object.getOwnPropertyDescriptor(window, 'fetch')`: Must match native (enumerable: false).
- `Object.getOwnPropertySymbols(window)`: Check for our internal state Symbol.
- `document.querySelectorAll('*')`: Audit for custom attributes or nodes.

---

## Technical Mapping Reference

| Component | Responsibility | Environment | Handshake Role |
| :--- | :--- | :--- | :--- |
| `interceptor.ts` | Data Patching | `MAIN` World | Sets transient `Symbol` |
| `content.ts` | Secure Bridge | `ISOLATED` World | Discovers Symbol & Dispatches |
| `background.ts` | Server Sync | Service Worker | N/A |
| `app.py` | API Lookup | Flask Server | N/A |

**Protocol Reference:**
**GHOST Protocol (Interceptor <-> Bridge)**
- `0` (SYNC): Discovery relay.
- `1` (UPDATE): Injection update.
- `2` (RETRY): Recovery trigger.

**BUS Protocol (Bridge <-> Background)**
- `4` (PROCESS): Background lookup request.
- `5` (UPDATE): Found data.
- `6` (RETRY): Failed lookup.
