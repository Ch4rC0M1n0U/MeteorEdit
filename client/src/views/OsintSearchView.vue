<template>
  <div class="osint-root">
    <!-- Header -->
    <div class="osint-header">
      <div class="osint-header-title">
        <v-icon size="28" color="var(--me-accent)">mdi-search-web</v-icon>
        <h1>{{ t('osint.searchTitle') }}</h1>
      </div>
    </div>

    <!-- Search bar -->
    <div class="osint-search-bar glass-card">
      <div class="osint-search-input-wrapper">
        <v-icon size="20" class="osint-search-icon">mdi-magnify</v-icon>
        <input
          v-model="query"
          type="text"
          :placeholder="t('osint.searchPlaceholder')"
          class="osint-search-input"
          @keydown.enter="doSearch(1)"
        />
        <v-progress-circular v-if="loading" indeterminate size="20" width="2" color="var(--me-accent)" class="osint-search-spinner" />
        <button v-else class="me-btn me-btn-accent" :disabled="!query.trim()" @click="doSearch(1)">
          <v-icon size="16" class="mr-1">mdi-magnify</v-icon>
          {{ t('common.search') }}
        </button>
      </div>

      <!-- Category chips -->
      <div class="osint-categories">
        <button
          v-for="cat in categories"
          :key="cat.key"
          class="osint-chip"
          :class="{ active: activeCategory === cat.key }"
          @click="setCategory(cat.key)"
        >
          <v-icon size="14" class="mr-1">{{ cat.icon }}</v-icon>
          {{ cat.label }}
        </button>
      </div>

      <!-- Quick dork buttons -->
      <div class="osint-dorks">
        <button
          v-for="dork in dorks"
          :key="dork.key"
          class="osint-dork-btn"
          :class="{ active: activeCategory === dork.key }"
          @click="setCategory(dork.key)"
        >
          <v-icon size="14">{{ dork.icon }}</v-icon>
          <span>{{ dork.label }}</span>
        </button>
      </div>
    </div>

    <!-- Results -->
    <div class="osint-results">
      <!-- Loading -->
      <div v-if="loading" class="osint-loading glass-card">
        <v-progress-circular indeterminate size="32" width="3" color="var(--me-accent)" />
        <span>{{ t('osint.searching') }}</span>
      </div>

      <!-- No results -->
      <div v-else-if="searched && results.length === 0" class="osint-no-results glass-card">
        <v-icon size="48" color="var(--me-text-muted)">mdi-magnify-close</v-icon>
        <span>{{ t('osint.noResults') }}</span>
      </div>

      <!-- Results list -->
      <template v-else-if="results.length > 0">
        <div class="osint-results-header">
          <span class="osint-results-count">{{ totalResults }} {{ t('osint.results') }}</span>
          <span class="osint-results-page">Page {{ currentPage }}</span>
        </div>

        <div
          v-for="(result, idx) in results"
          :key="idx"
          class="osint-result-card glass-card"
        >
          <div class="osint-result-header">
            <a :href="result.url" target="_blank" rel="noopener noreferrer" class="osint-result-title">
              {{ result.title }}
            </a>
            <span v-if="result.engine" class="osint-result-engine">
              {{ t('osint.engine') }}: {{ result.engine }}
            </span>
          </div>

          <a :href="result.url" target="_blank" rel="noopener noreferrer" class="osint-result-url">
            {{ result.url }}
          </a>

          <p v-if="result.content" class="osint-result-content">{{ result.content }}</p>

          <div v-if="result.publishedDate" class="osint-result-date">
            {{ result.publishedDate }}
          </div>

          <div class="osint-result-actions">
            <a :href="result.url" target="_blank" rel="noopener noreferrer" class="me-btn me-btn-ghost">
              <v-icon size="14" class="mr-1">mdi-open-in-new</v-icon>
              {{ t('osint.openLink') }}
            </a>
            <button class="me-btn me-btn-ghost" @click="openExportDialog(result)">
              <v-icon size="14" class="mr-1">mdi-export-variant</v-icon>
              {{ t('osint.exportToNote') }}
            </button>
          </div>
        </div>

        <!-- Pagination -->
        <div class="osint-pagination">
          <button class="me-btn me-btn-ghost" :disabled="currentPage <= 1" @click="doSearch(currentPage - 1)">
            <v-icon size="14" class="mr-1">mdi-chevron-left</v-icon>
            {{ t('osint.previousPage') }}
          </button>
          <span class="osint-pagination-page">{{ currentPage }}</span>
          <button class="me-btn me-btn-ghost" :disabled="results.length < 10" @click="doSearch(currentPage + 1)">
            {{ t('osint.nextPage') }}
            <v-icon size="14" class="ml-1">mdi-chevron-right</v-icon>
          </button>
        </div>
      </template>
    </div>

    <!-- Export dialog -->
    <v-dialog v-model="exportDialogOpen" max-width="480" persistent>
      <div class="glass-card osint-export-dialog">
        <div class="osint-export-header">
          <h3>{{ t('osint.exportToNote') }}</h3>
          <button class="me-btn-icon" @click="exportDialogOpen = false">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>

        <p v-if="exportResult" class="osint-export-title">{{ exportResult.title }}</p>

        <v-autocomplete
          v-model="selectedDossierId"
          :items="dossiers"
          item-title="title"
          item-value="_id"
          :label="t('osint.selectDossier')"
          variant="outlined"
          density="compact"
          hide-details
          class="mb-4"
        />

        <div class="osint-export-actions">
          <button class="me-btn me-btn-ghost" @click="exportDialogOpen = false">
            {{ t('common.cancel') }}
          </button>
          <button class="me-btn me-btn-accent" :disabled="!selectedDossierId || exporting" @click="doExport">
            <v-progress-circular v-if="exporting" indeterminate size="14" width="2" class="mr-1" />
            <v-icon v-else size="14" class="mr-1">mdi-export-variant</v-icon>
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar" :timeout="3000" color="success" location="bottom right">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import api from '../services/api';

const { t } = useI18n();
const route = useRoute();

// Search state
const query = ref('');
const activeCategory = ref<string | null>(null);
const loading = ref(false);
const searched = ref(false);
const currentPage = ref(1);
const totalResults = ref(0);

interface SearchResult {
  title: string;
  url: string;
  content: string;
  engine: string;
  category: string;
  thumbnail: string | null;
  publishedDate: string | null;
}

const results = ref<SearchResult[]>([]);

// Export state
const exportDialogOpen = ref(false);
const exportResult = ref<SearchResult | null>(null);
const selectedDossierId = ref<string | null>((route.query.dossierId as string) || null);
const exporting = ref(false);
const dossiers = ref<Array<{ _id: string; title: string }>>([]);

// Snackbar
const snackbar = ref(false);
const snackbarText = ref('');

// Categories
const categories = computed(() => [
  { key: null, icon: 'mdi-earth', label: t('osint.categoryAll') },
  { key: 'telegram', icon: 'mdi-send', label: t('osint.categoryTelegram') },
  { key: 'telegram-channels', icon: 'mdi-bullhorn-outline', label: t('osint.categoryTelegramChannels') },
  { key: 'telegram-messages', icon: 'mdi-message-text-outline', label: t('osint.categoryTelegramMessages') },
  { key: 'social', icon: 'mdi-account-group', label: t('osint.categorySocial') },
  { key: 'leaks', icon: 'mdi-alert-circle-outline', label: t('osint.categoryLeaks') },
  { key: 'forums', icon: 'mdi-forum-outline', label: t('osint.categoryForums') },
]);

// Quick dork buttons
const dorks = computed(() => [
  { key: 'telegram', icon: 'mdi-send', label: t('osint.dorkTelegram') },
  { key: 'email', icon: 'mdi-email-outline', label: t('osint.dorkEmail') },
  { key: 'phone', icon: 'mdi-phone-outline', label: t('osint.dorkPhone') },
  { key: 'username', icon: 'mdi-at', label: t('osint.dorkUsername') },
  { key: 'leaks', icon: 'mdi-leak', label: t('osint.dorkLeaks') },
]);

function setCategory(key: string | null) {
  activeCategory.value = key;
  if (query.value.trim()) {
    doSearch(1);
  }
}

async function doSearch(page: number) {
  if (!query.value.trim()) return;
  loading.value = true;
  searched.value = true;
  currentPage.value = page;

  try {
    const { data } = await api.post('/osint/search', {
      query: query.value.trim(),
      category: activeCategory.value,
      page,
    });
    results.value = data.results;
    totalResults.value = data.totalResults;
  } catch (err: any) {
    results.value = [];
    totalResults.value = 0;
  } finally {
    loading.value = false;
  }
}

async function openExportDialog(result: SearchResult) {
  exportResult.value = result;
  selectedDossierId.value = (route.query.dossierId as string) || null;
  exportDialogOpen.value = true;

  // Load dossiers
  try {
    const { data } = await api.get('/dossiers', { params: { limit: 100 } });
    dossiers.value = data.dossiers || data || [];
  } catch {
    dossiers.value = [];
  }
}

async function doExport() {
  if (!exportResult.value || !selectedDossierId.value) return;
  exporting.value = true;

  try {
    await api.post('/osint/search/export', {
      dossierId: selectedDossierId.value,
      title: exportResult.value.title,
      url: exportResult.value.url,
      content: exportResult.value.content,
    });
    exportDialogOpen.value = false;
    snackbarText.value = t('osint.exportSuccess');
    snackbar.value = true;
  } catch {
    // silent
  } finally {
    exporting.value = false;
  }
}
</script>

<style scoped>
.osint-root {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.osint-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.osint-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.osint-header-title h1 {
  font-size: 22px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin: 0;
}

/* Search bar */
.osint-search-bar {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.osint-search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--me-bg-deep);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  padding: 6px 12px;
  transition: border-color 0.2s;
}

.osint-search-input-wrapper:focus-within {
  border-color: var(--me-accent);
}

.osint-search-icon {
  color: var(--me-text-muted);
  flex-shrink: 0;
}

.osint-search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--me-text-primary);
  font-size: 15px;
  font-family: inherit;
  padding: 6px 0;
}

.osint-search-input::placeholder {
  color: var(--me-text-muted);
}

.osint-search-spinner {
  flex-shrink: 0;
}

/* Categories */
.osint-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.osint-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid var(--me-border);
  background: var(--me-bg-elevated);
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.osint-chip:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
}

.osint-chip.active {
  background: var(--me-accent);
  color: var(--me-bg-deep);
  border-color: var(--me-accent);
}

/* Dorks */
.osint-dorks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.osint-dork-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: var(--me-radius-xs);
  border: 1px solid var(--me-border);
  background: none;
  color: var(--me-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.osint-dork-btn:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
  background: var(--me-accent-glow);
}

.osint-dork-btn.active {
  border-color: var(--me-accent);
  color: var(--me-accent);
  background: var(--me-accent-glow);
}

/* Results */
.osint-results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.osint-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--me-text-muted);
  font-size: 14px;
}

.osint-no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: var(--me-text-muted);
  font-size: 15px;
}

.osint-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.osint-results-count {
  font-size: 13px;
  color: var(--me-text-muted);
  font-family: var(--me-font-mono);
}

.osint-results-page {
  font-size: 12px;
  color: var(--me-text-muted);
  font-family: var(--me-font-mono);
}

/* Result card */
.osint-result-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.osint-result-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.osint-result-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--me-accent);
  text-decoration: none;
  line-height: 1.3;
  word-break: break-word;
}

.osint-result-title:hover {
  text-decoration: underline;
}

.osint-result-engine {
  flex-shrink: 0;
  font-size: 11px;
  font-family: var(--me-font-mono);
  color: var(--me-text-muted);
  background: var(--me-bg-elevated);
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid var(--me-border);
}

.osint-result-url {
  font-size: 12px;
  font-family: var(--me-font-mono);
  color: var(--me-text-muted);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  display: block;
}

.osint-result-url:hover {
  color: var(--me-accent);
}

.osint-result-content {
  font-size: 13px;
  color: var(--me-text-secondary);
  line-height: 1.5;
  margin: 4px 0 0;
}

.osint-result-date {
  font-size: 11px;
  color: var(--me-text-muted);
  font-family: var(--me-font-mono);
}

.osint-result-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

/* Pagination */
.osint-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 0;
}

.osint-pagination-page {
  font-size: 13px;
  font-family: var(--me-font-mono);
  color: var(--me-text-secondary);
}

/* Export dialog */
.osint-export-dialog {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.osint-export-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.osint-export-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin: 0;
}

.osint-export-title {
  font-size: 13px;
  color: var(--me-text-secondary);
  margin: 0;
  line-height: 1.4;
}

.osint-export-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Button styles (scoped) */
.me-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border-radius: var(--me-radius-xs);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
  text-decoration: none;
  font-family: inherit;
  line-height: 1.4;
}

.me-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.me-btn-accent {
  background: var(--me-accent);
  color: var(--me-bg-deep);
  border-color: var(--me-accent);
}

.me-btn-accent:hover:not(:disabled) {
  filter: brightness(1.1);
}

.me-btn-ghost {
  background: none;
  color: var(--me-text-secondary);
  border-color: var(--me-border);
}

.me-btn-ghost:hover:not(:disabled) {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  border-color: var(--me-accent);
}

.me-btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.me-btn-icon:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}

@media (max-width: 640px) {
  .osint-root {
    padding: 16px 12px;
  }

  .osint-result-header {
    flex-direction: column;
  }

  .osint-result-actions {
    flex-direction: column;
  }
}
</style>
