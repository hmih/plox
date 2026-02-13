(function () {
  const GHOST_SYMBOL = Symbol.for("__X_SYSTEM_COMPAT__");
  if ((window as any)[GHOST_SYMBOL]) return;
  (window as any)[GHOST_SYMBOL] = true;

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
      const clone = response.clone();

      try {
        const json = (await clone.json()) as unknown;
        const modified = patchUserObjects(json);

        if (modified) {
          const newHeaders = new Headers(response.headers);
          newHeaders.delete("content-encoding");
          newHeaders.delete("content-length");

          return new Response(JSON.stringify(json), {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        }
      } catch (e) {}

      return response;
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

  const handshakeId = Math.random().toString(36).slice(2);
  document.documentElement.setAttribute("data-x-compat-id", handshakeId);

  document.addEventListener(
    handshakeId,
    (e: any) => {
      if (e.detail instanceof MessagePort) {
        setupPort(e.detail);
        document.documentElement.removeAttribute("data-x-compat-id");
      }
    },
    { once: true },
  );
})();
