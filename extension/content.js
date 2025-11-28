const OVERLAY_ID = "xcom-hello-world-overlay";

const ensureOverlay = () => {
  if (document.getElementById(OVERLAY_ID)) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "xcom-hello-overlay";
  overlay.innerHTML = `
    <div class="xcom-hello-card">
      <button type="button" class="xcom-hello-close" aria-label="close">x</button>
      <h2>Hello world</h2>
      <p>This message is injected by the development extension.</p>
    </div>
  `;

  overlay.querySelector(".xcom-hello-close").addEventListener("click", () => {
    overlay.remove();
  });

  document.body.appendChild(overlay);
};

const injectStyles = () => {
  if (document.getElementById("xcom-hello-style")) {
    return;
  }

  const style = document.createElement("link");
  style.id = "xcom-hello-style";
  style.rel = "stylesheet";
  style.type = "text/css";
  style.href = chrome.runtime.getURL("styles.css");
  document.head.appendChild(style);
};

const init = () => {
  injectStyles();
  ensureOverlay();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

