<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="720" persistent>
    <div class="ei-dialog glass-card">
      <div class="ei-header">
        <v-icon size="20" class="ei-header-icon">mdi-elephant</v-icon>
        <span>{{ $t('elephantastic.title') }}</span>
        <button class="ei-close" @click="close">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <!-- Step 1: File upload -->
      <div v-if="!parsedEntries.length" class="ei-body">
        <p class="ei-desc">{{ $t('elephantastic.description') }}</p>
        <div class="ei-drop-zone" @dragover.prevent @drop.prevent="onDrop" @click="triggerFileInput">
          <v-icon size="32" color="var(--me-text-muted)">mdi-file-upload-outline</v-icon>
          <span class="ei-drop-label">{{ $t('elephantastic.dropOrClick') }}</span>
          <span class="ei-drop-hint">.json</span>
        </div>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="onFileSelect" />
        <div v-if="parseError" class="ei-error">
          <v-icon size="14">mdi-alert-circle-outline</v-icon>
          {{ parseError }}
        </div>
      </div>

      <!-- Step 2: Entry selection -->
      <div v-else class="ei-body">
        <div class="ei-entity-header">
          <div class="ei-entity-info">
            <v-icon size="18" color="var(--me-accent)">mdi-account-circle-outline</v-icon>
            <span class="ei-entity-name">{{ entityLabel }}</span>
            <v-chip size="x-small" variant="tonal" color="primary">{{ parsedEntries.length }} {{ $t('elephantastic.sources') }}</v-chip>
          </div>
          <div class="ei-select-actions">
            <button class="ei-link-btn" @click="toggleAll(true)">{{ $t('elephantastic.selectAll') }}</button>
            <span class="ei-sep">|</span>
            <button class="ei-link-btn" @click="toggleAll(false)">{{ $t('elephantastic.deselectAll') }}</button>
          </div>
        </div>

        <div class="ei-entries-list">
          <div
            v-for="(entry, idx) in parsedEntries"
            :key="idx"
            class="ei-entry"
            :class="{ 'ei-entry--selected': entry.selected }"
            @click="entry.selected = !entry.selected"
          >
            <div class="ei-entry-header">
              <input type="checkbox" v-model="entry.selected" @click.stop class="ei-checkbox" />
              <v-icon size="20" :color="getProviderColor(entry.collection)">{{ getProviderIcon(entry.collection) }}</v-icon>
              <span class="ei-entry-collection">{{ entry.collection }}</span>
              <v-chip size="x-small" variant="outlined" :color="getCategoryColor(entry.category_id)">
                {{ getCategoryLabel(entry.category_id) }}
              </v-chip>
            </div>
            <div class="ei-entry-details">
              <div v-if="entry.names?.length" class="ei-detail">
                <span class="ei-detail-label">{{ $t('elephantastic.name') }}:</span>
                <span>{{ entry.names.join(', ') }}</span>
              </div>
              <div v-if="entry.usernames?.length" class="ei-detail">
                <span class="ei-detail-label">{{ $t('elephantastic.username') }}:</span>
                <span>{{ entry.usernames.join(', ') }}</span>
              </div>
              <div v-if="entry.countries?.length" class="ei-detail">
                <span class="ei-detail-label">{{ $t('elephantastic.country') }}:</span>
                <span>{{ entry.countries.map((c: string) => c.toUpperCase()).join(', ') }}</span>
              </div>
              <div v-if="entry.photoUrl" class="ei-detail">
                <img :src="entry.photoUrl" class="ei-thumb" />
              </div>
              <div v-if="entry.highlights.length" class="ei-highlights">
                <div v-for="(h, hi) in entry.highlights" :key="hi" class="ei-highlight">
                  <span class="ei-detail-label">{{ h.label }}:</span>
                  <span>{{ h.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="ei-field" style="margin-top: 12px;">
          <label class="ei-field-label">{{ $t('clipper.parentFolder') }}</label>
          <FolderPicker v-model="selectedParentId" />
        </div>
      </div>

      <div v-if="parsedEntries.length" class="ei-footer">
        <button class="ei-btn ei-btn--back" @click="resetEntries">
          <v-icon size="14">mdi-arrow-left</v-icon>
          {{ $t('common.back') }}
        </button>
        <div class="ei-footer-right">
          <span class="ei-selected-count">{{ selectedCount }} / {{ parsedEntries.length }}</span>
          <button class="ei-btn ei-btn--cancel" @click="close">{{ $t('common.cancel') }}</button>
          <button
            class="ei-btn ei-btn--import"
            :disabled="!selectedCount || importing"
            @click="doImport"
          >
            <v-icon v-if="importing" size="14" class="ei-spin">mdi-loading</v-icon>
            <v-icon v-else size="14">mdi-import</v-icon>
            {{ importing ? $t('elephantastic.importing') : $t('elephantastic.import') }}
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

interface ParsedEntry {
  collection: string;
  category_id: string;
  label: string;
  names: string[];
  usernames: string[];
  phones: string[];
  countries: string[];
  identifiers: string[];
  created_at: string;
  photoUrl: string;
  highlights: Array<{ label: string; value: string }>;
  original: any;
  selected: boolean;
}

const fileInput = ref<HTMLInputElement>();
const parsedEntries = ref<ParsedEntry[]>([]);
const entityLabel = ref('');
const parseError = ref('');
const importing = ref(false);
const selectedParentId = ref('');

const selectedCount = computed(() => parsedEntries.value.filter(e => e.selected).length);

const PROVIDER_ICONS: Record<string, string> = {
  'Amazon': 'mdi-shopping',
  'HLRLookup': 'mdi-cellphone-information',
  'CallApp': 'mdi-phone',
  'CallApp (2023-)': 'mdi-phone',
  'Eyecon': 'mdi-eye-outline',
  'WhatsApp': 'mdi-message-text',
  'Snapchat': 'mdi-snapchat',
  'Snapchat (2023-)': 'mdi-snapchat',
  'PayPal': 'mdi-credit-card-outline',
  'PayPal (app)': 'mdi-credit-card-outline',
  'Instagram': 'mdi-instagram',
  'Facebook': 'mdi-facebook',
  'Twitter': 'mdi-twitter',
  'X': 'mdi-twitter',
  'Telegram': 'mdi-send',
  'TikTok': 'mdi-music-note',
  'LinkedIn': 'mdi-linkedin',
  'Google': 'mdi-google',
  'Spotify': 'mdi-spotify',
  'Discord': 'mdi-message-outline',
  'GitHub': 'mdi-github',
  'Microsoft': 'mdi-microsoft',
  'Apple': 'mdi-apple',
  'Signal': 'mdi-message-lock-outline',
  'Viber': 'mdi-phone-message',
  'Skype': 'mdi-skype',
};

const PROVIDER_COLORS: Record<string, string> = {
  'Amazon': '#FF9900',
  'HLRLookup': '#607D8B',
  'CallApp': '#4CAF50',
  'CallApp (2023-)': '#4CAF50',
  'Eyecon': '#2196F3',
  'WhatsApp': '#25D366',
  'Snapchat': '#FFFC00',
  'Snapchat (2023-)': '#FFFC00',
  'PayPal': '#003087',
  'PayPal (app)': '#003087',
  'Instagram': '#E4405F',
  'Facebook': '#1877F2',
  'Twitter': '#1DA1F2',
  'X': '#1DA1F2',
  'Telegram': '#0088cc',
  'TikTok': '#00F2EA',
  'LinkedIn': '#0A66C2',
  'Google': '#4285F4',
  'Spotify': '#1DB954',
  'Discord': '#5865F2',
  'GitHub': '#333',
  'Microsoft': '#00A4EF',
};

function getProviderIcon(collection: string): string {
  // Try exact match, then base name match
  if (PROVIDER_ICONS[collection]) return PROVIDER_ICONS[collection];
  const base = collection.replace(/\s*\(.*\)$/, '');
  return PROVIDER_ICONS[base] || 'mdi-web';
}

function getProviderColor(collection: string): string {
  if (PROVIDER_COLORS[collection]) return PROVIDER_COLORS[collection];
  const base = collection.replace(/\s*\(.*\)$/, '');
  return PROVIDER_COLORS[base] || 'var(--me-accent)';
}

function getCategoryColor(cat: string): string {
  const map: Record<string, string> = {
    social: 'blue', personal: 'green', technical: 'orange', checker: 'purple',
  };
  return map[cat] || 'grey';
}

function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    social: t('elephantastic.catSocial'),
    personal: t('elephantastic.catPersonal'),
    technical: t('elephantastic.catTechnical'),
    checker: t('elephantastic.catChecker'),
  };
  return map[cat] || cat;
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
    const lines = text.trim().split('\n').filter(l => l.trim());
    const entries: ParsedEntry[] = [];
    let label = '';

    for (const line of lines) {
      const obj = JSON.parse(line);
      if (!label && obj.label) label = obj.label;
      if (!label && obj.phones?.length) label = obj.phones[0];

      const entry: ParsedEntry = {
        collection: obj.collection || 'Unknown',
        category_id: obj.category_id || '',
        label: obj.label || '',
        names: obj.names || [],
        usernames: obj.usernames || [],
        phones: obj.phones || [],
        countries: obj.countries || [],
        identifiers: obj.identifiers || [],
        created_at: obj.created_at || '',
        photoUrl: '',
        highlights: [],
        original: obj.original || {},
        selected: true,
      };

      // Extract photo URLs from original data
      if (obj.original?.picture) entry.photoUrl = obj.original.picture;
      if (obj.original?.photo_url) entry.photoUrl = obj.original.photo_url;
      if (obj.original?.bitmoji_avatar_id) {
        entry.highlights.push({ label: 'Bitmoji', value: obj.original.bitmoji_avatar_id });
      }

      // Extract highlights from original data
      const orig = obj.original || {};
      if (orig.registered !== undefined) {
        entry.highlights.push({ label: t('elephantastic.registered'), value: orig.registered ? t('common.yes') : t('common.no') });
      }
      if (orig.numberExists !== undefined) {
        entry.highlights.push({ label: t('elephantastic.accountExists'), value: orig.numberExists ? t('common.yes') : t('common.no') });
      }
      if (orig.display_name) {
        entry.highlights.push({ label: t('elephantastic.displayName'), value: orig.display_name });
      }
      if (orig.username) {
        entry.highlights.push({ label: t('elephantastic.username'), value: orig.username });
      }
      if (orig.name && typeof orig.name === 'string') {
        entry.highlights.push({ label: t('elephantastic.name'), value: orig.name });
      }
      if (orig.name?.person_name) {
        entry.highlights.push({ label: t('elephantastic.name'), value: `${orig.name.person_name.given_name || ''} ${orig.name.person_name.surname || ''}`.trim() });
      }
      if (orig.user?.name) {
        entry.highlights.push({ label: t('elephantastic.name'), value: orig.user.name });
      }
      if (orig.live_status) {
        entry.highlights.push({ label: 'Status', value: orig.live_status });
      }
      if (orig.original_network_details?.name) {
        entry.highlights.push({ label: t('elephantastic.operator'), value: orig.original_network_details.name });
      }
      if (orig.country) {
        entry.highlights.push({ label: t('elephantastic.country'), value: orig.country });
      }
      if (orig.external_id) {
        entry.highlights.push({ label: 'ID', value: orig.external_id });
      }
      if (orig.account_id) {
        entry.highlights.push({ label: 'Account ID', value: orig.account_id });
      }
      if (orig.user_id) {
        entry.highlights.push({ label: 'User ID', value: orig.user_id });
      }
      if (orig.history?.length) {
        entry.highlights.push({ label: t('elephantastic.history'), value: `${orig.history.length} ${t('elephantastic.entries')}` });
      }

      entries.push(entry);
    }

    entityLabel.value = label || file.name.replace('.json', '');
    parsedEntries.value = entries;
  } catch (err: any) {
    parseError.value = t('elephantastic.parseError') + ': ' + (err.message || 'Unknown error');
  }
}

function toggleAll(state: boolean) {
  parsedEntries.value.forEach(e => e.selected = state);
}

function resetEntries() {
  parsedEntries.value = [];
  entityLabel.value = '';
  parseError.value = '';
  selectedParentId.value = '';
}

function close() {
  emit('update:modelValue', false);
  setTimeout(resetEntries, 300);
}

async function doImport() {
  if (!selectedCount.value || importing.value) return;
  importing.value = true;

  try {
    const selectedItems = parsedEntries.value
      .filter(e => e.selected)
      .map(e => ({
        collection: e.collection,
        category_id: e.category_id,
        label: e.label,
        names: e.names,
        usernames: e.usernames,
        phones: e.phones,
        countries: e.countries,
        identifiers: e.identifiers,
        created_at: e.created_at,
        photoUrl: e.photoUrl,
        original: e.original,
      }));

    const { data } = await api.post(`/dossiers/${props.dossierId}/import-elephantastic`, {
      entityName: entityLabel.value,
      items: selectedItems,
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
.ei-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.ei-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.ei-header-icon { color: var(--me-accent); }
.ei-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; transition: all 0.15s; }
.ei-close:hover { background: rgba(255,255,255,0.08); color: var(--me-text-primary); }

.ei-body { padding: 16px 18px; }
.ei-desc { font-size: 13px; color: var(--me-text-secondary); margin-bottom: 16px; }

.ei-drop-zone {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 32px; border: 2px dashed var(--me-border); border-radius: 12px;
  cursor: pointer; transition: all 0.2s;
}
.ei-drop-zone:hover { border-color: var(--me-accent); background: var(--me-accent-glow); }
.ei-drop-label { font-size: 13px; color: var(--me-text-secondary); }
.ei-drop-hint { font-size: 11px; color: var(--me-text-muted); font-family: var(--me-font-mono); }

.ei-error { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 8px 10px; border-radius: 8px; background: rgba(244,67,54,0.12); color: #ef5350; font-size: 12px; }
.ei-field { display: flex; flex-direction: column; gap: 4px; }
.ei-field-label { font-size: 12px; color: var(--me-text-secondary); font-weight: 500; }

.ei-entity-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.ei-entity-info { display: flex; align-items: center; gap: 8px; }
.ei-entity-name { font-size: 15px; font-weight: 700; color: var(--me-text-primary); font-family: var(--me-font-mono); }
.ei-select-actions { display: flex; align-items: center; gap: 4px; }
.ei-link-btn { background: none; border: none; color: var(--me-accent); cursor: pointer; font-size: 12px; padding: 2px 4px; }
.ei-link-btn:hover { text-decoration: underline; }
.ei-sep { color: var(--me-text-muted); font-size: 12px; }

.ei-entries-list { display: flex; flex-direction: column; gap: 6px; max-height: 420px; overflow-y: auto; padding-right: 4px; }

.ei-entry {
  padding: 10px 12px; border-radius: 8px; border: 1px solid var(--me-border);
  background: var(--me-bg-deep); cursor: pointer; transition: all 0.15s;
}
.ei-entry:hover { border-color: var(--me-accent); }
.ei-entry--selected { border-color: var(--me-accent); background: var(--me-accent-glow); }

.ei-entry-header { display: flex; align-items: center; gap: 8px; }
.ei-checkbox { accent-color: var(--me-accent); cursor: pointer; }
.ei-entry-collection { font-size: 14px; font-weight: 600; color: var(--me-text-primary); flex: 1; }

.ei-entry-details { margin-top: 8px; padding-left: 32px; }
.ei-detail { font-size: 12px; color: var(--me-text-secondary); margin-bottom: 2px; display: flex; gap: 4px; }
.ei-detail-label { font-weight: 600; color: var(--me-text-muted); min-width: 80px; }
.ei-highlights { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 4px; }
.ei-highlight { font-size: 12px; color: var(--me-text-secondary); display: flex; gap: 4px; }

.ei-thumb { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 1px solid var(--me-border); }

.ei-footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-top: 1px solid var(--me-border); }
.ei-footer-right { display: flex; align-items: center; gap: 8px; }
.ei-selected-count { font-size: 12px; color: var(--me-text-muted); font-family: var(--me-font-mono); }

.ei-btn {
  padding: 7px 14px; border-radius: 8px; border: none;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.15s; display: flex; align-items: center; gap: 6px;
}
.ei-btn--back { background: none; color: var(--me-text-muted); }
.ei-btn--back:hover { color: var(--me-text-primary); }
.ei-btn--cancel { background: none; color: var(--me-text-muted); }
.ei-btn--cancel:hover { background: rgba(255,255,255,0.06); color: var(--me-text-primary); }
.ei-btn--import { background: var(--me-accent); color: #fff; }
.ei-btn--import:hover:not(:disabled) { filter: brightness(1.15); }
.ei-btn--import:disabled { opacity: 0.5; cursor: not-allowed; }

@keyframes spin { to { transform: rotate(360deg); } }
.ei-spin { animation: spin 1s linear infinite; }
</style>
