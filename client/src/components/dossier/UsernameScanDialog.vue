<template>
  <Dialog v-model:visible="model" modal :style="{ width: '620px' }" :closable="false">
    <template #container>
    <div class="us-dialog glass-card">
      <div class="us-header">
        <span class="mdi mdi-radar us-header-icon" style="font-size: 20px;"></span>
        <span class="mono">{{ t('dossier.scanTitle') }}</span>
        <button class="us-close" @click="close" :disabled="scanning">
          <i class="pi pi-times" style="font-size: 18px;"></i>
        </button>
      </div>

      <div class="us-body">
        <!-- Input -->
        <div class="us-input-section">
          <label class="us-label">{{ t('dossier.scanInputLabel') }}</label>
          <input
            v-model="query"
            class="us-input"
            :placeholder="t('dossier.scanInputPlaceholder')"
            :disabled="scanning"
            @input="onInputChange"
            @keyup.enter="startScan"
          />
          <!-- Detected type -->
          <div v-if="detectedType && query.trim()" class="us-detected">
            <span :class="'mdi ' + typeIcon" style="font-size: 14px;"></span>
            <span>{{ t('dossier.scanDetected') }} : <strong>{{ t('dossier.scanType_' + detectedType) }}</strong></span>
            <!-- Override type -->
            <select v-model="overrideType" class="us-type-select">
              <option value="">{{ t('dossier.scanAutoDetect') }}</option>
              <option value="username">{{ t('dossier.scanType_username') }}</option>
              <option value="phone">{{ t('dossier.scanType_phone') }}</option>
              <option value="email">{{ t('dossier.scanType_email') }}</option>
              <option value="identity">{{ t('dossier.scanType_identity') }}</option>
              <option value="plate">{{ t('dossier.scanType_plate') }}</option>
              <option value="vin">{{ t('dossier.scanType_vin') }}</option>
            </select>
          </div>
        </div>

        <!-- Platforms for this type -->
        <div v-if="availablePlatforms.length > 0 && !scanning && results.length === 0" class="us-platforms">
          <div class="us-platforms-header">
            <span class="us-label">{{ t('dossier.scanPlatforms') }} ({{ selectedCount }}/{{ availablePlatforms.length }})</span>
            <button class="us-select-btn" @click="toggleAll">
              {{ allSelected ? t('common.deselectAll') : t('common.selectAll') }}
            </button>
          </div>
          <div class="us-platform-grid">
            <label v-for="p in availablePlatforms" :key="p.id" class="us-platform" :class="{ 'us-platform--on': platformSelection[p.id] }">
              <input type="checkbox" v-model="platformSelection[p.id]" class="us-check" />
              <span class="us-platform-emoji">{{ p.emoji }}</span>
              <span>{{ p.label }}</span>
            </label>
          </div>
        </div>

        <!-- Scan button -->
        <button v-if="!scanning && results.length === 0" class="us-scan-btn" @click="startScan" :disabled="!query.trim() || selectedCount === 0">
          <i class="pi pi-search" style="font-size: 14px;"></i>
          {{ t('dossier.scanStart') }} ({{ selectedCount }} {{ t('dossier.scanPlatforms').toLowerCase() }})
        </button>

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

        <!-- Current scanning -->
        <div v-if="currentPlatform && scanning" class="us-current">
          <span class="mdi mdi-loading me-spin" style="font-size: 14px;"></span>
          {{ currentPlatform }}...
        </div>

        <!-- Results -->
        <div v-if="results.length > 0" class="us-results">
          <div v-for="r in sortedResults" :key="r.platform" class="us-result" :class="{ 'us-result--found': r.found, 'us-result--notfound': !r.found }">
            <span class="us-result-emoji">{{ r.emoji }}</span>
            <span class="us-result-label">{{ r.label }}</span>
            <span v-if="r.found && r.displayName" class="us-result-name">{{ r.displayName }}</span>
            <span class="us-result-status">
              <i v-if="r.found" class="pi pi-check-circle" style="font-size: 14px; color: #4caf50;"></i>
              <span v-else class="mdi mdi-close-circle-outline" style="font-size: 14px; color: var(--me-text-muted);"></span>
            </span>
          </div>
        </div>

        <!-- Done -->
        <div v-if="done && !scanning" class="us-done">
          <i class="pi pi-check-circle" style="font-size: 16px; color: #4caf50;"></i>
          {{ t('dossier.scanDone', { found: foundCount, total: totalPlatforms }) }}
          <button v-if="results.length > 0" class="us-reset-btn" @click="reset">
            {{ t('dossier.scanNewSearch') }}
          </button>
        </div>
      </div>
    </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Dialog from 'primevue/dialog';
import { useDossierStore } from '../../stores/dossier';
import { SERVER_URL } from '../../services/api';

const { t } = useI18n();
const model = defineModel<boolean>({ default: false });
const dossierStore = useDossierStore();

const query = ref('');
const overrideType = ref('');
const scanning = ref(false);
const done = ref(false);
const currentPlatform = ref('');
const totalPlatforms = ref(0);
const scannedCount = ref(0);
const foundCount = ref(0);
const platformSelection = reactive<Record<string, boolean>>({});

// --- Type detection ---
type InputType = 'username' | 'phone' | 'email' | 'identity' | 'plate' | 'vin';

function detectInputType(input: string): InputType {
  const v = input.trim();
  if (!v) return 'username';
  // Phone: starts with + or 0, mostly digits
  if (/^\+?\d[\d\s.\-()]{6,}$/.test(v)) return 'phone';
  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'email';
  // VIN: 17 alphanumeric chars
  if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(v)) return 'vin';
  // License plate: 1-XXX-123 or XX-123-XX etc
  if (/^\d{1,2}[- ]?[A-Z]{2,3}[- ]?\d{2,3}$/i.test(v) || /^[A-Z]{2}[- ]?\d{3}[- ]?[A-Z]{2}$/i.test(v)) return 'plate';
  // Identity: contains space (first + last name)
  if (/\s/.test(v) && !/[@#]/.test(v)) return 'identity';
  // Default: username
  return 'username';
}

const detectedType = computed<InputType>(() => {
  if (overrideType.value) return overrideType.value as InputType;
  return detectInputType(query.value);
});

const typeIcon = computed(() => {
  const icons: Record<InputType, string> = {
    username: 'mdi-at', phone: 'mdi-phone-outline', email: 'mdi-email-outline',
    identity: 'mdi-account-outline', plate: 'mdi-car-outline', vin: 'mdi-barcode',
  };
  return icons[detectedType.value] || 'mdi-magnify';
});

// --- Platform definitions by type ---
interface Platform { id: string; label: string; emoji: string }

const PLATFORMS_BY_TYPE: Record<InputType, Platform[]> = {
  username: [
    { id: 'instagram', label: 'Instagram', emoji: '\u{1F4F7}' },
    { id: 'facebook', label: 'Facebook', emoji: '\u{1F465}' },
    { id: 'x', label: 'X / Twitter', emoji: '\u{1D54F}' },
    { id: 'tiktok', label: 'TikTok', emoji: '\u{1F3B5}' },
    { id: 'snapchat', label: 'Snapchat', emoji: '\u{1F47B}' },
    { id: 'youtube', label: 'YouTube', emoji: '\u{1F4FA}' },
    { id: 'linkedin', label: 'LinkedIn', emoji: '\u{1F4BC}' },
    { id: 'threads', label: 'Threads', emoji: '\u{1F9F5}' },
    { id: 'telegram', label: 'Telegram', emoji: '\u{2708}' },
    { id: 'reddit', label: 'Reddit', emoji: '\u{1F4AC}' },
    { id: 'github', label: 'GitHub', emoji: '\u{1F4BB}' },
    { id: 'twitch', label: 'Twitch', emoji: '\u{1F3AE}' },
    { id: 'pinterest', label: 'Pinterest', emoji: '\u{1F4CC}' },
    { id: 'steam', label: 'Steam', emoji: '\u{1F3AE}' },
    { id: 'medium', label: 'Medium', emoji: '\u{270D}' },
    { id: 'linktree', label: 'Linktree', emoji: '\u{1F332}' },
    { id: 'paypal', label: 'PayPal', emoji: '\u{1F4B3}' },
    { id: 'vinted', label: 'Vinted', emoji: '\u{1F457}' },
    { id: 'flickr', label: 'Flickr', emoji: '\u{1F4F8}' },
    { id: 'behance', label: 'Behance', emoji: '\u{1F3A8}' },
    { id: 'trustpilot', label: 'Trustpilot', emoji: '\u{2B50}' },
    { id: '2ememain', label: '2ememain', emoji: '\u{1F6D2}' },
    { id: 'leboncoin', label: 'LeBonCoin', emoji: '\u{1F4E6}' },
    { id: 'strava', label: 'Strava', emoji: '\u{1F3C3}' },
  ],
  phone: [
    { id: 'whatsapp', label: 'WhatsApp', emoji: '\u{1F4AC}' },
    { id: 'telegram', label: 'Telegram', emoji: '\u{2708}' },
    { id: 'snapchat', label: 'Snapchat', emoji: '\u{1F47B}' },
    { id: 'facebook', label: 'Facebook', emoji: '\u{1F465}' },
    { id: 'instagram', label: 'Instagram', emoji: '\u{1F4F7}' },
    { id: 'linkedin', label: 'LinkedIn', emoji: '\u{1F4BC}' },
  ],
  email: [
    { id: 'linkedin', label: 'LinkedIn', emoji: '\u{1F4BC}' },
    { id: 'facebook', label: 'Facebook', emoji: '\u{1F465}' },
    { id: 'instagram', label: 'Instagram', emoji: '\u{1F4F7}' },
    { id: 'twitter', label: 'X / Twitter', emoji: '\u{1D54F}' },
    { id: 'github', label: 'GitHub', emoji: '\u{1F4BB}' },
    { id: 'gravatar', label: 'Gravatar', emoji: '\u{1F464}' },
  ],
  identity: [
    { id: 'linkedin', label: 'LinkedIn', emoji: '\u{1F4BC}' },
    { id: 'facebook', label: 'Facebook', emoji: '\u{1F465}' },
    { id: 'instagram', label: 'Instagram', emoji: '\u{1F4F7}' },
    { id: 'x', label: 'X / Twitter', emoji: '\u{1D54F}' },
    { id: 'pappers', label: 'Pappers.fr', emoji: '\u{1F3E2}' },
    { id: 'kbo', label: 'KBO/BCE', emoji: '\u{1F3DB}' },
    { id: 'societe', label: 'Societe.com', emoji: '\u{1F3E2}' },
  ],
  plate: [
    { id: 'autoscout24', label: 'AutoScout24', emoji: '\u{1F697}' },
    { id: '2ememain', label: '2ememain', emoji: '\u{1F6D2}' },
    { id: 'leboncoin', label: 'LeBonCoin', emoji: '\u{1F4E6}' },
    { id: 'gocar', label: 'Gocar.be', emoji: '\u{1F697}' },
  ],
  vin: [
    { id: 'autoscout24', label: 'AutoScout24', emoji: '\u{1F697}' },
    { id: 'leboncoin', label: 'LeBonCoin', emoji: '\u{1F4E6}' },
  ],
};

const availablePlatforms = computed(() => PLATFORMS_BY_TYPE[detectedType.value] || []);
const selectedCount = computed(() => Object.values(platformSelection).filter(Boolean).length);
const allSelected = computed(() => availablePlatforms.value.every(p => platformSelection[p.id]));

// Auto-select all platforms when type changes
watch(detectedType, () => {
  Object.keys(platformSelection).forEach(k => delete platformSelection[k]);
  availablePlatforms.value.forEach(p => { platformSelection[p.id] = true; });
}, { immediate: true });

function onInputChange() {
  overrideType.value = '';
  // Reset results on new input
  if (results.value.length > 0) reset();
}

function toggleAll() {
  const shouldSelect = !allSelected.value;
  availablePlatforms.value.forEach(p => { platformSelection[p.id] = shouldSelect; });
}

// --- Results ---
interface ScanResult {
  platform: string; label: string; emoji: string; found: boolean;
  displayName?: string; bio?: string; url?: string;
}

const results = ref<ScanResult[]>([]);
const sortedResults = computed(() => [...results.value].sort((a, b) => (b.found ? 1 : 0) - (a.found ? 1 : 0)));
const progressPercent = computed(() => totalPlatforms.value > 0 ? (scannedCount.value / totalPlatforms.value) * 100 : 0);

function close() { if (!scanning.value) model.value = false; }

function reset() {
  results.value = [];
  done.value = false;
  scannedCount.value = 0;
  foundCount.value = 0;
  currentPlatform.value = '';
}

async function startScan() {
  if (!query.value.trim() || !dossierStore.currentDossier || scanning.value || selectedCount.value === 0) return;

  scanning.value = true;
  done.value = false;
  results.value = [];
  scannedCount.value = 0;
  foundCount.value = 0;
  currentPlatform.value = '';

  const token = localStorage.getItem('accessToken');
  const parentId = dossierStore.selectedNode?.type === 'folder' ? dossierStore.selectedNode._id : undefined;
  const selectedPlatformIds = Object.entries(platformSelection).filter(([, v]) => v).map(([k]) => k);

  try {
    const response = await fetch(`${SERVER_URL}/api/social/scan-username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        username: query.value.trim(),
        dossierId: dossierStore.currentDossier._id,
        parentId,
        platforms: selectedPlatformIds,
        inputType: detectedType.value,
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
              platform: data.platform, label: data.label, emoji: data.emoji,
              found: data.found, displayName: data.displayName, bio: data.bio, url: data.url,
            });
            if (data.found) foundCount.value++;
          } else if (data.type === 'done') {
            done.value = true;
            if (data.folderId) {
              const { data: nodes } = await (await import('../../services/api')).default.get(`/dossiers/${dossierStore.currentDossier!._id}/nodes`);
              dossierStore.nodes = nodes;
            }
          }
        } catch { /* skip */ }
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
.us-body { padding: 16px 18px; max-height: 560px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }

.us-label { font-size: 12px; font-weight: 600; color: var(--me-text-secondary); display: block; margin-bottom: 4px; }
.us-input { width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--me-border); background: var(--me-bg-deep); color: var(--me-text-primary); font-size: 14px; font-family: var(--me-font-mono); outline: none; }
.us-input:focus { border-color: var(--me-accent); }

.us-detected { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--me-text-secondary); margin-top: 6px; }
.us-detected strong { color: var(--me-accent); }
.us-type-select { margin-left: auto; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--me-border); background: var(--me-bg-deep); color: var(--me-text-secondary); font-size: 11px; outline: none; cursor: pointer; }

.us-platforms-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.us-select-btn { font-size: 11px; color: var(--me-accent); background: none; border: none; cursor: pointer; text-decoration: underline; }
.us-platform-grid { display: flex; flex-wrap: wrap; gap: 4px; }
.us-platform { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--me-border); font-size: 11px; cursor: pointer; transition: all 0.15s; color: var(--me-text-secondary); }
.us-platform:hover { border-color: var(--me-accent); }
.us-platform--on { background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.08); border-color: var(--me-accent); color: var(--me-text-primary); }
.us-check { width: 12px; height: 12px; accent-color: var(--me-accent); }
.us-platform-emoji { font-size: 12px; }

.us-scan-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px; border-radius: 6px; border: none; background: var(--me-accent); color: white; font-size: 13px; font-weight: 600; cursor: pointer; }
.us-scan-btn:hover:not(:disabled) { filter: brightness(1.1); }
.us-scan-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.us-progress { display: flex; flex-direction: column; gap: 4px; }
.us-progress-bar { height: 4px; border-radius: 2px; background: var(--me-border); overflow: hidden; }
.us-progress-fill { height: 100%; background: var(--me-accent); transition: width 0.3s ease; }
.us-progress-text { font-size: 11px; color: var(--me-text-muted); display: flex; align-items: center; gap: 8px; }
.us-found-badge { color: #4caf50; font-weight: 600; }

.us-current { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--me-accent); }

.us-results { display: flex; flex-direction: column; gap: 3px; }
.us-result { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 6px; font-size: 12px; }
.us-result--found { background: rgba(76, 175, 80, 0.06); }
.us-result--notfound { opacity: 0.4; }
.us-result-emoji { font-size: 13px; width: 18px; text-align: center; }
.us-result-label { font-weight: 500; color: var(--me-text-primary); min-width: 80px; }
.us-result-name { flex: 1; color: var(--me-text-secondary); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.us-result-status { margin-left: auto; }

.us-done { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #4caf50; font-weight: 500; padding: 6px 0; flex-wrap: wrap; }
.us-reset-btn { margin-left: auto; font-size: 11px; color: var(--me-accent); background: none; border: 1px solid var(--me-border); border-radius: 6px; padding: 4px 10px; cursor: pointer; }
.us-reset-btn:hover { border-color: var(--me-accent); }
</style>
