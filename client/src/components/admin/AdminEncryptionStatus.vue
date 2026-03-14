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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t } = useI18n();

interface ScanResult {
  unencryptedContentNodes: number;
  unencryptedFileNodes: number;
  unencryptedDossiers: number;
  totalNodes: number;
  totalDossiers: number;
}

const scanning = ref(false);
const migrating = ref(false);
const scanResult = ref<ScanResult | null>(null);
const migrateResult = ref<number | null>(null);

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
</style>
