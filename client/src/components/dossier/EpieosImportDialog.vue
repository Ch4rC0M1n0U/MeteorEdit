<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="720" persistent>
    <div class="ep-dialog glass-card">
      <div class="ep-header">
        <v-icon size="20" class="ep-header-icon">mdi-magnify-scan</v-icon>
        <span>{{ $t('epieos.title') }}</span>
        <button class="ep-close" @click="close">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <!-- Step 1: File upload -->
      <div v-if="!parsedServices.length" class="ep-body">
        <p class="ep-desc">{{ $t('epieos.description') }}</p>
        <div class="ep-drop-zone" @dragover.prevent @drop.prevent="onDrop" @click="triggerFileInput">
          <v-icon size="32" color="var(--me-text-muted)">mdi-file-upload-outline</v-icon>
          <span class="ep-drop-label">{{ $t('epieos.dropOrClick') }}</span>
          <span class="ep-drop-hint">.json</span>
        </div>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="onFileSelect" />
        <div v-if="parseError" class="ep-error">
          <v-icon size="14">mdi-alert-circle-outline</v-icon>
          {{ parseError }}
        </div>
      </div>

      <!-- Step 2: Service selection -->
      <div v-else class="ep-body">
        <div class="ep-entity-header">
          <div class="ep-entity-info">
            <v-icon size="18" color="var(--me-accent)">mdi-magnify</v-icon>
            <span class="ep-entity-name">{{ queryLabel }}</span>
            <v-chip size="x-small" variant="tonal" color="primary">{{ parsedServices.length }} {{ $t('epieos.services') }}</v-chip>
          </div>
          <div class="ep-select-actions">
            <button class="ep-link-btn" @click="toggleAll(true)">{{ $t('epieos.selectAll') }}</button>
            <span class="ep-sep">|</span>
            <button class="ep-link-btn" @click="toggleAll(false)">{{ $t('epieos.deselectAll') }}</button>
          </div>
        </div>

        <div class="ep-entries-list">
          <div
            v-for="(svc, idx) in parsedServices"
            :key="idx"
            class="ep-entry"
            :class="{ 'ep-entry--selected': svc.selected, 'ep-entry--duplicate': svc.duplicate }"
            @click="svc.selected = !svc.selected"
          >
            <div class="ep-entry-header">
              <input type="checkbox" v-model="svc.selected" @click.stop class="ep-checkbox" />
              <v-icon size="20" :color="getServiceColor(svc.name)">{{ getServiceIcon(svc.name) }}</v-icon>
              <span class="ep-entry-name">{{ svc.name }}</span>
              <v-chip v-if="svc.duplicate" size="x-small" variant="outlined" color="warning">
                {{ $t('epieos.duplicate') }}
              </v-chip>
            </div>
            <div class="ep-entry-details">
              <div v-for="(h, hi) in svc.highlights" :key="hi" class="ep-detail">
                <span class="ep-detail-label">{{ h.label }}:</span>
                <span>{{ h.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="ep-field" style="margin-top: 12px;">
          <label class="ep-field-label">{{ $t('clipper.parentFolder') }}</label>
          <FolderPicker v-model="selectedParentId" />
        </div>
      </div>

      <div v-if="parsedServices.length" class="ep-footer">
        <button class="ep-btn ep-btn--back" @click="resetServices">
          <v-icon size="14">mdi-arrow-left</v-icon>
          {{ $t('common.back') }}
        </button>
        <div class="ep-footer-right">
          <span class="ep-selected-count">{{ selectedCount }} / {{ parsedServices.length }}</span>
          <button class="ep-btn ep-btn--cancel" @click="close">{{ $t('common.cancel') }}</button>
          <button
            class="ep-btn ep-btn--import"
            :disabled="!selectedCount || importing"
            @click="doImport"
          >
            <v-icon v-if="importing" size="14" class="ep-spin">mdi-loading</v-icon>
            <v-icon v-else size="14">mdi-import</v-icon>
            {{ importing ? $t('epieos.importing') : $t('epieos.import') }}
          </button>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import { useDossierStore } from '../../stores/dossier';
import FolderPicker from '../common/FolderPicker.vue';

const { t } = useI18n();
const dossierStore = useDossierStore();

const props = defineProps<{
  modelValue: boolean;
  dossierId: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'imported': [nodes: any[]];
}>();

interface ParsedService {
  name: string;
  data: any;
  highlights: Array<{ label: string; value: string }>;
  selected: boolean;
  duplicate: boolean;
}

const fileInput = ref<HTMLInputElement>();
const parsedServices = ref<ParsedService[]>([]);
const queryLabel = ref('');
const parseError = ref('');
const importing = ref(false);
const selectedParentId = ref('');

const selectedCount = computed(() => parsedServices.value.filter(e => e.selected).length);

const SERVICE_ICONS: Record<string, string> = {
  hlrlookups: 'mdi-cellphone-information',
  whatsapp: 'mdi-message-text',
  signal: 'mdi-lock-outline',
  imo: 'mdi-phone-message',
  telegram: 'mdi-send',
  viber: 'mdi-phone-message',
  skype: 'mdi-skype',
  instagram: 'mdi-instagram',
  facebook: 'mdi-facebook',
  twitter: 'mdi-twitter',
  google: 'mdi-google',
  linkedin: 'mdi-linkedin',
  snapchat: 'mdi-snapchat',
  tiktok: 'mdi-music-note',
  spotify: 'mdi-spotify',
  discord: 'mdi-message-outline',
  github: 'mdi-github',
  amazon: 'mdi-shopping',
  paypal: 'mdi-credit-card-outline',
  microsoft: 'mdi-microsoft',
  apple: 'mdi-apple',
};

const SERVICE_COLORS: Record<string, string> = {
  hlrlookups: '#607D8B',
  whatsapp: '#25D366',
  signal: '#3A76F0',
  imo: '#007AFF',
  telegram: '#0088cc',
  viber: '#665CAC',
  skype: '#00AFF0',
  instagram: '#E4405F',
  facebook: '#1877F2',
  twitter: '#1DA1F2',
  google: '#4285F4',
  linkedin: '#0A66C2',
  snapchat: '#FFFC00',
  tiktok: '#00F2EA',
  spotify: '#1DB954',
  discord: '#5865F2',
  github: '#333',
  amazon: '#FF9900',
  paypal: '#003087',
  microsoft: '#00A4EF',
  apple: '#555',
};

function getServiceIcon(name: string): string {
  return SERVICE_ICONS[name.toLowerCase()] || 'mdi-web';
}

function getServiceColor(name: string): string {
  return SERVICE_COLORS[name.toLowerCase()] || 'var(--me-accent)';
}

function extractHighlights(_name: string, data: any): Array<{ label: string; value: string }> {
  const highlights: Array<{ label: string; value: string }> = [];
  if (!data || typeof data !== 'object') return highlights;

  // Common fields
  if (data.connectivity_status) highlights.push({ label: 'Status', value: data.connectivity_status });
  if (data.original_network_name) highlights.push({ label: t('epieos.operator'), value: data.original_network_name });
  if (data.original_country_name) highlights.push({ label: t('epieos.country'), value: data.original_country_name });
  if (data.is_user !== undefined) highlights.push({ label: t('epieos.user'), value: data.is_user === 'true' || data.is_user === true ? t('common.yes') : t('common.no') });
  if (data.is_business !== undefined) highlights.push({ label: t('epieos.business'), value: data.is_business === 'true' || data.is_business === true ? t('common.yes') : t('common.no') });
  if (data.registered !== undefined) highlights.push({ label: t('epieos.registered'), value: data.registered === 'true' || data.registered === true ? t('common.yes') : t('common.no') });
  if (data.name) highlights.push({ label: t('epieos.name'), value: String(data.name) });
  if (data.status) highlights.push({ label: 'Status', value: data.status });
  if (data.number) highlights.push({ label: t('epieos.number'), value: data.number });

  // Device info
  if (data.device_info?.length) {
    const ua = data.device_info[0]?.user_agent;
    if (ua) highlights.push({ label: t('epieos.device'), value: ua });
  }

  return highlights;
}

function triggerFileInput() {
  fileInput.value?.click();
}

function onFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) parseFile(file);
}

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (file) parseFile(file);
}

async function parseFile(file: File) {
  parseError.value = '';
  try {
    const text = await file.text();
    const json = JSON.parse(text);

    // Validate Epieos format
    if (!json.metadata?.query || !json.data) {
      parseError.value = t('epieos.invalidFormat');
      return;
    }

    queryLabel.value = json.metadata.query;

    // Check existing notes for duplicate detection (match any folder ending with the query, e.g. 🐘 or 🔍 prefix)
    let existingNotes: string[] = [];
    const queryStr = json.metadata.query;
    const existingFolders = dossierStore.nodes.filter(
      n => n.type === 'folder' && n.title.endsWith(queryStr) && !n.deletedAt
    );
    for (const ef of existingFolders) {
      const children = dossierStore.nodes.filter(n => n.parentId === ef._id && !n.deletedAt);
      existingNotes.push(...children.map(n => n.title));
    }

    // Extract services from data.LEA (or data directly)
    const leaData = json.data.LEA || json.data;
    const services: ParsedService[] = [];

    for (const [serviceName, serviceData] of Object.entries(leaData)) {
      if (!serviceData || typeof serviceData !== 'object') continue;

      const icon = EPIEOS_ICONS[serviceName.toLowerCase()] || '\u{1F310}';
      const noteTitle = `${icon} ${serviceName}`;
      const isDuplicate = existingNotes.includes(noteTitle);

      services.push({
        name: serviceName,
        data: serviceData,
        highlights: extractHighlights(serviceName, serviceData),
        selected: !isDuplicate,
        duplicate: isDuplicate,
      });
    }

    if (services.length === 0) {
      parseError.value = t('epieos.noServices');
      return;
    }

    parsedServices.value = services;
  } catch (err: any) {
    parseError.value = t('epieos.parseError') + ': ' + (err.message || 'Unknown error');
  }
}

// Emoji icons for duplicate check (must match server)
const EPIEOS_ICONS: Record<string, string> = {
  hlrlookups: '\u{1F4F1}',
  whatsapp: '\u{1F4AC}',
  signal: '\u{1F510}',
  imo: '\u{1F4F2}',
  telegram: '\u{2708}',
  viber: '\u{1F4F1}',
  skype: '\u{260E}',
  instagram: '\u{1F4F7}',
  facebook: '\u{1F465}',
  twitter: '\u{1F426}',
  google: '\u{1F50D}',
  linkedin: '\u{1F4BC}',
  snapchat: '\u{1F47B}',
  tiktok: '\u{1F3B5}',
  spotify: '\u{1F3B6}',
  discord: '\u{1F4AC}',
  github: '\u{1F4BB}',
  amazon: '\u{1F4E6}',
  paypal: '\u{1F4B3}',
  microsoft: '\u{1F5A5}',
  apple: '\u{1F34E}',
};

function toggleAll(state: boolean) {
  parsedServices.value.forEach(s => s.selected = state);
}

function resetServices() {
  parsedServices.value = [];
  queryLabel.value = '';
  parseError.value = '';
  selectedParentId.value = '';
}

function close() {
  emit('update:modelValue', false);
  setTimeout(resetServices, 300);
}

async function doImport() {
  if (!selectedCount.value || importing.value) return;
  importing.value = true;

  try {
    const selectedServices = parsedServices.value
      .filter(s => s.selected)
      .map(s => ({
        name: s.name,
        data: s.data,
      }));

    const { data } = await api.post(`/dossiers/${props.dossierId}/import-epieos`, {
      query: queryLabel.value,
      services: selectedServices,
      parentId: selectedParentId.value || null,
    });

    // Add created nodes to store
    if (data.nodes && Array.isArray(data.nodes)) {
      for (const node of data.nodes) {
        if (!dossierStore.nodes.find(n => n._id === node._id)) {
          dossierStore.nodes.push(node);
        }
      }
      emit('imported', data.nodes);
    }

    close();
  } catch (err: any) {
    parseError.value = err.response?.data?.message || 'Import failed';
  } finally {
    importing.value = false;
  }
}
</script>

<style scoped>
.ep-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.ep-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.ep-header-icon { color: var(--me-accent); }
.ep-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; transition: all 0.15s; }
.ep-close:hover { background: rgba(255,255,255,0.08); color: var(--me-text-primary); }

.ep-body { padding: 16px 18px; }
.ep-desc { font-size: 13px; color: var(--me-text-secondary); margin-bottom: 16px; }

.ep-drop-zone {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 32px; border: 2px dashed var(--me-border); border-radius: 12px;
  cursor: pointer; transition: all 0.2s;
}
.ep-drop-zone:hover { border-color: var(--me-accent); background: var(--me-accent-glow); }
.ep-drop-label { font-size: 13px; color: var(--me-text-secondary); }
.ep-drop-hint { font-size: 11px; color: var(--me-text-muted); font-family: var(--me-font-mono); }

.ep-error { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 8px 10px; border-radius: 8px; background: rgba(244,67,54,0.12); color: #ef5350; font-size: 12px; }

.ep-entity-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.ep-entity-info { display: flex; align-items: center; gap: 8px; }
.ep-entity-name { font-size: 15px; font-weight: 700; color: var(--me-text-primary); font-family: var(--me-font-mono); }
.ep-select-actions { display: flex; align-items: center; gap: 4px; }
.ep-link-btn { background: none; border: none; color: var(--me-accent); cursor: pointer; font-size: 12px; padding: 2px 4px; }
.ep-link-btn:hover { text-decoration: underline; }
.ep-sep { color: var(--me-text-muted); font-size: 12px; }

.ep-entries-list { display: flex; flex-direction: column; gap: 6px; max-height: 380px; overflow-y: auto; padding-right: 4px; }

.ep-entry {
  padding: 10px 12px; border-radius: 8px; border: 1px solid var(--me-border);
  background: var(--me-bg-deep); cursor: pointer; transition: all 0.15s;
}
.ep-entry:hover { border-color: var(--me-accent); }
.ep-entry--selected { border-color: var(--me-accent); background: var(--me-accent-glow); }
.ep-entry--duplicate { opacity: 0.6; }
.ep-entry--duplicate:not(.ep-entry--selected) { border-color: rgba(251, 191, 36, 0.3); background: rgba(251, 191, 36, 0.04); }

.ep-entry-header { display: flex; align-items: center; gap: 8px; }
.ep-checkbox { accent-color: var(--me-accent); cursor: pointer; }
.ep-entry-name { font-size: 14px; font-weight: 600; color: var(--me-text-primary); flex: 1; }

.ep-entry-details { margin-top: 6px; padding-left: 32px; display: flex; flex-wrap: wrap; gap: 4px 16px; }
.ep-detail { font-size: 12px; color: var(--me-text-secondary); display: flex; gap: 4px; }
.ep-detail-label { font-weight: 600; color: var(--me-text-muted); }

.ep-field { display: flex; flex-direction: column; gap: 4px; }
.ep-field-label { font-size: 12px; color: var(--me-text-secondary); font-weight: 500; }

.ep-footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-top: 1px solid var(--me-border); }
.ep-footer-right { display: flex; align-items: center; gap: 8px; }
.ep-selected-count { font-size: 12px; color: var(--me-text-muted); font-family: var(--me-font-mono); }

.ep-btn {
  padding: 7px 14px; border-radius: 8px; border: none;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.15s; display: flex; align-items: center; gap: 6px;
}
.ep-btn--back { background: none; color: var(--me-text-muted); }
.ep-btn--back:hover { color: var(--me-text-primary); }
.ep-btn--cancel { background: none; color: var(--me-text-muted); }
.ep-btn--cancel:hover { background: rgba(255,255,255,0.06); color: var(--me-text-primary); }
.ep-btn--import { background: var(--me-accent); color: #fff; }
.ep-btn--import:hover:not(:disabled) { filter: brightness(1.15); }
.ep-btn--import:disabled { opacity: 0.5; cursor: not-allowed; }

@keyframes spin { to { transform: rotate(360deg); } }
.ep-spin { animation: spin 1s linear infinite; }
</style>
