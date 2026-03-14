<template>
  <div class="admin-encryption">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-shield-lock-outline</v-icon>
        {{ $t('admin.encryption.title') }}
      </h2>
    </div>

    <div class="enc-status-card glass-card fade-in fade-in-delay-1 enc-status--active">
      <v-icon color="success" size="32">mdi-shield-check</v-icon>
      <div class="enc-status-info">
        <h3 class="enc-status-text">{{ $t('admin.encryption.allEncrypted') }}</h3>
        <p class="enc-status-detail">{{ $t('admin.encryption.allEncryptedDetail') }}</p>
      </div>
    </div>

    <div class="enc-info-cards fade-in fade-in-delay-2">
      <div class="enc-info-card glass-card">
        <v-icon size="20" color="primary">mdi-key-variant</v-icon>
        <div>
          <h4 class="enc-info-title mono">{{ $t('admin.encryption.algorithm') }}</h4>
          <p class="enc-info-value">RSA-OAEP 4096 + AES-256-GCM</p>
        </div>
      </div>
      <div class="enc-info-card glass-card">
        <v-icon size="20" color="primary">mdi-lock-outline</v-icon>
        <div>
          <h4 class="enc-info-title mono">{{ $t('admin.encryption.keyDerivation') }}</h4>
          <p class="enc-info-value">PBKDF2 SHA-256 (600 000 iterations)</p>
        </div>
      </div>
      <div class="enc-info-card glass-card">
        <v-icon size="20" color="primary">mdi-eye-off-outline</v-icon>
        <div>
          <h4 class="enc-info-title mono">{{ $t('admin.encryption.zeroKnowledge') }}</h4>
          <p class="enc-info-value">{{ $t('admin.encryption.zeroKnowledgeDesc') }}</p>
        </div>
      </div>
    </div>

    <!-- Scan & Migration Section -->
    <div class="enc-scan-section fade-in fade-in-delay-3">
      <h3 class="enc-scan-title mono">
        <v-icon size="18" class="mr-2">mdi-magnify-scan</v-icon>
        {{ $t('admin.encryption.scanTitle') }}
      </h3>

      <div class="enc-scan-actions">
        <button class="me-btn me-btn--outline" :disabled="scanning" @click="runScan">
          <v-icon size="16" class="mr-1">mdi-radar</v-icon>
          {{ scanning ? $t('admin.encryption.scanning') : $t('admin.encryption.scanBtn') }}
        </button>
        <button class="me-btn me-btn--outline" :disabled="migrating" @click="runBrandingMigration">
          <v-icon size="16" class="mr-1">mdi-folder-move-outline</v-icon>
          {{ migrating ? $t('admin.encryption.migrating') : $t('admin.encryption.migrateBrandingBtn') }}
        </button>
      </div>

      <div v-if="scanResult" class="enc-scan-results">
        <div class="enc-scan-card glass-card">
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
        </div>
        <div class="enc-scan-card glass-card">
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

      <div v-if="migrateResult !== null" class="enc-migrate-result glass-card">
        <v-icon size="18" :color="migrateResult > 0 ? 'success' : 'info'">
          {{ migrateResult > 0 ? 'mdi-check-circle' : 'mdi-information-outline' }}
        </v-icon>
        <span>{{ $t('admin.encryption.migrateResult', { count: migrateResult }) }}</span>
      </div>

      <p class="enc-scan-note">{{ $t('admin.encryption.autoEncryptNote') }}</p>
    </div>

    <!-- File Migration Section -->
    <div class="enc-migrate-section fade-in fade-in-delay-3">
      <h3 class="enc-scan-title mono">
        <v-icon size="18" class="mr-2">mdi-file-lock-outline</v-icon>
        {{ $t('admin.encryption.migrateFilesTitle') }}
      </h3>
      <p class="enc-migrate-desc">{{ $t('admin.encryption.migrateFilesDesc') }}</p>

      <div class="enc-scan-actions">
        <button
          class="me-btn me-btn--primary"
          :disabled="fileMigrationRunning"
          @click="runFileMigration"
        >
          <v-icon size="16" class="mr-1">mdi-lock-plus-outline</v-icon>
          {{ fileMigrationRunning ? $t('admin.encryption.migrateFilesRunning') : $t('admin.encryption.migrateFilesBtn') }}
        </button>
      </div>

      <!-- Progress -->
      <div v-if="fileMigrationRunning || fileMigrationDone" class="enc-migrate-progress glass-card">
        <div class="enc-migrate-progress-header">
          <span class="enc-migrate-progress-label">
            {{ $t('admin.encryption.migrateFilesProgress', { current: fileMigrationCurrent, total: fileMigrationTotal }) }}
          </span>
          <span v-if="fileMigrationRunning" class="enc-migrate-progress-phase">
            {{ fileMigrationPhase }}
          </span>
        </div>
        <div class="enc-migrate-progress-bar">
          <div
            class="enc-migrate-progress-fill"
            :style="{ width: fileMigrationPercent + '%' }"
          ></div>
        </div>

        <!-- Completion -->
        <div v-if="fileMigrationDone" class="enc-migrate-done">
          <v-icon size="18" color="success" class="mr-1">mdi-check-circle</v-icon>
          <span>{{ $t('admin.encryption.migrateFilesDone', { files: fileMigrationStats.files, content: fileMigrationStats.content }) }}</span>
        </div>

        <!-- Errors -->
        <div v-if="fileMigrationErrors.length > 0" class="enc-migrate-errors">
          <div class="enc-migrate-errors-title">
            <v-icon size="16" color="warning" class="mr-1">mdi-alert-outline</v-icon>
            {{ $t('admin.encryption.migrateFilesErrors', { count: fileMigrationErrors.length }) }}
          </div>
          <ul class="enc-migrate-errors-list">
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
  if (!encryptionStore.isUnlocked) {
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

    fileMigrationTotal.value = files.length + contentNodes.length;

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
        const response = await fetch(SERVER_URL + node.fileUrl, {
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

        if (fullNode.content && !fullNode.content.startsWith('"ENC:')) {
          const { encryptContent } = await import('../../utils/encryption');
          update.content = '"ENC:' + await encryptContent(fullNode.content, key) + '"';
        }

        if (fullNode.excalidrawData) {
          const { encryptContent } = await import('../../utils/encryption');
          update.excalidrawData = 'ENC:' + await encryptContent(fullNode.excalidrawData, key);
        }

        if (fullNode.mapData) {
          const { encryptContent } = await import('../../utils/encryption');
          update.mapData = 'ENC:' + await encryptContent(fullNode.mapData, key);
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

.enc-status-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  margin-bottom: 20px;
  border-left: 3px solid var(--me-accent);
}
.enc-status--active {
  border-left-color: #4caf50;
}
.enc-status-info {
  flex: 1;
}
.enc-status-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin: 0 0 4px;
}
.enc-status-detail {
  font-size: 13px;
  color: var(--me-text-muted);
  margin: 0;
}

.enc-info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}
.enc-info-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
}
.enc-info-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--me-text-muted);
  margin: 0 0 4px;
}
.enc-info-value {
  font-size: 13px;
  color: var(--me-text-primary);
  margin: 0;
}

.enc-scan-section {
  margin-top: 8px;
}
.enc-scan-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.enc-scan-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.enc-scan-results {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.enc-scan-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.enc-scan-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.enc-scan-label {
  font-size: 13px;
  color: var(--me-text-secondary);
}
.enc-scan-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--me-text-primary);
  font-family: var(--me-font-mono);
}
.enc-scan-value--warn {
  color: #ff9800;
}
.enc-scan-value--ok {
  color: #4caf50;
}
.enc-migrate-result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--me-text-primary);
}
.enc-scan-note {
  font-size: 12px;
  color: var(--me-text-muted);
  font-style: italic;
  margin: 0;
}

/* File Migration Section */
.enc-migrate-section {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid var(--me-border);
}
.enc-migrate-desc {
  font-size: 13px;
  color: var(--me-text-secondary);
  margin: 0 0 16px;
  line-height: 1.5;
}
.enc-migrate-progress {
  padding: 16px;
  margin-bottom: 16px;
}
.enc-migrate-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.enc-migrate-progress-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
  font-family: var(--me-font-mono);
}
.enc-migrate-progress-phase {
  font-size: 12px;
  color: var(--me-text-muted);
}
.enc-migrate-progress-bar {
  height: 6px;
  background: var(--me-bg-secondary);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 12px;
}
.enc-migrate-progress-fill {
  height: 100%;
  background: var(--me-accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.enc-migrate-done {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #4caf50;
  font-weight: 600;
  margin-top: 8px;
}
.enc-migrate-errors {
  margin-top: 12px;
  padding: 12px;
  background: rgba(255, 152, 0, 0.08);
  border-radius: 6px;
  border: 1px solid rgba(255, 152, 0, 0.2);
}
.enc-migrate-errors-title {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: #ff9800;
  margin-bottom: 8px;
}
.enc-migrate-errors-list {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 12px;
  color: var(--me-text-secondary);
}
.enc-migrate-errors-list li {
  padding: 3px 0;
}
.enc-migrate-errors-list li strong {
  color: var(--me-text-primary);
}
</style>
