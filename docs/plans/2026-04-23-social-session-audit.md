# Audit : SocialSessionManager

**Date** : 2026-04-27
**Perimetre** : frontend SSM, routes /api/social/*, modele SocialCookie, consommateurs aval

---

## 1. Vue densemble

AppBar (user menu)
  -> Dialog > SocialSessionManager.vue
        - GET  /api/social/cookies            -> liste statuts par plateforme
        - POST /api/social/login/:platform    -> login Puppeteer (5 min window)
        - POST /api/social/cookies/:p/import  -> import JSON Cookie-Editor
        - DELETE /api/social/cookies/:p       -> suppression
        - POST /api/social/bridge-token       -> jeton extension (non appele depuis SSM)

server/src/routes/social.ts monte sur /api/social dans index.ts (ligne 145)
  -> socialAuthController.ts
        - SocialCookie (MongoDB, chiffre AES via cookieCrypto)
        - exportCookiesFile() helper interne (non expose via route HTTP)

Consommateurs aval :
  mediaController.ts     -> exportCookiesFile() -> Netscape .txt -> yt-dlp --cookies
  downloadController.ts  -> idem via import dynamique
  scrapeController.ts    -> SocialCookie.findOne() -> decryptCookies() -> page.setCookie()

---

## 2. Etat par plateforme

| Plateforme | SSM | Puppeteer | Import JSON | Import .txt | Scraper | Enum Model | enabledPlatforms |
|------------|:---:|:---------:|:-----------:|:-----------:|:-------:|:----------:|:----------------:|
| YouTube   | oui | OK  | OK  | OK (google.com)    | OK                | oui    | oui    |
| Instagram | oui | OK  | OK  | OK                 | OK                | oui    | oui    |
| TikTok    | oui | OK  | OK  | OK                 | OK                | oui    | oui    |
| Snapchat  | oui | OK  | OK  | OK                 | OK                | oui    | oui    |
| Facebook  | oui | OK  | OK  | OK                 | OK                | oui    | oui    |
| X         | oui | OK  | OK  | OK (x.com+twitter) | OK                | oui    | oui    |
| WhatsApp  | oui (openSite only) | ABSENT du SSM | OK | NON (domaine non detecte) | OK public wa.me | oui | oui |
| Threads   | oui | CASSE - enum Mongoose invalide | CASSE (enum) | NON | OK (scraper) | ABSENT | ABSENT |
| LinkedIn  | oui | CASSE - enum Mongoose invalide | CASSE (enum) | NON | OK (scraper) | ABSENT | ABSENT |
| Strava    | oui | CASSE - enum Mongoose invalide | CASSE (enum) | OK (strava.com) | OK (scraper) | ABSENT | oui |

---

## 3. Endpoints actifs vs morts

| Endpoint | Enregistre | Appele client | Appele serveur |
|----------|:----------:|:-------------:|:--------------:|
| POST /api/social/login/:platform          | oui | oui - SSM startLogin()                      | - |
| GET /api/social/cookies                   | oui | oui - SSM, MediaDownloader, ProfileAnalyzer | - |
| DELETE /api/social/cookies/:platform      | oui | oui - SSM doDisconnect()                    | - |
| POST /api/social/cookies/:platform/import | oui | oui - SSM doImportCookies()                 | - |
| POST /api/social/bridge-token             | oui | NON - aucun composant                       | - |
| POST /api/social/cookies-file             | oui | NON - aucun composant                       | - |
| POST /api/social/scrape-profile           | oui | oui - ProfileAnalyzer                       | - |
| POST /api/social/scan-username            | oui | oui - UsernameScanDialog                    | - |

Routes orphelines :
- POST /api/social/bridge-token : JWT pour extension navigateur, aucun bouton ne le declenche
- POST /api/social/cookies-file : parse Netscape .txt, aucun file picker dans UI

---

## 4. Consommateurs en aval

### scrapeController.ts - POST /api/social/scrape-profile
- Appele par ProfileAnalyzer.vue
- Lit SocialCookie.findOne({ userId, platform }) directement en Mongoose
- Appelle decryptCookies() puis page.setCookie() dans Puppeteer
- Verifie enabledPlatforms dans SiteSettings avant tout scrape
- WhatsApp : bypass explicite du check cookie cote client dans ProfileAnalyzer
  (detectedPlatform !== whatsapp), coherent avec scraping public via wa.me

### mediaController.ts et downloadController.ts
- Appellent exportCookiesFile(userId, platform) via import dynamique depuis socialAuthController
- Generent un fichier Netscape temporaire pour yt-dlp --cookies
- PLATFORM_PATTERNS detecte seulement YouTube, Instagram, TikTok, Snapchat, Facebook, X
- Strava, Threads, LinkedIn, WhatsApp absents de cette detection cote download

### MediaDownloader.vue
- Verifie /api/social/cookies et affiche un avertissement si pas de cookies
- Emet openSessionManager pour rediriger vers SSM
- Cet event nest pas cable dans le parent actuel (composant utilise hors AppBar)

---

## 5. Incoherences et code mort potentiel

### Desalignement critique : enum Mongoose vs plateformes declarees

SocialCookie.platform enum = [youtube, instagram, tiktok, snapchat, facebook, x, whatsapp]

PLATFORM_LOGIN_URLS dans socialAuthController inclut en plus : threads, linkedin, strava.
Resultat : le login Puppeteer capture les cookies correctement, mais findOneAndUpdate
upsert echoue en validation Mongoose. Pas d erreur remontee au client (500 silencieux).
Meme probleme pour importCookies et uploadCookiesFile sur ces trois plateformes.

### enabledPlatforms defaults incoherents
- Threads et LinkedIn : dans le SSM, absents des enabledPlatforms defaults
  => socialLogin() retourne 403 avant meme d ouvrir Puppeteer
- Strava : dans enabledPlatforms defaults mais absent de l enum du model => 500

### openSessionManager emit non cable
MediaDownloader.vue emet openSessionManager mais AppBar ne cable pas cet evenement.

### Bridge token sans UI
POST /api/social/bridge-token est documente Swagger, logue en audit trail,
mais aucun composant Vue ne le declenche. Code serveur complet sans surface frontend.

### uploadCookiesFile - domaines non detectes
Auto-detect ne couvre pas : threads.net, whatsapp.com, linkedin.com.

---

## 6. Verdict

### OK comme tel
- Pipeline complet pour YouTube, Instagram, TikTok, Snapchat, Facebook, X :
  login Puppeteer + import JSON + scraping + telechargement yt-dlp
- listCookies, deleteCookies : propres et fonctionnels
- Separation des vues dans SSM (list/import/login/disconnect) : coherente et maintenable

### Besoin de reactivation (lister quoi)
1. Ajouter threads, linkedin, strava a l enum de SocialCookie (modele Mongoose)
2. Ajouter threads, linkedin aux enabledPlatforms defaults dans SiteSettings
3. Completer l auto-detect de uploadCookiesFile pour threads.net et linkedin.com
4. Exposer une UI pour POST /api/social/cookies-file (file picker dans SSM)
5. Cabler openSessionManager dans le parent de MediaDownloader

### Refacto recommandee (pourquoi)
- Le bouton Open site de WhatsApp dans le SSM ne mene a aucune action utile.
  web.whatsapp.com ne s apparie pas via cookies HTTP classiques.
  Le flow WhatsApp doit etre clairement separe des autres plateformes des l UI.

---

## 7. Recommandations pour le mode wa-web (QR pairing whatsapp-web.js)

Le mode wa-web repose sur whatsapp-web.js avec LocalAuth, pas sur des cookies HTTP.
SocialCookie est inadapte pour stocker une session WA Web.

### Cote serveur

1. Nouveau modele Mongoose WhatsappSession separe de SocialCookie :
   - userId, sessionData (string JSON LocalAuth)
   - status (pending | ready | disconnected), createdAt, updatedAt

2. Nouvelles routes dans social.ts (ou fichier dedie wa-web.ts) :
   - POST   /api/social/wa-web/init    -> instancie client, genere QR (base64 PNG)
   - GET    /api/social/wa-web/qr      -> retourne le QR courant
   - GET    /api/social/wa-web/status  -> retourne { status, phoneNumber }
   - DELETE /api/social/wa-web/session -> destroy et supprime la session

3. Le client whatsapp-web.js doit vivre dans un singleton par userId cote serveur
   (Map userId -> WAWebJS.Client). Un controller stateless n est pas viable ici.

### Cote client

4. Ajouter currentView === wa-web dans SocialSessionManager.vue uniquement pour
   la tuile WhatsApp. Ne pas reutiliser startLogin() (HTTP bloquant 5 min).

5. Afficher le QR via img :src avec polling sur /api/social/wa-web/status toutes les 2s
   ou SSE pour du temps reel propre.

6. fetchStatus() dans SSM : merger le statut wa-web dans connectedPlatforms
   avec platform whatsapp si status === ready.

### Ce qui ne change pas

- scraper whatsapp.ts existant (profils publics via wa.me) : intact, non modifie