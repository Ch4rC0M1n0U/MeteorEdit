import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getShodanStatus, shodanSearch, shodanHostInfo, shodanFilters, shodanDnsResolve, shodanDnsReverse, shodanExploits } from '../controllers/shodanController';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /api/shodan/status:
 *   get:
 *     tags: [Shodan]
 *     summary: Check Shodan availability and account info
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Shodan status
 */
router.get('/status', getShodanStatus);

/**
 * @swagger
 * /api/shodan/filters:
 *   get:
 *     tags: [Shodan]
 *     summary: Get predefined Shodan filter presets
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Filter presets
 */
router.get('/filters', shodanFilters);

/**
 * @swagger
 * /api/shodan/search:
 *   post:
 *     tags: [Shodan]
 *     summary: Search Shodan by geographic area
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng]
 *             properties:
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *               radius:
 *                 type: number
 *                 default: 5
 *               filters:
 *                 type: string
 *               page:
 *                 type: number
 *                 default: 1
 *     responses:
 *       200:
 *         description: Search results
 */
router.post('/search', shodanSearch);

/**
 * @swagger
 * /api/shodan/host/{ip}:
 *   get:
 *     tags: [Shodan]
 *     summary: Get detailed info about a specific host
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: ip
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Host details
 */
router.get('/host/:ip', shodanHostInfo);

/**
 * @swagger
 * /api/shodan/dns/resolve:
 *   get:
 *     tags: [Shodan]
 *     summary: Resolve hostnames to IPs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: hostnames
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated hostnames
 *     responses:
 *       200:
 *         description: IP resolution map
 */
router.get('/dns/resolve', shodanDnsResolve);

/**
 * @swagger
 * /api/shodan/dns/reverse:
 *   get:
 *     tags: [Shodan]
 *     summary: Reverse DNS lookup
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: ips
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Comma-separated IPs
 *     responses:
 *       200:
 *         description: Reverse DNS results
 */
router.get('/dns/reverse', shodanDnsReverse);

/**
 * @swagger
 * /api/shodan/exploits:
 *   get:
 *     tags: [Shodan]
 *     summary: Search for known exploits/CVEs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: query
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         schema:
 *           type: number
 *           default: 1
 *     responses:
 *       200:
 *         description: Exploit search results
 */
router.get('/exploits', shodanExploits);

export default router;
