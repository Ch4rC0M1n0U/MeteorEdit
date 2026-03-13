# Media Analysis Node - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `media` node type supporting video/audio playback, timestamped captures/notes, oEmbed metadata, and DOCX export.

**Architecture:** New node type `media` with `mediaData` field (same pattern as `excalidrawData`/`mapData`). Client-side `MediaEditor.vue` component with HTML5 player + annotation panel. Server-side endpoints for oEmbed, upload, and frame capture with EvidenceRecord integrity.

**Tech Stack:** Vue 3 + TypeScript, HTML5 `<video>`/`<audio>`, Canvas API, Puppeteer (embed captures), Multer, noembed.com API, docx library.

---

## Task 1: Data Model — Server Schema

**Files:**
- Modify: `server/src/models/DossierNode.ts`
- Modify: `server/src/models/EvidenceRecord.ts`

**Step 1: Add `media` to DossierNode type enum and `mediaData` field**

In `server/src/models/DossierNode.ts`, find the `type` field enum and add `'media'`. Add `mediaData` field as Mixed:

```typescript
// In the schema definition, add 'media' to the type enum:
type: { type: String, required: true, enum: ['folder', 'note', 'mindmap', 'document', 'map', 'dataset', 'media'] },

// Add after mapData field:
mediaData: { type: Schema.Types.Mixed, default: null },
```

**Step 2: Add `media-capture` to EvidenceRecord evidenceType enum**

In `server/src/models/EvidenceRecord.ts`, find the `evidenceType` field and add `'media-capture'`:

```typescript
evidenceType: { type: String, required: true, enum: ['file', 'screenshot', 'clip', 'media-capture'] },
```

Also update the `IEvidenceRecord` interface:

```typescript
evidenceType: 'file' | 'screenshot' | 'clip' | 'media-capture';
```

**Step 3: Commit**

```bash
git add server/src/models/DossierNode.ts server/src/models/EvidenceRecord.ts
git commit -m "feat(media): add media type to DossierNode schema and media-capture evidence type"
```

---

## Task 2: Data Model — Client Types

**Files:**
- Modify: `client/src/types/index.ts`

**Step 1: Add media interfaces and update DossierNode type**

In `client/src/types/index.ts`, add the media interfaces before the DossierNode interface, and update the type union:

```typescript
// Add before DossierNode interface:
export interface MediaSource {
  type: 'url' | 'upload';
  url?: string;
  fileUrl?: string;
  fileName?: string;
  mimeType: string;
  mediaType: 'video' | 'audio';
}

export interface MediaMetadata {
  title: string;
  platform?: string;
  channelName?: string;
  channelUrl?: string;
  publishedAt?: string;
  duration?: number;
  thumbnailUrl?: string;
  description?: string;
  tags?: string[];
}

export interface MediaAnnotation {
  id: string;
  timestamp: number;
  type: 'capture' | 'note';
  comment: string;
  screenshotUrl?: string;
  createdAt: string;
}

export interface MediaData {
  source: MediaSource;
  metadata: MediaMetadata;
  annotations: MediaAnnotation[];
}
```

Then in the DossierNode interface:
- Add `'media'` to the type union on the `type` field
- Add `mediaData: MediaData | null;` after `mapData`

**Step 2: Commit**

```bash
git add client/src/types/index.ts
git commit -m "feat(media): add MediaData types and media node type to client"
```

---

## Task 3: Backend — Media Controller & Routes

**Files:**
- Create: `server/src/controllers/mediaController.ts`
- Create: `server/src/routes/media.ts`
- Modify: `server/src/index.ts`

**Step 1: Create media controller**

Create `server/src/controllers/mediaController.ts` with these functions:

- `fetchOembed(req, res)` — POST `/oembed` with `{ url }`, calls `https://noembed.com/embed?url=...`, fallback to HTML meta parsing, returns `MediaMetadata`
- `uploadMedia(req, res)` — POST `/upload` with multer file, saves to `uploads/media/`, returns `{ fileUrl, mimeType, mediaType }`
- `captureFrame(req, res)` — POST `/capture` with `{ nodeId, imageData, timestamp }`, decodes base64, saves PNG to `uploads/media/captures/cap-{Date.now()}.png`, computes SHA-256 hash, creates EvidenceRecord with `evidenceType: 'media-capture'`, returns `{ screenshotUrl, evidenceId }`
- `captureEmbed(req, res)` — POST `/capture-embed` with `{ nodeId, url, timestamp }`, uses Puppeteer to screenshot embed page, same flow as captureFrame for saving + evidence

All functions must call `logActivity()` with appropriate actions.

Ensure `uploads/media/` and `uploads/media/captures/` directories are created on first use (use `fs.mkdirSync` with `recursive: true`).

**Step 2: Create media routes**

Create `server/src/routes/media.ts`:

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { fetchOembed, uploadMedia, captureFrame, captureEmbed } from '../controllers/mediaController';
import { upload } from '../config/upload';

const router = Router();
router.use(authenticate);

router.post('/oembed', fetchOembed);
router.post('/upload', upload.single('file'), uploadMedia);
router.post('/capture', captureFrame);
router.post('/capture-embed', captureEmbed);

export default router;
```

**Step 3: Mount routes in index.ts**

In `server/src/index.ts`, add after the clipper routes (line ~83):

```typescript
import mediaRoutes from './routes/media';
// ...
app.use('/api/media', mediaRoutes);
```

**Step 4: Commit**

```bash
git add server/src/controllers/mediaController.ts server/src/routes/media.ts server/src/index.ts
git commit -m "feat(media): add media controller with oEmbed, upload, and capture endpoints"
```

---

## Task 4: i18n — Translation Keys

**Files:**
- Modify: `client/src/i18n/locales/fr.json`
- Modify: `client/src/i18n/locales/en.json`
- Modify: `client/src/i18n/locales/nl.json`

**Step 1: Add media keys to all 3 locale files**

Add under `"tree"` section:
```json
"media": "Media"
```

Add a new `"media"` section:
```json
"media": {
  "title": "Analyse media",
  "addUrl": "Ajouter une URL",
  "uploadFile": "Importer un fichier",
  "urlPlaceholder": "URL YouTube, Vimeo, SoundCloud, lien direct...",
  "detecting": "Detection des metadonnees...",
  "capture": "Capture",
  "note": "Note",
  "metadata": "Metadonnees",
  "editMetadata": "Modifier les metadonnees",
  "platform": "Plateforme",
  "channel": "Chaine / Profil",
  "channelUrl": "URL du profil",
  "publishedAt": "Date de publication",
  "duration": "Duree",
  "description": "Description",
  "tags": "Tags",
  "thumbnailUrl": "URL miniature",
  "annotations": "Annotations",
  "noAnnotations": "Aucune annotation. Utilisez les boutons Capture ou Note.",
  "addComment": "Ajouter un commentaire...",
  "captureAt": "Capture a {time}",
  "noteAt": "Note a {time}",
  "filterAnnotations": "Filtrer...",
  "sortChrono": "Chronologique",
  "sortRecent": "Plus recentes",
  "formatTable": "Format tableau",
  "formatSequential": "Format sequentiel",
  "mediaExportFormat": "Format annotations media",
  "sourceInfo": "Informations source",
  "seekTo": "Aller a",
  "capturing": "Capture en cours...",
  "captureSuccess": "Capture enregistree",
  "captureFailed": "Echec de la capture",
  "unsupportedFormat": "Format non supporte",
  "videoAudio": "Video / Audio"
}
```

Add translations in EN and NL locale files with the same keys.

**Step 2: Commit**

```bash
git add client/src/i18n/locales/fr.json client/src/i18n/locales/en.json client/src/i18n/locales/nl.json
git commit -m "feat(media): add i18n keys for media node in FR, EN, NL"
```

---

## Task 5: Tree Integration — Add Media to Creation Menu & Context Menu

**Files:**
- Modify: `client/src/components/tree/NodeTree.vue`
- Modify: `client/src/components/tree/NodeTreeItem.vue`
- Modify: `client/src/components/dossier/ExportSelectDialog.vue`

**Step 1: Add media button to NodeTree.vue creation menu**

After the dataset button in the `nt-add-menu` div, add:

```vue
<button class="nt-add-option" @click="$emit('create', 'media', null)">
  <v-icon size="16">mdi-play-circle-outline</v-icon>
  <span>{{ $t('tree.media') }}</span>
</button>
```

**Step 2: Add media to NodeTreeItem.vue context menu**

In the folder context menu section (where folder/note/mindmap/map/dataset child creation is listed), add:

```vue
<button v-if="node.type === 'folder'" class="nti-ctx-item" @click="showMenu = false; $emit('create', 'media', node._id)">
  <v-icon size="14">mdi-play-circle-outline</v-icon>
  {{ $t('tree.media') }}
</button>
```

**Step 3: Add media icon to ExportSelectDialog.vue**

In the `NODE_ICONS` record, add:

```typescript
media: 'mdi-play-circle-outline',
```

**Step 4: Commit**

```bash
git add client/src/components/tree/NodeTree.vue client/src/components/tree/NodeTreeItem.vue client/src/components/dossier/ExportSelectDialog.vue
git commit -m "feat(media): add media node to tree creation menu and context menu"
```

---

## Task 6: MediaCreateDialog Component

**Files:**
- Create: `client/src/components/media/MediaCreateDialog.vue`

**Step 1: Create the dialog component**

A `v-dialog` with two tabs/modes:
- **URL** : text input for external URL, "Detect" button that calls `POST /api/media/oembed`, shows detected metadata preview
- **Upload** : file input accepting `video/*,audio/*`, upload to `POST /api/media/upload`

On confirm, emits the `MediaData` object (source + metadata + empty annotations array) to the parent.

The dialog is opened from DossierView when creating a media node (instead of the standard title-only dialog).

**Step 2: Commit**

```bash
git add client/src/components/media/MediaCreateDialog.vue
git commit -m "feat(media): add MediaCreateDialog with URL and upload modes"
```

---

## Task 7: MediaMetadataDialog Component

**Files:**
- Create: `client/src/components/media/MediaMetadataDialog.vue`

**Step 1: Create the metadata editing modal**

A `v-dialog` with editable fields:
- title (text)
- platform (text)
- channelName (text)
- channelUrl (text)
- publishedAt (date picker)
- duration (number, formatted as mm:ss)
- description (textarea)
- tags (comma-separated text → array)
- thumbnailUrl (text + preview)

Props: `modelValue` (boolean), `metadata` (MediaMetadata)
Emits: `update:modelValue`, `save` (MediaMetadata)

**Step 2: Commit**

```bash
git add client/src/components/media/MediaMetadataDialog.vue
git commit -m "feat(media): add MediaMetadataDialog for editing source metadata"
```

---

## Task 8: MediaEditor Component — Core Player & Annotations

**Files:**
- Create: `client/src/components/media/MediaEditor.vue`

**Step 1: Create the main media editor component**

This is the biggest component. Layout:
- **Top section**: HTML5 `<video>` or `<audio>` element (based on `mediaData.source.mediaType`) or YouTube/Vimeo iframe embed (based on URL pattern)
- **Controls bar**: Play/pause, seek bar, current time display, buttons: [Capture] [Note] [Metadata]
- **Bottom section**: Annotations list, sorted by timestamp, each showing: timestamp badge, type icon, comment text, thumbnail (if capture), edit/delete buttons

Key logic:
- **Capture button**: pauses player, gets current time, draws video frame to hidden `<canvas>` via `drawImage()`, converts to base64 PNG, sends to `POST /api/media/capture`, adds annotation to `mediaData.annotations`
- **Note button**: gets current time, prompts for comment, adds annotation with `type: 'note'`
- **Metadata button**: opens `MediaMetadataDialog`
- **Click on annotation timestamp**: seeks player to that position
- **For embeds (YouTube/Vimeo)**: capture button calls `POST /api/media/capture-embed` instead (Puppeteer server-side)
- **Auto-save**: debounced save of `mediaData` to node via store on annotation changes

Props: `node` (DossierNode)
Uses: `dossierStore` for saving, `api` for capture calls, `useI18n` for translations

For YouTube URLs: detect pattern `youtube.com/watch?v=` or `youtu.be/` and render `<iframe>` with YouTube embed API for seeking. Same for Vimeo.

For direct files (upload or direct URL): use native `<video>`/`<audio>` element with `src`.

**Step 2: Commit**

```bash
git add client/src/components/media/MediaEditor.vue
git commit -m "feat(media): add MediaEditor with player, capture, and annotations"
```

---

## Task 9: DossierView Integration — Wire Up MediaEditor

**Files:**
- Modify: `client/src/components/dossier/DossierView.vue`

**Step 1: Import MediaEditor and MediaCreateDialog**

Add imports at the top of the script section:

```typescript
import MediaEditor from '../media/MediaEditor.vue';
import MediaCreateDialog from '../media/MediaCreateDialog.vue';
```

**Step 2: Add media editor section in template**

After the dataset `v-else-if` block and before the document block, add:

```vue
<div v-else-if="dossierStore.selectedNode.type === 'media'" class="dv-editor-wrap">
  <MediaEditor :node="dossierStore.selectedNode" />
</div>
```

**Step 3: Handle media node creation**

In the node creation flow, when `type === 'media'`, open `MediaCreateDialog` instead of the standard title dialog. On dialog confirm, create the node with `mediaData` populated.

Add state:
```typescript
const showMediaCreateDialog = ref(false);
const mediaCreateParentId = ref<string | null>(null);
```

In the `handleCreate` function, add a branch for media:
```typescript
if (type === 'media') {
  mediaCreateParentId.value = parentId;
  showMediaCreateDialog.value = true;
  return;
}
```

Add handler for dialog confirm:
```typescript
async function handleMediaCreated(title: string, mediaData: MediaData) {
  await dossierStore.createNode({
    type: 'media',
    title,
    parentId: mediaCreateParentId.value,
    mediaData,
  });
  showMediaCreateDialog.value = false;
}
```

**Step 4: Commit**

```bash
git add client/src/components/dossier/DossierView.vue
git commit -m "feat(media): integrate MediaEditor and MediaCreateDialog in DossierView"
```

---

## Task 10: DOCX Export — Media Node Rendering

**Files:**
- Modify: `client/src/utils/docxTemplate.ts`
- Modify: `client/src/components/dossier/DossierView.vue` (buildDocxSections)

**Step 1: Add media section builder in DossierView.vue**

In the `buildDocxSections` function (or `walkTreeDocx`), when encountering a media node, build a section with:
- Metadata header paragraphs (title, source, platform, channel, URL, date, duration)
- Annotations rendered based on export format choice

**Step 2: Add media rendering functions in docxTemplate.ts**

Add two functions:

```typescript
function renderMediaAnnotationsTable(annotations: MediaAnnotation[], tpl: PdfTemplateConfig, _images: { src: string; placeholder: Paragraph }[]): Table
function renderMediaAnnotationsSequential(annotations: MediaAnnotation[], tpl: PdfTemplateConfig, _images: { src: string; placeholder: Paragraph }[]): (Paragraph | Table)[]
```

The table format creates a 3-column table (Temps | Capture | Commentaire).
The sequential format creates paragraphs with bold timestamps.

Both formats use the existing placeholder pattern for images (captures).

**Step 3: Add format option to ExportSelectDialog**

Add a radio button group visible when media nodes are selected:

```vue
<div v-if="hasMediaNodes" class="es-media-format">
  <span>{{ $t('media.mediaExportFormat') }}</span>
  <label><input type="radio" v-model="mediaFormat" value="table" /> {{ $t('media.formatTable') }}</label>
  <label><input type="radio" v-model="mediaFormat" value="sequential" /> {{ $t('media.formatSequential') }}</label>
</div>
```

Pass `mediaFormat` in the emit.

**Step 4: Commit**

```bash
git add client/src/utils/docxTemplate.ts client/src/components/dossier/DossierView.vue client/src/components/dossier/ExportSelectDialog.vue
git commit -m "feat(media): add DOCX export for media nodes with table and sequential formats"
```

---

## Task 11: Dossier Store — mediaData Save Support

**Files:**
- Modify: `client/src/stores/dossier.ts`

**Step 1: Ensure mediaData is handled in node update**

Check that the `updateNode` function in the dossier store handles `mediaData` like it handles `excalidrawData` and `mapData`. The node update endpoint should already accept any field since `content` is Mixed, but verify that `mediaData` is included in the encrypted payload if encryption is enabled.

In `encryptNodeData`, ensure `mediaData` is treated like `excalidrawData`:
```typescript
if (nodeData.mediaData) {
  // encrypt mediaData same as excalidrawData
}
```

**Step 2: Commit**

```bash
git add client/src/stores/dossier.ts
git commit -m "feat(media): add mediaData encryption support in dossier store"
```

---

## Task 12: Final Polish — Activity Log & Help View

**Files:**
- Modify: `client/src/views/HelpView.vue`

**Step 1: Update HelpView with media feature documentation**

Add a section in HelpView documenting the media analysis feature:
- How to create a media node (URL or upload)
- How to use capture and note buttons
- How to edit metadata
- How the export works

**Step 2: Commit**

```bash
git add client/src/views/HelpView.vue
git commit -m "docs: add media analysis feature to help view"
```
