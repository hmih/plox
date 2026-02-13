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
    EventTarget_prototype_addEventListener: EventTarget.prototype.addEventListener,
    EventTarget_prototype_dispatchEvent: EventTarget.prototype.dispatchEvent,
    MessagePort_prototype_postMessage: MessagePort.prototype.postMessage,
    Document_prototype_createElement: Document.prototype.createElement,
    HTMLIFrameElement_prototype_contentWindow_get: Object.getOwnPropertyDescriptor(
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

  // Capture the original toString BEFORE we hook it
  const originalToString = Native.Function_prototype_toString;

  // The Ouroboros Hook: Patch Function.prototype.toString
  // This is the most critical stealth component. It must never fail.
  const toStringProxy = new Native.Proxy(originalToString, {
    apply: (target, thisArg, args) => {
      // 1. Check if the object has a registered lie
      try {
        if (thisArg && lies.has(thisArg)) {
            return lies.get(thisArg);
        }
      } catch (e) {
        // Fail-open: If WeakMap lookup fails (e.g. primitive), ignore.
      }
      
      // 2. Fallback to native behavior
      return safeCall(target, thisArg, ...args);
    }
  });

  // Self-masking: The hook itself must report as native code
  lies.set(toStringProxy, safeCall(originalToString, originalToString));
  
  // Apply the global hook
  Function.prototype.toString = toStringProxy;

  /**
   * Helper to copy descriptors and register a lie.
   */
  function harden(proxy: any, original: any) {
    const descriptors = Native.Object_getOwnPropertyDescriptor(original, "prototype");
    if (descriptors) {
        Native.Object_defineProperty(proxy, "prototype", descriptors);
    }
    
    const descriptor = Native.Object_getOwnPropertyDescriptor(
      original,
      "name",
    );
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
    lies.set(proxy, safeCall(originalToString, original));
  }

  // --- Core Logic ---

  const handleToFlag = new Native.Map<string, string>();
  const pendingHandles = new Native.Set<string>();
  const proxiedWindows = new Native.WeakSet<any>();
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

  // --- Network Proxies ---

  function createFetchProxy(originalFetch: typeof fetch): typeof fetch {
    const proxy = new Native.Proxy(originalFetch, {
      apply: async (target, thisArg, args: [RequestInfo | URL, RequestInit?]) => {
        const input = args[0];
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;
  
        const isGraphQL = url && url.includes("/i/api/graphql/");
  
        if (!isGraphQL) {
          return Native.Reflect.apply(target, Native.window, args);
        }
  
        const response: Response = await Native.Reflect.apply(target, Native.window, args);
  
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
    
    // Fix name (it becomes "bound fetch" because of the bind)
    Native.Object_defineProperty(proxy, "name", {
        value: "fetch",
        writable: false,
        enumerable: false,
        configurable: true
    });
    
    return proxy;
  }

  const fetchProxy = createFetchProxy(Native.fetch);
  window.fetch = fetchProxy;

  // --- XHR Proxy ---

  const XHRProxy = new Native.Proxy(Native.XMLHttpRequest, {
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
              return safeApply(originalOnReadyStateChange, this, arguments as any);
            }
          };
        }
        return safeApply(originalSend, xhr, arguments as any);
      };
      
      // Register lies
      lies.set(openWrapper, safeCall(originalToString, originalOpen));
      lies.set(sendWrapper, safeCall(originalToString, originalSend));

      // Return a Proxy to hide our overrides from hasOwnProperty checks
      return new Native.Proxy(xhr, {
          get(target, prop, receiver) {
              if (prop === "open") return openWrapper;
              if (prop === "send") return sendWrapper;
              return Native.Reflect.get(target, prop, receiver);
          }
      });
    },
  });
  harden(XHRProxy, Native.XMLHttpRequest);
  window.XMLHttpRequest = XHRProxy as any;

  /**
   * NUCLEAR STEALTH PHASE 3: IFRAME IMMUNIZATION
   * Hook into the prototype of HTMLIFrameElement to capture contentWindow access.
   * This avoids proxying the DOM element itself, which causes "Illegal invocation" errors.
   */
  const iframeProto = Native.window.HTMLIFrameElement.prototype;
  if (Native.HTMLIFrameElement_prototype_contentWindow_get) {
    const originalGetter = Native.HTMLIFrameElement_prototype_contentWindow_get;
    const getterProxy = function () {
        const win = safeCall(originalGetter, this);
        if (win && !proxiedWindows.has(win)) {
          proxiedWindows.add(win);
          try {
            win.fetch = createFetchProxy(win.fetch);
          } catch (e) {
            // Ignore errors in restricted contexts
          }
        }
        return win;
    };
    
    // Fix name to match native getter "get contentWindow"
    Native.Object_defineProperty(getterProxy, "name", {
        value: "get contentWindow",
        writable: false,
        enumerable: false,
        configurable: true
    });
    
    // Register the lie for our getter
    lies.set(getterProxy, safeCall(originalToString, originalGetter));

    Native.Object_defineProperty(iframeProto, "contentWindow", {
      get: getterProxy,
      enumerable: true,
      configurable: true,
    });
  }


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
   * Camouflaged as a generic React internal message to avoid flagging.
   */
  const HANDSHAKE_REQ = "ReactDevTools_connect_v4"; // Common enough to be ignored

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

  // Add the listener using the native, secured prototype
  safeCall(Native.EventTarget_prototype_addEventListener, window, "message", onHandshake, true);
})();
