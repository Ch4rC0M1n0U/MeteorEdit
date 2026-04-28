# MeteorEdit Cookie Bridge

Browser extension (Chrome / Edge / Brave / Opera) that exports the cookies of supported OSINT
platforms directly into your MeteorEdit instance, **end-to-end encrypted** with your account's
RSA public key.

## Supported platforms

Instagram · Facebook · Threads · X (Twitter) · TikTok · LinkedIn · YouTube · Reddit · Snapchat ·
Telegram · WhatsApp · Mastodon · Linktree · PayPal · Strava

## Installation (developer mode)

1. Open `chrome://extensions` (or `edge://extensions`)
2. Toggle **Developer mode** on
3. Click **Load unpacked** and pick this `extension/` folder
4. Pin the icon to the toolbar

## First-time setup

1. Open `Profile > Tokens API` on your MeteorEdit instance and click **Create token**.
   Copy the token (shown only once — `mext_...`)
2. Open the extension's options page (gear icon in popup, or right-click extension → Options)
3. Paste your instance URL (e.g. `https://meteoredit.local`) and the token
4. Click **Test connection**. You should see ✓ Connected as `your-email@…`

## Usage

1. Visit a supported platform (e.g. `https://www.instagram.com`)
2. Click the MeteorEdit extension icon
3. Choose the destination dossier
4. Click **Export to MeteorEdit**

The cookies are encrypted **locally** in your browser with your account's RSA-OAEP-4096 public
key. Only you, with your E2E password unlocked on the website, can decrypt them.

## Security

- Token is stored in `chrome.storage.local` (per-Chrome-profile encryption)
- Cookies never leave your browser in clear text
- Server stores only the encrypted blob — neither your MeteorEdit admins nor a server compromise
  can read your cookies
- HTTPS is strongly recommended; the extension allows `http://` only on `localhost` / `*.local`
  domains for development convenience

## Architecture

```
extension/
├── manifest.json              MV3 manifest
├── icons/                     PNG icons
├── common/
│   ├── api.js                 Fetch wrapper (Bearer auth)
│   ├── crypto.js              Web Crypto E2E encryption
│   ├── platforms.js           Platform detection (synced with server)
│   ├── storage.js             chrome.storage.local helpers
│   └── theme.css              Shared styles aligned with MeteorEdit
├── background/
│   └── service-worker.js      Tab badge updates
├── options/
│   ├── options.html / .css / .js   Configuration page
└── popup/
    └── popup.html / .css / .js     Main UI
```
