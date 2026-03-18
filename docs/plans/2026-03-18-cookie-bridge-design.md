# Cookie Bridge — Design Document

**Date**: 2026-03-18
**Status**: Approved

## Problem

MeteorEdit needs authenticated cookies to download videos from YouTube, Instagram, etc. via yt-dlp. The current approach (Puppeteer `headless: false`) requires a visible browser window — impossible in Docker/server deployments. Bot-like approaches risk account bans.

## Solution

Two complementary methods using the user's **real browser** (zero bot detection risk):

1. **Chrome/Firefox extension** "MeteorEdit Cookie Bridge" — one-click cookie export
2. **Manual cookies.txt upload** — fallback for users who can't install extensions

## Architecture

### Extension "MeteorEdit Cookie Bridge"

**Manifest V3** extension with minimal permissions.

#### Files
```
meteoredit-cookie-bridge/
├── manifest.json       # Manifest V3, permissions: cookies, activeTab, storage
├── popup.html          # Platform buttons with status indicators
├── popup.js            # Cookie extraction + API push
├── options.html        # Server URL + token config
├── options.js          # Auto-config via URL params
└── icons/              # 16, 48, 128px
```

#### User Flow
1. MeteorEdit > Sessions > "Configurer l'extension" → generates link with URL + temporary API token
2. Extension auto-configures with server URL and token
3. User browses to YouTube/Instagram, logs in normally in their own browser
4. Clicks extension popup → sees platforms with detected session cookies (green = found)
5. Clicks "Send" → `POST /api/social/cookies/:platform` with filtered cookies

#### Cookie Filtering
Extension only reads cookies for specific domains per platform:
- YouTube: `youtube.com`, `google.com`, `accounts.google.com`
- Instagram: `instagram.com`
- TikTok: `tiktok.com`
- Facebook: `facebook.com`
- X/Twitter: `x.com`, `twitter.com`
- LinkedIn: `linkedin.com`
- Snapchat: `snapchat.com`
- Strava: `strava.com`

Only session-proving cookies are sent (SID, sessionid, auth_token, etc.), matching the existing `AUTH_COOKIE_NAMES` map in `socialAuthController.ts`.

#### Security
- API token expires after 24h, scoped to cookie upload only
- Extension never reads cookies from other domains
- Cookies encrypted server-side via existing `encryptCookies()` before storage

### cookies.txt Upload (Fallback)

#### User Flow
1. User exports cookies via third-party extension (e.g., "Get cookies.txt LOCALLY")
2. MeteorEdit > Sessions > "Import cookies.txt" → file upload dialog
3. Server parses Netscape cookie format, filters by platform domains
4. Stores encrypted in `SocialCookie` model

### Server Changes

#### New Endpoint
`POST /api/social/cookies/:platform` (authenticated)
- Accepts JSON body: `{ cookies: [{name, value, domain, path, ...}] }`
- Encrypts via `encryptCookies()`
- Upserts into `SocialCookie` model (already exists)
- Returns success + cookie count

#### New Endpoint
`POST /api/social/cookies-file` (authenticated, multipart)
- Accepts cookies.txt file upload
- Parses Netscape format
- Auto-detects platform from cookie domains
- Stores encrypted per platform

#### New Endpoint
`POST /api/social/bridge-token` (authenticated)
- Generates a short-lived JWT (24h) scoped to `cookie-upload` purpose
- Returns token + server URL for extension configuration

#### yt-dlp Integration
When downloading, write stored cookies to a temp Netscape cookies.txt file:
- `SocialCookie.find({ userId, platform })` → decrypt → write temp file
- Pass `--cookies /tmp/cookies-<id>.txt` to yt-dlp
- Delete temp file after download

### UI Changes (Sessions Page)

Add to existing Sessions panel in MeteorEdit:
- **"Configurer l'extension"** button → generates QR code / clickable link with bridge token
- **"Importer cookies.txt"** button → file upload dialog
- **Platform status cards** → show cookie validity (present / expired / missing) with last update date
- **"Supprimer"** button per platform → clear stored cookies

## Platforms Supported
YouTube, Instagram, TikTok, Snapchat, Facebook, X/Twitter, Threads, LinkedIn, Strava (matching existing `PLATFORM_LOGIN_URLS` config).

## Dependencies
- No new npm packages needed
- Extension: pure JS, no framework
- QR code: `qrcode` package already in server dependencies
