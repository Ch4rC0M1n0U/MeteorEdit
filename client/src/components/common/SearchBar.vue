<template>
  <div class="me-search" ref="searchRef">
    <div class="me-search-bar">
      <div class="me-search-input-wrap" :class="{ focused: isFocused }">
        <v-icon size="16" class="me-search-icon">mdi-magnify</v-icon>
        <input
          v-model="query"
          type="text"
          class="me-search-input mono"
          placeholder="Rechercher..."
          @focus="isFocused = true; showResults = true"
          @blur="hideResults"
        />
        <kbd v-if="!isFocused" class="me-search-kbd mono">/</kbd>
      </div>
      <button
        class="me-filter-toggle"
        :class="{ active: filtersOpen }"
        @click="filtersOpen = !filtersOpen"
        title="Filtres"
      >
        <v-icon size="16">mdi-filter-variant</v-icon>
        <span class="mono">Filtres</span>
        <span v-if="activeFilterCount > 0" class="me-filter-badge">{{ activeFilterCount }}</span>
      </button>
    </div>

    <!-- Filter panel -->
    <div v-if="filtersOpen" class="me-filter-panel glass-card">
      <div class="me-filter-grid">
        <div class="me-filter-group">
          <div class="me-filter-label mono">Statut</div>
          <div class="me-filter-chips">
            <button
              v-for="s in statusOptions"
              :key="s.value"
              :class="['at-badge', filters.status === s.value ? 'at-badge-accent' : 'at-badge-default']"
              @click="filters.status = filters.status === s.value ? '' : s.value"
            >{{ s.label }}</button>
          </div>
        </div>

        <div class="me-filter-group">
          <div class="me-filter-label mono">Type de noeud</div>
          <div class="me-filter-chips">
            <button
              v-for="t in nodeTypeOptions"
              :key="t.value"
              :class="['at-badge', filters.nodeType === t.value ? 'at-badge-accent' : 'at-badge-default']"
              @click="filters.nodeType = filters.nodeType === t.value ? '' : t.value"
            >{{ t.label }}</button>
          </div>
        </div>

        <div class="me-filter-group">
          <div class="me-filter-label mono">Tags</div>
          <v-combobox
            v-model="filters.tags"
            :items="availableTags"
            multiple
            chips
            closable-chips
            density="compact"
            variant="outlined"
            placeholder="Ajouter un tag..."
            hide-details
            class="me-filter-combobox"
          />
        </div>

        <div class="me-filter-group">
          <div class="me-filter-label mono">Periode</div>
          <div class="me-filter-dates">
            <input
              v-model="filters.dateFrom"
              type="date"
              class="me-date-input mono"
              placeholder="Du"
            />
            <span class="me-date-sep">—</span>
            <input
              v-model="filters.dateTo"
              type="date"
              class="me-date-input mono"
              placeholder="Au"
            />
          </div>
        </div>
      </div>

      <button class="me-filter-reset" @click="resetFilters">
        <v-icon size="14" class="mr-1">mdi-refresh</v-icon>
        Reinitialiser
      </button>
    </div>

    <!-- Active filter chips -->
    <div v-if="activeFilterChips.length && !filtersOpen" class="me-active-filters">
      <span
        v-for="chip in activeFilterChips"
        :key="chip.key"
        class="me-active-chip at-badge at-badge-accent"
      >
        {{ chip.label }}
        <button class="me-chip-remove" @click="removeFilter(chip.key)">
          <v-icon size="12">mdi-close</v-icon>
        </button>
      </span>
    </div>

    <!-- Results -->
    <div
      v-if="showResults && hasResults"
      class="me-search-results glass-card"
    >
      <div v-if="results.dossiers.length" class="me-search-section">
        <div class="me-search-section-label mono">
          Dossiers
          <span class="me-search-count">({{ results.dossiersTotal ?? results.dossiers.length }})</span>
        </div>
        <button
          v-for="d in results.dossiers"
          :key="d._id"
          class="me-search-result"
          @mousedown="openDossier(d._id)"
        >
          <v-icon size="16" class="mr-2">mdi-folder-outline</v-icon>
          <div>
            <div class="me-search-result-title" v-html="highlight(d.title, query)"></div>
            <div class="me-search-result-sub" v-if="d.description">{{ d.description }}</div>
          </div>
        </button>
      </div>

      <div v-if="results.nodes.length" class="me-search-section">
        <div class="me-search-section-label mono">
          Notes
          <span class="me-search-count">({{ results.nodesTotal ?? results.nodes.length }})</span>
        </div>
        <button
          v-for="n in results.nodes"
          :key="n._id"
          class="me-search-result"
          @mousedown="openNode(n)"
        >
          <v-icon size="16" class="mr-2">{{ nodeIcon(n.type) }}</v-icon>
          <div class="me-search-result-title" v-html="highlight(n.title, query)"></div>
        </button>
      </div>

      <button
        v-if="hasMore"
        class="me-load-more"
        @mousedown.prevent="loadMore"
      >
        <v-icon size="14" class="mr-1">mdi-chevron-down</v-icon>
        Charger plus
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import api from '../../services/api';
import { useDossierStore } from '../../stores/dossier';

const dossierStore = useDossierStore();
const searchRef = ref<HTMLElement | null>(null);
const query = ref('');
const isFocused = ref(false);
const showResults = ref(false);
const filtersOpen = ref(false);
const page = ref(1);
const availableTags = ref<string[]>([]);

const filters = reactive({
  status: '',
  tags: [] as string[],
  nodeType: '',
  dateFrom: '',
  dateTo: '',
});

const results = reactive<{
  dossiers: any[];
  nodes: any[];
  dossiersTotal?: number;
  nodesTotal?: number;
  total?: number;
}>({
  dossiers: [],
  nodes: [],
});

const statusOptions = [
  { label: 'Ouvert', value: 'ouvert' },
  { label: 'En cours', value: 'en_cours' },
  { label: 'Ferme', value: 'ferme' },
];

const nodeTypeOptions = [
  { label: 'Note', value: 'note' },
  { label: 'Mindmap', value: 'mindmap' },
  { label: 'Document', value: 'document' },
  { label: 'Dossier', value: 'dossier' },
];

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

const hasResults = computed(() => results.dossiers.length > 0 || results.nodes.length > 0);

const hasMore = computed(() => {
  const loaded = results.dossiers.length + results.nodes.length;
  return results.total != null && loaded < results.total;
});

const activeFilterCount = computed(() => {
  let count = 0;
  if (filters.status) count++;
  if (filters.tags.length) count++;
  if (filters.nodeType) count++;
  if (filters.dateFrom || filters.dateTo) count++;
  return count;
});

const activeFilterChips = computed(() => {
  const chips: { key: string; label: string }[] = [];
  if (filters.status) {
    const opt = statusOptions.find(s => s.value === filters.status);
    chips.push({ key: 'status', label: `Statut: ${opt?.label ?? filters.status}` });
  }
  if (filters.nodeType) {
    const opt = nodeTypeOptions.find(t => t.value === filters.nodeType);
    chips.push({ key: 'nodeType', label: `Type: ${opt?.label ?? filters.nodeType}` });
  }
  if (filters.tags.length) {
    chips.push({ key: 'tags', label: `Tags: ${filters.tags.join(', ')}` });
  }
  if (filters.dateFrom) {
    chips.push({ key: 'dateFrom', label: `Depuis: ${filters.dateFrom}` });
  }
  if (filters.dateTo) {
    chips.push({ key: 'dateTo', label: `Jusqu'a: ${filters.dateTo}` });
  }
  return chips;
});

function highlight(text: string, q: string): string {
  if (!q || q.length < 2) return text;
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function triggerSearch() {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    doSearch(false);
  }, 300);
}

async function doSearch(append: boolean) {
  const hasQuery = query.value.length >= 2;
  const hasFilters = filters.status || filters.tags.length || filters.nodeType || filters.dateFrom || filters.dateTo;

  if (!hasQuery && !hasFilters) {
    results.dossiers = [];
    results.nodes = [];
    results.dossiersTotal = undefined;
    results.nodesTotal = undefined;
    results.total = undefined;
    return;
  }

  const params: Record<string, string> = {};
  if (query.value.length >= 2) params.q = query.value;
  if (filters.status) params.status = filters.status;
  if (filters.tags.length) params.tags = filters.tags.join(',');
  if (filters.nodeType) params.nodeType = filters.nodeType;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  params.page = String(page.value);
  params.limit = '20';

  try {
    const { data } = await api.get('/search', { params });
    if (append) {
      results.dossiers = [...results.dossiers, ...(data.dossiers ?? [])];
      results.nodes = [...results.nodes, ...(data.nodes ?? [])];
    } else {
      results.dossiers = data.dossiers ?? [];
      results.nodes = data.nodes ?? [];
    }
    results.dossiersTotal = data.dossiersTotal;
    results.nodesTotal = data.nodesTotal;
    results.total = data.total;
    showResults.value = true;
  } catch {
    // silently ignore search errors
  }
}

function loadMore() {
  page.value++;
  doSearch(true);
}

function resetFilters() {
  filters.status = '';
  filters.tags = [];
  filters.nodeType = '';
  filters.dateFrom = '';
  filters.dateTo = '';
}

function removeFilter(key: string) {
  if (key === 'status') filters.status = '';
  else if (key === 'nodeType') filters.nodeType = '';
  else if (key === 'tags') filters.tags = [];
  else if (key === 'dateFrom') filters.dateFrom = '';
  else if (key === 'dateTo') filters.dateTo = '';
}

function hideResults() {
  setTimeout(() => {
    showResults.value = false;
    isFocused.value = false;
  }, 200);
}

function openDossier(id: string) {
  dossierStore.openDossier(id);
  query.value = '';
  showResults.value = false;
}

function openNode(node: any) {
  dossierStore.openDossier(node.dossierId);
  query.value = '';
  showResults.value = false;
}

function nodeIcon(type: string) {
  switch (type) {
    case 'folder': return 'mdi-folder-outline';
    case 'note': return 'mdi-note-text-outline';
    case 'mindmap': return 'mdi-vector-polyline';
    case 'document': return 'mdi-file-document-outline';
    default: return 'mdi-file-outline';
  }
}

async function loadTags() {
  try {
    const { data } = await api.get('/dossiers/tags');
    availableTags.value = data ?? [];
  } catch {
    // tags endpoint may not exist yet
  }
}

// Watch query for debounced search
watch(query, () => {
  triggerSearch();
});

// Watch all filters for immediate search
watch(
  () => [filters.status, filters.tags.length, filters.nodeType, filters.dateFrom, filters.dateTo],
  () => {
    triggerSearch();
  }
);

onMounted(() => {
  loadTags();
});
</script>

<style scoped>
.me-search {
  position: relative;
  width: 100%;
}

.me-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.me-search-input-wrap {
  display: flex;
  align-items: center;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  padding: 0 12px;
  height: 36px;
  flex: 1;
  transition: all 0.2s;
}
.me-search-input-wrap.focused {
  border-color: var(--me-accent);
  box-shadow: 0 0 0 2px var(--me-accent-glow);
}
.me-search-icon {
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.me-search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--me-text-primary);
  font-size: 13px;
  margin-left: 8px;
}
.me-search-input::placeholder {
  color: var(--me-text-muted);
}
.me-search-kbd {
  font-size: 11px;
  color: var(--me-text-muted);
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: 4px;
  padding: 1px 6px;
  line-height: 1.4;
}

/* Filter toggle button */
.me-filter-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  padding: 0 12px;
  height: 36px;
  color: var(--me-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.me-filter-toggle:hover {
  border-color: var(--me-accent);
  color: var(--me-text-primary);
}
.me-filter-toggle.active {
  border-color: var(--me-accent);
  color: var(--me-accent);
  background: var(--me-accent-glow);
}
.me-filter-badge {
  background: var(--me-accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* Filter panel */
.me-filter-panel {
  margin-top: 8px;
  padding: 16px;
  z-index: 201;
}
.me-filter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 640px) {
  .me-filter-grid {
    grid-template-columns: 1fr;
  }
}
.me-filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.me-filter-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
}
.me-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.me-filter-chips .at-badge {
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}
.me-filter-chips .at-badge:hover {
  opacity: 0.85;
}

/* Badge styles (mirroring AdminUsers pattern) */
.at-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.at-badge-accent {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.at-badge-default {
  background: var(--me-bg-elevated);
  color: var(--me-text-muted);
}

/* Date inputs */
.me-filter-dates {
  display: flex;
  align-items: center;
  gap: 8px;
}
.me-date-input {
  flex: 1;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  padding: 6px 10px;
  color: var(--me-text-primary);
  font-size: 12px;
  outline: none;
  transition: border-color 0.2s;
}
.me-date-input:focus {
  border-color: var(--me-accent);
}
.me-date-sep {
  color: var(--me-text-muted);
  font-size: 12px;
  flex-shrink: 0;
}

/* Combobox override */
.me-filter-combobox {
  font-size: 13px;
}

/* Reset button */
.me-filter-reset {
  display: flex;
  align-items: center;
  margin-top: 12px;
  padding: 6px 14px;
  background: none;
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  color: var(--me-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.me-filter-reset:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
}

/* Active filter chips */
.me-active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.me-active-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.me-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  margin-left: 2px;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.me-chip-remove:hover {
  opacity: 1;
}

/* Results dropdown */
.me-search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 400px;
  overflow-y: auto;
  z-index: 200;
  padding: 6px;
}
.me-search-section {
  margin-bottom: 4px;
}
.me-search-section-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
  padding: 6px 10px 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.me-search-count {
  font-weight: 400;
  opacity: 0.7;
}
.me-search-result {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-primary);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  transition: background 0.15s;
}
.me-search-result:hover {
  background: var(--me-accent-glow);
}
.me-search-result-title {
  font-weight: 500;
}
.me-search-result-title :deep(mark) {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  border-radius: 2px;
  padding: 0 2px;
}
.me-search-result-sub {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

/* Load more */
.me-load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px;
  background: none;
  border: none;
  border-top: 1px solid var(--me-border);
  color: var(--me-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s;
  margin-top: 4px;
}
.me-load-more:hover {
  color: var(--me-accent);
}
</style>
