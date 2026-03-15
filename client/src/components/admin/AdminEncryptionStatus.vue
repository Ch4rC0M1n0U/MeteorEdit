<template>
  <div class="admin-encryption">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-shield-lock-outline</v-icon>
        {{ $t('admin.encryption.title') }}
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.encryption.subtitle') }}</p>
    </div>

    <!-- Status Card -->
    <div class="enc-card glass-card fade-in fade-in-delay-1">
      <div class="enc-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-shield-check</v-icon>
        <h3 class="enc-card-title mono">{{ $t('admin.encryption.statusTitle') }}</h3>
      </div>
      <div class="enc-status-row">
        <v-icon color="success" size="28">mdi-check-circle</v-icon>
        <div class="enc-status-info">
          <p class="enc-status-text">{{ $t('admin.encryption.allEncrypted') }}</p>
          <p class="enc-status-detail">{{ $t('admin.encryption.allEncryptedDetail') }}</p>
        </div>
      </div>
    </div>

    <!-- Crypto Info Card -->
    <div class="enc-card glass-card fade-in fade-in-delay-1">
      <div class="enc-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-information-outline</v-icon>
        <h3 class="enc-card-title mono">{{ $t('admin.encryption.cryptoInfoTitle') }}</h3>
      </div>
      <div class="enc-info-row">
        <v-icon size="18" color="var(--me-text-muted)">mdi-key-variant</v-icon>
        <div>
          <p class="enc-info-label">{{ $t('admin.encryption.algorithm') }}</p>
          <p class="enc-info-value">RSA-OAEP 4096 + AES-256-GCM</p>
        </div>
      </div>
      <div class="enc-divider" />
      <div class="enc-info-row">
        <v-icon size="18" color="var(--me-text-muted)">mdi-lock-outline</v-icon>
        <div>
          <p class="enc-info-label">{{ $t('admin.encryption.keyDerivation') }}</p>
          <p class="enc-info-value">PBKDF2 SHA-256 (600 000 iterations)</p>
        </div>
      </div>
      <div class="enc-divider" />
      <div class="enc-info-row">
        <v-icon size="18" color="var(--me-text-muted)">mdi-eye-off-outline</v-icon>
        <div>
          <p class="enc-info-label">{{ $t('admin.encryption.zeroKnowledge') }}</p>
          <p class="enc-info-value">{{ $t('admin.encryption.zeroKnowledgeDesc') }}</p>
        </div>
      </div>
    </div>

    <!-- Scan & Branding Migration Card -->
    <div class="enc-card glass-card fade-in fade-in-delay-2">
      <div class="enc-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-magnify-scan</v-icon>
        <h3 class="enc-card-title mono">{{ $t('admin.encryption.scanTitle') }}</h3>
      </div>

      <div class="enc-actions">
        <button class="me-btn-ghost" :disabled="scanning" @click="runScan">
          <v-icon size="14" class="mr-1">mdi-radar</v-icon>
          {{ scanning ? $t('admin.encryption.scanning') : $t('admin.encryption.scanBtn') }}
        </button>
        <button class="me-btn-ghost" :disabled="migrating" @click="runBrandingMigration">
          <v-icon size="14" class="mr-1">mdi-folder-move-outline</v-icon>
          {{ migrating ? $t('admin.encryption.migrating') : $t('admin.encryption.migrateBrandingBtn') }}
        </button>
      </div>

      <div v-if="scanResult" class="enc-scan-results">
        <div class="enc-scan-grid">
          <div class="enc-scan-stat">
            <span class="enc-scan-label">{{ $t('admin.encryption.totalDossiers') }}</span>
            <span class="enc-scan-value">{{ scanResult.totalDossiers }}</span>
          </div>
          <div class="enc-scan-stat">
            <span class="enc-scan-label">{{ $t('admin.encryption.unencryptedDossiers') }}</span>
            <span :class="['enc-scan-value', scanResult.unencryptedDossiers > 0 ? 'enc-scan-value--warn' : 'enc-scan-value--ok']">
              {{ scanResult.unencryptedDossiers }}
            </span>
          </div>
          <div class="enc-scan-stat">
            <span class="enc-scan-label">{{ $t('admin.encryption.totalNodes') }}</span>
            <span class="enc-scan-value">{{ scanResult.totalNodes }}</span>
          </div>
          <div class="enc-scan-stat">
            <span class="enc-scan-label">{{ $t('admin.encryption.unencryptedContent') }}</span>
            <span :class="['enc-scan-value', scanResult.unencryptedContentNodes > 0 ? 'enc-scan-value--warn' : 'enc-scan-value--ok']">
              {{ scanResult.unencryptedContentNodes }}
            </span>
          </div>
          <div class="enc-scan-stat">
            <span class="enc-scan-label">{{ $t('admin.encryption.unencryptedFiles') }}</span>
            <span :class="['enc-scan-value', scanResult.unencryptedFileNodes > 0 ? 'enc-scan-value--warn' : 'enc-scan-value--ok']">
              {{ scanResult.unencryptedFileNodes }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="migrateResult !== null" class="enc-migrate-result">
        <v-icon size="16" :color="migrateResult > 0 ? 'success' : 'info'">
          {{ migrateResult > 0 ? 'mdi-check-circle' : 'mdi-information-outline' }}
        </v-icon>
        <span>{{ $t('admin.encryption.migrateResult', { count: migrateResult }) }}</span>
      </div>

      <p class="enc-note">{{ $t('admin.encryption.autoEncryptNote') }}</p>
    </div>

    <!-- File Migration Card -->
    <div class="enc-card glass-card fade-in fade-in-delay-2">
      <div class="enc-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-file-lock-outline</v-icon>
        <h3 class="enc-card-title mono">{{ $t('admin.encryption.migrateFilesTitle') }}</h3>
      </div>
      <p class="enc-desc">{{ $t('admin.encryption.migrateFilesDesc') }}</p>

      <!-- Warning if keys not unlocked -->
      <div v-if="keysNotUnlocked" class="enc-warning">
        <v-icon size="16" color="warning" class="mr-1">mdi-alert-outline</v-icon>
        <span>{{ $t('admin.encryption.keysNotUnlocked') }}</span>
      </div>

      <div class="enc-actions">
        <button
          class="me-btn-primary"
          :disabled="fileMigrationRunning"
          @click="runFileMigration"
        >
          <v-icon size="14" class="mr-1">mdi-lock-plus-outline</v-icon>
          {{ fileMigrationRunning ? $t('admin.encryption.migrateFilesRunning') : $t('admin.encryption.migrateFilesBtn') }}
        </button>
      </div>

      <!-- Progress -->
      <div v-if="fileMigrationRunning || fileMigrationDone" class="enc-progress">
        <div class="enc-progress-header">
          <span class="enc-progress-label">
            {{ $t('admin.encryption.migrateFilesProgress', { current: fileMigrationCurrent, total: fileMigrationTotal }) }}
          </span>
          <span v-if="fileMigrationRunning" class="enc-progress-phase">
            {{ fileMigrationPhase }}
          </span>
        </div>
        <div class="enc-progress-bar">
          <div
            class="enc-progress-fill"
            :style="{ width: fileMigrationPercent + '%' }"
          ></div>
        </div>

        <!-- Completion -->
        <div v-if="fileMigrationDone" class="enc-done">
          <v-icon size="16" color="success" class="mr-1">mdi-check-circle</v-icon>
          <span>{{ $t('admin.encryption.migrateFilesDone', { files: fileMigrationStats.files, content: fileMigrationStats.content }) }}</span>
        </div>

        <!-- Errors -->
        <div v-if="fileMigrationErrors.length > 0" class="enc-errors">
          <div class="enc-errors-title">
            <v-icon size="14" color="warning" class="mr-1">mdi-alert-outline</v-icon>
            {{ $t('admin.encryption.migrateFilesErrors', { count: fileMigrationErrors.length }) }}
          </div>
          <ul class="enc-errors-list">
            <li v-for="(err, i) in fileMigrationErrors" :key="i">
              <strong>{{ err.title || err.nodeId }}</strong>: {{ err.error }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api, { SERVER_URL } from '../../services/api';
import { useEncryptionStore } from '../../stores/encryption';
import { encryptFile, hashFile } from '../../utils/encryption';

const { t } = useI18n();
const encryptionStore = useEncryptionStore();

interface ScanResult {
  unencryptedContentNodes: number;
  unencryptedFileNodes: number;
  unencryptedDossiers: number;
  totalNodes: number;
  totalDossiers: number;
}

interface UnencryptedFileNode {
  _id: string;
  dossierId: string;
  title: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  type: string;
}

interface UnencryptedContentNode {
  _id: string;
  dossierId: string;
  title: string;
  type: string;
}

interface MigrationError {
  nodeId: string;
  title: string;
  error: string;
}

const scanning = ref(false);
const migrating = ref(false);
const scanResult = ref<ScanResult | null>(null);
const migrateResult = ref<number | null>(null);
const keysNotUnlocked = ref(false);

// File migration state
const fileMigrationRunning = ref(false);
const fileMigrationDone = ref(false);
const fileMigrationCurrent = ref(0);
const fileMigrationTotal = ref(0);
const fileMigrationPhase = ref('');
const fileMigrationErrors = ref<MigrationError[]>([]);
const fileMigrationStats = ref({ files: 0, content: 0 });

const fileMigrationPercent = ref(0);

async function runScan() {
  scanning.value = true;
  try {
    const { data } = await api.get('/admin/encryption/scan');
    scanResult.value = data;
  } catch {
    // silent
  } finally {
    scanning.value = false;
  }
}

async function runBrandingMigration() {
  migrating.value = true;
  try {
    const { data } = await api.post('/admin/encryption/migrate-branding');
    migrateResult.value = data.migrated;
  } catch {
    // silent
  } finally {
    migrating.value = false;
  }
}

async function ensureDossierKey(dossierId: string) {
  let key = await encryptionStore.getDossierKey(dossierId);
  if (!key) {
    await encryptionStore.setupDossierEncryption(dossierId);
    key = await encryptionStore.getDossierKey(dossierId);
  }
  return key;
}

async function runFileMigration() {
  keysNotUnlocked.value = false;
  if (!encryptionStore.isUnlocked) {
    keysNotUnlocked.value = true;
    return;
  }

  fileMigrationRunning.value = true;
  fileMigrationDone.value = false;
  fileMigrationCurrent.value = 0;
  fileMigrationTotal.value = 0;
  fileMigrationPercent.value = 0;
  fileMigrationErrors.value = [];
  fileMigrationStats.value = { files: 0, content: 0 };

  try {
    // Phase 1: Migrate files
    fileMigrationPhase.value = t('admin.encryption.migratePhaseFiles');
    const { data: fileData } = await api.get('/admin/encryption/unencrypted-files');
    const files: UnencryptedFileNode[] = fileData.files;

    // Phase 2: Get unencrypted content
    const { data: contentData } = await api.get('/admin/encryption/unencrypted-content');
    const contentNodes: UnencryptedContentNode[] = contentData.contentNodes || [];

    // Phase 3: Get unencrypted dossier files (logo, documents, entity photos)
    const { data: dossierFileData } = await api.get('/admin/encryption/unencrypted-dossier-files');
    const dossierFiles: Array<{
      dossierId: string;
      dossierTitle: string;
      type: 'logo' | 'document' | 'entityPhoto';
      filePath: string;
      entityIndex?: number;
      photoIndex?: number;
      docId?: string;
    }> = dossierFileData.items || [];

    fileMigrationTotal.value = files.length + contentNodes.length + dossierFiles.length;

    // Migrate files
    for (const node of files) {
      try {
        const key = await ensureDossierKey(node.dossierId);
        if (!key) {
          fileMigrationErrors.value.push({
            nodeId: node._id,
            title: node.title || node._id,
            error: t('admin.encryption.migrateErrorNoKey'),
          });
          fileMigrationCurrent.value++;
          fileMigrationPercent.value = Math.round((fileMigrationCurrent.value / fileMigrationTotal.value) * 100);
          continue;
        }

        // Download the plaintext file
        const fileUrl = node.fileUrl.startsWith('/') ? node.fileUrl : '/' + node.fileUrl;
        const response = await fetch(SERVER_URL + fileUrl, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const plainBuffer = await response.arrayBuffer();

        // Compute hash of plaintext
        const plainHash = await hashFile(plainBuffer);

        // Encrypt
        const encryptedBuffer = await encryptFile(key, plainBuffer);
        const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
        const originalName = node.fileName || node.fileUrl.split('/').pop() || 'file';
        const encryptedFile = new File([encryptedBlob], originalName + '.enc', { type: 'application/octet-stream' });

        // Detect original content type from the file extension
        const ext = (node.fileName || node.fileUrl).split('.').pop()?.toLowerCase() || '';
        const mimeMap: Record<string, string> = {
          pdf: 'application/pdf',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
          svg: 'image/svg+xml',
          doc: 'application/msword',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          xls: 'application/vnd.ms-excel',
          xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          csv: 'text/csv',
          txt: 'text/plain',
          mp4: 'video/mp4',
          mp3: 'audio/mpeg',
          wav: 'audio/wav',
        };
        const originalContentType = mimeMap[ext] || 'application/octet-stream';

        // Upload encrypted version
        const formData = new FormData();
        formData.append('file', encryptedFile);
        formData.append('originalContentType', originalContentType);
        formData.append('originalFileSize', plainBuffer.byteLength.toString());
        formData.append('plainHash', plainHash);

        await api.post(`/admin/encryption/replace/${node._id}`, formData);
        fileMigrationStats.value.files++;
      } catch (err: any) {
        fileMigrationErrors.value.push({
          nodeId: node._id,
          title: node.title || node._id,
          error: err.message || String(err),
        });
      }
      fileMigrationCurrent.value++;
      fileMigrationPercent.value = Math.round((fileMigrationCurrent.value / fileMigrationTotal.value) * 100);
    }

    // Phase 2: Migrate content nodes (re-save triggers auto-encryption in dossier store)
    fileMigrationPhase.value = t('admin.encryption.migratePhaseContent');
    for (const node of contentNodes) {
      try {
        const key = await ensureDossierKey(node.dossierId);
        if (!key) {
          fileMigrationErrors.value.push({
            nodeId: node._id,
            title: node.title || node._id,
            error: t('admin.encryption.migrateErrorNoKey'),
          });
          fileMigrationCurrent.value++;
          fileMigrationPercent.value = Math.round((fileMigrationCurrent.value / fileMigrationTotal.value) * 100);
          continue;
        }

        // Fetch the full node
        const { data: fullNode } = await api.get(`/nodes/${node._id}`);

        // Build update payload - encrypt the fields that need it
        const update: Record<string, any> = {};

        const contentStr = typeof fullNode.content === 'string'
          ? fullNode.content
          : fullNode.content != null ? JSON.stringify(fullNode.content) : null;

        if (contentStr && !contentStr.startsWith('"ENC:') && !contentStr.startsWith('ENC:')) {
          const { encryptContent } = await import('../../utils/encryption');
          update.content = '"ENC:' + await encryptContent(contentStr, key) + '"';
        }

        const excalidrawStr = typeof fullNode.excalidrawData === 'string'
          ? fullNode.excalidrawData
          : fullNode.excalidrawData != null ? JSON.stringify(fullNode.excalidrawData) : null;

        if (excalidrawStr && !excalidrawStr.startsWith('ENC:')) {
          const { encryptContent } = await import('../../utils/encryption');
          update.excalidrawData = 'ENC:' + await encryptContent(excalidrawStr, key);
        }

        const mapStr = typeof fullNode.mapData === 'string'
          ? fullNode.mapData
          : fullNode.mapData != null ? JSON.stringify(fullNode.mapData) : null;

        if (mapStr && !mapStr.startsWith('ENC:')) {
          const { encryptContent } = await import('../../utils/encryption');
          update.mapData = 'ENC:' + await encryptContent(mapStr, key);
        }

        if (Object.keys(update).length > 0) {
          await api.put(`/nodes/${node._id}`, update);
          fileMigrationStats.value.content++;
        }
      } catch (err: any) {
        fileMigrationErrors.value.push({
          nodeId: node._id,
          title: node.title || node._id,
          error: err.message || String(err),
        });
      }
      fileMigrationCurrent.value++;
      fileMigrationPercent.value = Math.round((fileMigrationCurrent.value / fileMigrationTotal.value) * 100);
    }

    // Phase 3: Migrate dossier files (logo, linked documents, entity photos)
    fileMigrationPhase.value = t('admin.encryption.migratePhaseDossierFiles');
    for (const item of dossierFiles) {
      try {
        const key = await ensureDossierKey(item.dossierId);
        if (!key) {
          fileMigrationErrors.value.push({
            nodeId: item.dossierId,
            title: item.dossierTitle,
            error: t('admin.encryption.migrateErrorNoKey'),
          });
          fileMigrationCurrent.value++;
          fileMigrationPercent.value = Math.round((fileMigrationCurrent.value / fileMigrationTotal.value) * 100);
          continue;
        }

        // Download the plaintext file
        const filePath = item.filePath.startsWith('/') ? item.filePath : '/' + item.filePath;
        const response = await fetch(SERVER_URL + filePath, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const plainBuffer = await response.arrayBuffer();

        // Encrypt
        const encryptedBuffer = await encryptFile(key, plainBuffer);
        const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
        const originalName = item.filePath.split('/').pop() || 'file';
        const encryptedFile = new File([encryptedBlob], originalName + '.enc', { type: 'application/octet-stream' });

        // Upload encrypted version
        const formData = new FormData();
        formData.append('file', encryptedFile);
        formData.append('type', item.type);
        if (item.entityIndex != null) formData.append('entityIndex', item.entityIndex.toString());
        if (item.photoIndex != null) formData.append('photoIndex', item.photoIndex.toString());
        if (item.docId) formData.append('docId', item.docId);

        await api.post(`/admin/encryption/replace-dossier/${item.dossierId}`, formData);
        fileMigrationStats.value.files++;
      } catch (err: any) {
        fileMigrationErrors.value.push({
          nodeId: item.dossierId,
          title: `${item.dossierTitle} (${item.type})`,
          error: err.message || String(err),
        });
      }
      fileMigrationCurrent.value++;
      fileMigrationPercent.value = Math.round((fileMigrationCurrent.value / fileMigrationTotal.value) * 100);
    }

    fileMigrationDone.value = true;
  } catch (err: any) {
    fileMigrationErrors.value.push({
      nodeId: '',
      title: 'Global',
      error: err.message || String(err),
    });
  } finally {
    fileMigrationRunning.value = false;
    fileMigrationPercent.value = 100;
    // Refresh scan after migration
    runScan();
  }
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.admin-section-subtitle { font-size: 13px; color: var(--me-text-muted); margin-top: 4px; font-family: var(--me-font-mono); }

/* Card pattern (matches AdminSecurity / AdminBranding) */
.enc-card { padding: 20px; margin-bottom: 16px; }
.enc-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--me-border); }
.enc-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); }

/* Status row */
.enc-status-row { display: flex; align-items: center; gap: 14px; padding: 4px 0; }
.enc-status-info { flex: 1; }
.enc-status-text { font-size: 13px; font-weight: 600; color: var(--me-text-primary); margin: 0; }
.enc-status-detail { font-size: 12px; color: var(--me-text-muted); margin: 2px 0 0; }

/* Info rows */
.enc-info-row { display: flex; align-items: flex-start; gap: 12px; padding: 6px 0; }
.enc-info-label { font-size: 12px; color: var(--me-text-muted); margin: 0 0 2px; }
.enc-info-value { font-size: 13px; color: var(--me-text-primary); margin: 0; }
.enc-divider { height: 1px; background: var(--me-border); margin: 8px 0; opacity: 0.5; }

/* Actions */
.enc-actions { display: flex; gap: 10px; margin-bottom: 16px; }

/* Buttons (matches AdminBranding) */
.me-btn-ghost {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
}
.me-btn-ghost:hover {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
}
.me-btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.me-btn-primary {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.me-btn-primary:hover {
  box-shadow: 0 0 16px var(--me-accent-glow);
}
.me-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Scan results */
.enc-scan-results { margin-bottom: 16px; }
.enc-scan-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.enc-scan-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}
.enc-scan-label { font-size: 13px; color: var(--me-text-secondary); }
.enc-scan-value { font-size: 14px; font-weight: 600; color: var(--me-text-primary); font-family: var(--me-font-mono); }
.enc-scan-value--warn { color: #ff9800; }
.enc-scan-value--ok { color: #4caf50; }

/* Migrate result inline */
.enc-migrate-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
  color: var(--me-text-primary);
}

/* Note */
.enc-note { font-size: 12px; color: var(--me-text-muted); font-style: italic; margin: 0; }

/* Desc */
.enc-desc { font-size: 13px; color: var(--me-text-secondary); margin: 0 0 16px; line-height: 1.5; }

/* Progress */
.enc-progress {
  padding: 14px;
  margin-top: 4px;
  background: var(--me-bg-glass);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs);
}
.enc-progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.enc-progress-label { font-size: 13px; font-weight: 600; color: var(--me-text-primary); font-family: var(--me-font-mono); }
.enc-progress-phase { font-size: 12px; color: var(--me-text-muted); }
.enc-progress-bar { height: 6px; background: var(--me-bg-secondary); border-radius: 3px; overflow: hidden; margin-bottom: 10px; }
.enc-progress-fill { height: 100%; background: var(--me-accent); border-radius: 3px; transition: width 0.3s ease; }

/* Warning */
.enc-warning {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  margin-bottom: 14px;
  background: rgba(255, 152, 0, 0.08);
  border: 1px solid rgba(255, 152, 0, 0.2);
  border-radius: var(--me-radius-xs);
  font-size: 13px;
  color: #ff9800;
  font-weight: 500;
}

/* Done */
.enc-done { display: flex; align-items: center; font-size: 13px; color: #4caf50; font-weight: 600; margin-top: 6px; }

/* Errors */
.enc-errors {
  margin-top: 10px;
  padding: 12px;
  background: rgba(255, 152, 0, 0.08);
  border-radius: var(--me-radius-xs);
  border: 1px solid rgba(255, 152, 0, 0.2);
}
.enc-errors-title { display: flex; align-items: center; font-size: 13px; font-weight: 600; color: #ff9800; margin-bottom: 6px; }
.enc-errors-list { list-style: none; padding: 0; margin: 0; font-size: 12px; color: var(--me-text-secondary); }
.enc-errors-list li { padding: 3px 0; }
.enc-errors-list li strong { color: var(--me-text-primary); }

.mr-1 { margin-right: 4px; }
</style>
