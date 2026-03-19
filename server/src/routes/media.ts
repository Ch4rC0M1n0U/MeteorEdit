import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { fetchOembed, uploadMedia, captureFrame, captureEmbed, replaceCapture, replaceCaptureEncrypted, encryptMediaFile, deleteCapture, analyzeFile } from '../controllers/mediaController';
import { downloadVideo } from '../controllers/downloadController';
import { upload } from '../config/upload';

const router = Router();
router.use(authenticate);

router.post('/oembed', fetchOembed);
router.post('/upload', upload.single('file'), uploadMedia);
/**
 * @swagger
 * /api/media/download:
 *   post:
 *     tags: [Media]
 *     summary: Telecharger une video depuis un reseau social
 *     description: Lance yt-dlp pour telecharger une video depuis une URL sociale. La reponse utilise Server-Sent Events (SSE) pour envoyer la progression en temps reel. Les evenements SSE emis sont — `status` (fetching_metadata, downloading), `metadata` (titre, duree, thumbnail), `progress` (pourcentage, vitesse, ETA), `complete` (noeud cree), `error`. Les cookies stockes pour la plateforme sont utilises automatiquement. Un noeud media est cree dans le dossier a la fin du telechargement.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, dossierId]
 *             properties:
 *               url:
 *                 type: string
 *                 description: URL de la video a telecharger
 *               dossierId:
 *                 type: string
 *                 description: ID du dossier cible
 *               parentId:
 *                 type: string
 *                 description: ID du noeud parent (optionnel)
 *     responses:
 *       200:
 *         description: Flux SSE avec progression puis noeud media cree
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: "Evenements SSE — status, metadata, progress, complete, error"
 *       400:
 *         description: URL manquante ou plateforme non reconnue
 *       401:
 *         description: Non authentifie
 *       403:
 *         description: Acces refuse au dossier ou plateforme non activee
 *       429:
 *         description: Limite de telechargements simultanees atteinte
 *       500:
 *         description: Erreur lors du telechargement
 */
router.post('/download', downloadVideo);
router.post('/capture', captureFrame);
router.post('/capture-embed', captureEmbed);
router.post('/replace-capture', replaceCapture);
router.post('/replace-capture-encrypted', upload.single('file'), replaceCaptureEncrypted);
router.post('/encrypt-file', upload.single('file'), encryptMediaFile);
router.delete('/capture', deleteCapture);
/**
 * @swagger
 * /api/media/analyze:
 *   post:
 *     tags: [Media]
 *     summary: Analyse technique d'un fichier media
 *     description: Extrait les metadonnees EXIF, ffprobe et calcule le hash SHA256 d'un fichier uploade. Cree un noeud note avec le rapport d'analyse structure en TipTap (tableaux par categorie — appareil, localisation, dates, image/video, audio, fichier, logiciel).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nodeId, dossierId]
 *             properties:
 *               nodeId:
 *                 type: string
 *                 description: ID du noeud media source
 *               dossierId:
 *                 type: string
 *                 description: ID du dossier
 *     responses:
 *       200:
 *         description: Noeud d'analyse cree
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 nodeId:
 *                   type: string
 *                 title:
 *                   type: string
 *       400:
 *         description: Parametres manquants ou fichier chiffre
 *       404:
 *         description: Noeud ou fichier introuvable
 *       500:
 *         description: Erreur lors de l'analyse
 */
router.post('/analyze', analyzeFile);

export default router;
