# Plox: Developer Agent Handbook

This document provides operational protocols and bootstrapping instructions for AI agents working on the Plox project. For a full technical overview of the system, refer to the [README.md](./README.md).

## Agent Bootstrap Protocol

Whenever starting a new session or task, you MUST follow these steps to ensure environment consistency and system safety:

1.  **Environment Check:** Enter the pure development environment:
    ```sh
    nix-shell --pure
    ```
2.  **Safety Verification:** Run the full test suite to confirm the current state is stable:
    ```sh
    make test && make server-test
    ```
3.  **Stealth Audit:** Verify that the "Zero Footprint" mandate is intact. Run `make build` and ensure no residual DOM-mutation or style-injection code exists in `extension/src/`.

---

## The Stealth Mandates (CRITICAL)

Plox uses **Nuclear Stealth**. Failure to follow these rules will result in user detection and bans. If you are asked to implement a feature that requires a DOM mutation, explain why it violates the mandate and suggest a Data-Layer alternative.

1.  **No DOM Mutations:** No `appendChild`, `prepend`, or `innerHTML`.
2.  **No Custom Attributes:** No `data-plox-*` or custom IDs.
3.  **No Style Injection:** Do not inject CSS.
4.  **Zero Footprint:** The DOM must be 100% identical to its original state. Verify with `document.querySelectorAll('*')` audits.

---

## Operational Workflow

### Extension Development
- **Strict Typing:** Use `strict` TypeScript. Use `unknown` with type guards instead of `any`.
- **In-Place Patching:** Always modify JSON objects in-place in `interceptor.ts` to minimize memory overhead.
- **Proxy Integrity:** When modifying `fetch` or `XHR` proxies, ensure they still mask themselves as native code.

### Server Development
- **Thread Safety:** Always use request-scoped database connections via Flask's `g` object.
- **Normalization:** Every database query involving a username MUST be lowercased and stripped.

### Testing & Verification
- **Regression Guard:** Any change to the interceptor or communication bridge MUST be verified with `npx playwright test`.
- **Latency Monitoring:** Ensure patching time remains below **5ms**. If it exceeds this, optimize the recursion logic in `patchUserObjects`.

---

## Technical Mapping Reference

| Component | Responsibility | Environment |
| :--- | :--- | :--- |
| `interceptor.ts` | Data Patching | `MAIN` World (X.com Context) |
| `content.ts` | Secure Bridge | `ISOLATED` World (Extension Context) |
| `background.ts` | Orchestrator | Service Worker |
| `app.py` | API & Logic | Flask Server |
| `db.py` | Persistence | SQLite (WAL Mode) |

**Handshake Event Types:**
- `__INITIAL_STATE__`: Port-passing handshake.
- `__DATA_LAYER_SYNC__`: Discovery relay.
- `__DATA_LAYER_UPDATE__`: Flag injection update.
- `__DATA_LAYER_RETRY__`: Lookup failure recovery.
