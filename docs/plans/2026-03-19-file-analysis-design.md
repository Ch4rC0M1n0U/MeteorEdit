# File Technical Analysis — Design Document

**Date**: 2026-03-19
**Status**: Approved

## Problem

Uploaded media files (images, video, audio) contain forensic metadata (EXIF, GPS, device info, software signatures) that is valuable for OSINT investigations. Currently this data is not extracted or displayed.

## Solution

Add a "Technical Analysis" button in MediaEditor that extracts all metadata via ExifTool + ffprobe, categorizes it, and creates a structured note with tables per category.

## Architecture

- **Server**: `POST /api/media/analyze` — runs exiftool + ffprobe, creates note
- **Docker**: Add `libimage-exiftool-perl` to Dockerfile.server
- **Client**: Analysis button in MediaEditor controls bar
- **Output**: DossierNode (type: note) with TipTap JSON tables

## Metadata Categories

| Category | Icon | Fields |
|----------|------|--------|
| Appareil | 📷 | Make, Model, Software, LensModel, SerialNumber |
| Localisation | 📍 | GPSLatitude, GPSLongitude, GPSAltitude + Google Maps link |
| Dates | 📅 | DateTimeOriginal, CreateDate, ModifyDate, FileModifyDate |
| Image/Vidéo | 🖼️ | Width, Height, Resolution, ColorSpace, Codec, Bitrate, FrameRate |
| Audio | 🎵 | SampleRate, Channels, AudioCodec, AudioBitrate |
| Fichier | 📄 | FileName, FileSize, MimeType, FileType, SHA256 hash |
| Logiciel | 💻 | Software, CreatorTool, HistorySoftwareAgent, XMP |

## Flow

1. User clicks 🔬 Analysis button on uploaded media
2. Client sends POST /api/media/analyze { nodeId, dossierId }
3. Server runs `exiftool -json -G -n <file>` + `ffprobe -print_format json -show_streams -show_format <file>`
4. Server categorizes metadata into groups
5. Server generates TipTap JSON with heading + table per category
6. If GPS found: adds Google Maps link
7. Server computes SHA256 hash of file
8. Creates DossierNode (type: note) with title "🔬 Analyse technique — {filename}"
9. Returns new node ID
10. Client navigates to the new note

## Dependencies

- ExifTool (libimage-exiftool-perl) — ~30MB in Docker
- ffprobe (already installed via ffmpeg)
- crypto (Node.js built-in for SHA256)
