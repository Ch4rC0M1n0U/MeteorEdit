<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    modal
    maximizable
    :style="{ width: '90vw', maxWidth: '1200px', height: '85vh' }"
    :pt="{ content: { class: 'ps-dialog-content' } }"
  >
    <template #header>
      <div class="ps-header">
        <SocialIcon platform="whatsapp" :size="24" />
        <h2 class="ps-title mono">{{ $t('phoneScanner.title') }}</h2>
        <span class="ps-subtitle">{{ $t('phoneScanner.subtitle') }}</span>
      </div>
    </template>

    <TabView v-model:active-index="activeTab" class="ps-tabs">
      <!-- Tab 1: Scan -->
      <TabPanel :header="$t('phoneScanner.tabs.scan')">
        <div class="ps-scan-grid">
          <!-- Left: form -->
          <div class="ps-form">
            <div class="ps-section">
              <label class="ps-label">{{ $t('phoneScanner.country') }}</label>
              <Dropdown
                v-model="countryCode"
                :options="countryOptions"
                option-label="name"
                option-value="code"
                filter
                :placeholder="$t('phoneScanner.selectCountry')"
                class="w-full"
              >
                <template #value="slotProps">
                  <span v-if="slotProps.value" class="ps-country-value">
                    <span class="ps-country-code mono">+{{ getDialCode(slotProps.value) }}</span>
                    <span>{{ getCountryName(slotProps.value) }}</span>
                  </span>
                  <span v-else>{{ slotProps.placeholder }}</span>
                </template>
                <template #option="slotProps">
                  <div class="ps-country-option">
                    <span class="ps-country-code mono">{{ slotProps.option.dialCode }}</span>
                    <span>{{ slotProps.option.name }}</span>
                  </div>
                </template>
              </Dropdown>
            </div>

            <div class="ps-section">
              <label class="ps-label">{{ $t('phoneScanner.pattern') }}</label>
              <InputText
                v-model="pattern"
                :placeholder="$t('phoneScanner.patternPlaceholder')"
                class="w-full mono"
              />
              <small class="ps-help">{{ $t('phoneScanner.patternHelp') }}</small>
            </div>

            <div class="ps-section">
              <label class="ps-label">{{ $t('phoneScanner.platforms') }}</label>
              <div class="ps-platforms">
                <label
                  v-for="p in availablePlatforms"
                  :key="p.key"
                  class="ps-platform"
                  :class="{ 'ps-platform--disabled': p.disabled }"
                >
                  <Checkbox
                    v-model="selectedPlatforms"
                    :value="p.key"
                    :disabled="p.disabled"
                  />
                  <SocialIcon :platform="p.key" :size="18" />
                  <span>{{ p.label }}</span>
                  <small v-if="p.disabled" class="ps-soon">{{ $t('phoneScanner.soon') }}</small>
                </label>
              </div>
            </div>

            <div v-if="preview" :class="['ps-preview', `ps-preview--${effectiveWarnLevel}`]">
              <div class="ps-preview-row">
                <span class="ps-preview-label">{{ $t('phoneScanner.combinations') }}</span>
                <span class="ps-preview-value mono">{{ preview.count }}</span>
              </div>
              <div class="ps-preview-row">
                <span class="ps-preview-label">{{ $t('phoneScanner.estimatedDuration') }}</span>
                <span class="ps-preview-value mono">{{ formatDuration(preview.estimatedDurationMs) }}</span>
              </div>
              <div v-if="lengthCheck && lengthCheck.expected" class="ps-preview-row">
                <span class="ps-preview-label">Longueur</span>
                <span :class="['ps-preview-value', 'mono', { 'ps-length-bad': !lengthCheck.valid }]">
                  {{ lengthCheck.actual }} / {{ lengthCheck.expected }}
                </span>
              </div>
              <div v-if="lengthCheck && lengthCheck.expected && !lengthCheck.valid" class="ps-preview-msg">
                Le numéro doit avoir {{ lengthCheck.expected }} chiffres pour {{ getCountryName(countryCode) }}.
                Actuellement : {{ lengthCheck.actual }}.
              </div>
              <div v-else-if="preview.warnLevel === 'warn'" class="ps-preview-msg">
                {{ $t('phoneScanner.warnMessage', { count: preview.count }) }}
              </div>
              <div v-else-if="preview.warnLevel === 'block'" class="ps-preview-msg">
                {{ $t('phoneScanner.blockMessage', { count: preview.count }) }}
              </div>
            </div>

            <div class="ps-actions">
              <Button
                :label="$t('phoneScanner.launch')"
                icon="pi pi-play"
                :disabled="!canLaunch"
                :loading="launching"
                @click="onLaunch"
              />
              <Button
                v-if="store.isScanning"
                :label="$t('phoneScanner.cancel')"
                icon="pi pi-stop"
                severity="danger"
                outlined
                @click="onCancel"
              />
            </div>

            <div v-if="!hasWaSession" class="ps-session-warn">
              <i class="pi pi-info-circle" />
              <span>{{ $t('phoneScanner.noWaSession') }}</span>
              <a href="/profile?section=social-sessions">{{ $t('phoneScanner.goToSessions') }}</a>
            </div>
          </div>

          <!-- Right: live results -->
          <div class="ps-results">
            <div class="ps-results-header">
              <h3>{{ $t('phoneScanner.results') }}</h3>
              <div v-if="store.currentScan" class="ps-progress-info mono">
                {{ store.currentScan.progress.tested }}/{{ store.currentScan.totalCombinations }}
                · {{ $t('phoneScanner.found') }}: {{ store.currentScan.progress.found }}
                · {{ $t('phoneScanner.errors') }}: {{ store.currentScan.progress.errors }}
              </div>
            </div>

            <ProgressBar
              v-if="store.currentScan && store.isScanning"
              :value="progressPercent"
              class="ps-progress-bar"
            />

            <div class="ps-results-filters">
              <Button
                v-for="f in resultFilters"
                :key="f.key"
                size="small"
                :outlined="resultFilter !== f.key"
                :label="f.label"
                @click="resultFilter = f.key"
              />
            </div>

            <div v-if="filteredResults.length === 0" class="ps-empty">
              {{ store.isScanning ? $t('phoneScanner.scanInProgress') : $t('phoneScanner.noResults') }}
            </div>

            <div v-else class="ps-results-grid">
              <PhoneScanResultCard
                v-for="r in filteredResults"
                :key="r._id"
                :result="r"
                :creating="creatingResultId === r._id"
                @add-to-dossier="onAddToDossier"
              />
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- Tab 2: History -->
      <TabPanel :header="$t('phoneScanner.tabs.history')">
        <div class="ps-history">
          <div v-if="store.history.length === 0" class="ps-empty">
            {{ $t('phoneScanner.noHistory') }}
          </div>
          <div v-else class="ps-history-list">
            <div
              v-for="scan in store.history"
              :key="scan._id"
              class="ps-history-item"
              @click="loadHistoricalScan(scan._id)"
            >
              <div class="ps-history-pattern mono">{{ scan.pattern }}</div>
              <div class="ps-history-meta">
                <span :class="['ps-status-pill', `ps-status-pill--${scan.status}`]">{{ $t(`phoneScanner.scanStatus.${scan.status}`) }}</span>
                <span class="mono">{{ scan.progress.tested }}/{{ scan.totalCombinations }}</span>
                <span>· {{ $t('phoneScanner.found') }}: {{ scan.progress.found }}</span>
                <span class="ps-history-date">{{ formatDate(scan.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>
    </TabView>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import Checkbox from 'primevue/checkbox';
import Button from 'primevue/button';
import ProgressBar from 'primevue/progressbar';
import api from '../../services/api';
import SocialIcon from '../common/SocialIcon.vue';
import PhoneScanResultCard from './PhoneScanResultCard.vue';
import { usePhoneScannerStore, type PhoneScanResult } from '../../stores/phoneScanner';
import { useDossierStore } from '../../stores/dossier';
import {
  getCountryList,
  previewCombinations,
  formatDuration,
  detectCountryFromPattern,
  validateLength,
  normalizeWildcards,
} from './phoneScannerHelpers';

const props = defineProps<{ visible: boolean; dossierId?: string | null }>();
defineEmits<{ 'update:visible': [value: boolean] }>();

const { t } = useI18n();
const toast = useToast();
const store = usePhoneScannerStore();
const dossierStore = useDossierStore();

const activeTab = ref(0);
const countryOptions = getCountryList();
const countryCode = ref('BE');
const pattern = ref('');
const selectedPlatforms = ref<string[]>(['whatsapp']);
const launching = ref(false);
const hasWaSession = ref(false);
const creatingResultId = ref<string | null>(null);
const resultFilter = ref<'all' | 'exists' | 'not_found' | 'error'>('all');

const resultFilters = computed(() => [
  { key: 'all' as const, label: t('phoneScanner.filters.all') },
  { key: 'exists' as const, label: t('phoneScanner.filters.exists') },
  { key: 'not_found' as const, label: t('phoneScanner.filters.notFound') },
  { key: 'error' as const, label: t('phoneScanner.filters.error') },
]);

const availablePlatforms = computed(() => [
  { key: 'whatsapp', label: 'WhatsApp', disabled: false },
  { key: 'telegram', label: 'Telegram', disabled: true },
  { key: 'signal', label: 'Signal', disabled: true },
  { key: 'viber', label: 'Viber', disabled: true },
]);

const preview = computed(() => {
  if (!pattern.value || !store.settings) return null;
  return previewCombinations(pattern.value, {
    warn: store.settings.combinationsWarnThreshold,
    block: store.settings.combinationsBlockThreshold,
  }, {
    minMs: store.settings.minDelayMs,
    maxMs: store.settings.maxDelayMs,
  });
});

const lengthCheck = computed(() => {
  if (!pattern.value || !countryCode.value) return null;
  return validateLength(pattern.value, countryCode.value);
});

const effectiveWarnLevel = computed(() => {
  if (lengthCheck.value && lengthCheck.value.expected && !lengthCheck.value.valid) return 'block';
  return preview.value?.warnLevel || 'ok';
});

const canLaunch = computed(() => {
  if (!pattern.value || !countryCode.value) return false;
  if (selectedPlatforms.value.length === 0) return false;
  if (preview.value?.warnLevel === 'block') return false;
  if (store.isScanning) return false;
  if (!effectiveDossierId.value) return false;
  if (lengthCheck.value && lengthCheck.value.expected && !lengthCheck.value.valid) return false;
  return true;
});

// Auto-detect country when pattern starts with +CC
watch(pattern, (newVal) => {
  // Auto-replace * with ?
  const normalized = normalizeWildcards(newVal);
  if (normalized !== newVal) {
    pattern.value = normalized;
    return;
  }
  // Detect country from +CC prefix
  if (newVal.startsWith('+')) {
    const detected = detectCountryFromPattern(newVal);
    if (detected && detected !== countryCode.value) {
      countryCode.value = detected;
    }
  }
});

const effectiveDossierId = computed(
  () => props.dossierId ?? dossierStore.currentDossier?._id ?? null
);

const filteredResults = computed(() => {
  if (resultFilter.value === 'all') return store.results;
  return store.results.filter((r) => r.status === resultFilter.value);
});

const progressPercent = computed(() => {
  if (!store.currentScan) return 0;
  const total = store.currentScan.totalCombinations || 1;
  return Math.round((store.currentScan.progress.tested / total) * 100);
});

function getDialCode(code: string): string {
  return countryOptions.find((c) => c.code === code)?.dialCode.replace('+', '') ?? '';
}
function getCountryName(code: string): string {
  return countryOptions.find((c) => c.code === code)?.name ?? code;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

async function checkSession(): Promise<void> {
  try {
    const { data } = await api.get<{ isActive: boolean; isClientReady: boolean }>(
      '/social/whatsapp/status'
    );
    hasWaSession.value = data.isActive;
  } catch {
    hasWaSession.value = false;
  }
}

async function onLaunch(): Promise<void> {
  if (!effectiveDossierId.value) return;
  launching.value = true;
  try {
    // Build full E.164 with country dial code if pattern doesn't start with +
    let fullPattern = pattern.value.trim();
    if (!fullPattern.startsWith('+')) {
      const dial = getDialCode(countryCode.value);
      fullPattern = `+${dial}${fullPattern.replace(/^0+/, '')}`;
    }
    await store.startScan({
      dossierId: effectiveDossierId.value,
      pattern: fullPattern,
      countryCode: countryCode.value,
      platforms: selectedPlatforms.value,
    });
    toast.add({
      severity: 'success',
      summary: t('phoneScanner.scanStarted'),
      life: 3000,
    });
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: t('phoneScanner.scanFailed'),
      detail: err.response?.data?.message ?? err.message,
      life: 5000,
    });
  } finally {
    launching.value = false;
  }
}

async function onCancel(): Promise<void> {
  if (!store.currentScan) return;
  try {
    await store.cancelScan(store.currentScan._id);
    toast.add({
      severity: 'info',
      summary: t('phoneScanner.scanCancelled'),
      life: 3000,
    });
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.message,
      life: 5000,
    });
  }
}

async function onAddToDossier(result: PhoneScanResult): Promise<void> {
  creatingResultId.value = result._id;
  try {
    await store.createEntityFromResult(result._id);
    toast.add({
      severity: 'success',
      summary: t('phoneScanner.entityCreated'),
      detail: result.profile?.name || result.phoneE164,
      life: 3000,
    });
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: t('phoneScanner.entityFailed'),
      detail: err.response?.data?.message ?? err.message,
      life: 5000,
    });
  } finally {
    creatingResultId.value = null;
  }
}

async function loadHistoricalScan(scanId: string): Promise<void> {
  await store.loadScan(scanId);
  activeTab.value = 0; // switch to scan tab
}

watch(() => props.visible, async (v) => {
  if (v) {
    await store.loadSettings();
    await checkSession();
    if (effectiveDossierId.value) {
      await store.loadHistory(effectiveDossierId.value).catch(() => {});
    }
  } else {
    store.reset();
  }
});

// Notify the user when a scan ends abnormally (rate-limit / failure)
watch(
  () => store.currentScan?.status,
  (newStatus, oldStatus) => {
    if (!newStatus || newStatus === oldStatus) return;
    if (newStatus === 'rate_limited') {
      toast.add({
        severity: 'warn',
        summary: t('phoneScanner.scanStatus.rate_limited'),
        detail: store.currentScan?.errorMessage || t('phoneScanner.quotaExceeded'),
        life: 8000,
      });
    } else if (newStatus === 'failed') {
      toast.add({
        severity: 'error',
        summary: t('phoneScanner.scanStatus.failed'),
        detail: store.currentScan?.errorMessage || t('phoneScanner.scanFailed'),
        life: 8000,
      });
    }
  }
);

onMounted(() => {
  if (props.visible) {
    store.loadSettings();
    checkSession();
  }
});

onUnmounted(() => {
  store.unsubscribeFromScan();
});
</script>

<style scoped>
.ps-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ps-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin: 0;
}
.ps-subtitle {
  font-size: 12px;
  color: var(--me-text-muted);
}

:deep(.ps-dialog-content) {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ps-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.ps-tabs :deep(.p-tabview-panels) {
  flex: 1;
  overflow: hidden;
  padding: 0;
}
.ps-tabs :deep(.p-tabview-panel) {
  height: 100%;
}

.ps-scan-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 0;
  height: 100%;
  overflow: hidden;
}

@media (max-width: 900px) {
  .ps-scan-grid { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
}

.ps-form {
  padding: 20px;
  border-right: 1px solid var(--me-border);
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.ps-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ps-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ps-help {
  font-size: 11px;
  color: var(--me-text-muted);
}

.ps-country-value, .ps-country-option {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ps-country-code {
  color: var(--me-text-muted);
  font-size: 12px;
  min-width: 48px;
}

.ps-platforms {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.ps-platform {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--me-border);
  font-size: 13px;
  cursor: pointer;
}
.ps-platform--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ps-soon {
  margin-left: auto;
  font-size: 10px;
  color: var(--me-text-muted);
  text-transform: uppercase;
}

.ps-preview {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ps-preview--warn {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
}
.ps-preview--block {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}
.ps-preview-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.ps-preview-label { color: var(--me-text-secondary); }
.ps-preview-value { color: var(--me-text-primary); font-weight: 600; }
.ps-length-bad { color: #ef4444 !important; }
.ps-preview-msg { font-size: 12px; margin-top: 4px; color: var(--me-text-secondary); }

.ps-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.ps-session-warn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.08);
  border: 1px dashed var(--me-accent, #6366f1);
  font-size: 12px;
}
.ps-session-warn a {
  color: var(--me-accent, #6366f1);
  font-weight: 600;
  text-decoration: underline;
}

.ps-results {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}
.ps-results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ps-results-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin: 0;
}
.ps-progress-info {
  font-size: 11px;
  color: var(--me-text-secondary);
}
.ps-progress-bar { height: 6px !important; }

.ps-results-filters {
  display: flex;
  gap: 6px;
}

.ps-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--me-text-muted);
  font-size: 13px;
}

.ps-results-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
  padding-right: 4px;
}

.ps-history { padding: 20px; height: 100%; overflow-y: auto; }
.ps-history-list { display: flex; flex-direction: column; gap: 8px; }
.ps-history-item {
  padding: 12px;
  border: 1px solid var(--me-border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.ps-history-item:hover { border-color: var(--me-accent, #6366f1); }
.ps-history-pattern { font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.ps-history-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--me-text-secondary);
}
.ps-history-date { margin-left: auto; }

.ps-status-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
  text-transform: uppercase;
}
.ps-status-pill--completed { color: #047857; background: rgba(16,185,129,0.12); }
.ps-status-pill--running { color: #1e40af; background: rgba(59,130,246,0.12); }
.ps-status-pill--queued { color: #b45309; background: rgba(245,158,11,0.12); }
.ps-status-pill--cancelled { color: #6b7280; background: rgba(107,114,128,0.12); }
.ps-status-pill--failed { color: #b91c1c; background: rgba(239,68,68,0.12); }
.ps-status-pill--rate_limited { color: #b45309; background: rgba(245,158,11,0.12); }
</style>
