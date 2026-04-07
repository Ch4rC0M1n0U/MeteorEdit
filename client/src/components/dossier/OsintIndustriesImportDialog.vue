<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="720" persistent>
    <div class="oi-dialog glass-card">
      <div class="oi-header">
        <v-icon size="20" class="oi-header-icon">mdi-shield-search</v-icon>
        <span>{{ $t('osintIndustries.title') }}</span>
        <button class="oi-close" @click="close">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <!-- Step 1: Input (file or paste) -->
      <div v-if="!parsed" class="oi-body">
        <p class="oi-desc">{{ $t('osintIndustries.description') }}</p>
        <div class="oi-entity-field">
          <label class="oi-field-label">{{ $t('osintIndustries.entityName') }}</label>
          <input v-model="entityLabel" type="text" class="oi-input" :placeholder="$t('osintIndustries.entityPlaceholder')" />
        </div>

        <!-- Tab switcher: File / Paste -->
        <div class="oi-tabs">
          <button :class="['oi-tab', { 'oi-tab--active': inputMode === 'file' }]" @click="inputMode = 'file'">
            <v-icon size="14">mdi-file-upload-outline</v-icon>
            {{ $t('osintIndustries.fileUpload') }}
          </button>
          <button :class="['oi-tab', { 'oi-tab--active': inputMode === 'paste' }]" @click="inputMode = 'paste'">
            <v-icon size="14">mdi-content-paste</v-icon>
            {{ $t('osintIndustries.pasteJson') }}
          </button>
        </div>

        <!-- File upload -->
        <div v-if="inputMode === 'file'" class="oi-drop-zone" @dragover.prevent @drop.prevent="onDrop" @click="triggerFileInput">
          <v-icon size="32" color="var(--me-text-muted)">mdi-file-upload-outline</v-icon>
          <span class="oi-drop-label">{{ $t('osintIndustries.dropOrClick') }}</span>
          <span class="oi-drop-hint">.json</span>
        </div>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="onFileSelect" />

        <!-- Paste JSON -->
        <div v-if="inputMode === 'paste'">
          <div class="oi-paste-zone" @click="focusTextarea">
            <textarea
              ref="textareaRef"
              v-model="rawJson"
              class="oi-textarea"
              :placeholder="$t('osintIndustries.pastePlaceholder')"
              rows="10"
            />
          </div>
          <div class="oi-paste-actions">
            <button class="oi-btn oi-btn--paste" @click="pasteFromClipboard">
              <v-icon size="14">mdi-content-paste</v-icon>
              {{ $t('osintIndustries.pasteClipboard') }}
            </button>
            <button class="oi-btn oi-btn--parse" :disabled="!rawJson.trim()" @click="parseJson">
              <v-icon size="14">mdi-code-json</v-icon>
              {{ $t('osintIndustries.parse') }}
            </button>
          </div>
        </div>

        <div v-if="parseError" class="oi-error">
          <v-icon size="14">mdi-alert-circle-outline</v-icon>
          {{ parseError }}
        </div>
      </div>

      <!-- Step 2: Preview & Confirm -->
      <div v-else class="oi-body">
        <div class="oi-preview-header">
          <v-icon size="18" color="var(--me-accent)">mdi-shield-search</v-icon>
          <span class="oi-entity-name">{{ entityLabel }}</span>
          <v-chip size="x-small" variant="tonal" color="primary">{{ platformEntries.length }} {{ $t('osintIndustries.platforms') }}</v-chip>
        </div>

        <!-- Status -->
        <div class="oi-status-row">
          <span v-if="parsed.registered" class="oi-badge oi-badge--registered">
            <v-icon size="12">mdi-check-circle</v-icon> {{ $t('osintIndustries.registered') }}
          </span>
          <span v-if="parsed.last_seen" class="oi-badge oi-badge--seen">
            <v-icon size="12">mdi-eye</v-icon> {{ $t('osintIndustries.lastSeen') }}:
            {{ parsed.last_seen_date ? new Date(parsed.last_seen_date).toLocaleDateString() : '-' }}
          </span>
        </div>

        <!-- Platform entries -->
        <div class="oi-entries-list">
          <div
            v-for="(entry, idx) in platformEntries"
            :key="idx"
            class="oi-entry"
            :class="{ 'oi-entry--selected': entry.selected }"
            @click="entry.selected = !entry.selected"
          >
            <div class="oi-entry-header">
              <v-icon size="16" :style="{ color: getGroupColor(entry.name) }">{{ getGroupIcon(entry.name) }}</v-icon>
              <span class="oi-entry-name">{{ entry.name }}</span>
              <v-chip size="x-small" variant="outlined">{{ entry.items.length }} {{ $t('osintIndustries.activities') }}</v-chip>
              <v-icon size="16" :color="entry.selected ? 'var(--me-accent)' : 'var(--me-text-muted)'" class="oi-check">
                {{ entry.selected ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline' }}
              </v-icon>
            </div>
            <div class="oi-entry-items">
              <div v-for="(item, ii) in entry.items.slice(0, 3)" :key="ii" class="oi-item-preview">
                <span class="oi-item-date mono">{{ item.start ? new Date(item.start).toLocaleDateString() : '-' }}</span>
                <span class="oi-item-content">{{ item.content }}</span>
              </div>
              <span v-if="entry.items.length > 3" class="oi-more mono">+{{ entry.items.length - 3 }} {{ $t('osintIndustries.more') }}</span>
            </div>
          </div>
        </div>

        <div class="oi-select-actions">
          <button class="oi-link-btn" @click="toggleAll(true)">{{ $t('elephantastic.selectAll') }}</button>
          <span class="oi-sep">|</span>
          <button class="oi-link-btn" @click="toggleAll(false)">{{ $t('elephantastic.deselectAll') }}</button>
        </div>

        <div class="oi-field" style="margin-top: 12px;">
          <label class="oi-field-label">{{ $t('clipper.parentFolder') }}</label>
          <FolderPicker v-model="selectedParentId" />
        </div>
      </div>

      <div v-if="parsed" class="oi-footer">
        <button class="oi-btn oi-btn--back" @click="resetState">
          <v-icon size="14">mdi-arrow-left</v-icon>
          {{ $t('common.back') }}
        </button>
        <div class="oi-footer-right">
          <span class="oi-selected-count">{{ selectedCount }} / {{ platformEntries.length }}</span>
          <button class="oi-btn oi-btn--cancel" @click="close">{{ $t('common.cancel') }}</button>
          <button
            class="oi-btn oi-btn--import"
            :disabled="!selectedCount || importing"
            @click="doImport"
          >
            <v-icon v-if="importing" size="14" class="oi-spin">mdi-loading</v-icon>
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

interface PlatformEntry {
  name: string;
  color: string;
  items: Array<{ group_name: string; start: string | null; end: string | null; content: string; platform_variables: any; year: number }>;
  selected: boolean;
}

const textareaRef = ref<HTMLTextAreaElement>();
const fileInput = ref<HTMLInputElement>();
const rawJson = ref('');
const entityLabel = ref('');
const parseError = ref('');
const parsed = ref<any>(null);
const platformEntries = ref<PlatformEntry[]>([]);
const importing = ref(false);
const selectedParentId = ref('');
const inputMode = ref<'file' | 'paste'>('file');

const selectedCount = computed(() => platformEntries.value.filter(e => e.selected).length);

const GROUP_ICONS: Record<string, string> = {
  whatsapp: 'mdi-message-text',
  telegram: 'mdi-send',
  signal: 'mdi-message-lock-outline',
  viber: 'mdi-phone-message',
  instagram: 'mdi-instagram',
  facebook: 'mdi-facebook',
  twitter: 'mdi-twitter',
  x: 'mdi-twitter',
  tiktok: 'mdi-music-note',
  linkedin: 'mdi-linkedin',
  snapchat: 'mdi-snapchat',
  discord: 'mdi-message-outline',
  github: 'mdi-github',
  google: 'mdi-google',
  spotify: 'mdi-spotify',
  skype: 'mdi-skype',
  paypal: 'mdi-credit-card-outline',
  amazon: 'mdi-shopping',
  apple: 'mdi-apple',
  microsoft: 'mdi-microsoft',
  line: 'mdi-chat',
  kakao: 'mdi-chat-outline',
  wechat: 'mdi-wechat',
};

const GROUP_COLORS: Record<string, string> = {
  whatsapp: '#25D366',
  telegram: '#0088cc',
  signal: '#3A76F0',
  viber: '#7360f2',
  instagram: '#E4405F',
  facebook: '#1877F2',
  twitter: '#1DA1F2',
  x: '#1DA1F2',
  tiktok: '#00F2EA',
  linkedin: '#0A66C2',
  snapchat: '#FFFC00',
  discord: '#5865F2',
  github: '#333',
  google: '#4285F4',
  spotify: '#1DB954',
  skype: '#00AFF0',
  paypal: '#003087',
  amazon: '#FF9900',
  apple: '#999',
  microsoft: '#00A4EF',
};

function getGroupIcon(name: string): string {
  return GROUP_ICONS[name.toLowerCase()] || 'mdi-web';
}

function getGroupColor(name: string): string {
  return GROUP_COLORS[name.toLowerCase()] || 'var(--me-accent)';
}

function focusTextarea() {
  textareaRef.value?.focus();
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
    rawJson.value = text;
    parseJson();
  } catch {
    parseError.value = t('osintIndustries.parseError');
  }
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    rawJson.value = text;
  } catch {
    parseError.value = t('osintIndustries.clipboardError');
  }
}

function parseJson() {
  parseError.value = '';
  try {
    const raw = rawJson.value.trim();
    let data: any;

    // Try parsing as single JSON object
    try {
      data = JSON.parse(raw);
    } catch {
      // Try as NDJSON (one JSON per line)
      const lines = raw.split('\n').filter(l => l.trim());
      if (lines.length > 1) {
        data = { _ndjson: lines.map(l => JSON.parse(l)) };
      } else {
        throw new Error('Invalid JSON');
      }
    }

    // Handle NDJSON array (multiple entities)
    if (data._ndjson) {
      const entries: PlatformEntry[] = [];
      for (const item of data._ndjson) {
        const name = item.module || item.source || item.platform || item.collection || 'Unknown';
        entries.push({
          name,
          color: getGroupColor(name),
          items: [{ group_name: name, start: item.created_at || item.date || null, end: null, content: item.description || item.content || JSON.stringify(item).substring(0, 100), platform_variables: item, year: 0 }],
          selected: true,
        });
      }
      parsed.value = data;
      platformEntries.value = entries;
      return;
    }

    // Standard format with groups/group_items
    if (data.groups || data.group_items) {
      parsed.value = data;
      const entries: PlatformEntry[] = [];
      const groupItems = data.group_items || {};
      const groups = data.groups || {};

      for (const [groupName, items] of Object.entries(groupItems)) {
        entries.push({
          name: groupName,
          color: (groups[groupName] as any)?.color || getGroupColor(groupName),
          items: items as any[],
          selected: true,
        });
      }

      platformEntries.value = entries;
      return;
    }

    // Flat format: single entity result (no groups wrapper)
    // Detect by presence of common OSINT Industries keys
    if (data.last_seen !== undefined || data.registered !== undefined || data.modules || data.results || data.data) {
      parsed.value = data;
      const entries: PlatformEntry[] = [];

      // Try data.modules or data.results or data.data as array of platform results
      const moduleList = data.modules || data.results || data.data;
      if (Array.isArray(moduleList)) {
        for (const mod of moduleList) {
          const name = mod.module || mod.source || mod.platform || mod.name || 'Unknown';
          const items = Array.isArray(mod.results || mod.items || mod.data) ? (mod.results || mod.items || mod.data) : [mod];
          entries.push({
            name,
            color: getGroupColor(name),
            items: items.map((it: any) => ({
              group_name: name,
              start: it.created_at || it.date || it.timestamp || null,
              end: null,
              content: it.description || it.content || it.title || it.value || JSON.stringify(it).substring(0, 120),
              platform_variables: it,
              year: 0,
            })),
            selected: true,
          });
        }
      }

      // If no modules found, treat the whole object as a single entry
      if (entries.length === 0) {
        entries.push({
          name: 'OSINT Industries Result',
          color: 'var(--me-accent)',
          items: [{
            group_name: 'result',
            start: data.last_seen_date || data.date || null,
            end: null,
            content: `Registered: ${data.registered ?? '-'}, Last seen: ${data.last_seen ?? '-'}`,
            platform_variables: data,
            year: 0,
          }],
          selected: true,
        });
      }

      platformEntries.value = entries;
      return;
    }

    // Unknown format - still accept it as generic import
    parsed.value = data;
    platformEntries.value = [{
      name: 'OSINT Industries Data',
      color: 'var(--me-accent)',
      items: [{
        group_name: 'data',
        start: null,
        end: null,
        content: JSON.stringify(data).substring(0, 150),
        platform_variables: data,
        year: 0,
      }],
      selected: true,
    }];
  } catch {
    parseError.value = t('osintIndustries.parseError');
  }
}

function toggleAll(val: boolean) {
  platformEntries.value.forEach(e => e.selected = val);
}

function resetState() {
  parsed.value = null;
  platformEntries.value = [];
  parseError.value = '';
}

function close() {
  emit('update:modelValue', false);
  rawJson.value = '';
  entityLabel.value = '';
  parseError.value = '';
  parsed.value = null;
  platformEntries.value = [];
  importing.value = false;
  selectedParentId.value = '';
  inputMode.value = 'file';
}

async function doImport() {
  importing.value = true;
  try {
    const selected = platformEntries.value.filter(e => e.selected);
    const { data } = await api.post(`/dossiers/${props.dossierId}/import-osint-industries`, {
      entityName: entityLabel.value || 'OSINT Industries',
      data: parsed.value,
      selectedGroups: selected.map(s => s.name),
      parentId: selectedParentId.value || null,
    });

    if (data.nodes) {
      for (const node of data.nodes) {
        if (!dossierStore.nodes.find(n => n._id === node._id)) {
          dossierStore.nodes.push(node);
        }
      }
    }

    emit('imported', data.nodes || []);
    close();
  } catch (err: any) {
    parseError.value = err.response?.data?.message || t('osintIndustries.importError');
  } finally {
    importing.value = false;
  }
}
</script>

<style scoped>
.oi-dialog {
  padding: 0;
  overflow: hidden;
}
.oi-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--me-border);
  font-weight: 600;
  font-size: 15px;
}
.oi-header-icon { color: var(--me-accent); }
.oi-close {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.oi-close:hover { background: var(--me-hover); }

.oi-body {
  padding: 20px;
  max-height: 500px;
  overflow-y: auto;
}
.oi-desc {
  font-size: 13px;
  color: var(--me-text-secondary);
  margin-bottom: 16px;
  line-height: 1.5;
}
.oi-entity-field { margin-bottom: 12px; }
.oi-field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--me-text-secondary);
  margin-bottom: 4px;
}
.oi-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--me-border);
  border-radius: 6px;
  background: var(--me-bg-secondary);
  color: var(--me-text-primary);
  font-size: 13px;
}
.oi-input:focus {
  outline: none;
  border-color: var(--me-accent);
}

/* Tabs */
.oi-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--me-border);
  padding-bottom: 8px;
}
.oi-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--me-text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.oi-tab:hover { background: var(--me-hover); color: var(--me-text-primary); }
.oi-tab--active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}

/* Drop zone */
.oi-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  border: 2px dashed var(--me-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.oi-drop-zone:hover {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
}
.oi-drop-label {
  font-size: 13px;
  color: var(--me-text-secondary);
}
.oi-drop-hint {
  font-size: 11px;
  color: var(--me-text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.oi-paste-zone {
  border: 1px solid var(--me-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--me-bg-secondary);
}
.oi-textarea {
  width: 100%;
  border: none;
  background: transparent;
  color: var(--me-text-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 12px;
  resize: vertical;
  min-height: 120px;
}
.oi-textarea:focus { outline: none; }
.oi-textarea::placeholder { color: var(--me-text-muted); }

.oi-paste-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.oi-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.1);
  color: var(--me-error);
  font-size: 12px;
}

/* Preview */
.oi-preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.oi-entity-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--me-text-primary);
}

.oi-status-row {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.oi-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.oi-badge--registered {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}
.oi-badge--seen {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.oi-entries-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}
.oi-entry {
  padding: 10px 12px;
  border: 1px solid var(--me-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.oi-entry:hover { background: var(--me-hover); }
.oi-entry--selected {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
}
.oi-entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.oi-entry-name {
  font-weight: 600;
  font-size: 13px;
  text-transform: capitalize;
  color: var(--me-text-primary);
}
.oi-check { margin-left: auto; }

.oi-entry-items {
  margin-top: 6px;
  padding-left: 24px;
}
.oi-item-preview {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--me-text-secondary);
  padding: 2px 0;
}
.oi-item-date {
  color: var(--me-text-muted);
  min-width: 80px;
  flex-shrink: 0;
}
.oi-item-content {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.oi-more {
  font-size: 11px;
  color: var(--me-text-muted);
  padding: 2px 0;
}

.oi-select-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.oi-link-btn {
  background: none;
  border: none;
  color: var(--me-accent);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}
.oi-link-btn:hover { text-decoration: underline; }
.oi-sep { color: var(--me-text-muted); font-size: 12px; }

.oi-field { margin-bottom: 8px; }

/* Footer */
.oi-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--me-border);
}
.oi-footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.oi-selected-count {
  font-size: 12px;
  color: var(--me-text-muted);
}

/* Buttons */
.oi-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.oi-btn--paste {
  background: var(--me-bg-secondary);
  color: var(--me-text-primary);
  border: 1px solid var(--me-border);
}
.oi-btn--paste:hover { background: var(--me-hover); }
.oi-btn--parse {
  background: var(--me-accent);
  color: #fff;
}
.oi-btn--parse:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.oi-btn--back {
  background: var(--me-bg-secondary);
  color: var(--me-text-primary);
  border: 1px solid var(--me-border);
}
.oi-btn--cancel {
  background: var(--me-bg-secondary);
  color: var(--me-text-primary);
  border: 1px solid var(--me-border);
}
.oi-btn--import {
  background: var(--me-accent);
  color: #fff;
}
.oi-btn--import:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes oi-spin { to { transform: rotate(360deg); } }
.oi-spin { animation: oi-spin 1s linear infinite; }
</style>
