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
