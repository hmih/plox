# X.com Hello World Extension

This repo contains a tiny Chrome-compatible extension that injects a friendly "Hello world" popup whenever you open `https://x.com/*`. The project is intentionally minimal so you can hotload it into Chromium-based browsers (Chrome, Edge, Brave, Arc, Vivaldi, etc.) and iterate without reinstalling.

## What you get
- Manifest V3 extension scoped strictly to `x.com` (no other sites are touched)
- Lightweight content script (`content.js`) that drops a dismissible popup into the page
- Standalone stylesheet so you can tweak the look & feel without touching JavaScript
- Instructions for loading the unpacked folder once and reloading it in-place for fast development cycles

## Project layout
```
extension/
  manifest.json     # Declarative config for the MV3 extension
  content.js        # Injects the Hello World overlay on x.com
  styles.css        # Visual styling for the overlay + close button
```

## Requirements
- Chrome 121+ (or any Chromium-based browser that supports Manifest V3)
- macOS, Linux, or Windows - instructions work everywhere

## One-time setup (load unpacked)
1. Clone or download this repo:
   ```sh
   git clone https://github.com/<you>/plox.git
   cd plox/extension
   ```
2. Open `chrome://extensions/` in your browser.
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** and select the `extension/` directory in this repo.
5. Visit `https://x.com` and you should see the "Hello world" popup in the top-right corner. Use the x button to dismiss it.

## Hotloading during development
Once the folder is loaded, you never need to remove/reinstall it:
- Edit `content.js` or `styles.css` directly in this repo.
- In `chrome://extensions/`, click the **Refresh** icon on the extension card (or press `Command/Ctrl + R` while the page is focused).
- Reload the `x.com` tab and the updated popup appears immediately.

Tips:
- Keep the Extensions page pinned next to your dev tab; Chrome remembers the unpacked path.
- If you change `manifest.json`, Chrome still updates in-place - just hit **Refresh** again.
- Use console logs inside `content.js` (`console.log("loaded");`) and read them from `View > Developer > JavaScript Console` on the x.com tab.

## Common tweaks
- **Popup styling**: edit `styles.css`. Because the stylesheet is referenced via `chrome.runtime.getURL`, you only need to refresh the extension once per change.
- **Different trigger site**: update the `matches` value inside `manifest.json` to the new domain(s).
- **Disable auto popup**: swap the DOM injection for a browser action if you prefer manual activation.

## Troubleshooting
- _Popup never appears_: ensure you're on `https://x.com` (Chrome won't run the script on `http://` or other domains). Check the DevTools console for errors.
- _Can't reload_: Make sure Developer mode stays enabled; otherwise Chrome hides the refresh arrow.
- _Permission warning_: The extension only requests access to `x.com` by design. If you add more hosts, Chrome will ask you to confirm.

You now have a hotloadable Hello World extension tailored to `x.com`. Iterate locally, refresh in place, and expand the content script as your feature list grows.