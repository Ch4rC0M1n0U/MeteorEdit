<template>
  <div class="me-search" ref="searchRef">
    <div class="me-search-input-wrap" :class="{ focused: isFocused }">
      <v-icon size="16" class="me-search-icon">mdi-magnify</v-icon>
      <input
        v-model="query"
        type="text"
        class="me-search-input mono"
        placeholder="Rechercher..."
        @input="handleSearch"
        @focus="isFocused = true; showResults = true"
        @blur="hideResults"
      />
      <kbd v-if="!isFocused" class="me-search-kbd mono">/</kbd>
    </div>

    <div v-if="showResults && (results.dossiers.length || results.nodes.length)" class="me-search-results glass-card">
      <div v-if="results.dossiers.length" class="me-search-section">
        <div class="me-search-section-label mono">Dossiers</div>
        <button
          v-for="d in results.dossiers"
          :key="d._id"
          class="me-search-result"
          @mousedown="openDossier(d._id)"
        >
          <v-icon size="16" class="mr-2">mdi-folder-outline</v-icon>
          <div>
            <div class="me-search-result-title">{{ d.title }}</div>
            <div class="me-search-result-sub" v-if="d.description">{{ d.description }}</div>
          </div>
        </button>
      </div>
      <div v-if="results.nodes.length" class="me-search-section">
        <div class="me-search-section-label mono">Notes</div>
        <button
          v-for="n in results.nodes"
          :key="n._id"
          class="me-search-result"
          @mousedown="openNode(n)"
        >
          <v-icon size="16" class="mr-2">{{ nodeIcon(n.type) }}</v-icon>
          <div class="me-search-result-title">{{ n.title }}</div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import api from '../../services/api';
import { useDossierStore } from '../../stores/dossier';

const dossierStore = useDossierStore();
const searchRef = ref<HTMLElement | null>(null);
const query = ref('');
const isFocused = ref(false);
const showResults = ref(false);
const results = reactive<{ dossiers: any[]; nodes: any[] }>({ dossiers: [], nodes: [] });
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function handleSearch() {
  if (searchTimeout) clearTimeout(searchTimeout);
  if (query.value.length < 2) {
    results.dossiers = [];
    results.nodes = [];
    return;
  }
  searchTimeout = setTimeout(async () => {
    const { data } = await api.get('/search', { params: { q: query.value } });
    results.dossiers = data.dossiers;
    results.nodes = data.nodes;
    showResults.value = true;
  }, 300);
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
</script>

<style scoped>
.me-search {
  position: relative;
  width: 100%;
}
.me-search-input-wrap {
  display: flex;
  align-items: center;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  padding: 0 12px;
  height: 36px;
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
.me-search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 360px;
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
.me-search-result-sub {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}
</style>
