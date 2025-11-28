# X.com Account Flags

This repo contains a Chrome-compatible content script that scans every `https://x.com/*` page for usernames rendered in the timeline (e.g., `@username`). For each username it discovers, the script silently loads `https://x.com/<username>/about`, scrapes the "Account based in" field, converts it to a country/region flag, and injects that emoji immediately to the left of the handle. The goal is to provide quick geographic context for every post without leaving the timeline.

## What you get
- Manifest V3 extension scoped strictly to `x.com`
- Content script that observes the live DOM, finds spans containing valid `@username` handles, and injects flag emojis as data arrives
- Background fetch of `x.com/<username>/about` (same-origin) to read the “Account based in” value
- Basic country/region-to-flag mapping with caching per username
- Hotload instructions so you can iterate without reinstalling

## How it works
1. **Scan**: when the page loads (and whenever the DOM mutates), the script looks for `span` elements containing the valid `@username` pattern that X renders for tweets.
2. **Fetch**: for each new username it finds, it issues a same-origin request to `https://x.com/<username>/about`. Requests reuse the user's session cookies so only profiles you can already view are fetched.
3. **Parse**: it searches that HTML for the "Account based in" label, extracts the text that follows, and normalizes/caches the location string.
4. **Annotate**: the location is translated to a best-effort flag emoji (country or region). The emoji is inserted as a small badge directly before the `@username`, and reused for every subsequent appearance of that handle.

## Project layout
```
extension/
  manifest.json     # Declarative config for the MV3 extension
  content.js        # Watches usernames, fetches /about pages, injects flags
  styles.css        # Minimal styling for the injected emoji badge
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
5. Visit `https://x.com` and scroll a timeline. Usernames that match the `@username` pattern will gain a small flag emoji just to the left of the handle. Flags appear after the extension finishes fetching each profile’s `/about` page, so the first load per user may take a second.

## Hotloading during development
Once the folder is loaded, you never need to remove/reinstall it:
- Edit `content.js` or `styles.css` directly in this repo.
- In `chrome://extensions/`, click the **Refresh** icon on the extension card (or press `Command/Ctrl + R` while the page is focused).
- Reload the `x.com` tab and the new logic runs immediately.

Tips:
- Keep the Extensions page pinned next to your dev tab; Chrome remembers the unpacked path.
- If you change `manifest.json`, Chrome still updates in-place - just hit **Refresh** again.
- Use console logs inside `content.js` (`console.log("username", username);`) and read them from `View > Developer > JavaScript Console` on the x.com tab.

## Common tweaks
- **Emoji styling**: edit `styles.css` to adjust spacing, sizing, or animations.
- **Additional regions/countries**: extend the `COUNTRY_CODE_BY_NAME` or `REGION_FLAGS` objects in `content.js`.
- **Different trigger site**: update the `matches` value inside `manifest.json`.

## Troubleshooting
- _No flags appear_: ensure you're on `https://x.com` and that handles include the `@username` portion. Open DevTools > Console to watch for network or parsing errors.
- _Flags missing for some users_: the `/about` page must have an “Account based in” value. The script falls back to `🌐` when parsing fails.
- _Can't reload_: make sure Developer mode stays enabled; otherwise Chrome hides the refresh arrow.
- _Permission warning_: the extension only requests access to `x.com`. Adding more hosts in `manifest.json` will prompt Chrome for approval.

You now have a hotloadable flag-injection helper tailored to `x.com`. Iterate locally, refresh in place, and expand the content script as your feature list grows.