# MeteorEdit Cookie Bridge

Cross-browser extension (Chrome / Edge / Brave / Opera **and** Firefox 128+) that exports the
**authentication cookies** of supported OSINT platforms to your MeteorEdit instance, so the
server-side tools (Web Clipper, Profile Analyzer, OSINT Dorking…) can scrape **as you**,
authenticated.

## Supported platforms

Instagram · Facebook · Threads · X (Twitter) · TikTok · LinkedIn · YouTube · Reddit · Snapchat ·
Telegram · WhatsApp · Mastodon · Linktree · PayPal · Strava

## Installation

### Chromium (Chrome / Edge / Brave / Opera)

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`)
2. Toggle **Developer mode** on
3. Click **Load unpacked** and pick this `extension/` folder
4. Pin the icon to the toolbar

### Firefox (128+)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Pick the `manifest.json` file inside the unzipped `extension/` folder
4. The extension stays loaded until Firefox is closed (unsigned add-ons can't be installed
   permanently outside Mozilla AMO)

## First-time setup

1. Open `Profile > Tokens API` on your MeteorEdit instance and click **Create token**.
   Copy the token (shown only once — `mext_...`)
2. Open the extension's options page (gear icon in popup, or right-click extension → Options)
3. Paste your instance URL (e.g. `https://meteoredit.local`) and the token
4. Click **Test connection** → ✓ Connected as `your-email@…`

## Usage

1. Log into a supported platform in your browser (e.g. `https://www.instagram.com`)
2. Click the MeteorEdit extension icon
3. Click **Import session to MeteorEdit**

The extension extracts only the **whitelisted authentication cookies** (no analytics, no A/B
testing junk) and uploads them over HTTPS. The server stores them encrypted at-rest with
AES-256-GCM (`COOKIE_ENCRYPTION_KEY`). When MeteorEdit's scrapers run, they apply these cookies
to Puppeteer so the requests are authenticated as you.

## Security

- Token is stored in `chrome.storage.local` (per-Chrome-profile encryption)
- Only **whitelisted** auth cookie names are extracted (per-platform list)
- Server stores cookies AES-256-GCM encrypted with a 32-byte master key — DB compromise alone
  is insufficient to read them
- HTTPS is strongly recommended; the extension allows `http://` only on `localhost` / `*.local`
  for development

## Architecture

```
extension/
├── manifest.json              MV3 manifest
├── icons/                     PNG icons
├── common/
│   ├── api.js                 Fetch wrapper (Bearer auth)
│   ├── platforms.js           Platform detection (synced with server)
│   ├── cookieWhitelist.js     Per-platform allowed cookie names
│   ├── storage.js             chrome.storage.local helpers
│   └── theme.css              Shared styles aligned with MeteorEdit
├── background/
│   └── service-worker.js      Tab badge updates
├── options/
│   ├── options.html / .css / .js   Configuration page
└── popup/
    └── popup.html / .css / .js     Main UI
```
