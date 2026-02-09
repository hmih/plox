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
