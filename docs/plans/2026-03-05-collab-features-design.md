# MeteorEdit - Collaboration & Advanced Features Design

**Date:** 2026-03-05
**Features:** Activity logs, Notifications, Real-time collaboration, Tags, Advanced search

---

## Architecture Overview

Two communication layers:
- **Socket.io** (port 3001) — notifications, presence indicators, activity events
- **y-websocket** (port 3002) — Yjs CRDT sync for TipTap and Excalidraw collaboration

---

## 1. Activity Logs / Audit Trail

### Model: ActivityLog
```
userId        ObjectId ref User (required)
action        String enum: login, dossier.create, dossier.delete, dossier.update,
              collaborator.add, collaborator.remove, user.role_change,
              user.activate, user.deactivate, user.delete,
              admin.reset_password, admin.reset_2fa
targetType    String enum: dossier, user, system
targetId      ObjectId (optional)
metadata      Mixed (e.g. dossier name, target user name)
ip            String
timestamp     Date (default: now, indexed)
```
- TTL index: 90 days
- Helper: `logActivity(userId, action, targetType, targetId, metadata, ip)`
- Endpoint: `GET /admin/logs?action=&userId=&from=&to=&page=&limit=`

### Admin UI
- New "Activite" section in admin sidebar
- Paginated table with icon per action type, filters by type/user/date range

---

## 2. Real-time Notifications

### Model: Notification
```
userId        ObjectId ref User (recipient, required, indexed)
type          String enum: collaborator.added, collaborator.removed,
              dossier.updated, node.updated
message       String
dossierId     ObjectId ref Dossier (optional)
fromUserId    ObjectId ref User (optional)
read          Boolean (default: false)
createdAt     Date (indexed)
```
- TTL index: 30 days

### Backend
- `createNotification(userId, type, data)` — saves to DB + emits `notification:new` via Socket.io to target user
- `GET /notifications?page=&limit=` — list user's notifications
- `PATCH /notifications/:id/read` — mark as read
- `PATCH /notifications/read-all` — mark all as read

### Frontend
- Bell icon in navbar with unread count badge
- Dropdown on click: recent notifications list, click navigates to dossier + marks read
- Composable: `useNotifications()` — listens to Socket.io, manages state

### Trigger events
- Collaboration only: collaborator added/removed, dossier modified by another collaborator, node modified by another collaborator

---

## 3. Real-time Collaboration (TipTap + Excalidraw)

### Infrastructure
- **y-websocket** server on port 3002
- JWT auth via query param on WebSocket handshake
- Room naming: `node:{nodeId}`
- Persistence: LevelDB (`./yjs-docs/`) + debounced sync to MongoDB (content / excalidrawData fields)

### TipTap Collaborative Editing
- Extensions: `@tiptap/extension-collaboration` + `@tiptap/extension-collaboration-cursor`
- Client: `y-websocket` WebSocketProvider
- Content stored in `Y.XmlFragment`
- Colored cursors with username labels

### Excalidraw Collaborative Editing
- `Y.Map` for Excalidraw elements synced via same y-websocket room
- Awareness protocol for cursor/pointer positions
- Replaces existing Socket.io events (`excalidraw-update`, `node-update`)

### Presence
- Yjs awareness protocol: each user broadcasts `{ name, color, cursor }`
- UI: avatar bubbles of active collaborators at top of editor
- Color assigned per user (hash of userId)

### Dossier Sharing UI
- Enhanced "Collaborateurs" section in dossier info panel
- Autocomplete field to search users by email/name
- Invite button + list with remove button
- Uses existing `collaborators` field on Dossier model

---

## 4. Tags on Dossiers

### Model changes
- Add `tags: [String]` to Dossier schema (lowercase, trimmed)
- Index on `tags` field

### Backend
- Tags sent/received via existing `POST /dossiers` and `PUT /dossiers/:id`
- New endpoint: `GET /dossiers/tags` — returns distinct tags used by user (for autocomplete)

### Frontend
- Dossier info panel: chips input for add/remove tags with autocomplete
- Dossier list: tag badges displayed under title
- Clickable tags activate search filter

---

## 5. Advanced Search with Filters

### Model changes
- Add `contentText: String` to DossierNode schema — plain text extracted from TipTap JSON
- Text index on `contentText` for full-text search
- Helper: `extractTextFromTipTap(json)` to extract plain text from TipTap content
- Updated automatically in `updateNode` controller

### Backend
- Refactored `GET /api/search` with query params:
  - `q` — search text (searches title, description, objectives, contentText)
  - `status` — open/in_progress/closed
  - `tags` — comma-separated
  - `owner` — userId
  - `collaborator` — userId
  - `nodeType` — folder/note/mindmap/document
  - `dateFrom`, `dateTo` — date range
  - `sort` — relevance/date/title
  - `page`, `limit` — pagination (default 20)
- AND combination between filters

### Frontend
- SearchBar enhanced: "Filtres" button opens filter panel below
- Filters: status chips, tags autocomplete, node type, date pickers, owner/collaborator autocomplete
- Results grouped: dossiers first, then nodes, with search term highlighting
- Active filters displayed as removable chips above results

---

## Dependencies to add

### Server
- `yjs` — CRDT library
- `y-websocket` — WebSocket server for Yjs
- `y-leveldb` — LevelDB persistence for Yjs docs

### Client
- `yjs` — CRDT library
- `y-websocket` — WebSocket provider
- `@tiptap/extension-collaboration` — TipTap Yjs binding
- `@tiptap/extension-collaboration-cursor` — cursor awareness

---

## Implementation order (recommended)

1. **Tags** — smallest change, standalone, unblocks search filters
2. **Search avancee** — builds on tags, improves core UX
3. **Activity logs** — standalone backend + admin UI
4. **Notifications** — builds on Socket.io, leverages activity events
5. **Collaboration temps reel** — largest feature, builds on everything above
