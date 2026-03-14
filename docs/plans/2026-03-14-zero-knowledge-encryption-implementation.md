# Zero-Knowledge File Encryption — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Chiffrer tous les fichiers et contenus d'investigation cote client (zero-knowledge) pour qu'aucune personne ayant acces au serveur ne puisse lire les donnees. Le chiffrement est obligatoire.

**Architecture:** Le systeme existant (RSA-OAEP 4096 + AES-256-GCM + PBKDF2) dans `client/src/utils/encryption.ts` et `client/src/stores/encryption.ts` est deja en place mais optionnel. On le rend obligatoire, on ajoute le chiffrement des fichiers binaires (images, documents, medias), on remplace `express.static` par une route authentifiee, et on persiste les cles crypto en sessionStorage pour survivre aux refresh.

**Tech Stack:** Web Crypto API (PBKDF2, RSA-OAEP, AES-256-GCM), Express, Mongoose, Pinia, Vue 3, sessionStorage

**Design doc:** `docs/plans/2026-03-14-zero-knowledge-encryption-design.md`

---

### Task 1: Modifications DB et route authentifiee pour les fichiers

**Contexte:** Actuellement les fichiers sont servis via `express.static('/uploads', ...)` sans auth. On doit:
1. Separer le dossier branding (`uploads/branding/`) du reste
2. Supprimer le static global pour les fichiers d'investigation
3. Creer une route `GET /api/files/:filename` authentifiee qui stream les fichiers chiffres
4. Ajouter les champs necessaires aux modeles DB

**Files:**
- Modify: `server/src/models/DossierNode.ts` — ajouter `originalContentType: String`, `originalFileSize: Number`
- Modify: `server/src/models/Dossier.ts` — supprimer `isEncrypted` (toujours vrai maintenant)
- Modify: `server/src/index.ts` — remplacer static `/uploads` par static `/uploads/branding` + route authentifiee
- Create: `server/src/controllers/fileController.ts` — controller pour servir les fichiers chiffres
- Modify: `server/src/routes/nodes.ts` — ajouter la route `GET /api/files/:filename`

**Step 1: Modifier DossierNode model**

Dans `server/src/models/DossierNode.ts`, ajouter apres `fileHash`:
```typescript
originalContentType: { type: String, default: null },
originalFileSize: { type: Number, default: null },
```

**Step 2: Modifier Dossier model**

Dans `server/src/models/Dossier.ts`:
- Supprimer le champ `isEncrypted` (le chiffrement est obligatoire)
- S'assurer que `encryptionKeys` reste present

**Step 3: Creer le controller de fichiers**

Creer `server/src/controllers/fileController.ts`:
```typescript
import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads');

export async function serveFile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { filename } = req.params;

    // Securite: bloquer traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({ message: 'Invalid filename' });
      return;
    }

    // Chercher dans uploads/ et uploads/media/ et uploads/media/captures/
    const searchPaths = [
      path.join(UPLOAD_DIR, filename),
      path.join(UPLOAD_DIR, 'media', filename),
      path.join(UPLOAD_DIR, 'media', 'captures', filename),
    ];

    let filePath: string | null = null;
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    // Verifier que le chemin resolu reste dans UPLOAD_DIR
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(UPLOAD_DIR)) {
      res.status(400).json({ message: 'Invalid path' });
      return;
    }

    // Stream le fichier (blob chiffre)
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const stream = fs.createReadStream(resolved);
    stream.pipe(res);
  } catch (error) {
    console.error('Serve file error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}
```

**Step 4: Modifier index.ts serveur**

Dans `server/src/index.ts`:
- Remplacer `app.use('/uploads', express.static(...))` par:
```typescript
// Branding files remain public (logo, favicon, login background)
app.use('/uploads/branding', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || './uploads', 'branding')));
```
- La route `/api/files/:filename` sera ajoutee dans les routes authentifiees

**Step 5: Ajouter la route dans nodes.ts**

Dans `server/src/routes/nodes.ts`:
```typescript
import { serveFile } from '../controllers/fileController';
// ...
router.get('/files/:filename', serveFile);
```

**Step 6: Creer le dossier branding**

```bash
mkdir -p server/uploads/branding
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(encryption): add authenticated file serving route, update DB schemas"
```

---

### Task 2: Separer les fichiers de branding

**Contexte:** Les fichiers de branding (logo site, favicon, fond login) doivent rester publics. Il faut modifier les controllers de settings pour stocker dans `uploads/branding/` et migrer les references.

**Files:**
- Modify: `server/src/controllers/settingsController.ts` — uploads branding dans sous-dossier
- Modify: `server/src/config/upload.ts` — ajouter un multer `brandingUpload` avec destination branding

**Step 1: Ajouter un multer branding dans upload.ts**

Dans `server/src/config/upload.ts`, ajouter:
```typescript
const brandingStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'branding');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const brandingUpload = multer({ storage: brandingStorage, limits: { fileSize: 50 * 1024 * 1024 } });
```

**Step 2: Modifier settingsController.ts**

Remplacer l'usage de `upload` par `brandingUpload` pour les endpoints logo/favicon/loginBackground.
Les paths stockes deviennent `uploads/branding/{uuid}.{ext}`.

**Step 3: Modifier les routes settings**

Dans `server/src/routes/settings.ts`, importer `brandingUpload` au lieu de `upload` pour les routes branding.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(encryption): separate branding uploads to public directory"
```

---

### Task 3: Mise a jour des utilitaires crypto client

**Contexte:** Le fichier `client/src/utils/encryption.ts` existe deja avec RSA, AES, PBKDF2. Il faut:
1. Augmenter PBKDF2 de 100k a 600k iterations
2. Ajouter des fonctions pour chiffrer/dechiffrer des fichiers binaires (ArrayBuffer)
3. Ajouter une fonction pour calculer le SHA-256 d'un fichier en clair

**Files:**
- Modify: `client/src/utils/encryption.ts`

**Step 1: Augmenter les iterations PBKDF2**

Chercher `100000` (ou la valeur actuelle) et remplacer par `600000`.

**Step 2: Ajouter le chiffrement de fichiers binaires**

Ajouter dans `encryption.ts`:
```typescript
/**
 * Encrypt a binary file (ArrayBuffer) with AES-256-GCM.
 * Returns: IV (12 bytes) + ciphertext + auth tag
 */
export async function encryptFile(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  // Prepend IV
  const result = new Uint8Array(iv.byteLength + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.byteLength);
  return result.buffer;
}

/**
 * Decrypt a binary file (ArrayBuffer) encrypted with AES-256-GCM.
 * Expects: IV (12 bytes) + ciphertext + auth tag
 */
export async function decryptFile(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  const dataArray = new Uint8Array(data);
  const iv = dataArray.slice(0, 12);
  const ciphertext = dataArray.slice(12);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
}

/**
 * Compute SHA-256 hash of an ArrayBuffer, return hex string.
 */
export async function hashFile(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**Step 3: Commit**

```bash
git add client/src/utils/encryption.ts
git commit -m "feat(encryption): add file encrypt/decrypt and hash utilities, increase PBKDF2 to 600k"
```

---

### Task 4: Persistance sessionStorage des cles crypto

**Contexte:** Actuellement la cle privee RSA est en memoire et perdue au refresh. On doit la persister en sessionStorage, chiffree par une cle ephemere.

**Files:**
- Modify: `client/src/stores/encryption.ts`

**Step 1: Ajouter la persistance sessionStorage**

Dans `client/src/stores/encryption.ts`, ajouter:

```typescript
const SESSION_KEY = 'me_crypto_session';

/**
 * Generate an ephemeral AES key and store it in a closure.
 * The ephemeral key encrypts the session data in sessionStorage.
 */
let ephemeralKey: CryptoKey | null = null;

async function getEphemeralKey(): Promise<CryptoKey> {
  if (!ephemeralKey) {
    ephemeralKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }
  return ephemeralKey;
}

async function saveToSession(privateKeyJwk: JsonWebKey, dossierKeys: Record<string, string>): Promise<void> {
  const key = await getEphemeralKey();
  const data = JSON.stringify({ privateKeyJwk, dossierKeys });
  const encoded = new TextEncoder().encode(data);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const payload = {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

async function loadFromSession(): Promise<{ privateKeyJwk: JsonWebKey; dossierKeys: Record<string, string> } | null> {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw || !ephemeralKey) return null;
  try {
    const { iv, data } = JSON.parse(raw);
    const ivArr = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    const dataArr = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivArr }, ephemeralKey, dataArr);
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  ephemeralKey = null;
}
```

**Step 2: Integrer dans le store**

- Dans `unlockKeys()`: apres dechiffrement, appeler `saveToSession(privateKeyJwk, {})`
- Dans `lockKeys()`: appeler `clearSession()`
- Ajouter `tryRestoreFromSession()`: tente de restaurer les cles depuis sessionStorage au demarrage
- Dans `getDossierKey()`: mettre a jour le cache sessionStorage quand une nouvelle cle de dossier est decryptee

**Step 3: Commit**

```bash
git add client/src/stores/encryption.ts
git commit -m "feat(encryption): persist crypto keys in sessionStorage with ephemeral encryption"
```

---

### Task 5: Chiffrement obligatoire — Registration et Login

**Contexte:** Actuellement le chiffrement est optionnel (l'utilisateur peut choisir de generer ses cles). On doit le rendre obligatoire:
- A la registration: generer automatiquement la paire RSA, chiffrer la cle privee avec le mot de passe
- Au login: dechiffrer automatiquement la cle privee

**Files:**
- Modify: `client/src/stores/encryption.ts` — supprimer les checks `hasKeys`/`checkKeys`, rendre `initializeKeys` automatique
- Modify: `client/src/stores/auth.ts` (ou la logique de login) — appeler `unlockKeys` apres login
- Modify: `server/src/controllers/authController.ts` — inclure les cles crypto dans la reponse login
- Modify: `client/src/stores/dossier.ts` — supprimer les conditions `isEncrypted` (toujours vrai)

**Step 1: Modifier le flow de registration**

Dans le composant de registration ou le store auth, apres `POST /auth/register` reussi et login auto:
```typescript
// Generer les cles automatiquement
await encryptionStore.initializeKeys(password);
```

**Step 2: Modifier le flow de login**

Apres login reussi (tokens recus):
```typescript
// Tenter la restauration session d'abord
const restored = await encryptionStore.tryRestoreFromSession();
if (!restored) {
  // Deverrouiller avec le mot de passe
  await encryptionStore.unlockKeys(password);
}
```

**Step 3: Supprimer les conditions isEncrypted dans dossier store**

Dans `client/src/stores/dossier.ts`:
- `decryptDossierFields()` : toujours dechiffrer (ne plus checker `isEncrypted`)
- `encryptDossierFields()` : toujours chiffrer
- `decryptNodeContent()` : toujours dechiffrer
- `encryptNodeData()` : toujours chiffrer
- `openDossier()` : toujours appeler `setupDossierEncryption` si pas de cle

**Step 4: Modifier createDossier**

A la creation d'un dossier, toujours generer la cle AES et la stocker:
```typescript
await encryptionStore.setupDossierEncryption(newDossier._id);
```

**Step 5: Supprimer le toggle d'encryption dans l'UI**

Retirer tout bouton/switch permettant d'activer/desactiver le chiffrement (dans DossierInfo ou DossierView).

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(encryption): make encryption mandatory at registration and login"
```

---

### Task 6: Chiffrement des fichiers a l'upload

**Contexte:** Tous les uploads de fichiers (images TipTap, documents, medias, captures, photos d'entites, documents lies) doivent etre chiffres cote client avant envoi.

**Files:**
- Modify: `client/src/components/editor/NoteEditor.vue` — chiffrer les images avant upload
- Modify: `client/src/components/media/MediaEditor.vue` — chiffrer les medias avant upload
- Modify: `client/src/components/media/MediaCreateDialog.vue` — chiffrer a la creation
- Modify: `client/src/components/dossier/DossierInfo.vue` — chiffrer photos d'entites et documents lies
- Create: `client/src/composables/useEncryptedUpload.ts` — composable reutilisable

**Step 1: Creer le composable useEncryptedUpload**

```typescript
// client/src/composables/useEncryptedUpload.ts
import { useEncryptionStore } from '../stores/encryption';
import { encryptFile, hashFile } from '../utils/encryption';
import api from '../services/api';

export function useEncryptedUpload() {
  const encryptionStore = useEncryptionStore();

  async function uploadEncryptedFile(
    dossierId: string,
    file: File,
    endpoint: string,
    fieldName = 'file'
  ): Promise<{ data: any }> {
    // 1. Lire le fichier
    const arrayBuffer = await file.arrayBuffer();

    // 2. Hash du clair (integrite)
    const plainHash = await hashFile(arrayBuffer);

    // 3. Chiffrer
    const dossierKey = await encryptionStore.getDossierKey(dossierId);
    const encryptedBuffer = await encryptFile(dossierKey, arrayBuffer);

    // 4. Creer un blob chiffre
    const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
    const encryptedFile = new File([encryptedBlob], file.name + '.enc', { type: 'application/octet-stream' });

    // 5. Upload
    const formData = new FormData();
    formData.append(fieldName, encryptedFile);
    formData.append('originalContentType', file.type);
    formData.append('originalFileSize', file.size.toString());
    formData.append('plainHash', plainHash);

    return api.post(endpoint, formData);
  }

  async function uploadEncryptedImage(
    dossierId: string,
    file: File
  ): Promise<string> {
    // Pour les images TipTap: chiffrer et upload, retourner le fileId
    const arrayBuffer = await file.arrayBuffer();
    const dossierKey = await encryptionStore.getDossierKey(dossierId);
    const encryptedBuffer = await encryptFile(dossierKey, arrayBuffer);
    const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
    const encryptedFile = new File([encryptedBlob], file.name + '.enc', { type: 'application/octet-stream' });

    const formData = new FormData();
    formData.append('image', encryptedFile);
    formData.append('originalContentType', file.type);

    const { data } = await api.post('/upload/image', formData);
    return data.url; // Retourne le filename pour reference
  }

  return { uploadEncryptedFile, uploadEncryptedImage };
}
```

**Step 2: Modifier NoteEditor.vue**

Remplacer l'upload d'images direct par l'upload chiffre:
```typescript
const { uploadEncryptedImage } = useEncryptedUpload();

async function uploadImageFile(file: File): Promise<string> {
  const dossierId = dossierStore.currentDossier?._id;
  if (!dossierId) throw new Error('No dossier');
  return uploadEncryptedImage(dossierId, file);
}
```

**Step 3: Modifier les uploads de medias**

Dans `MediaCreateDialog.vue` et `MediaEditor.vue`, utiliser `uploadEncryptedFile` au lieu de l'upload direct.

**Step 4: Modifier les uploads dans DossierInfo.vue**

Pour les photos d'entites et documents lies, utiliser `uploadEncryptedFile`.

**Step 5: Modifier les endpoints serveur pour accepter les metadonnees**

Dans `nodeController.ts` (`uploadFile`, `uploadImage`):
- Lire `req.body.originalContentType`, `req.body.originalFileSize`, `req.body.plainHash`
- Stocker dans le noeud: `originalContentType`, `originalFileSize`
- Utiliser `plainHash` pour `fileHash` (hash du clair)

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(encryption): encrypt all files client-side before upload"
```

---

### Task 7: Dechiffrement des fichiers a l'affichage

**Contexte:** Les fichiers chiffres sont maintenant servis via `GET /api/files/:filename`. Le client doit:
1. Fetch le blob chiffre
2. Dechiffrer en memoire
3. Creer un `URL.createObjectURL` pour l'affichage

**Files:**
- Create: `client/src/composables/useDecryptedFile.ts` — composable pour dechiffrer et afficher
- Modify: `client/src/components/editor/NoteEditor.vue` — images TipTap dechiffrees
- Modify: `client/src/components/editor/ResizableImage.vue` — afficher les images dechiffrees
- Modify: `client/src/components/media/MediaEditor.vue` — videos/audio dechiffres
- Modify: `client/src/components/dossier/DossierInfo.vue` — photos et logos dechiffres

**Step 1: Creer le composable useDecryptedFile**

```typescript
// client/src/composables/useDecryptedFile.ts
import { ref, onBeforeUnmount } from 'vue';
import { useEncryptionStore } from '../stores/encryption';
import { decryptFile } from '../utils/encryption';
import api from '../services/api';

export function useDecryptedFile() {
  const encryptionStore = useEncryptionStore();
  const objectUrls = ref<string[]>([]);

  async function getDecryptedUrl(
    dossierId: string,
    fileUrl: string,
    contentType = 'application/octet-stream'
  ): Promise<string> {
    // Extraire le filename du fileUrl (ex: "/uploads/abc123.enc" -> "abc123.enc")
    const filename = fileUrl.split('/').pop();
    if (!filename) throw new Error('Invalid file URL');

    // Fetch le blob chiffre via la route authentifiee
    const response = await api.get(`/files/${filename}`, { responseType: 'arraybuffer' });

    // Dechiffrer
    const dossierKey = await encryptionStore.getDossierKey(dossierId);
    const decryptedBuffer = await decryptFile(dossierKey, response.data);

    // Creer Object URL
    const blob = new Blob([decryptedBuffer], { type: contentType });
    const url = URL.createObjectURL(blob);
    objectUrls.value.push(url);
    return url;
  }

  function revokeAll() {
    for (const url of objectUrls.value) {
      URL.revokeObjectURL(url);
    }
    objectUrls.value = [];
  }

  onBeforeUnmount(() => {
    revokeAll();
  });

  return { getDecryptedUrl, revokeAll };
}
```

**Step 2: Modifier ResizableImage.vue**

Au lieu d'utiliser `SERVER_URL + src` directement, detecter si c'est un fichier chiffre et dechiffrer:
```typescript
const { getDecryptedUrl } = useDecryptedFile();
const decryptedSrc = ref<string>('');

watch(() => props.node.attrs.src, async (src) => {
  if (src && src.includes('/uploads/') && dossierStore.currentDossier) {
    decryptedSrc.value = await getDecryptedUrl(
      dossierStore.currentDossier._id,
      src,
      'image/png' // ou le type original
    );
  } else {
    decryptedSrc.value = src;
  }
}, { immediate: true });
```

**Step 3: Modifier MediaEditor.vue**

Pour la source video/audio, dechiffrer avant de passer au player:
```typescript
const { getDecryptedUrl } = useDecryptedFile();

const decryptedSourceUrl = ref('');

watch(() => props.node.mediaData?.source, async (source) => {
  if (source?.type === 'upload' && source.fileUrl && dossierStore.currentDossier) {
    decryptedSourceUrl.value = await getDecryptedUrl(
      dossierStore.currentDossier._id,
      source.fileUrl,
      source.mediaType === 'video' ? 'video/mp4' : 'audio/mpeg'
    );
  } else if (source?.url) {
    decryptedSourceUrl.value = source.url;
  }
}, { immediate: true });
```

**Step 4: Modifier DossierInfo.vue**

Pour les photos d'entites, logos de dossier, et documents lies, dechiffrer les URLs.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(encryption): decrypt files client-side for display with Object URLs"
```

---

### Task 8: Mise a jour du changement de mot de passe

**Contexte:** Quand l'utilisateur change son mot de passe, il faut re-chiffrer la cle privee RSA avec la nouvelle masterKey derivee du nouveau mot de passe.

**Files:**
- Modify: `client/src/components/profile/ProfileSecurity.vue` (ou composant de changement MDP)
- Modify: `server/src/controllers/profileController.ts` — accepter le nouveau `encryptedPrivateKey`

**Step 1: Modifier le flow client de changement de mot de passe**

```typescript
async function changePassword(currentPassword: string, newPassword: string) {
  // 1. Verifier que les cles sont deverrouillees
  const encryptionStore = useEncryptionStore();

  // 2. Re-chiffrer la cle privee avec le nouveau mot de passe
  const { encryptedPrivateKey, salt } = await encryptionStore.reEncryptPrivateKey(newPassword);

  // 3. Envoyer au serveur: ancien MDP + nouveau MDP + nouvelle cle privee chiffree
  await api.put('/auth/profile/password', {
    currentPassword,
    newPassword,
    encryptedPrivateKey,
    encryptionSalt: salt,
  });

  // 4. Mettre a jour le sessionStorage
  await encryptionStore.unlockKeys(newPassword);
}
```

**Step 2: Ajouter reEncryptPrivateKey au store**

```typescript
async function reEncryptPrivateKey(newPassword: string): Promise<{ encryptedPrivateKey: string; salt: string }> {
  if (!privateKey.value) throw new Error('Keys not unlocked');
  const privateKeyJwk = await exportPrivateKey(privateKey.value);
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const saltB64 = btoa(String.fromCharCode(...salt));
  const newMasterKey = await deriveKey(newPassword, salt);
  const encrypted = await encryptPrivateKeyWithMasterKey(newMasterKey, privateKeyJwk);
  return { encryptedPrivateKey: encrypted, salt: saltB64 };
}
```

**Step 3: Modifier le controller serveur**

Dans `profileController.ts` `changePassword()`, accepter et sauvegarder:
```typescript
if (req.body.encryptedPrivateKey) {
  user.encryptionPrivateKey = req.body.encryptedPrivateKey;
  user.encryptionSalt = req.body.encryptionSalt;
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(encryption): re-encrypt RSA private key on password change"
```

---

### Task 9: Integration avec le systeme d'integrite (EvidenceRecord)

**Contexte:** Le hash d'integrite doit etre calcule sur le fichier en clair (cote client). La verification doit aussi se faire cote client: fetch blob chiffre → dechiffrer → recalculer SHA-256 → comparer.

**Files:**
- Modify: `server/src/controllers/evidenceController.ts` — adapter la verification
- Modify: `server/src/controllers/nodeController.ts` — utiliser le `plainHash` envoye par le client
- Modify: `client/src/components/evidence/EvidenceBadge.vue` (ou composant de verification) — verification cote client

**Step 1: Modifier uploadFile dans nodeController**

Utiliser `req.body.plainHash` comme `fileHash` au lieu de calculer le hash serveur:
```typescript
const fileHash = req.body.plainHash; // Hash du clair, calcule cote client
// Ne plus appeler computeFileHash() sur le fichier chiffre
```

**Step 2: Adapter la verification d'integrite**

La verification ne peut plus se faire cote serveur (le serveur n'a pas la cle). Deux options:
- Le serveur expose le blob chiffre, le client dechiffre et compare le hash
- On ajoute un endpoint `POST /api/evidence/:nodeId/verify` qui recoit le hash recalcule par le client

Approche recommandee: endpoint client-driven:
```typescript
// Client: fetch fichier chiffre → dechiffrer → hash → envoyer au serveur pour enregistrement
async function verifyIntegrity(nodeId: string, dossierId: string) {
  const node = await api.get(`/nodes/${nodeId}`);
  const { getDecryptedUrl } = useDecryptedFile();
  // Fetch et dechiffrer le fichier
  const response = await api.get(`/files/${filename}`, { responseType: 'arraybuffer' });
  const dossierKey = await encryptionStore.getDossierKey(dossierId);
  const decrypted = await decryptFile(dossierKey, response.data);
  const computedHash = await hashFile(decrypted);
  // Envoyer le resultat au serveur
  await api.post(`/evidence/${nodeId}/client-verify`, { computedHash });
}
```

**Step 3: Creer l'endpoint serveur client-verify**

```typescript
// server/src/controllers/evidenceController.ts
export async function clientVerifyIntegrity(req: AuthRequest, res: Response): Promise<void> {
  const { nodeId } = req.params;
  const { computedHash } = req.body;
  // ... lookup EvidenceRecord, compare hashes, push verification entry
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(encryption): client-side integrity verification for encrypted files"
```

---

### Task 10: Partage de dossiers — wrap/unwrap des cles

**Contexte:** Le systeme de partage existe deja dans `encryptionStore.shareDossierKey()`. Il faut s'assurer qu'il est integre au flow d'ajout de collaborateurs et que le chiffrement est toujours applique.

**Files:**
- Modify: `client/src/components/dossier/DossierInfo.vue` — wrapper la cle lors de l'ajout d'un collaborateur
- Modify: `client/src/stores/dossier.ts` — appeler shareDossierKey a l'ajout
- Verify: `server/src/controllers/encryptionController.ts` — s'assurer que storeDossierKey supporte l'ajout incrementiel

**Step 1: Modifier l'ajout de collaborateur**

Dans le flow qui ajoute un collaborateur a un dossier:
```typescript
// Apres ajout du collaborateur en DB
await encryptionStore.shareDossierKey(dossierId, newCollaboratorId);
```

**Step 2: Modifier le retrait de collaborateur**

Quand on retire un collaborateur, supprimer son `wrappedKey` du tableau `encryptionKeys`.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(encryption): integrate key sharing with collaborator management"
```

---

### Task 11: Indicateurs UI — Admin et Profil

**Contexte:** Ajouter des indicateurs visuels confirmant le statut du chiffrement dans l'admin et le profil utilisateur.

**Files:**
- Modify: `client/src/views/AdminView.vue` — section securite avec badge de statut
- Create: `client/src/components/admin/AdminEncryptionStatus.vue` — composant indicateur admin
- Modify: `client/src/components/profile/ProfileTemplate.vue` — indicateur dans le profil
- Modify: i18n files: `client/src/i18n/locales/fr.json`, `en.json`, `nl.json`

**Step 1: Creer AdminEncryptionStatus.vue**

```vue
<template>
  <div class="encryption-status">
    <div class="status-card" :class="allEncrypted ? 'status-ok' : 'status-warn'">
      <v-icon :color="allEncrypted ? 'success' : 'warning'" size="24">
        {{ allEncrypted ? 'mdi-shield-lock' : 'mdi-shield-alert' }}
      </v-icon>
      <div>
        <h4>{{ $t('admin.encryption.title') }}</h4>
        <p v-if="allEncrypted">{{ $t('admin.encryption.allEncrypted') }}</p>
        <p v-else>{{ $t('admin.encryption.someUnencrypted', { count: unencryptedCount }) }}</p>
      </div>
    </div>
  </div>
</template>
```

**Step 2: Ajouter un indicateur dans ProfileTemplate.vue**

Ajouter une section "Securite des donnees" avec:
- Badge vert: "Vos fichiers sont chiffres de bout en bout"
- "Seul vous et les membres autorises de vos dossiers peuvent les lire"

**Step 3: Ajouter les cles i18n**

```json
{
  "admin": {
    "encryption": {
      "title": "Chiffrement des fichiers",
      "allEncrypted": "Tous les fichiers sont chiffres et illisibles sur le serveur",
      "someUnencrypted": "{count} fichier(s) non chiffre(s) detecte(s)"
    }
  },
  "profile": {
    "encryption": {
      "title": "Securite des donnees",
      "status": "Vos fichiers sont chiffres de bout en bout",
      "details": "Seul vous et les membres autorises de vos dossiers peuvent les lire"
    }
  }
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(encryption): add encryption status indicators in admin and profile"
```

---

### Task 12: Migration des donnees existantes

**Contexte:** L'app est en developpement, seul l'admin a des dossiers reels. La migration:
1. Genere les cles RSA pour les utilisateurs existants (au prochain login)
2. Chiffre tous les fichiers existants
3. Chiffre tous les contenus (TipTap, Excalidraw, mapData, mediaData)
4. Deplace les fichiers branding existants vers `uploads/branding/`

**Files:**
- Create: `client/src/components/admin/MigrationWizard.vue` — wizard de migration cote client
- Modify: `server/src/controllers/settingsController.ts` — endpoint pour lister les fichiers non chiffres

**Step 1: Creer un endpoint de scan**

```typescript
// GET /api/admin/encryption/scan
// Retourne le nombre de fichiers/contenus non chiffres
export async function scanEncryptionStatus(req: AuthRequest, res: Response) {
  const unencryptedNodes = await DossierNode.countDocuments({
    content: { $ne: null, $not: /^ENC:/ },
    deletedAt: null,
  });
  const unencryptedFiles = await DossierNode.countDocuments({
    fileUrl: { $ne: null, $not: /\.enc$/ },
    deletedAt: null,
  });
  res.json({ unencryptedNodes, unencryptedFiles });
}
```

**Step 2: Creer le composant MigrationWizard**

Le wizard:
1. Scanne les fichiers non chiffres via l'API
2. Pour chaque dossier de l'admin: genere une cle AES, wrap avec sa cle publique RSA
3. Pour chaque fichier non chiffre: fetch → dechiffre (clair) → re-chiffre → re-upload
4. Pour chaque contenu non chiffre: fetch → chiffre → save
5. Deplace les fichiers branding
6. Affiche la progression

**Step 3: Deplacer les fichiers branding existants**

Creer un endpoint serveur pour deplacer les fichiers references dans SiteSettings vers `uploads/branding/`:
```typescript
// POST /api/admin/encryption/migrate-branding
// Deplace logoPath, faviconPath, loginBackgroundPath vers uploads/branding/
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(encryption): add migration wizard for existing data"
```

---

### Task 13: Mise a jour HelpView et nettoyage final

**Contexte:** Mettre a jour la page d'aide, nettoyer le code mort (ancien toggle encryption), et tester.

**Files:**
- Modify: `client/src/views/HelpView.vue` — documenter le chiffrement
- Modify: `client/src/stores/dossier.ts` — supprimer le code conditionnel `isEncrypted`
- Modify: `client/src/components/dossier/DossierInfo.vue` — supprimer le toggle encryption si present
- Verify: compilation TypeScript (`vue-tsc --noEmit` et `tsc --noEmit`)

**Step 1: Ajouter dans HelpView.vue**

Section sur le chiffrement zero-knowledge:
- Les fichiers sont chiffres avant d'etre envoyes au serveur
- Seuls les membres autorises du dossier peuvent les lire
- Meme l'administrateur du serveur ne peut pas acceder aux donnees
- Le mot de passe est la cle — ne jamais le perdre

**Step 2: Nettoyage du code mort**

- Supprimer les references a `isEncrypted` dans le store dossier et les composants
- Supprimer les boutons/UI de toggle encryption
- Supprimer `defaultEncryptionEnabled` dans SiteSettings si present

**Step 3: Verification TypeScript**

```bash
cd client && npx vue-tsc --noEmit
cd ../server && npx tsc --noEmit
```

**Step 4: Commit final**

```bash
git add -A
git commit -m "feat(encryption): update help view, cleanup dead encryption toggle code"
```
