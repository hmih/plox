"use strict";
(() => {
  // src/core.ts
  var GhostCmd = {
    SYNC: 0,
    UPDATE: 1,
    RETRY: 2
  };
  var log = (msg, ...args) => {
    if (true) {
      console.log(`[PLOX] ${msg}`, ...args);
    }
  };

  // src/interceptor.ts
  (function() {
    const Native = {
      Object,
      Function,
      Array,
      JSON,
      Promise,
      Symbol,
      Map,
      Set,
      Proxy,
      Reflect,
      fetch: window.fetch.bind(window),
      XMLHttpRequest: window.XMLHttpRequest,
      // Constructor, so we don't bind
      document,
      window,
      console,
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
      Document_prototype_createElement: Document.prototype.createElement
    };
    const safeCall = (fn, thisArg, ...args) => Native.Function_prototype_call.apply(fn, [thisArg, ...args]);
    const safeApply = (fn, thisArg, args) => Native.Function_prototype_apply.apply(fn, [thisArg, args]);
    const safeJSONParse = (text) => Native.JSON.parse(text);
    const safeJSONStringify = (value) => Native.JSON.stringify(value);
    function harden(proxy, original) {
      const descriptor = Native.Object_getOwnPropertyDescriptor(
        original,
        "name"
      );
      if (descriptor) {
        Native.Object_defineProperty(proxy, "name", descriptor);
      }
      const lenDescriptor = Native.Object_getOwnPropertyDescriptor(
        original,
        "length"
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
        writable: true
      });
    }
    const handleToFlag = new Native.Map();
    const pendingHandles = new Native.Set();
    const discoveryQueue = [];
    let messagePort = null;
    function patchUserObjects(obj) {
      if (!obj || typeof obj !== "object") return false;
      let modified = false;
      const user = obj;
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
              handle
            });
          } else {
            discoveryQueue.push(handle);
          }
        }
      }
      const record = obj;
      for (const key in record) {
        if (Object.prototype.hasOwnProperty.call(record, key)) {
          const val = record[key];
          if (val && typeof val === "object") {
            if (Native.Array.isArray(val) || key === "data" || key === "user" || key === "legacy" || key === "user_results" || key === "result" || key === "core" || key === "instructions" || key === "entries" || key === "content" || key === "itemContent" || key === "tweet_results") {
              if (patchUserObjects(val)) modified = true;
            }
          }
        }
      }
      return modified;
    }
    function createFetchProxy(originalFetch) {
      const proxy = new Native.Proxy(originalFetch, {
        apply: async (target, thisArg, args) => {
          const input = args[0];
          const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          const isGraphQL = url && url.includes("/i/api/graphql/");
          if (!isGraphQL) {
            return Native.Reflect.apply(target, Native.window, args);
          }
          const response = await Native.Reflect.apply(target, Native.window, args);
          const createResponseProxy = (res) => {
            return new Native.Proxy(res, {
              get(target2, prop, receiver) {
                if (prop === "json") {
                  const original = target2.json;
                  const hooked = async function() {
                    const json = await safeCall(original, target2);
                    try {
                      if (patchUserObjects(json)) {
                        return json;
                      }
                    } catch (e) {
                    }
                    return json;
                  };
                  harden(hooked, original);
                  return hooked;
                }
                if (prop === "clone") {
                  const original = target2.clone;
                  const hooked = function() {
                    return createResponseProxy(safeCall(original, target2));
                  };
                  harden(hooked, original);
                  return hooked;
                }
                const value = Native.Reflect.get(target2, prop, receiver);
                if (typeof value === "function") {
                  return safeCall(Native.Function_prototype_bind, value, target2);
                }
                return value;
              }
            });
          };
          return createResponseProxy(response);
        }
      });
      harden(proxy, originalFetch);
      return proxy;
    }
    const fetchProxy = createFetchProxy(Native.fetch);
    window.fetch = fetchProxy;
    const XHRProxy = new Native.Proxy(Native.XMLHttpRequest, {
      construct(target, args) {
        const xhr = new target(...args);
        const open = xhr.open;
        let isGraphQL = false;
        xhr.open = function(method, url) {
          const urlStr = typeof url === "string" ? url : url.toString();
          if (urlStr.includes("/i/api/graphql/")) {
            isGraphQL = true;
          }
          return safeApply(open, this, arguments);
        };
        const send = xhr.send;
        xhr.send = function() {
          if (isGraphQL) {
            const originalOnReadyStateChange = xhr.onreadystatechange;
            xhr.onreadystatechange = function() {
              if (xhr.readyState === 4 && xhr.status === 200) {
                try {
                  const json = safeJSONParse(xhr.responseText);
                  if (patchUserObjects(json)) {
                    Native.Object_defineProperty(xhr, "responseText", {
                      value: safeJSONStringify(json),
                      configurable: true
                    });
                    Native.Object_defineProperty(xhr, "response", {
                      value: json,
                      configurable: true
                    });
                  }
                } catch (e) {
                }
              }
              if (originalOnReadyStateChange) {
                return safeApply(originalOnReadyStateChange, this, arguments);
              }
            };
          }
          return safeApply(send, this, arguments);
        };
        return xhr;
      }
    });
    harden(XHRProxy, Native.XMLHttpRequest);
    window.XMLHttpRequest = XHRProxy;
    const createElementProxy = new Native.Proxy(Native.Document_prototype_createElement, {
      apply: (target, thisArg, args) => {
        const element = Native.Reflect.apply(target, thisArg, args);
        if (element && element.tagName === "IFRAME") {
          const contentWindowGetter = Native.Object_getOwnPropertyDescriptor(
            Native.window.HTMLIFrameElement.prototype,
            "contentWindow"
          )?.get;
          if (contentWindowGetter) {
            try {
              const observer = new MutationObserver(() => {
                if (element.contentWindow) {
                  element.contentWindow.fetch = createFetchProxy(element.contentWindow.fetch);
                  observer.disconnect();
                }
              });
              observer.observe(document.documentElement, { childList: true, subtree: true });
            } catch (e) {
            }
          }
        }
        return element;
      }
    });
    harden(createElementProxy, Native.Document_prototype_createElement);
    document.createElement = createElementProxy;
    const setupPort = (port) => {
      messagePort = port;
      messagePort.onmessage = (event) => {
        const data = event.data;
        if (data.type === GhostCmd.UPDATE) {
          const update = data;
          handleToFlag.set(update.handle.toLowerCase(), update.flag);
        } else if (data.type === GhostCmd.RETRY) {
          const { handle } = data;
          pendingHandles.delete(handle.toLowerCase());
        }
      };
      while (discoveryQueue.length > 0) {
        const handle = discoveryQueue.shift();
        if (handle) {
          safeCall(Native.MessagePort_prototype_postMessage, messagePort, {
            type: GhostCmd.SYNC,
            handle
          });
        }
      }
    };
    const HANDSHAKE_SYMBOL = Native.Symbol("x-compat-handshake");
    Native.Object_defineProperty(document, HANDSHAKE_SYMBOL, {
      get: () => {
        return {
          connect: (port) => {
            setupPort(port);
            delete document[HANDSHAKE_SYMBOL];
          }
        };
      },
      configurable: true,
      enumerable: false
      // Invisible to iterators
    });
  })();
})();
