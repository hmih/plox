(function () {
  // Remove global symbol pollution (Tripwire #2)
  // Instead of a global guard, we rely on the hardened proxy check itself if needed,
  // or just trust the run_at logic. Since this is an extension content script,
  // it runs once per frame context.
  
  // Helper to harden proxies against detection
  function harden(proxy: any, original: any) {
    Object.defineProperties(proxy, {
      name: { value: original.name, configurable: true },
      length: { value: original.length, configurable: true },
      toString: {
        value: function toString() {
          if (this === proxy || this === original) return original.toString();
          return original.toString.call(this);
        },
        configurable: true,
        enumerable: false,
      },
    });
  }

  const handleToFlag = new Map<string, string>();
  const pendingHandles = new Set<string>();
  const discoveryQueue: string[] = [];
  let messagePort: MessagePort | null = null;

  interface XUser {
    screen_name?: string;
    name?: string;
  }

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
          messagePort.postMessage({ type: "__DATA_LAYER_SYNC__", handle });
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
            Array.isArray(val) ||
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

  const nativeFetch = window.fetch;
  const fetchProxy = new Proxy(nativeFetch, {
    apply: async (target, thisArg, args: [RequestInfo | URL, RequestInit?]) => {
      const input = args[0];
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      const isGraphQL = url && url.includes("/i/api/graphql/");

      if (!isGraphQL) {
        return Reflect.apply(target, thisArg, args);
      }

      const response: Response = await Reflect.apply(target, thisArg, args);

      const createResponseProxy = (res: Response): Response => {
        return new Proxy(res, {
          get(target, prop, receiver) {
            // Trap .json() to inject our patch
            if (prop === "json") {
              const original = target.json;
              const hooked = async function () {
                const json = await original.call(target);
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

            // Trap .clone() to ensure the clone is also proxied
            if (prop === "clone") {
              const original = target.clone;
              const hooked = function () {
                return createResponseProxy(original.call(target));
              };
              harden(hooked, original);
              return hooked;
            }

            const value = Reflect.get(target, prop, receiver);
            if (typeof value === "function") {
              // Ensure native methods run against the real target
              return value.bind(target);
            }
            return value;
          },
        });
      };

      return createResponseProxy(response);
    },
  });
  harden(fetchProxy, nativeFetch);
  window.fetch = fetchProxy;

  const nativeXHR = window.XMLHttpRequest;
  const XHRProxy = new Proxy(nativeXHR, {
    construct(target, args: any[]) {
      const xhr = new target(...args);
      const open = xhr.open;
      let isGraphQL = false;

      xhr.open = function (method: string, url: string | URL) {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/i/api/graphql/")) {
          isGraphQL = true;
        }
        return open.apply(this, arguments as any);
      };

      const send = xhr.send;
      xhr.send = function () {
        if (isGraphQL) {
          const originalOnReadyStateChange = xhr.onreadystatechange;
          xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
              try {
                const json = JSON.parse(xhr.responseText);
                if (patchUserObjects(json)) {
                  Object.defineProperty(xhr, "responseText", {
                    value: JSON.stringify(json),
                    configurable: true,
                  });
                  Object.defineProperty(xhr, "response", {
                    value: json,
                    configurable: true,
                  });
                }
              } catch (e) {}
            }
            if (originalOnReadyStateChange) {
              return originalOnReadyStateChange.apply(this, arguments as any);
            }
          };
        }
        return send.apply(this, arguments as any);
      };

      return xhr;
    },
  });
  harden(XHRProxy, nativeXHR);
  window.XMLHttpRequest = XHRProxy as any;

  const setupPort = (port: MessagePort) => {
    messagePort = port;
    messagePort.onmessage = (event) => {
      const data = event.data as Record<string, unknown>;
      if (data.type === "__DATA_LAYER_UPDATE__") {
        const update = data as { handle: string; flag: string };
        handleToFlag.set(update.handle.toLowerCase(), update.flag);
      } else if (data.type === "__DATA_LAYER_RETRY__") {
        const { handle } = data as { handle: string };
        pendingHandles.delete(handle.toLowerCase());
      }
    };

    while (discoveryQueue.length > 0) {
      const handle = discoveryQueue.shift();
      if (handle) {
        messagePort.postMessage({ type: "__DATA_LAYER_SYNC__", handle });
      }
    }
  };

  // Hardened Handshake: Use a transient Symbol instead of DOM attributes
  const HANDSHAKE_SYMBOL = Symbol("x-compat-handshake");
  const handshakeId = Math.random().toString(36).slice(2);
  
  // Stash the ID in a non-enumerable property on document
  Object.defineProperty(document, HANDSHAKE_SYMBOL, {
    value: handshakeId,
    configurable: true,
    enumerable: false,
    writable: false
  });

  document.addEventListener(
    handshakeId,
    (e: any) => {
      if (e.detail instanceof MessagePort) {
        setupPort(e.detail);
        // Nuclear cleanup: remove the symbol and the listener
        // @ts-ignore
        delete document[HANDSHAKE_SYMBOL];
      }
    },
    { once: true },
  );
})();
