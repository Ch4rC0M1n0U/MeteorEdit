<div align="center">

# MeteorEdit

### Open Source Intelligence Investigation Platform

[![Version](https://img.shields.io/badge/version-3.0.0--beta.1-blue.svg)](https://github.com/your-org/meteoredit)
[![Status](https://img.shields.io/badge/status-beta-orange.svg)]()
[![License](https://img.shields.io/badge/license-proprietary-red.svg)]()
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg?logo=docker&logoColor=white)]()

**MeteorEdit** is a secure, self-hosted investigation management platform designed for OSINT professionals, intelligence analysts, and law enforcement teams. Organize investigations, collaborate in real-time, and produce professional reports — all from a single interface.

> **Beta Notice:** This software is currently in active development. Features may change between releases.

---

</div>

## Features

### Investigation Management
- **Dossier-based workflow** — Organize investigations with structured dossiers containing entities, objectives, judicial facts, and investigator assignments
- **Hierarchical node tree** — Folders, rich-text notes, mindmaps, documents, datasets, maps, and media nodes
- **Version history** — Snapshots with full restore capability for every node

### Rich Text Editor
- **TipTap-powered editor** — Full-featured rich text with tables, images, code blocks, task lists, mentions, and more
- **Integrated spell checker** — LanguageTool integration for real-time orthographic, grammar, and style checking
- **Auto-save** — Configurable auto-save intervals to prevent data loss

### Real-Time Collaboration
- **Live editing** — Multiple users can edit the same document simultaneously via Yjs/WebSocket
- **Presence indicators** — See who's online and what they're working on
- **Socket.io notifications** — Instant updates when collaborators make changes

### Visual Analysis
- **Excalidraw mindmaps** — Interactive whiteboard for brainstorming and relationship mapping
- **Mapbox integration** — Geospatial analysis with customizable map layers
- **Dataset tables** — Structured data with CSV import/export and inline editing
- **Charts** — Data visualization with Chart.js

### AI-Powered Analysis
- **Entity enrichment** — Automatic entity extraction and enrichment via Ollama (self-hosted)
- **Smart summaries** — AI-generated summaries for nodes and dossiers
- **Report generation** — Automated investigation reports with customizable templates
- **Multi-provider support** — Ollama (local), Claude API, or OpenAI — with per-user API key management

### Security & Encryption
- **End-to-end encryption** — RSA-OAEP 4096 + AES-256-GCM for all sensitive content
- **Client-side decryption** — Encryption keys never leave the browser (Web Crypto API)
- **Two-factor authentication** — TOTP-based 2FA with backup codes
- **Audit trail** — Comprehensive activity logging with admin dashboard, filters, and CSV export
- **Role-based access** — Admin/user roles with configurable permissions

### Web Clipper
- **Page capture** — Capture web pages as full-page screenshots via Puppeteer
- **Social media integration** — Dedicated connectors for social platforms
- **Media downloader** — Download videos and media with yt-dlp integration

### Export & Reporting
- **PDF export** — Professional investigation reports
- **DOCX generation** — Microsoft Word compatible reports with custom templates
- **Selective export** — Choose which nodes to include in exports
- **JSON backup** — Full dossier backup and restore

### Customization
- **White-label branding** — Custom app name, logo, favicon, accent color, and login page background
- **Multi-language** — Full i18n support (French, English, Dutch) with easy extensibility
- **Theme support** — Dark and light themes with configurable display density
- **PWA** — Install as a progressive web app for desktop-like experience

---

## Quick Start

### Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/meteoredit.git
cd meteoredit

# Copy and configure environment
cp server/.env.example server/.env
# Edit server/.env — change JWT_SECRET, JWT_REFRESH_SECRET, COOKIE_ENCRYPTION_KEY

# Start core services
docker compose up -d

# (Optional) Start AI services
docker compose --profile ai up -d

# (Optional) Start spell checking
docker compose --profile tools up -d
```

Open `http://localhost:8080` — the setup wizard will guide you through the initial configuration.

### Manual Installation

**Prerequisites:** Node.js 20+, MongoDB 7+

```bash
# Install dependencies
cd server && npm install && cd ..
cd client && npm install && cd ..

# Configure server
cp server/.env.example server/.env
# Edit server/.env with your settings

# Build and start
cd server && npm run build && npm start &
cd client && npm run build && npm run preview
```

### Setup Wizard

On first launch, MeteorEdit automatically redirects to the setup wizard (`/setup`) which:

1. **Diagnoses** all services (MongoDB, LanguageTool, Ollama, uploads directory)
2. **Validates** environment configuration (JWT secrets, connection strings)
3. **Creates** the first administrator account
4. **Configures** initial application settings (branding, language, registration)

**Dev Mode:** Access `/setup?dev=true` at any time to run diagnostics without modifying anything.

---

## Architecture

| Component | Technology | Port |
|-----------|-----------|------|
| Frontend | Vue 3 + TypeScript + Vuetify 4 + Vite | 8080 |
| Backend | Express 5 + Mongoose 9 | 3001 |
| Collaboration | Yjs + WebSocket | 3002 |
| Database | MongoDB 7 | 27017 |
| AI (optional) | Ollama | 11434 |
| Spell Check (optional) | LanguageTool | 8010 |

---

## Screenshots

*Coming soon*

---

## API Documentation

MeteorEdit exposes a complete REST API documented with Swagger/OpenAPI 3.0.3.

Once running, access the interactive API documentation at: `http://localhost:3001/api-docs`

---

## Contributing

This project is currently in closed beta. Contribution guidelines will be published with the stable release.

---

## Security

If you discover a security vulnerability, please report it responsibly. Do not open a public issue.

---

<div align="center">

**Built for investigators, by investigators.**

MeteorEdit v3.0.0-beta.1

</div>
