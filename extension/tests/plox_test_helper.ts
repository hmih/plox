import { Page } from "@playwright/test";

export const decodeQuotedPrintable = (text: string): string => {
  return text
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
};

export const extractHtmlFromMhtml = (mhtmlContent: string): string | null => {
  const parts = mhtmlContent.split("--MultipartBoundary");
  const htmlPart = parts.find((p) => p.includes("Content-Type: text/html"));
  if (!htmlPart) return null;

  const bodyEncoded =
    htmlPart.split("\r\n\r\n")[1] || htmlPart.split("\n\n")[1];
  if (!bodyEncoded) return null;
  return decodeQuotedPrintable(bodyEncoded);
};

export const setupChromeMock = async (page: Page, BusCmd: any) => {
  await page.evaluate((BusCmd) => {
    const listeners: any[] = [];
    const storage: Record<string, any> = {};

    try {
      // @ts-ignore
      delete window.chrome;
    } catch (e) {}

    const mockChrome = {
      runtime: {
        onMessage: {
          addListener: (fn: any) => listeners.push(fn),
        },
        sendMessage: async (msg: any) => {
          if (msg.action === BusCmd.PROCESS) {
            const resp = await fetch(
              `https://plox.krepost.xy/met?username=${msg.handle}`,
            );
            const data = await resp.json();
            if (data.processed) {
              const flag = "🇩🇪";
              storage[`cache:${msg.handle}`] = {
                location: data.location,
                flag,
              };
              listeners.forEach((fn) =>
                fn({
                  action: BusCmd.UPDATE,
                  handle: msg.handle,
                  flag: flag,
                }),
              );
            }
          }
        },
      },
      storage: {
        local: {
          get: (keys: string[], cb: any) => {
            const res: any = {};
            keys.forEach((k) => {
              if (storage[k]) res[k] = storage[k];
            });
            setTimeout(() => cb(res), 0);
          },
          set: (items: any) => {
            Object.assign(storage, items);
          },
        },
      },
    };

    Object.defineProperty(window, "chrome", {
      value: mockChrome,
      writable: true,
      configurable: true,
    });
  }, BusCmd);
};
