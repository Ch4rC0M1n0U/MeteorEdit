# Media Analysis Node - Design Document

**Date:** 2026-03-13
**Statut:** Valide

## Objectif

Nouveau type de node `media` permettant l'analyse de fichiers video et audio dans un dossier OSINT. L'utilisateur peut lire un media (URL externe ou fichier uploade), effectuer des captures de frames video horodatees, ajouter des notes avec timestamp, et exporter le tout dans le rapport DOCX.

## Architecture

Approche retenue : node `media` dedie avec donnees structurees dans `mediaData` (meme pattern que `excalidrawData` pour mindmaps et `mapData` pour cartes). Un composant `MediaEditor.vue` unifie le lecteur et le panneau d'annotations.

---

## 1. Data Model

### DossierNode - modifications

- Enum type : ajouter `media` → `folder|note|mindmap|document|map|dataset|media`
- Nouveau champ `mediaData` (Mixed) dans le schema Mongoose

### Interfaces TypeScript

```typescript
interface MediaSource {
  type: 'url' | 'upload';
  url?: string;                    // URL externe (YouTube, direct link, etc.)
  fileUrl?: string;                // /uploads/media/xxx.mp4 (si upload)
  fileName?: string;
  mimeType: string;                // video/mp4, audio/mpeg, audio/wav, etc.
  mediaType: 'video' | 'audio';
}

interface MediaMetadata {
  title: string;
  platform?: string;               // YouTube, Vimeo, SoundCloud, etc.
  channelName?: string;
  channelUrl?: string;
  publishedAt?: string;
  duration?: number;                // duree en secondes
  thumbnailUrl?: string;
  description?: string;
  tags?: string[];
}

interface MediaAnnotation {
  id: string;                       // uuid
  timestamp: number;                // secondes dans le media
  type: 'capture' | 'note';
  comment: string;
  screenshotUrl?: string;           // /uploads/media/captures/xxx.png
  createdAt: string;
}

interface MediaData {
  source: MediaSource;
  metadata: MediaMetadata;
  annotations: MediaAnnotation[];
}
```

### Stockage fichiers

- `uploads/media/` — fichiers media uploades
- `uploads/media/captures/` — screenshots de frames

### Integrite (EvidenceRecord)

Chaque capture cree un EvidenceRecord :
- `evidenceType: 'media-capture'`
- `sourceUrl` : URL du media source
- `filePath` : chemin de la capture
- `fileHash` : SHA-256
- `metadata.mediaTimestamp` : position dans le media (secondes)

---

## 2. UI - Composant MediaEditor

### Layout

```
+-----------------------------------------------------+
|  +--- Lecteur Media --------------------------------+|
|  |                                                   ||
|  |   [VIDEO / AUDIO PLAYER]                          ||
|  |                                                   ||
|  |   > =========@===========  03:42 / 12:15         ||
|  |   [Capture] [Note] [Metadata]                     ||
|  +---------------------------------------------------+|
|                                                       |
|  +--- Annotations ----------------------------------+|
|  |  Filtrer...                [Tri: chrono v]        ||
|  |                                                   ||
|  |  + 00:01:23 --- capture -------------------+     ||
|  |  | [thumbnail]  Profil suspect visible      |     ||
|  |  |              sur la droite de l'image    |     ||
|  |  +--------------------------------- [E] [X]-+     ||
|  |                                                   ||
|  |  + 00:03:42 --- note ----------------------+     ||
|  |  | Changement de sujet a ce moment          |     ||
|  |  +--------------------------------- [E] [X]-+     ||
|  +---------------------------------------------------+|
+-----------------------------------------------------+
```

### Interactions

- **Bouton Capture** : pause + capture frame via `<canvas>.drawImage()` (fichiers locaux) ou Puppeteer (embeds YouTube/Vimeo - CORS) + upload serveur + EvidenceRecord + champ commentaire
- **Bouton Note** : insere timestamp courant + champ commentaire (pas de screenshot)
- **Bouton Metadata** : ouvre modale avec champs pre-remplis (auto-detection) editables
- **Clic sur timestamp** : seek le lecteur a cette position
- **Audio** : meme layout sans zone video (barre de lecture uniquement)

### Creation du node

Dialog `MediaCreateDialog.vue` :
- Choix : URL externe ou upload fichier
- Si URL : champ texte → auto-detection oEmbed cote serveur → pre-remplit metadonnees
- Si upload : input file (accept video/*, audio/*) → upload multer → detection MIME

---

## 3. Backend - API

### Nouveaux endpoints

```
POST /api/media/oembed           → { url } → metadonnees auto-detectees
POST /api/media/upload           → multer (video/audio) → { fileUrl, mimeType }
POST /api/media/capture          → { nodeId, imageData, timestamp } → { screenshotUrl, evidenceId }
POST /api/media/capture-embed    → { nodeId, url, timestamp } → Puppeteer → { screenshotUrl, evidenceId }
```

### oEmbed / auto-detection

1. Appel `https://noembed.com/embed?url=...` (YouTube, Vimeo, SoundCloud, Dailymotion)
2. Fallback : fetch HTML + parse `og:title`, `og:video`, `og:image`
3. Retourne metadonnees pre-remplies pour la modale

### Upload media

- Multer destination : `uploads/media/`
- Accept : `video/*`, `audio/*`
- Limite : 500 MB
- Detection MIME cote serveur pour `mediaType: 'video' | 'audio'`

### Capture de frame

- **Client-side** (`/api/media/capture`) : recoit base64 du canvas, sauve en PNG, hash SHA-256, cree EvidenceRecord
- **Server-side** (`/api/media/capture-embed`) : Puppeteer screenshot pour embeds (CORS), meme logique que webclipper

---

## 4. Export DOCX

### En-tete metadonnees

```
Analyse Media : [titre]
Source : YouTube | Chaine : @nom
URL : https://...
Date publication : 2026-01-15
Duree : 12:15
```

### Format tableau (option 1)

| Temps    | Capture | Commentaire           |
|----------|---------|----------------------|
| 00:01:23 | [image] | Profil visible...     |
| 00:03:42 | —       | Changement de sujet   |

### Format sequentiel (option 2)

```
[00:01:23] - Capture
[image]
Profil suspect visible sur la droite

[00:03:42] - Note
Changement de sujet a ce moment
```

Le choix du format se fait dans ExportSelectDialog (radio button visible quand des nodes media sont selectionnes).

---

## 5. Integration existante

### Arbre de nodes

- Icone : `mdi-play-circle-outline`
- Menu contextuel folders : ajout option "Media"
- ExportSelectDialog : icone media

### i18n

Nouvelles cles dans les 3 locales (fr, en, nl) pour tous les labels media.

### Activity log

`logActivity()` sur : creation node media, ajout annotation, capture frame.

---

## 6. Fichiers a creer/modifier

### Creer

- `client/src/components/media/MediaEditor.vue`
- `client/src/components/media/MediaMetadataDialog.vue`
- `client/src/components/media/MediaCreateDialog.vue`
- `server/src/controllers/mediaController.ts`
- `server/src/routes/media.ts`

### Modifier

- `server/src/models/DossierNode.ts` — enum type + champ mediaData
- `client/src/types/index.ts` — type union + interfaces MediaData
- `client/src/components/dossier/DossierView.vue` — afficher MediaEditor
- `client/src/components/tree/NodeTree.vue` — icone + option creation
- `client/src/components/tree/NodeTreeItem.vue` — context menu
- `client/src/components/dossier/ExportSelectDialog.vue` — icone + option format
- `client/src/utils/docxTemplate.ts` — rendu media dans export
- `client/src/i18n/locales/{fr,en,nl}.json` — cles i18n
- `server/src/index.ts` — monter routes media
