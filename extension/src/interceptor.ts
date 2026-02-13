(function () {
  const PLOX_MARKER = "plox-interceptor-loaded";
  if (Object.prototype.hasOwnProperty.call(window, PLOX_MARKER)) return;
  (window as unknown as Record<string, boolean>)[PLOX_MARKER] = true;

  const handleToFlag = new Map<string, string>();
  const pendingHandles = new Set<string>();

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
        window.postMessage({ type: "PLOX_DISCOVERED", handle }, "*");
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
          return new Response(JSON.stringify(json), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
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

  // Listen for flag updates from the Isolated World
  window.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as unknown;
    if (
      data &&
      typeof data === "object" &&
      (data as Record<string, unknown>).type === "PLOX_FLAG_UPDATE"
    ) {
      const update = data as { handle: string; flag: string };
      handleToFlag.set(update.handle.toLowerCase(), update.flag);
    }
  });

  console.log("[Plox] Nuclear Stealth Interceptor active");
})();
