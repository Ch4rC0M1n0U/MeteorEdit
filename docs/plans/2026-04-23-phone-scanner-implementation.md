# Phone Scanner Implementation Plan

> **For Claude:** Suivre task-by-task, commits fréquents.

**Goal :** Construire un outil OSINT de scan de numéros de téléphone (WhatsApp en V1, extensible) avec UI modal/page, backend rate-limité, persistance par dossier, et création d'entités automatique.

**Architecture :** Frontend Vue 3 dans menu Outils → API Express → Service WhatsApp singleton (whatsapp-web.js) avec queue rate-limitée + Phase B (Puppeteer wa.me) → MongoDB pour scans/résultats/settings.

**Tech Stack :** Vue 3 + PrimeVue + Pinia + Socket.io (frontend), Express 5 + Mongoose 9 + whatsapp-web.js + Puppeteer-core + libphonenumber-js (backend).

**Reference :** `docs/plans/2026-04-23-phone-scanner-design.md`

---

## Phase 0 — Préparation

### Task 0.1 : Vérifier dépendances + ajouter whatsapp-web.js

**Files:**
- Modify: `server/package.json`
- Modify: `client/package.json` (vérifier libphonenumber-js)

**Steps:**
1. `cd server && npm i whatsapp-web.js@^1.31 libphonenumber-js@^1.11`
2. Vérifier dans `client/package.json` que `libphonenumber-js` est présent (sinon `cd client && npm i libphonenumber-js`)
3. Commit : `chore(deps): add whatsapp-web.js + libphonenumber-js`

---

## Phase 1 — Backend foundation

### Task 1.1 : Modèle PhoneScannerSettings (singleton)

**Files:**
- Create: `server/src/models/PhoneScannerSettings.ts`

**Schema :**
```typescript
{
  maxDailyChecks: { type: Number, default: 50 },
  minDelayMs: { type: Number, default: 45000 },
  maxDelayMs: { type: Number, default: 90000 },
  combinationsWarnThreshold: { type: Number, default: 50 },
  combinationsBlockThreshold: { type: Number, default: 200 },
  resultsTtlDays: { type: Number, default: 30 },
  whatsappSession: {
    isActive: { type: Boolean, default: false },
    pairedAt: Date,
    accountInfo: { phone: String, name: String }
  },
  dailyCounter: {
    date: { type: String, default: '' }, // YYYY-MM-DD
    count: { type: Number, default: 0 }
  }
}
```

**Test :** créer doc, recharger, vérifier defaults.

### Task 1.2 : Modèles PhoneScan + PhoneScanResult

**Files:**
- Create: `server/src/models/PhoneScan.ts`
- Create: `server/src/models/PhoneScanResult.ts`

Voir design doc §3.3.

**Index :**
- `PhoneScan` : `dossierId + createdAt desc`, `status`
- `PhoneScanResult` : `scanId`, `phoneE164 + platform` (unique cache), `dossierId + testedAt`

### Task 1.3 : Helpers — expansion masques + validation

**Files:**
- Create: `server/src/services/phoneScannerHelpers.ts`

**Fonctions :**
- `expandPattern(pattern: string, maxCombinations: number): string[]` — génère toutes les combinaisons
- `validateE164(phone: string, defaultCountry?: string): { isValid, e164, country, type }` (utilise libphonenumber-js)
- `formatE164(phone: string): string`

**Tests unitaires** (Vitest) :
- `expandPattern('+32490223813', 200)` → `['+32490223813']`
- `expandPattern('+3249?22381?', 200)` → 100 combinaisons
- `expandPattern('+32?????????', 200)` → throw `TooManyCombinations`
- `validateE164('+32490223813', 'BE').isValid === true`
- `validateE164('1234', 'BE').isValid === false`

### Task 1.4 : Service WhatsApp singleton (squelette)

**Files:**
- Create: `server/src/services/whatsappService.ts`

**API publique :**
```typescript
export const whatsappService = {
  initialize(): Promise<void>;
  pairNewSession(): EventEmitter; // emits 'qr', 'ready', 'auth_failure'
  isReady(): boolean;
  getSessionInfo(): { phone?: string; name?: string } | null;
  destroy(): Promise<void>;

  // Lookups
  checkNumberExists(phoneE164: string): Promise<boolean>;
  getProfile(phoneE164: string): Promise<{ name?: string; about?: string; avatarUrl?: string; isBusiness?: boolean } | null>;
};
```

**Implémentation :**
- Lazy init au premier appel
- LocalAuth avec dossier `server/.wwebjs_auth`
- Exposer events via EventEmitter

**Tests :** mocker whatsapp-web.js pour ne pas pairer en CI.

### Task 1.5 : Service Phase B (Puppeteer wa.me)

**Files:**
- Create: `server/src/services/waMeService.ts`

**API :**
```typescript
export async function checkWaMe(phoneE164: string): Promise<'exists' | 'not_found' | 'error'>;
```

**Détection :**
- GET `https://wa.me/<phone>` headless
- Si page contient `Open chat` ou redirect vers profile → `exists`
- Si page d'erreur "Phone number shared via url is invalid" → `not_found`
- Sinon `error`

**Pool Puppeteer :** instance unique réutilisée, fermée après 5 min d'inactivité.

### Task 1.6 : Queue rate-limitée

**Files:**
- Create: `server/src/services/phoneScannerQueue.ts`

**Comportement :**
- Singleton avec `Map<scanId, JobState>`
- Méthode `enqueue(scan: PhoneScan)` lance le job
- Pour chaque numéro :
  - Check `dailyCounter` ; si dépassé → status = rate_limited, abort
  - Phase B → si exists, Phase A
  - Insert PhoneScanResult
  - Emit Socket.io `scan:<id>:progress`
  - Random delay (gaussien) `minDelayMs..maxDelayMs`
- Cancel possible via `cancel(scanId)`

**Tests :** queue avec 3 numéros mockés, vérifier ordre + delays respectés (avec fake timers).

---

## Phase 2 — Backend API

### Task 2.1 : Controller + routes utilisateur

**Files:**
- Create: `server/src/controllers/phoneScannerController.ts`
- Create: `server/src/routes/phoneScanner.ts`
- Modify: `server/src/index.ts` (mount route)

**Endpoints utilisateur :**
- `POST /api/phone-scanner/scans` body: `{ dossierId, pattern, countryCode, platforms, dryRun? }`
  - Validation pattern + nombre de combinaisons
  - Si `dryRun: true` → renvoie `{ totalCombinations, estimatedDurationMs, warnLevel }`
  - Sinon → crée PhoneScan + enqueue + renvoie `{ scanId }`
- `GET /api/phone-scanner/scans/:id`
- `GET /api/phone-scanner/scans/:id/results?status=&platform=`
- `DELETE /api/phone-scanner/scans/:id` → cancel
- `GET /api/phone-scanner/dossiers/:id/history?limit=20`
- `POST /api/phone-scanner/results/:id/to-entity` body: `{ dossierId?, customName?, customDescription? }` → crée DossierEntity, renvoie `{ entityId }`

Toutes les routes sont protégées par `authMiddleware`. Vérifier que le user a accès au dossier.

Audit : `logActivity()` à chaque action.

### Task 2.2 : Routes admin

**Files:**
- Modify: `server/src/controllers/phoneScannerController.ts`
- Modify: `server/src/routes/phoneScanner.ts`

**Endpoints admin (`requireAdmin`) :**
- `GET /api/phone-scanner/admin/settings`
- `PUT /api/phone-scanner/admin/settings`
- `POST /api/phone-scanner/admin/whatsapp/pair` → init Whatsapp pairing, renvoie `{ status: 'awaiting_qr' }`
- `GET /api/phone-scanner/admin/whatsapp/qr` (SSE) → stream du QR code base64
- `DELETE /api/phone-scanner/admin/whatsapp/session`
- `GET /api/phone-scanner/admin/stats` → daily counter, sessions, scans actifs

### Task 2.3 : Socket.io rooms

**Files:**
- Modify: `server/src/services/phoneScannerQueue.ts` (emit events)
- Doc: événements `scan:<id>:progress`, `scan:<id>:complete`, `scan:<id>:error`

**Côté client :** `client/src/stores/phoneScanner.ts` → join room sur création scan, leave à la complétion.

---

## Phase 3 — Frontend modal scanner

### Task 3.1 : Helpers frontend

**Files:**
- Create: `client/src/components/tools/phoneScannerHelpers.ts`

**Fonctions :**
- `previewCombinations(pattern: string): { count: number; warnLevel: 'ok' | 'warn' | 'block' }`
- `formatPhonePreview(pattern: string, country: string): string`
- `estimateDurationMs(count: number, settings): number`
- `getCountryListWithFlags(): { code: string; name: string; dialCode: string; flag: string }[]`

### Task 3.2 : Composant PhoneScannerDialog.vue (UI saisie)

**Files:**
- Create: `client/src/components/tools/PhoneScannerDialog.vue`

**Structure :**
- PrimeVue Dialog plein écran
- Section 1 : "Numéro à scanner"
  - Sélecteur pays (Dropdown avec drapeau via `SocialIcon` / `flag-icons`)
  - Input avec masque `?` accepté
  - Live preview : nombre de combinaisons + bandeau ok/warn/block
  - Sélection plateformes (checkbox groupe : `whatsapp` activé, `telegram`, `signal` désactivés "bientôt")
- Section 2 : "Lancer le scan"
  - Bouton "Estimer" (dryRun) → affiche durée
  - Bouton "Lancer" disabled si block
- Section 3 : "Résultats live"
  - Progress bar global
  - Grille de cartes résultats (composant `PhoneScanResultCard.vue`)
  - Filtres + tri

### Task 3.3 : Composant PhoneScanResultCard.vue

**Files:**
- Create: `client/src/components/tools/PhoneScanResultCard.vue`

**Props :** `result: PhoneScanResult`

**UI :**
- Card avec photo / numéro formaté / nom / about / badge statut
- Boutons :
  - "Ouvrir WhatsApp" → `window.open('https://wa.me/' + numWithoutPlus)`
  - "+ Au dossier" → ouvre dialog création entité

### Task 3.4 : Dialog création entité depuis résultat

**Files:**
- Create: `client/src/components/tools/AddResultToDossierDialog.vue`

Ré-utilise les composants entité existants. POST vers `/api/phone-scanner/results/:id/to-entity`.

### Task 3.5 : Store Pinia

**Files:**
- Create: `client/src/stores/phoneScanner.ts`

**State :**
- `currentScan: PhoneScan | null`
- `results: PhoneScanResult[]`
- `history: PhoneScan[]`

**Actions :**
- `previewScan(pattern, country, platforms)`
- `startScan(...)` → ouvre socket room
- `cancelScan(id)`
- `loadHistory(dossierId)`
- `createEntityFromResult(resultId)`

### Task 3.6 : Onglet historique

**Files:**
- Modify: `PhoneScannerDialog.vue` (ajouter TabView)

**Tab "Historique du dossier" :**
- Liste des scans précédents avec date + pattern + nb résultats
- Click → expand pour voir les résultats anciens
- Bouton "Relancer ce scan"

### Task 3.7 : Intégration dans la sidebar Outils

**Files:**
- Modify: `client/src/components/common/AppSidebar.vue`
- Modify: `client/src/i18n/locales/fr.json` + `en.json` + `nl.json`

**Ajouter :**
```typescript
{ key: 'phone-scanner', icon: 'pi pi-search-plus', label: t('nav.phoneScanner'), to: '/tools/phone-scanner' }
```

**Route :**
- Modify: `client/src/router/index.ts` → route `/tools/phone-scanner` → `PhoneScannerView.vue` qui ouvre la modal

OU plus simple : bouton qui ouvre la modal directement depuis n'importe quelle page (pas de route dédiée).

→ **Choix :** route dédiée pour deeplink + permettre ouverture sans dossier sélectionné.

---

## Phase 4 — Admin UI

### Task 4.1 : Page admin Phone Scanner

**Files:**
- Create: `client/src/components/admin/AdminPhoneScanner.vue`
- Modify: `client/src/views/AdminView.vue` (ajouter section sidebar)

**Sections :**
1. **Settings** : éditer maxDailyChecks, minDelay, maxDelay, thresholds, TTL
2. **Session WhatsApp** :
   - Si pas de session : bouton "Pairer un compte"
   - Modal pairing avec QR live (via SSE ou polling)
   - Si session : info compte + bouton "Déconnecter"
3. **Stats** : compteur quotidien, scans 24h, top dossiers

### Task 4.2 : Composant pairing QR

**Files:**
- Create: `client/src/components/admin/WhatsappPairingDialog.vue`

**Flow :**
- Click "Pairer" → POST `/api/phone-scanner/admin/whatsapp/pair`
- EventSource `/api/phone-scanner/admin/whatsapp/qr` → reçoit base64 QR
- Affiche QR + instructions
- Sur event `ready` → ferme dialog, refresh état

---

## Phase 5 — i18n + docs

### Task 5.1 : Traductions

**Files:**
- Modify: `client/src/i18n/locales/fr.json`
- Modify: `client/src/i18n/locales/en.json`
- Modify: `client/src/i18n/locales/nl.json`

**Clés à ajouter** sous `phoneScanner.*` :
- title, subtitle, country, pattern, patternHelp, combinations, estimate, launch, cancel
- warnLevels.ok, .warn, .block
- platforms.whatsapp, .telegram (disabled tooltip)
- result.exists, .notFound, .error, .openInPlatform, .addToDossier
- history.title, .empty
- admin.settings.*, admin.session.*, admin.stats.*

⚠ **Échapper** tout `@` avec `{'@'}` (rappel CLAUDE.md).

### Task 5.2 : Documentation HelpView

**Files:**
- Modify: `client/src/views/HelpView.vue`

Section "Phone Scanner" :
- Comment ça marche (Phase A+B)
- Bonnes pratiques anti-ban
- Setup compte WhatsApp dédié (procédure)
- Limites quotidiennes par défaut

---

## Phase 6 — Tests + finitions

### Task 6.1 : Tests d'intégration backend

**Files:**
- Create: `server/src/__tests__/phoneScanner.test.ts`

Couvrir :
- expansion combinaisons OK
- expansion > seuil → 400
- création scan dryRun renvoie estimation
- création scan réelle enqueue + crée DB
- scan annulable
- création entité depuis résultat avec photo

### Task 6.2 : Tests E2E (Playwright)

**Files:**
- Create: `tests/e2e/phone-scanner.spec.ts`

Scenarios :
- Login → tools → phone scanner → saisir numéro complet → scan dryRun → voit l'estimation
- Lancer scan mock → voit progression
- Click "+ Au dossier" sur résultat → entité créée

(Mock WhatsApp service côté test pour éviter calls réels.)

### Task 6.3 : Bump version + changelog

**Files:**
- Modify: `package.json`, `client/package.json`, `server/package.json` → 3.12.0
- Modify: `server/src/controllers/setupController.ts` → version
- Modify: `server/src/index.ts` → ajouter entrée changelog 3.12.0

**Entrée changelog 3.12.0 :**
- feature: Phone Scanner — outil OSINT de détection de comptes WhatsApp à partir d'un numéro complet ou partiel, avec génération automatique d'entités
- feature: Génération de combinaisons à partir de masques (?) avec seuils anti-explosion
- feature: Session WhatsApp paireable depuis l'admin avec scan QR
- feature: Rate limiting configurable + audit complet anti-ban

---

## Phase 7 — Déploiement

### Task 7.1 : Variables d'environnement Coolify

Ajouter dans `.env.example` + Coolify :
- `WA_AUTH_PATH=/app/server/.wwebjs_auth` (volume persistant)
- `WA_HEADLESS=true`

Volume Docker pour persister `.wwebjs_auth` entre redéploiements.

### Task 7.2 : Healthcheck WhatsApp

**Files:**
- Modify: `server/src/index.ts` ou healthcheck endpoint

Si session WA active mais service crashed → marquer `isActive: false`.

### Task 7.3 : Push + déploiement

```bash
git push origin master
# Coolify deploy via API
```

Vérifier post-déploiement :
- Volume `.wwebjs_auth` monté
- Modal accessible depuis `/tools/phone-scanner`
- Admin → pairing fonctionne

---

## Ordre d'exécution recommandé

1. Phase 0 (deps)
2. Phase 1 backend (modèles + services + queue)
3. Phase 2 API
4. Phase 3 frontend modal (sans admin pairing)
5. Phase 4 admin (pairing UI)
6. Phase 5 i18n + docs
7. Phase 6 tests
8. Phase 7 déploiement

Commits fréquents (1 par task minimum). Push à chaque fin de phase.

## Hors scope (futur)

- Telegram lookup (architecture déjà extensible)
- Multi-session WhatsApp
- Scan parallèle multi-jobs
- Export PDF/DOCX dédié des résultats
- Vue cartographique des résultats par pays
