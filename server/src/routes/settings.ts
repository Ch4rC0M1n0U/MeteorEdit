import { Router } from 'express';
import { getBranding } from '../controllers/settingsController';
import { getMapboxToken } from '../controllers/pluginSettingsController';

const router = Router();

/**
 * @swagger
 * /api/settings/branding:
 *   get:
 *     tags: [Settings]
 *     summary: Obtenir les parametres de branding (public)
 *     description: Retourne les parametres du site (nom, logo, couleur, etc.). Aucune authentification requise.
 *     responses:
 *       200:
 *         description: Parametres du site
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteSettings'
 */
router.get('/branding', getBranding);

/**
 * @swagger
 * /api/settings/mapbox:
 *   get:
 *     tags: [Settings]
 *     summary: Obtenir la configuration Mapbox (public)
 *     description: Retourne la cle API et les parametres par defaut de Mapbox.
 *     responses:
 *       200:
 *         description: Configuration Mapbox
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 apiKey:
 *                   type: string
 *                 defaultStyle:
 *                   type: string
 *                 defaultCenter:
 *                   type: array
 *                   items:
 *                     type: number
 *                 defaultZoom:
 *                   type: number
 */
router.get('/mapbox', getMapboxToken);

export default router;
