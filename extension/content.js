(() => {
  let observer = null;
  let isScanning = false;

  // 1. The Snapshot Function
  // Runs only when the browser is idle to stay invisible.
  const snapshotAndSend = (deadline) => {
    isScanning = false;

    // If the browser is suddenly busy, bail out to avoid lag.
    if (deadline.timeRemaining() < 1) return;

    // We send innerText. It captures the visual flow (@handle · Time)
    // without the overhead of serializing the full HTML DOM.
    const pageText = document.body.innerText;

    if (pageText.length < 500) return; // Wait for page load

    try {
      chrome.runtime.sendMessage(
        { action: "analyzePageText", textContent: pageText },
        (response) => {
          // The background decides when to stop.
          if (response && response.stopLooking) {
            if (observer) {
              observer.disconnect();
              observer = null;
            }
          }
        },
      );
    } catch (e) {
      // Disconnect if the extension was updated/reloaded
      if (observer) observer.disconnect();
    }
  };

  // 2. Scheduler
  const scheduleScan = () => {
    if (isScanning) return;
    isScanning = true;

    if ("requestIdleCallback" in window) {
      // "Run this when the CPU is completely free"
      window.requestIdleCallback(snapshotAndSend, { timeout: 2000 });
    } else {
      // Fallback for older browsers (unlikely needed for Brave/Chrome)
      setTimeout(() => snapshotAndSend({ timeRemaining: () => 10 }), 1000);
    }
  };

  // 3. Observer
  // Watch for dynamic content loading, but trigger lazily
  observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, { childList: true, subtree: true });
})();
