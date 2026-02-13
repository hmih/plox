import { GhostCmd, log } from "./core";

(function () {
  /**
   * NUCLEAR STEALTH PHASE 1: NATIVE SAFEGUARDING
   * Capture all critical native APIs immediately before any external scripts run.
   * This creates a "clean room" environment for our internal logic.
   */
  const Native = {
    Object: Object,
    Function: Function,
    Array: Array,
    JSON: JSON,
    Promise: Promise,
    Symbol: Symbol,
    Map: Map,
    Set: Set,
    WeakMap: WeakMap,
    WeakSet: WeakSet,
    Proxy: Proxy,
    Reflect: Reflect,
    fetch: window.fetch.bind(window),
    XMLHttpRequest: window.XMLHttpRequest, // Constructor, so we don't bind
    document: document,
    window: window,
    console: console,
    // Prototypes
    Object_defineProperty: Object.defineProperty,
    Object_getOwnPropertyDescriptor: Object.getOwnPropertyDescriptor,
    Object_getOwnPropertySymbols: Object.getOwnPropertySymbols,
    Object_getPrototypeOf: Object.getPrototypeOf,
    Object_keys: Object.keys,
    Function_prototype_call: Function.prototype.call,
    Function_prototype_apply: Function.prototype.apply,
    Function_prototype_bind: Function.prototype.bind,
    Function_prototype_toString: Function.prototype.toString,
    EventTarget_prototype_addEventListener:
      EventTarget.prototype.addEventListener,
    EventTarget_prototype_dispatchEvent: EventTarget.prototype.dispatchEvent,
    MessagePort_prototype_postMessage: MessagePort.prototype.postMessage,
    Document_prototype_createElement: Document.prototype.createElement,
    HTMLIFrameElement_prototype_contentWindow_get:
      Object.getOwnPropertyDescriptor(
        window.HTMLIFrameElement.prototype,
        "contentWindow",
      )?.get,
  };

  // Safe execution helpers using captured natives
  const safeCall = (fn: Function, thisArg: any, ...args: any[]) =>
    Native.Function_prototype_call.apply(fn, [thisArg, ...args]);
  const safeApply = (fn: Function, thisArg: any, args: any[]) =>
    Native.Function_prototype_apply.apply(fn, [thisArg, args]);
  const safeJSONParse = (text: string) => Native.JSON.parse(text);
  const safeJSONStringify = (value: any) => Native.JSON.stringify(value);

  /**
   * NUCLEAR STEALTH PHASE 4: THE LIE MAP
   * Instead of patching individual objects with a .toString() property (which is detectable),
   * we maintain a global map of "lies" and patch the source of truth: Function.prototype.toString.
   */
  const lies = new Native.WeakMap<any, string>();
  const proxiedWindows = new Native.WeakSet<any>();

  /**
   * Helper to copy descriptors and register a lie.
   */
  function harden(proxy: any, original: any) {
    const descriptors = Native.Object_getOwnPropertyDescriptor(
      original,
      "prototype",
    );
    if (descriptors) {
      Native.Object_defineProperty(proxy, "prototype", descriptors);
    }

    const descriptor = Native.Object_getOwnPropertyDescriptor(original, "name");
    if (descriptor) {
      Native.Object_defineProperty(proxy, "name", descriptor);
    }

    const lenDescriptor = Native.Object_getOwnPropertyDescriptor(
      original,
      "length",
    );
    if (lenDescriptor) {
      Native.Object_defineProperty(proxy, "length", lenDescriptor);
    }

    // Register the lie instead of defining a property
    // We use the MAIN WORLD'S originalToString to generate the lie string
    // This assumes all realms return "function name() { [native code] }" which is standard.
    lies.set(proxy, safeCall(Native.Function_prototype_toString, original));
  }

  // --- Core Logic ---

  const handleToFlag = new Native.Map<string, string>();
  const pendingHandles = new Native.Set<string>();
  const discoveryQueue: string[] = [];
  let messagePort: MessagePort | null = null;

  interface XUser {
    screen_name?: string;
    name?: string;
  }

  // Recursive patcher using safe iteration
  function patchUserObjects(obj: unknown): boolean {
    if (!obj || typeof obj !== "object") return false;

    let modified = false;

    const user = obj as XUser;
    if (typeof user.screen_name === "string" && typeof user.name === "string") {
      const handle = user.screen_name.toLowerCase();
      const flag = handleToFlag.get(handle);

      if (flag) {
        if (!user.name.includes(flag)) {
          user.name = `${user.name} ${flag}`;
          modified = true;
          log(`Applied flag to ${handle}`);
        }
      } else if (!pendingHandles.has(handle)) {
        pendingHandles.add(handle);
        if (messagePort) {
          safeCall(Native.MessagePort_prototype_postMessage, messagePort, {
            type: GhostCmd.SYNC,
            handle,
          });
        } else {
          discoveryQueue.push(handle);
        }
      }
    }

    const record = obj as Record<string, unknown>;
    for (const key in record) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        const val = record[key];
        if (val && typeof val === "object") {
          if (
            Native.Array.isArray(val) ||
            key === "data" ||
            key === "user" ||
            key === "legacy" ||
            key === "user_results" ||
            key === "result" ||
            key === "core" ||
            key === "instructions" ||
            key === "entries" ||
            key === "content" ||
            key === "itemContent" ||
            key === "tweet_results"
          ) {
            if (patchUserObjects(val)) modified = true;
          }
        }
      }
    }

    return modified;
  }

  // --- Factories ---

  function createFetchProxy(originalFetch: typeof fetch): typeof fetch {
    const proxy = new Native.Proxy(originalFetch, {
      apply: async (
        target,
        thisArg,
        args: [RequestInfo | URL, RequestInit?],
      ) => {
        const input = args[0];
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;

        const isGraphQL = url && url.includes("/i/api/graphql/");

        // We use Native.Reflect to ensure we don't trip any user-land hooks
        if (!isGraphQL) {
          return Native.Reflect.apply(target, thisArg, args);
        }

        const response: Response = await Native.Reflect.apply(
          target,
          thisArg,
          args,
        );

        const createResponseProxy = (res: Response): Response => {
          return new Native.Proxy(res, {
            get(target, prop, receiver) {
              if (prop === "json") {
                const original = target.json;
                const hooked = async function () {
                  const json = await safeCall(original, target);
                  try {
                    if (patchUserObjects(json)) {
                      return json;
                    }
                  } catch (e) {
                    // Silent failure
                  }
                  return json;
                };
                harden(hooked, original);
                return hooked;
              }

              if (prop === "clone") {
                const original = target.clone;
                const hooked = function () {
                  return createResponseProxy(safeCall(original, target));
                };
                harden(hooked, original);
                return hooked;
              }

              const value = Native.Reflect.get(target, prop, receiver);
              if (typeof value === "function") {
                return safeCall(Native.Function_prototype_bind, value, target);
              }
              return value;
            },
          });
        };

        return createResponseProxy(response);
      },
    });
    harden(proxy, originalFetch);

    // Fix name (it becomes "bound fetch" because of the bind if it was bound)
    // We enforce "fetch"
    Native.Object_defineProperty(proxy, "name", {
      value: "fetch",
      writable: false,
      enumerable: false,
      configurable: true,
    });

    return proxy;
  }

  function createXHRProxy(
    originalXHR: typeof XMLHttpRequest,
  ): typeof XMLHttpRequest {
    const proxy = new Native.Proxy(originalXHR, {
      construct(target, args: any[]) {
        const xhr = new target(...args);
        const originalOpen = xhr.open;
        const originalSend = xhr.send;
        let isGraphQL = false;

        const openWrapper = function (method: string, url: string | URL) {
          const urlStr = typeof url === "string" ? url : url.toString();
          if (urlStr.includes("/i/api/graphql/")) {
            isGraphQL = true;
          }
          return safeApply(originalOpen, xhr, arguments as any);
        };
        harden(openWrapper, originalOpen);

        const sendWrapper = function () {
          if (isGraphQL) {
            const originalOnReadyStateChange = xhr.onreadystatechange;
            xhr.onreadystatechange = function () {
              if (xhr.readyState === 4 && xhr.status === 200) {
                try {
                  const json = safeJSONParse(xhr.responseText);
                  if (patchUserObjects(json)) {
                    Native.Object_defineProperty(xhr, "responseText", {
                      value: safeJSONStringify(json),
                      configurable: true,
                    });
                    Native.Object_defineProperty(xhr, "response", {
                      value: json,
                      configurable: true,
                    });
                  }
                } catch (e) {}
              }
              if (originalOnReadyStateChange) {
                return safeApply(
                  originalOnReadyStateChange,
                  this,
                  arguments as any,
                );
              }
            };
          }
          return safeApply(originalSend, xhr, arguments as any);
        };
        harden(sendWrapper, originalSend);

        // Return a Proxy to hide our overrides from hasOwnProperty checks AND CONSTRUCTOR CHECKS
        const instanceProxy = new Native.Proxy(xhr, {
          get(target, prop, receiver) {
            if (prop === "open") return openWrapper;
            if (prop === "send") return sendWrapper;

            // STEALTH FIX: Hide the fact that this is a Proxy wrapper
            // When user asks for .constructor, give them the wrapper class (XHRProxy),
            // not the underlying native XMLHttpRequest which would betray the deception.
            if (prop === "constructor") return proxy;

            return Native.Reflect.get(target, prop, receiver);
          },
        });

        return instanceProxy;
      },
    });
    harden(proxy, originalXHR);
    return proxy;
  }

  /**
   * Applies all stealth measures to a specific window/realm.
   * Can be called on the main window or any iframe contentWindow.
   */
  function applyStealth(win: any) {
    if (!win || proxiedWindows.has(win)) return;
    proxiedWindows.add(win);

    try {
      // 1. Ouroboros: Hook Function.prototype.toString
      // We must hook the SPECIFIC prototype of the realm
      const winFunctionProto = win.Function.prototype;
      const winOriginalToString = winFunctionProto.toString;

      const toStringProxy = new Native.Proxy(winOriginalToString, {
        apply: (target, thisArg, args) => {
          // 1. Check if the object has a registered lie
          try {
            if (thisArg && lies.has(thisArg)) {
              return lies.get(thisArg);
            }
          } catch (e) {
            // Fail-open
          }

          // 2. Fallback to native behavior
          return safeCall(target, thisArg, ...args);
        },
      });

      // Register the lie for the hook itself
      lies.set(
        toStringProxy,
        safeCall(winOriginalToString, winOriginalToString),
      );

      // Apply the hook
      winFunctionProto.toString = toStringProxy;

      // 2. Patch Fetch
      if (win.fetch) {
        win.fetch = createFetchProxy(win.fetch);
      }

      // 3. Patch XHR
      if (win.XMLHttpRequest) {
        win.XMLHttpRequest = createXHRProxy(win.XMLHttpRequest);
      }
    } catch (e) {
      // Ignore errors in restricted contexts (e.g. cross-origin iframes)
    }
  }

  // --- Iframe Immunization ---

  /**
   * NUCLEAR STEALTH PHASE 3: IFRAME IMMUNIZATION
   * Hook into the prototype of HTMLIFrameElement to capture contentWindow access.
   */
  const iframeProto = Native.window.HTMLIFrameElement.prototype;
  if (Native.HTMLIFrameElement_prototype_contentWindow_get) {
    const originalGetter = Native.HTMLIFrameElement_prototype_contentWindow_get;
    const getterProxy = function () {
      const win = safeCall(originalGetter, this);
      if (win) {
        applyStealth(win);
      }
      return win;
    };

    Native.Object_defineProperty(getterProxy, "name", {
      value: "get contentWindow",
      writable: false,
      enumerable: false,
      configurable: true,
    });

    lies.set(
      getterProxy,
      safeCall(Native.Function_prototype_toString, originalGetter),
    );

    Native.Object_defineProperty(iframeProto, "contentWindow", {
      get: getterProxy,
      enumerable: true,
      configurable: true,
    });
  }

  // --- Initialization ---

  // Apply stealth to the main window immediately
  applyStealth(Native.window);

  // --- Port Setup ---

  const setupPort = (port: MessagePort) => {
    messagePort = port;
    messagePort.onmessage = (event) => {
      const data = event.data as Record<string, unknown>;
      if (data.type === GhostCmd.UPDATE) {
        const update = data as { handle: string; flag: string };
        handleToFlag.set(update.handle.toLowerCase(), update.flag);
      } else if (data.type === GhostCmd.RETRY) {
        const { handle } = data as { handle: string };
        pendingHandles.delete(handle.toLowerCase());
      }
    };

    while (discoveryQueue.length > 0) {
      const handle = discoveryQueue.shift();
      if (handle) {
        safeCall(Native.MessagePort_prototype_postMessage, messagePort, {
          type: GhostCmd.SYNC,
          handle,
        });
      }
    }
  };

  /**
   * NUCLEAR STEALTH PHASE 2: EVENT-BASED HANDSHAKE
   */
  const HANDSHAKE_REQ = "ReactDevTools_connect_v4";

  const onHandshake = (event: Event) => {
    const e = event as MessageEvent;
    if (e.data && e.data.source === HANDSHAKE_REQ) {
      e.stopImmediatePropagation();
      e.preventDefault();
      const port = e.ports[0];
      if (port) {
        setupPort(port);
      }
    }
  };

  safeCall(
    Native.EventTarget_prototype_addEventListener,
    window,
    "message",
    onHandshake,
    true,
  );
})();
