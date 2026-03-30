<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="720" persistent>
    <div class="wc-dialog glass-card">
      <div class="wc-header">
        <v-icon size="20" class="wc-header-icon">mdi-web-check</v-icon>
        <span>{{ $t('webcheck.title') }}</span>
        <button class="wc-close" @click="close">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <!-- Step 1: File upload -->
      <div v-if="!parsed" class="wc-body">
        <p class="wc-desc">{{ $t('webcheck.description') }}</p>
        <div class="wc-drop-zone" @dragover.prevent @drop.prevent="onDrop" @click="triggerFileInput">
          <v-icon size="32" color="var(--me-text-muted)">mdi-file-upload-outline</v-icon>
          <span class="wc-drop-label">{{ $t('webcheck.dropOrClick') }}</span>
          <span class="wc-drop-hint">.json</span>
        </div>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="onFileSelect" />
        <div v-if="parseError" class="wc-error">
          <v-icon size="14">mdi-alert-circle-outline</v-icon>
          {{ parseError }}
        </div>
      </div>

      <!-- Step 2: Category selection -->
      <div v-else class="wc-body">
        <div class="wc-domain-header">
          <div class="wc-domain-info">
            <v-icon size="18" color="var(--me-accent)">mdi-web</v-icon>
            <span class="wc-domain-name">{{ domain }}</span>
            <v-chip size="x-small" variant="tonal" color="primary">{{ $t('webcheck.domainDetected') }}</v-chip>
          </div>
          <div class="wc-select-actions">
            <button class="wc-link-btn" @click="toggleAll(true)">{{ $t('webcheck.selectAll') }}</button>
            <span class="wc-sep">|</span>
            <button class="wc-link-btn" @click="toggleAll(false)">{{ $t('webcheck.deselectAll') }}</button>
          </div>
        </div>

        <p class="wc-desc" style="margin-bottom: 8px;">{{ $t('webcheck.selectCategories') }}</p>

        <div class="wc-categories-list">
          <div
            v-for="cat in availableCategories"
            :key="cat.key"
            class="wc-category"
            :class="{ 'wc-category--selected': cat.selected }"
            @click="cat.selected = !cat.selected"
          >
            <input type="checkbox" v-model="cat.selected" @click.stop class="wc-checkbox" />
            <span class="wc-cat-icon">{{ cat.icon }}</span>
            <span class="wc-cat-label">{{ cat.label }}</span>
          </div>
        </div>

        <div class="wc-field" style="margin-top: 12px;">
          <label class="wc-field-label">{{ $t('clipper.parentFolder') }}</label>
          <FolderPicker v-model="selectedParentId" />
        </div>

        <div v-if="parseError" class="wc-error" style="margin-top: 8px;">
          <v-icon size="14">mdi-alert-circle-outline</v-icon>
          {{ parseError }}
        </div>
      </div>

      <div v-if="parsed" class="wc-footer">
        <button class="wc-btn wc-btn--back" @click="reset">
          <v-icon size="14">mdi-arrow-left</v-icon>
          {{ $t('common.back') }}
        </button>
        <div class="wc-footer-right">
          <span class="wc-selected-count">{{ selectedCount }} {{ $t('webcheck.categories') }}</span>
          <button class="wc-btn wc-btn--cancel" @click="close">{{ $t('common.cancel') }}</button>
          <button
            class="wc-btn wc-btn--import"
            :disabled="!selectedCount || importing"
            @click="doImport"
          >
            <v-icon v-if="importing" size="14" class="wc-spin">mdi-loading</v-icon>
            <v-icon v-else size="14">mdi-import</v-icon>
            {{ importing ? $t('webcheck.importing') : $t('webcheck.import') }}
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
  'imported': [node: any];
}>();

const CATEGORY_DEFS: Record<string, { icon: string; label: string }> = {
  ssl: { icon: '🔒', label: 'Certificat SSL' },
  domain: { icon: '🌐', label: 'Domaine / WHOIS' },
  headers: { icon: '📡', label: 'Headers HTTP' },
  dns: { icon: '🗂️', label: 'DNS' },
  'http-security': { icon: '🛡️', label: 'Securite HTTP' },
  'social-tags': { icon: '📱', label: 'Social Tags' },
  'trace-route': { icon: '🗺️', label: 'Traceroute' },
  firewall: { icon: '🧱', label: 'Firewall' },
  dnssec: { icon: '🔐', label: 'DNSSEC' },
  hsts: { icon: '🔗', label: 'HSTS' },
  threats: { icon: '⚠️', label: 'Menaces' },
  archives: { icon: '📚', label: 'Archives' },
  rank: { icon: '📊', label: 'Classement' },
  'linked-pages': { icon: '🔗', label: 'Liens' },
  'robots-txt': { icon: '🤖', label: 'Robots.txt' },
  'txt-records': { icon: '📝', label: 'TXT Records' },
  'block-lists': { icon: '🚫', label: 'Blocklists' },
  sitemap: { icon: '🗺️', label: 'Sitemap' },
  redirects: { icon: '↪️', label: 'Redirections' },
  'security-txt': { icon: '📄', label: 'Security.txt' },
};

interface CategoryItem {
  key: string;
  icon: string;
  label: string;
  selected: boolean;
}

const fileInput = ref<HTMLInputElement>();
const parsed = ref(false);
const rawData = ref<Record<string, any>>({});
const domain = ref('');
const availableCategories = ref<CategoryItem[]>([]);
const parseError = ref('');
const importing = ref(false);
const selectedParentId = ref('');

const selectedCount = computed(() => availableCategories.value.filter(c => c.selected).length);

function extractDomain(data: Record<string, any>): string {
  if (data['social-tags']?.canonicalUrl) {
    try {
      return new URL(data['social-tags'].canonicalUrl).hostname;
    } catch { /* ignore */ }
  }
  for (const val of Object.values(data)) {
    if (!val || typeof val !== 'object') continue;
    for (const field of ['url', 'canonicalUrl', 'domain', 'hostname']) {
      const candidate = (val as any)[field];
      if (candidate && typeof candidate === 'string') {
        try {
          return new URL(candidate.startsWith('http') ? candidate : `https://${candidate}`).hostname;
        } catch {
          if (candidate.includes('.') && !candidate.includes(' ')) return candidate;
        }
      }
    }
  }
  return 'unknown';
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
    const data = JSON.parse(text);
    if (typeof data !== 'object' || Array.isArray(data)) {
      parseError.value = t('webcheck.parseError');
      return;
    }
    rawData.value = data;
    domain.value = extractDomain(data);

    // Build available categories from data keys matched to known categories
    const cats: CategoryItem[] = [];
    for (const [key, def] of Object.entries(CATEGORY_DEFS)) {
      if (data[key] !== undefined && data[key] !== null) {
        cats.push({ key, icon: def.icon, label: def.label, selected: true });
      }
    }
    availableCategories.value = cats;
    parsed.value = true;
  } catch (err: any) {
    parseError.value = t('webcheck.parseError') + ': ' + (err.message || 'Unknown error');
  }
}

function toggleAll(state: boolean) {
  availableCategories.value.forEach(c => c.selected = state);
}

function reset() {
  parsed.value = false;
  rawData.value = {};
  domain.value = '';
  availableCategories.value = [];
  parseError.value = '';
  selectedParentId.value = '';
}

function close() {
  emit('update:modelValue', false);
  setTimeout(reset, 300);
}

async function doImport() {
  if (!selectedCount.value || importing.value) return;
  importing.value = true;
  parseError.value = '';

  try {
    const selectedCats = availableCategories.value
      .filter(c => c.selected)
      .map(c => c.key);

    const { data } = await api.post(`/dossiers/${props.dossierId}/import-webcheck`, {
      data: rawData.value,
      selectedCategories: selectedCats,
      parentId: selectedParentId.value || null,
    });

    if (data.node) {
      if (!dossierStore.nodes.find(n => n._id === data.node._id)) {
        dossierStore.nodes.push(data.node);
      }
      emit('imported', data.node);
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
.wc-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.wc-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.wc-header-icon { color: var(--me-accent); }
.wc-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; transition: all 0.15s; }
.wc-close:hover { background: rgba(255,255,255,0.08); color: var(--me-text-primary); }

.wc-body { padding: 16px 18px; }
.wc-desc { font-size: 13px; color: var(--me-text-secondary); margin-bottom: 16px; }

.wc-drop-zone {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  padding: 32px; border: 2px dashed var(--me-border); border-radius: 12px;
  cursor: pointer; transition: all 0.2s;
}
.wc-drop-zone:hover { border-color: var(--me-accent); background: var(--me-accent-glow); }
.wc-drop-label { font-size: 13px; color: var(--me-text-secondary); }
.wc-drop-hint { font-size: 11px; color: var(--me-text-muted); font-family: var(--me-font-mono); }

.wc-error { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 8px 10px; border-radius: 8px; background: rgba(244,67,54,0.12); color: #ef5350; font-size: 12px; }

.wc-field { display: flex; flex-direction: column; gap: 4px; }
.wc-field-label { font-size: 12px; color: var(--me-text-secondary); font-weight: 500; }

.wc-domain-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.wc-domain-info { display: flex; align-items: center; gap: 8px; }
.wc-domain-name { font-size: 15px; font-weight: 700; color: var(--me-text-primary); font-family: var(--me-font-mono); }
.wc-select-actions { display: flex; align-items: center; gap: 4px; }
.wc-link-btn { background: none; border: none; color: var(--me-accent); cursor: pointer; font-size: 12px; padding: 2px 4px; }
.wc-link-btn:hover { text-decoration: underline; }
.wc-sep { color: var(--me-text-muted); font-size: 12px; }

.wc-categories-list { display: flex; flex-wrap: wrap; gap: 6px; max-height: 360px; overflow-y: auto; padding-right: 4px; }

.wc-category {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-radius: 8px; border: 1px solid var(--me-border);
  background: var(--me-bg-deep); cursor: pointer; transition: all 0.15s;
  min-width: 180px; flex: 0 0 calc(50% - 3px);
}
.wc-category:hover { border-color: var(--me-accent); }
.wc-category--selected { border-color: var(--me-accent); background: var(--me-accent-glow); }

.wc-checkbox { accent-color: var(--me-accent); cursor: pointer; }
.wc-cat-icon { font-size: 16px; }
.wc-cat-label { font-size: 13px; font-weight: 500; color: var(--me-text-primary); }

.wc-footer { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; border-top: 1px solid var(--me-border); }
.wc-footer-right { display: flex; align-items: center; gap: 8px; }
.wc-selected-count { font-size: 12px; color: var(--me-text-muted); font-family: var(--me-font-mono); }

.wc-btn {
  padding: 7px 14px; border-radius: 8px; border: none;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.15s; display: flex; align-items: center; gap: 6px;
}
.wc-btn--back { background: none; color: var(--me-text-muted); }
.wc-btn--back:hover { color: var(--me-text-primary); }
.wc-btn--cancel { background: none; color: var(--me-text-muted); }
.wc-btn--cancel:hover { background: rgba(255,255,255,0.06); color: var(--me-text-primary); }
.wc-btn--import { background: var(--me-accent); color: #fff; }
.wc-btn--import:hover:not(:disabled) { filter: brightness(1.15); }
.wc-btn--import:disabled { opacity: 0.5; cursor: not-allowed; }

@keyframes wc-spin { to { transform: rotate(360deg); } }
.wc-spin { animation: wc-spin 1s linear infinite; }
</style>
