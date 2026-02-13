(function () {
  const PLOX_MARKER = "plox-interceptor-loaded";
  if (Object.prototype.hasOwnProperty.call(window, PLOX_MARKER)) return;
  (window as unknown as Record<string, boolean>)[PLOX_MARKER] = true;

  const handleToFlag = new Map<string, string>();
  const pendingHandles = new Set<string>();
  const discoveryQueue: string[] = [];
  let messagePort: MessagePort | null = null;

  interface XUser {
    screen_name?: string;
    name?: string;
  }

  /**
   * Deep-patching function for user objects in GraphQL responses.
   * Modifies the object in-place for maximum performance.
   */
  function patchUserObjects(obj: unknown): boolean {
    if (!obj || typeof obj !== "object") return false;

    let modified = false;

    // Type guard for objects that might be X users
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

    // Recurse into arrays and objects, but stay targeted
    const record = obj as Record<string, unknown>;
    for (const key in record) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        const val = record[key];
        if (val && typeof val === "object") {
          // Optimization: Only recurse into keys likely to contain user data or structure
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

  // Stealth Proxy for fetch
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
        const start = performance.now();
        const modified = patchUserObjects(json);
        const end = performance.now();

        if (modified) {
          console.debug(
            `[Plox] Patched GraphQL response in ${(end - start).toFixed(2)}ms`,
          );
          
          const newHeaders = new Headers(response.headers);
          newHeaders.delete("content-encoding");
          newHeaders.delete("content-length");

          return new Response(JSON.stringify(json), {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        }
      } catch (e) {
        // Silently fail and return original response if JSON parsing or patching fails
      }

      return response;
    },
  });

  // Mask the proxy to look native
  Object.defineProperty(fetchProxy, "name", {
    value: "fetch",
    configurable: true,
  });
  Object.defineProperty(fetchProxy, "toString", {
    value: function () {
      return "function fetch() { [native code] }";
    },
    configurable: true,
  });

  window.fetch = fetchProxy;

  // Stealth Proxy for XMLHttpRequest
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

  // Mask XHR Proxy
  Object.defineProperty(XHRProxy, "name", {
    value: "XMLHttpRequest",
    configurable: true,
  });
  Object.defineProperty(XHRProxy, "toString", {
    value: function () {
      return "function XMLHttpRequest() { [native code] }";
    },
    configurable: true,
  });

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

    // Flush any discoveries made before the port was ready
    while (discoveryQueue.length > 0) {
      const handle = discoveryQueue.shift();
      if (handle) {
        messagePort.postMessage({ type: "__DATA_LAYER_SYNC__", handle });
      }
    }
  };

  // Listen for the initial handshake or legacy updates
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;

    const data = event.data as unknown;
    if (!data || typeof data !== "object") return;

    const msg = data as Record<string, unknown>;

    if (msg.type === "__INITIAL_STATE__" && event.ports && event.ports[0]) {
      setupPort(event.ports[0]);
    }
  });

  console.log("[Plox] Nuclear Stealth Interceptor active");
})();
