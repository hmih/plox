import {
  GhostCmd,
  log,
  normalizeHandle,
  GRAPHQL_TARGET_KEYS,
  MAX_RECURSION_DEPTH,
  GhostMessage,
} from "./core";

(function () {
  /**
   * NUCLEAR STEALTH PHASE 1: NATIVE SAFEGUARDING
   * Capture only the essential native APIs.
   */
  const Native = {
    Object: Object,
    Function: Function,
    Array: Array,
    JSON: JSON,
    Symbol: Symbol,
    Map: Map,
    Set: Set,
    WeakMap: WeakMap,
    WeakSet: WeakSet,
    Proxy: Proxy,
    Reflect: Reflect,
    fetch: window.fetch.bind(window),
    XMLHttpRequest: window.XMLHttpRequest,
    window: window,
    console: console,
    // Prototypes
    Object_defineProperty: Object.defineProperty,
    Object_getOwnPropertyDescriptor: Object.getOwnPropertyDescriptor,
    Function_prototype_call: Function.prototype.call,
    Function_prototype_apply: Function.prototype.apply,
    Function_prototype_bind: Function.prototype.bind,
    Function_prototype_toString: Function.prototype.toString,
    EventTarget_prototype_addEventListener:
      EventTarget.prototype.addEventListener,
    MessagePort_prototype_postMessage: MessagePort.prototype.postMessage,
    HTMLIFrameElement_prototype_contentWindow_get:
      Object.getOwnPropertyDescriptor(
        window.HTMLIFrameElement.prototype,
        "contentWindow",
      )?.get,
  };

  const safeCall = (fn: Function, thisArg: any, ...args: any[]) =>
    Native.Function_prototype_call.apply(fn, [thisArg, ...args]);
  const safeApply = (fn: Function, thisArg: any, args: any[]) =>
    Native.Function_prototype_apply.apply(fn, [thisArg, args]);

  const lies = new Native.WeakMap<any, string>();
  const proxiedWindows = new Native.WeakSet<any>();

  /**
   * NUCLEAR STEALTH: Atomic Harden
   * Mirrors all essential descriptors and registers the lie.
   */
  function harden(proxy: any, original: any, tag?: string) {
    const props = ["prototype", "name", "length"];
    for (const prop of props) {
      const desc = Native.Object_getOwnPropertyDescriptor(original, prop);
      if (desc) Native.Object_defineProperty(proxy, prop, desc);
    }

    if (tag) {
      Native.Object_defineProperty(proxy, Native.Symbol.toStringTag, {
        value: tag,
        configurable: true,
      });
    }

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

  function patchUserObjects(obj: unknown, depth = 0): boolean {
    if (!obj || typeof obj !== "object" || depth > MAX_RECURSION_DEPTH)
      return false;

    let modified = false;
    const user = obj as XUser;

    if (typeof user.screen_name === "string" && typeof user.name === "string") {
      const handle = normalizeHandle(user.screen_name);
      const flag = handleToFlag.get(handle);

      if (flag) {
        if (!user.name.includes(flag)) {
          user.name = `${user.name} ${flag}`;
          modified = true;
          log(`Applied flag to ${handle}`, Native.console);
        }
      } else if (!pendingHandles.has(handle)) {
        pendingHandles.add(handle);
        const msg: GhostMessage = { type: GhostCmd.SYNC, handle };
        if (messagePort) {
          safeCall(Native.MessagePort_prototype_postMessage, messagePort, msg);
        } else {
          discoveryQueue.push(handle);
        }
      }
    }

    const record = obj as Record<string, unknown>;
    for (const key in record) {
      if (Native.Object.prototype.hasOwnProperty.call(record, key)) {
        const val = record[key];
        if (val && typeof val === "object") {
          if (Native.Array.isArray(val) || GRAPHQL_TARGET_KEYS.includes(key)) {
            if (patchUserObjects(val, depth + 1)) modified = true;
          }
        }
      }
    }

    return modified;
  }

  // --- Factories ---

  function createFetchProxy(originalFetch: typeof fetch): typeof fetch {
    const proxy = new Native.Proxy(originalFetch, {
      get(target, prop, receiver) {
        if (prop === Native.Symbol.toStringTag) return "Function";
        return Native.Reflect.get(target, prop, receiver);
      },
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

        if (!url?.includes("/i/api/graphql/")) {
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
              if (prop === Native.Symbol.toStringTag) return "Response";
              if (prop === "json") {
                const original = target.json;
                const hooked = async function () {
                  const json = await safeCall(original, target);
                  try {
                    patchUserObjects(json);
                  } catch (e) {}
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
              return typeof value === "function"
                ? safeCall(Native.Function_prototype_bind, value, target)
                : value;
            },
          });
        };

        return createResponseProxy(response);
      },
    });
    harden(proxy, originalFetch);
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
          if (url.toString().includes("/i/api/graphql/")) isGraphQL = true;
          return safeApply(originalOpen, xhr, arguments as any);
        };
        harden(openWrapper, originalOpen);

        const sendWrapper = function () {
          if (isGraphQL) {
            const originalOnReadyStateChange = xhr.onreadystatechange;
            xhr.onreadystatechange = function () {
              if (xhr.readyState === 4 && xhr.status === 200) {
                try {
                  const json = Native.JSON.parse(xhr.responseText);
                  if (patchUserObjects(json)) {
                    Native.Object_defineProperty(xhr, "responseText", {
                      value: Native.JSON.stringify(json),
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

        return new Native.Proxy(xhr, {
          get(target, prop, receiver) {
            if (prop === "open") return openWrapper;
            if (prop === "send") return sendWrapper;
            if (prop === Native.Symbol.toStringTag) return "XMLHttpRequest";
            if (prop === "constructor") return proxy;
            return Native.Reflect.get(target, prop, receiver);
          },
        });
      },
    });
    harden(proxy, originalXHR);
    return proxy;
  }

  function applyStealth(win: any) {
    if (!win || proxiedWindows.has(win)) return;
    proxiedWindows.add(win);

    try {
      const winFunctionProto = win.Function.prototype;
      const winOriginalToString = winFunctionProto.toString;

      const toStringProxy = new Native.Proxy(winOriginalToString, {
        apply: (target, thisArg, args) => {
          try {
            if (thisArg && lies.has(thisArg)) return lies.get(thisArg);
          } catch (e) {}
          return safeCall(target, thisArg, ...args);
        },
      });

      harden(toStringProxy, winOriginalToString);
      winFunctionProto.toString = toStringProxy;

      const patches = [
        { key: "fetch", factory: createFetchProxy },
        { key: "XMLHttpRequest", factory: createXHRProxy },
      ];

      for (const patch of patches) {
        if (win[patch.key]) {
          const original = win[patch.key];
          const proxy = patch.factory(original);
          const desc = Native.Object_getOwnPropertyDescriptor(win, patch.key);
          if (desc) {
            Native.Object_defineProperty(win, patch.key, {
              ...desc,
              value: proxy,
            });
          } else {
            win[patch.key] = proxy;
          }
        }
      }
    } catch (e) {}
  }

  const iframeProto = Native.window.HTMLIFrameElement.prototype;
  if (Native.HTMLIFrameElement_prototype_contentWindow_get) {
    const originalGetter = Native.HTMLIFrameElement_prototype_contentWindow_get;
    const getterProxy = function () {
      const win = safeCall(originalGetter, this);
      if (win) applyStealth(win);
      return win;
    };
    harden(getterProxy, originalGetter);
    Native.Object_defineProperty(iframeProto, "contentWindow", {
      get: getterProxy,
      enumerable: true,
      configurable: true,
    });
  }

  applyStealth(Native.window);

  const setupPort = (port: MessagePort) => {
    messagePort = port;
    messagePort.onmessage = (event) => {
      const data = event.data as GhostMessage;
      if (data.type === GhostCmd.UPDATE && data.flag) {
        handleToFlag.set(normalizeHandle(data.handle), data.flag);
      } else if (data.type === GhostCmd.RETRY) {
        pendingHandles.delete(normalizeHandle(data.handle));
      }
    };

    while (discoveryQueue.length > 0) {
      const handle = discoveryQueue.shift();
      if (handle) {
        const msg: GhostMessage = { type: GhostCmd.SYNC, handle };
        safeCall(Native.MessagePort_prototype_postMessage, messagePort, msg);
      }
    }
  };

  const onHandshake = (event: Event) => {
    const e = event as MessageEvent;
    if (e.data && e.data.source === "ReactDevTools_connect_v4") {
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.ports[0]) setupPort(e.ports[0]);
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
