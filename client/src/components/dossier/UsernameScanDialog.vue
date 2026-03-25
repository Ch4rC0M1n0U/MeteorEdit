<template>
  <v-dialog v-model="model" max-width="620" persistent>
    <div class="us-dialog glass-card">
      <div class="us-header">
        <v-icon size="20" class="us-header-icon">mdi-account-search-outline</v-icon>
        <span class="mono">{{ t('dossier.scanTitle') }}</span>
        <button class="us-close" @click="close" :disabled="scanning">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <div class="us-body">
        <!-- Input -->
        <div class="us-input-section">
          <label class="us-label">{{ t('dossier.scanUsernameLabel') }}</label>
          <div class="us-input-row">
            <input
              v-model="username"
              class="us-input"
              :placeholder="t('dossier.scanUsernamePlaceholder')"
              :disabled="scanning"
              @keyup.enter="startScan"
            />
            <button class="us-scan-btn" @click="startScan" :disabled="!username.trim() || scanning">
              <v-icon v-if="scanning" size="14" class="me-spin">mdi-loading</v-icon>
              <v-icon v-else size="14">mdi-magnify</v-icon>
              {{ scanning ? t('dossier.scanScanning') : t('dossier.scanStart') }}
            </button>
          </div>
        </div>

        <!-- Progress -->
        <div v-if="scanning || results.length > 0" class="us-progress">
          <div class="us-progress-bar">
            <div class="us-progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <span class="us-progress-text mono">
            {{ scannedCount }} / {{ totalPlatforms }}
            <span v-if="foundCount > 0" class="us-found-badge">{{ foundCount }} {{ t('dossier.scanFound') }}</span>
          </span>
        </div>

        <!-- Results -->
        <div v-if="results.length > 0" class="us-results">
          <div v-for="r in results" :key="r.platform" class="us-result" :class="{ 'us-result--found': r.found, 'us-result--notfound': !r.found }">
            <span class="us-result-emoji">{{ r.emoji }}</span>
            <span class="us-result-label">{{ r.label }}</span>
            <span v-if="r.found && r.displayName" class="us-result-name">{{ r.displayName }}</span>
            <span class="us-result-status">
              <v-icon v-if="r.found" size="14" color="#4caf50">mdi-check-circle</v-icon>
              <v-icon v-else size="14" color="var(--me-text-muted)">mdi-close-circle-outline</v-icon>
            </span>
          </div>
        </div>

        <!-- Scanning indicator -->
        <div v-if="currentPlatform && scanning" class="us-current">
          <v-icon size="14" class="me-spin">mdi-loading</v-icon>
          {{ currentPlatform }}...
        </div>

        <!-- Done message -->
        <div v-if="done && !scanning" class="us-done">
          <v-icon size="16" color="#4caf50">mdi-check-circle</v-icon>
          {{ t('dossier.scanDone', { found: foundCount, total: totalPlatforms }) }}
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDossierStore } from '../../stores/dossier';
import { SERVER_URL } from '../../services/api';

const { t } = useI18n();
const model = defineModel<boolean>({ default: false });
const dossierStore = useDossierStore();

const username = ref('');
const scanning = ref(false);
const done = ref(false);
const currentPlatform = ref('');
const totalPlatforms = ref(0);
const scannedCount = ref(0);
const foundCount = ref(0);

interface ScanResult {
  platform: string; label: string; emoji: string; found: boolean;
  displayName?: string; bio?: string; url?: string;
}

const results = ref<ScanResult[]>([]);

const progressPercent = computed(() => totalPlatforms.value > 0 ? (scannedCount.value / totalPlatforms.value) * 100 : 0);

function close() {
  if (!scanning.value) model.value = false;
}

async function startScan() {
  if (!username.value.trim() || !dossierStore.currentDossier || scanning.value) return;

  scanning.value = true;
  done.value = false;
  results.value = [];
  scannedCount.value = 0;
  foundCount.value = 0;
  currentPlatform.value = '';

  const token = localStorage.getItem('accessToken');
  const parentId = dossierStore.selectedNode?.type === 'folder' ? dossierStore.selectedNode._id : undefined;

  try {
    const response = await fetch(`${SERVER_URL}/api/social/scan-username`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        username: username.value.trim(),
        dossierId: dossierStore.currentDossier._id,
        parentId,
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'start') {
            totalPlatforms.value = data.total;
          } else if (data.type === 'scanning') {
            currentPlatform.value = `${data.emoji} ${data.label}`;
          } else if (data.type === 'result') {
            scannedCount.value = data.index + 1;
            currentPlatform.value = '';
            results.value.push({
              platform: data.platform,
              label: data.label,
              emoji: data.emoji,
              found: data.found,
              displayName: data.displayName,
              bio: data.bio,
              url: data.url,
            });
            if (data.found) foundCount.value++;
          } else if (data.type === 'done') {
            done.value = true;
            // Refresh nodes if profiles were found
            if (data.folderId) {
              const { data: nodes } = await (await import('../../services/api')).default.get(`/dossiers/${dossierStore.currentDossier!._id}/nodes`);
              dossierStore.nodes = nodes;
            }
          } else if (data.type === 'error') {
            console.error('Scan error:', data.message);
          }
        } catch { /* skip malformed SSE */ }
      }
    }
  } catch (err) {
    console.error('Scan failed:', err);
  } finally {
    scanning.value = false;
    currentPlatform.value = '';
  }
}
</script>

<style scoped>
.us-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.us-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.us-header-icon { color: var(--me-accent); }
.us-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; }
.us-close:hover { color: var(--me-text-primary); }
.us-body { padding: 16px 18px; max-height: 520px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }

.us-label { font-size: 12px; font-weight: 600; color: var(--me-text-secondary); margin-bottom: 6px; display: block; }
.us-input-row { display: flex; gap: 8px; }
.us-input { flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--me-border); background: var(--me-bg-deep); color: var(--me-text-primary); font-size: 14px; font-family: var(--me-font-mono); outline: none; }
.us-input:focus { border-color: var(--me-accent); }
.us-scan-btn { display: flex; align-items: center; gap: 4px; padding: 8px 16px; border-radius: 6px; border: none; background: var(--me-accent); color: white; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.us-scan-btn:hover:not(:disabled) { filter: brightness(1.1); }
.us-scan-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.us-progress { display: flex; flex-direction: column; gap: 4px; }
.us-progress-bar { height: 4px; border-radius: 2px; background: var(--me-border); overflow: hidden; }
.us-progress-fill { height: 100%; background: var(--me-accent); transition: width 0.3s ease; border-radius: 2px; }
.us-progress-text { font-size: 11px; color: var(--me-text-muted); display: flex; align-items: center; gap: 8px; }
.us-found-badge { color: #4caf50; font-weight: 600; }

.us-results { display: flex; flex-direction: column; gap: 3px; }
.us-result { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; font-size: 13px; }
.us-result--found { background: rgba(76, 175, 80, 0.06); }
.us-result--notfound { opacity: 0.5; }
.us-result-emoji { font-size: 14px; width: 20px; text-align: center; }
.us-result-label { font-weight: 500; color: var(--me-text-primary); min-width: 90px; }
.us-result-name { flex: 1; color: var(--me-text-secondary); font-size: 12px; }
.us-result-status { margin-left: auto; }

.us-current { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--me-accent); }
.us-done { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #4caf50; font-weight: 500; padding: 8px 0; }
</style>
