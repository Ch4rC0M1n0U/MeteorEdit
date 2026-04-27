# Phone Scanner — Design Document

**Date :** 2026-04-23
**Auteur :** Conception collaborative
**Statut :** APPROUVÉ — implémentation à suivre

## 1. Objectif

Ajouter un outil OSINT générique (modal ou page) accessible depuis le menu "Outils", permettant d'identifier des comptes actifs sur des plateformes liées à un numéro de téléphone, en commençant par WhatsApp. L'architecture doit être extensible (Telegram, Signal, Viber à terme).

## 2. Cas d'usage cible

L'enquêteur dispose d'un numéro complet ou partiel (ex. `+32 49? ??? 813`). Il :

1. Saisit le numéro avec masques optionnels
2. Sélectionne le pays (auto-détecté si possible)
3. Voit en temps réel le nombre de combinaisons générées + estimation de durée
4. Lance le scan, qui respecte les limites anti-ban
5. Obtient pour chaque numéro testé : statut (existe / inexistant / erreur), photo de profil, nom public, "about" / description, lien `wa.me`
6. Peut soit ouvrir le profil dans WhatsApp, soit ajouter le résultat comme **entité** dans le dossier courant
7. Consulte l'historique des scans précédents du dossier

## 3. Architecture

### 3.1 Méthode hybride A+B

Pour chaque numéro de la liste à scanner :

1. **Phase B (filtre rapide, sans ban)** :
   - Requête HEAD vers `https://wa.me/<num>` via Puppeteer headless ou fetch léger
   - Parsing de la page : si redirection vers le profil → numéro existe
   - Coût : ~2-5s par numéro, IP-bound
2. **Phase A (enrichissement, session WA)** :
   - Pour les numéros confirmés en B uniquement
   - Via `whatsapp-web.js` (session attachée à un compte dédié)
   - Récupération : photo de profil URL, nom public, "about"
   - Coût : ~30-90s par numéro avec délai aléatoire

### 3.2 Composants

**Frontend (Vue 3) :**

- `client/src/components/tools/PhoneScannerDialog.vue` — modal principale
- `client/src/components/tools/phoneScannerHelpers.ts` — utils (masques, génération combinaisons, formatage)
- `client/src/views/PhoneScannerView.vue` — page dédiée si on choisit une vue (sinon modal seulement)
- Entrée dans `AppSidebar.vue` `toolNavItems`

**Backend (Express + Mongo) :**

- `server/src/models/PhoneScan.ts` — modèle Mongo (job + résultats)
- `server/src/models/PhoneScanResult.ts` — résultat individuel par numéro (cache + historique)
- `server/src/models/PhoneScannerSettings.ts` — settings admin (limites, session WA active)
- `server/src/services/whatsappService.ts` — wrapper whatsapp-web.js singleton
- `server/src/services/phoneScannerQueue.ts` — file d'attente avec rate limiting
- `server/src/controllers/phoneScannerController.ts` — endpoints REST
- `server/src/routes/phoneScanner.ts` — routes

### 3.3 Modèle de données

```typescript
// PhoneScan : un job de scan global
interface PhoneScan {
  _id: ObjectId;
  dossierId: ObjectId;          // dossier de rattachement
  userId: ObjectId;              // qui a lancé
  pattern: string;               // ex. '+32 49? ??? 813'
  countryCode: string;           // ISO-2 ('BE')
  totalCombinations: number;
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  platforms: string[];           // ['whatsapp'] pour MVP
  progress: { tested: number; found: number; errors: number };
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

// PhoneScanResult : un résultat unitaire
interface PhoneScanResult {
  _id: ObjectId;
  scanId: ObjectId;
  dossierId: ObjectId;
  phoneE164: string;             // +32490223813
  platform: string;              // 'whatsapp'
  status: 'exists' | 'not_found' | 'error' | 'rate_limited';
  profile?: {
    name?: string;
    about?: string;
    avatarUrl?: string;
    isBusiness?: boolean;
  };
  errorMessage?: string;
  testedAt: Date;
}

// PhoneScannerSettings : config admin (singleton)
interface PhoneScannerSettings {
  maxDailyChecks: number;        // défaut 50
  minDelayMs: number;            // défaut 45000
  maxDelayMs: number;            // défaut 90000
  combinationsWarnThreshold: number;  // 50
  combinationsBlockThreshold: number; // 200
  whatsappSession?: {
    isActive: boolean;
    pairedAt?: Date;
    accountInfo?: { phone?: string; name?: string };
  };
  dailyCounter: { date: string; count: number }; // reset auto
}
```

### 3.4 Endpoints REST

```
POST   /api/phone-scanner/scans          → créer un scan (preview = dryRun: true)
GET    /api/phone-scanner/scans/:id      → état + progression
GET    /api/phone-scanner/scans/:id/results → résultats
DELETE /api/phone-scanner/scans/:id      → annuler un scan en cours
GET    /api/phone-scanner/dossiers/:id/history → historique par dossier
POST   /api/phone-scanner/results/:id/to-entity → créer entité dans dossier

# Admin
GET    /api/phone-scanner/admin/settings
PUT    /api/phone-scanner/admin/settings
POST   /api/phone-scanner/admin/whatsapp/pair      → init QR
GET    /api/phone-scanner/admin/whatsapp/qr        → flux SSE QR code
DELETE /api/phone-scanner/admin/whatsapp/session   → logout session
```

### 3.5 Flux d'extraction

```
[Frontend modal]
  ├─ Préparation : génère combinaisons côté client (preview)
  ├─ POST /scans → backend valide + crée job en DB
  └─ Connexion Socket.io room `scan:<id>` pour updates live

[Backend queue]
  ├─ Pour chaque numéro :
  │   ├─ Phase B (wa.me) → HEAD request, parse response
  │   ├─ Si exists, Phase A → whatsapp-web.js → getProfilePicUrl + getStatus
  │   ├─ Délai aléatoire gaussien minDelay..maxDelay
  │   ├─ Insert PhoneScanResult
  │   ├─ Increment dailyCounter
  │   ├─ Emit `scan:progress` via Socket.io
  │   └─ Si dailyCounter >= max → pause job (status: rate_limited)
  └─ Audit : logActivity('phone-scanner.scan.complete', {...})
```

### 3.6 Génération de combinaisons

Masques supportés : `?` (1 chiffre 0-9), `*` (déjà existant : refusé pour éviter explosion combinatoire).

Exemple : `+32 49? ??? 81?` → 10 × 10 × 10 × 10 = **10 000 combinaisons → bloqué** (au-dessus du seuil 200).

```typescript
function expandPattern(pattern: string): string[] {
  const masks = pattern.match(/\?/g)?.length ?? 0;
  if (masks === 0) return [pattern];
  if (Math.pow(10, masks) > 200) {
    throw new Error('Too many combinations');
  }
  // génération récursive...
}
```

UI :
- 0-49 combinaisons : bandeau vert "Prêt à scanner"
- 50-199 : bandeau orange "⚠ Beaucoup de combinaisons (X), durée estimée Y minutes"
- ≥200 : bandeau rouge bloquant "Réduisez le nombre de chiffres inconnus"

### 3.7 Anti-ban

**Mesures impératives :**

1. Hard cap quotidien (50/jour défaut)
2. Délai aléatoire 45-90s entre Phase A
3. Pause auto si erreur 429 / `BlockedReason`
4. Mode "stealth" : pas de bursts, pas de lookups parallèles sur le même compte
5. Logs détaillés dans `ActivityLog` pour audit

**Bonnes pratiques** (documentées dans HelpView) :
- Compte WA dédié (jamais le compte personnel de l'enquêteur)
- Numéro WA jetable / SIM dédiée
- Surveiller les codes d'erreur, arrêter au premier signe de blocage

### 3.8 UI résultats

Grille responsive 1-3 colonnes selon largeur :

```
┌─────────────────────────────┐
│ ┌───┐  +32 490 22 38 13     │
│ │📷 │  Roudy SERT            │
│ └───┘  "Available."          │
│        🟢 Compte actif       │
│  [Ouvrir WA] [+ Au dossier]  │
└─────────────────────────────┘
```

Filtres : tous / actifs / inactifs / erreurs.
Tri : par numéro, par date, par statut.

### 3.9 Création d'entité

Bouton "+ Au dossier" sur un résultat → ouvre dialog :
- Sélection dossier (par défaut : dossier courant)
- Type d'entité : `phone` (préselectionné), modifiable
- Nom : auto-rempli avec le nom du profil ou le numéro formaté
- Description : auto-rempli avec le `about` + meta scan
- Photo : import auto depuis avatarUrl

→ POST `/api/dossiers/:id/entities` (existant)
→ Audit : `logActivity('entity.create-from-scan', ...)`

## 4. Risques et mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Ban du compte WA dédié | Service indisponible | Hard cap journalier + délais + audit + procédure de re-pairing documentée |
| WhatsApp change l'API web | Break du scanner | Utiliser whatsapp-web.js qui a une communauté active + fallback Phase B seule |
| Faux positifs Phase B | Résultats erronés | Marquer "à confirmer" si Phase A échoue |
| Numéros incomplets : explosion | Surcharge serveur | Hard cap 200 combinaisons côté frontend + revalidation backend |
| Données sensibles persistées | RGPD | TTL configurable sur les résultats (défaut 30 jours), purge admin |

## 5. Stack technique

**Nouvelles dépendances backend :**
- `whatsapp-web.js` (^1.31)
- `qrcode-terminal` (dev) ou QR généré côté client
- `libphonenumber-js` (côté serveur si pas déjà présent — vérifier)

**Réutilisé :**
- `puppeteer-core` (déjà installé) pour Phase B
- `socket.io` (déjà installé) pour progression live
- `@iconify/vue` + `socialIconMap` (déjà en place)

## 6. Internationalisation

Toutes les chaînes UI via `vue-i18n` dans les 3 locales (fr/en/nl). Clés sous `phoneScanner.*`.

## 7. Audit & RGPD

Chaque événement est loggé via `logActivity()` avec userAgent :

- `phone-scanner.scan.start`
- `phone-scanner.scan.complete`
- `phone-scanner.scan.cancel`
- `phone-scanner.entity.create`
- `phone-scanner.session.pair`
- `phone-scanner.session.logout`
- `phone-scanner.settings.update`

## 8. Out-of-scope (V1)

- Telegram / Signal / Viber (architecture extensible mais non implémentés)
- Multi-session (1 seule session WA)
- Scan en parallèle de plusieurs jobs (queue séquentielle)
- Export PDF/DOCX dédié des résultats
