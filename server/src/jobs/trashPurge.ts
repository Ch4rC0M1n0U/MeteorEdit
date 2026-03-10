import path from 'path';
import fs from 'fs';
import DossierNode from '../models/DossierNode';
import EvidenceRecord from '../models/EvidenceRecord';
import SiteSettings from '../models/SiteSettings';

const UPLOAD_DIR = path.resolve(__dirname, '..', '..', 'uploads');

async function cleanupNodeFiles(node: any): Promise<void> {
  if (node.fileUrl) {
    const filePath = path.resolve(UPLOAD_DIR, '..', node.fileUrl);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.warn(`[TrashPurge] Failed to delete file ${filePath}:`, err);
    }
  }
  await EvidenceRecord.deleteMany({ nodeId: node._id });
}

async function runTrashPurge(): Promise<void> {
  try {
    const settings = await SiteSettings.findOne();
    const days = settings?.trashAutoDeleteDays || 0;
    if (days <= 0) return; // Disabled

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const expiredNodes = await DossierNode.find({
      deletedAt: { $ne: null, $lte: cutoff },
    });

    if (!expiredNodes.length) return;

    // Cleanup files for each node
    for (const node of expiredNodes) {
      await cleanupNodeFiles(node);
    }

    // Delete all expired nodes
    const result = await DossierNode.deleteMany({
      deletedAt: { $ne: null, $lte: cutoff },
    });

    console.log(`[TrashPurge] Purged ${result.deletedCount} nodes older than ${days} days`);
  } catch (err) {
    console.error('[TrashPurge] Error:', err);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startTrashPurgeJob(): void {
  // Run once on startup
  runTrashPurge();

  // Then run every hour
  intervalId = setInterval(runTrashPurge, 60 * 60 * 1000);
  console.log('[TrashPurge] Job scheduled (every hour)');
}

export function stopTrashPurgeJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
