# Zero-Knowledge File Encryption — Design Document

**Date:** 2026-03-14
**Statut:** Approuve
**Objectif:** Chiffrer tous les fichiers d'investigation cote client (zero-knowledge) pour qu'aucune personne ayant acces au serveur ne puisse lire les donnees.

---

## Probleme

Les fichiers uploades (images, documents, medias, captures) sont servis via `express.static` sans authentification. Toute personne ayant acces au serveur (admin, attaquant) peut lire les fichiers en clair. Cela compromet la confidentialite des investigations.

## Decisions cles

| Decision | Choix |
|----------|-------|
| Modele crypto | Zero-knowledge, chiffrement cote client |
| Cle maitre | Derivee du mot de passe utilisateur (PBKDF2) |
| Cle par dossier | AES-256-GCM, wrappee par RSA-OAEP 4096 de chaque membre |
| Partage | Hybrid RSA (wrap asynchrone via cle publique du destinataire) |
| Branding | Reste public (dossier `uploads/branding/` isole) |
| Integrite | Hash SHA-256 du fichier en clair, avant chiffrement |
| Migration | Script unique (app en dev, pas de retro-compatibilite) |
| Persistance cle session | sessionStorage (cle ephemere), survit au refresh, pas a la fermeture |
| Chiffrement | Obligatoire, pas d'option on/off |

---

## 1. Modele cryptographique

### Cle maitre utilisateur

- Au login, derivation d'une `masterKey` via **PBKDF2** (SHA-256, 600 000 iterations)
- Entree : mot de passe + `keySalt` (stocke en DB sur User)
- La `masterKey` ne quitte jamais le navigateur
- Stockee en **sessionStorage** (chiffree par une cle ephemere) pour survivre aux refresh
- Effacee a la fermeture de l'onglet

### Paire RSA par utilisateur

- Generation RSA-OAEP 4096 cote client a la creation du compte
- `User.publicKey` : stockee en clair en DB (cle publique)
- `User.encryptedPrivateKey` : cle privee chiffree avec la `masterKey` (AES-256-GCM)
- `User.keySalt` : salt PBKDF2 (32 octets aleatoires)

### Cle AES par dossier

- A la creation d'un dossier : generation d'une cle AES-256-GCM aleatoire cote client
- Wrappee (RSA-OAEP) avec la cle publique du createur
- Stockee dans `Dossier.encryptedKeys: [{ userId, wrappedKey }]`

### Chiffrement des fichiers

- Avant upload : le client chiffre avec la cle AES du dossier
- Format du blob : `IV (12 octets) + ciphertext + auth tag (16 octets)`
- Le hash d'integrite est calcule sur le fichier **en clair** avant chiffrement
- Le serveur ne recoit que du binaire opaque

---

## 2. Architecture serveur

### Routes fichiers

- **Suppression** de `app.use('/uploads', express.static(...))` pour les fichiers d'investigation
- **Nouvelle route** `GET /api/files/:fileId` : authentifiee, verifie l'acces au dossier, stream le blob `.enc`
- **Branding** : `uploads/branding/` reste servi en statique public (logo, favicon, fond login)

### Stockage disque

- Fichiers chiffres avec extension `.enc` (ex: `abc123.enc`)
- Content-Type original stocke en DB pour le renvoyer au client
- Pas de listing possible (pas de `express.static` sur les fichiers d'investigation)

### Modifications DB

**User :**
```
+ publicKey: String           // Cle publique RSA (PEM/JWK)
+ encryptedPrivateKey: String // Cle privee chiffree par masterKey
+ keySalt: String             // Salt PBKDF2 (base64)
```

**Dossier :**
```
+ encryptedKeys: [{           // Une entree par membre
    userId: ObjectId,
    wrappedKey: String         // Cle AES wrappee par RSA publique du membre
  }]
- encryptionEnabled           // Supprime (toujours actif)
```

**DossierNode :**
```
+ encryptedContent: String    // Contenu TipTap/Excalidraw/mapData chiffre
+ contentIV: String           // IV du contenu chiffre
- content                     // Supprime (remplace par encryptedContent)
```

---

## 3. Flux client

### Login (un seul mot de passe)

1. Saisie mot de passe → derivation `masterKey` (PBKDF2)
2. Dechiffrement cle privee RSA
3. Stockage en sessionStorage (cle ephemere) → survit au refresh
4. Aucune re-saisie tant que l'onglet est ouvert

### Ouverture dossier

1. Recuperation du `wrappedKey` pour l'userId courant
2. Unwrap avec la cle privee RSA → cle AES du dossier en memoire
3. Dechiffrement automatique de tous les contenus et fichiers

### Upload fichier

1. Lecture fichier → SHA-256 (hash integrite sur le clair)
2. Generation IV aleatoire (12 octets)
3. Chiffrement AES-256-GCM avec la cle du dossier
4. Upload du blob `IV + ciphertext` + metadonnees (nom, Content-Type, taille, hash)

### Affichage image/media

1. Fetch `GET /api/files/:fileId` → blob chiffre
2. Dechiffrement en memoire → `URL.createObjectURL(decryptedBlob)`
3. Liberation de l'Object URL au `onBeforeUnmount`

### Sauvegarde contenu (TipTap, Excalidraw, etc.)

1. Serialisation JSON → chiffrement AES-256-GCM
2. Envoi comme `encryptedContent` + `contentIV`
3. Images inline referencent des `fileId` au lieu d'URLs directes

---

## 4. Partage de dossiers

### Invitation

1. Le proprietaire invite un utilisateur
2. Le client recupere la `publicKey` du destinataire via l'API
3. Wrap la cle AES du dossier avec cette cle publique RSA
4. Envoi du `wrappedKey` → ajoute dans `dossier.encryptedKeys[]`
5. **Asynchrone** : le destinataire n'a pas besoin d'etre connecte

### Retrait d'acces

- Suppression du `wrappedKey` du tableau
- L'utilisateur ne peut plus dechiffrer
- Pas de re-chiffrement des fichiers (evolution future possible)

---

## 5. Integrite (EvidenceRecord)

- `fileHash` = SHA-256 du fichier **en clair** (calcule cote client avant chiffrement)
- Verification : fetch blob chiffre → dechiffrer → recalculer SHA-256 → comparer avec `originalHash`
- La verification est **cote client** (zero-knowledge : le serveur n'a pas la cle)

---

## 6. Changement de mot de passe

1. Derivation nouvelle `masterKey` avec le nouveau mot de passe
2. Dechiffrement de la cle privee RSA avec l'ancienne `masterKey`
3. Re-chiffrement avec la nouvelle `masterKey`
4. Un seul appel API : `PUT /auth/change-password` avec le nouveau `encryptedPrivateKey` + nouveau `keySalt`
5. Aucun fichier ni cle de dossier a toucher

---

## 7. UI — Indicateurs de chiffrement

### Panneau Admin (AdminView)

- Section "Securite" avec indicateur :
  - Badge vert : "Tous les fichiers sont chiffres et illisibles sur le serveur"
  - Badge rouge : "X fichiers non chiffres" (si migration incomplete)

### Espace Utilisateur (ProfileTemplate)

- Section "Securite" avec indicateur confirmant :
  - "Vos fichiers sont chiffres de bout en bout"
  - "Seul vous et les membres autorises de vos dossiers peuvent les lire"

---

## 8. Migration (unique)

1. L'admin se connecte → script de migration cote client
2. Pour chaque dossier : generation cle AES, wrapping avec les cles publiques des membres
3. Pour chaque fichier en clair : lecture → chiffrement → reecriture en `.enc`
4. Pour chaque contenu (TipTap/Excalidraw/mapData/mediaData) : chiffrement
5. Suppression des anciens champs optionnels E2E du schema
6. Flag `SiteSettings.encryptionMigrated: true`

---

## 9. Ce qui ne change pas

- Copier-coller, export PDF/DOCX, drag & drop → tout fonctionne (contenu en clair en memoire)
- 2FA → independant de la crypto, valide l'identite
- Branding → reste public
- UX generale → aucun changement visible sauf l'indicateur de chiffrement
