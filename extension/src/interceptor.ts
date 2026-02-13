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
    Object_keys: Object.keys,
    Function_prototype_call: Function.prototype.call,
    Function_prototype_apply: Function.prototype.apply,
    Function_prototype_bind: Function.prototype.bind,
    EventTarget_prototype_addEventListener: EventTarget.prototype.addEventListener,
    EventTarget_prototype_dispatchEvent: EventTarget.prototype.dispatchEvent,
    MessagePort_prototype_postMessage: MessagePort.prototype.postMessage,
    Document_prototype_createElement: Document.prototype.createElement,
  };

  // Safe execution helpers using captured natives
  const safeCall = (fn: Function, thisArg: any, ...args: any[]) =>
    Native.Function_prototype_call.apply(fn, [thisArg, ...args]);
  const safeApply = (fn: Function, thisArg: any, args: any[]) =>
    Native.Function_prototype_apply.apply(fn, [thisArg, args]);
  const safeJSONParse = (text: string) => Native.JSON.parse(text);
  const safeJSONStringify = (value: any) => Native.JSON.stringify(value);

  /**
   * NUCLEAR STEALTH PHASE 4: DESCRIPTOR PERFECTION
   * Copies the exact descriptor from the original to the proxy.
   */
  function harden(proxy: any, original: any) {
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

    Native.Object_defineProperty(proxy, "toString", {
      value: function toString() {
        if (this === proxy) return original.toString();
        return safeCall(original.toString, this);
      },
      configurable: true,
      enumerable: false,
      writable: true,
    });
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

  const Cmd = {
    SYNC: 0,
    UPDATE: 1,
    RETRY: 2
  } as const;

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
        }
      } else if (!pendingHandles.has(handle)) {
        pendingHandles.add(handle);
        if (messagePort) {
          safeCall(Native.MessagePort_prototype_postMessage, messagePort, {
            type: Cmd.SYNC,
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
    return proxy;
  }

  const fetchProxy = createFetchProxy(Native.fetch);
  window.fetch = fetchProxy;

  // --- XHR Proxy ---

  const XHRProxy = new Native.Proxy(Native.XMLHttpRequest, {
    construct(target, args: any[]) {
      const xhr = new target(...args);
      const open = xhr.open;
      let isGraphQL = false;

      xhr.open = function (method: string, url: string | URL) {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/i/api/graphql/")) {
          isGraphQL = true;
        }
        return safeApply(open, this, arguments as any);
      };

      const send = xhr.send;
      xhr.send = function () {
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
        return safeApply(send, this, arguments as any);
      };

      return xhr;
    },
  });
  harden(XHRProxy, Native.XMLHttpRequest);
  window.XMLHttpRequest = XHRProxy as any;

  /**
   * NUCLEAR STEALTH PHASE 3: IFRAME IMMUNIZATION
   * Patch document.createElement to ensure any new iframes get the proxies too.
   * This defeats "Cross-Realm Comparison" checks.
   */
  const createElementProxy = new Native.Proxy(Native.Document_prototype_createElement, {
    apply: (target, thisArg, args) => {
        const element = Native.Reflect.apply(target, thisArg, args);
        if (element && element.tagName === "IFRAME") {
            // We can't access contentWindow immediately, but we can hook the getter
            // or simply wait a microtask? Hooking the getter is safer.
            const contentWindowGetter = Native.Object_getOwnPropertyDescriptor(
                Native.window.HTMLIFrameElement.prototype, 
                "contentWindow"
            )?.get;

            if (contentWindowGetter) {
                 // Advanced: If we really want to be robust, we'd need to shadow the iframe's
                 // creation. For now, a simple property definition on the instance works 
                 // for 99% of cases where X accesses it shortly after creation.
                 try {
                     // Wait for the iframe to be attached
                     const observer = new MutationObserver(() => {
                         if (element.contentWindow) {
                             element.contentWindow.fetch = createFetchProxy(element.contentWindow.fetch);
                             // We could also proxy XHR here
                             observer.disconnect();
                         }
                     });
                     observer.observe(document.documentElement, { childList: true, subtree: true });
                 } catch(e) {}
            }
        }
        return element;
    }
  });
  harden(createElementProxy, Native.Document_prototype_createElement);
  document.createElement = createElementProxy;


  // --- Port Setup ---

  const setupPort = (port: MessagePort) => {
    messagePort = port;
    messagePort.onmessage = (event) => {
      const data = event.data as Record<string, unknown>;
      if (data.type === Cmd.UPDATE) {
        const update = data as { handle: string; flag: string };
        handleToFlag.set(update.handle.toLowerCase(), update.flag);
      } else if (data.type === Cmd.RETRY) {
        const { handle } = data as { handle: string };
        pendingHandles.delete(handle.toLowerCase());
      }
    };

    while (discoveryQueue.length > 0) {
      const handle = discoveryQueue.shift();
      if (handle) {
        safeCall(Native.MessagePort_prototype_postMessage, messagePort, {
          type: Cmd.SYNC,
          handle,
        });
      }
    }
  };

  /**
   * NUCLEAR STEALTH PHASE 2: SILENT GETTER HANDSHAKE
   * No Events. No Listeners. Just a silent touch.
   */
  const HANDSHAKE_SYMBOL = Native.Symbol("x-compat-handshake");
  
  // Define the symbol on document with a 'get' trap
  Native.Object_defineProperty(document, HANDSHAKE_SYMBOL, {
    get: () => {
      // This function executes when content.ts reads document[Symbol]
      return {
        connect: (port: MessagePort) => {
          setupPort(port);
          // Self-destruct the symbol immediately
          // Using native delete to avoid any trapped deleteProperty
          delete (document as any)[HANDSHAKE_SYMBOL];
        }
      };
    },
    configurable: true,
    enumerable: false, // Invisible to iterators
  });
})();
