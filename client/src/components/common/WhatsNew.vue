<template>
  <Dialog
    :visible="modelValue"
    @update:visible="$emit('update:modelValue', $event)"
    :style="{ width: '520px' }"
    modal
    :closable="false"
    :draggable="false"
    :pt="{
      root: { class: 'whatsnew-dialog-root' },
      mask: { class: 'whatsnew-dialog-mask' },
      content: { class: 'whatsnew-dialog-content' },
      header: { style: 'display: none' },
    }"
  >
    <div class="glass-card whatsnew-dialog">
      <div class="whatsnew-header">
        <div>
          <h2 class="whatsnew-title mono">{{ t('changelog.title') }}</h2>
        </div>
        <button class="me-icon-btn" @click="$emit('update:modelValue', false)">
          <i class="pi pi-times" style="font-size: 16px"></i>
        </button>
      </div>

      <div class="whatsnew-body" v-if="changelogs.length > 0">
        <div v-for="log in changelogs" :key="log._id" class="whatsnew-version-block">
          <div class="whatsnew-version-header">
            <span class="whatsnew-version mono">{{ t('changelog.version') }} {{ log.version }}</span>
            <span class="whatsnew-date mono">{{ formatDate(log.date) }}</span>
          </div>
          <div class="whatsnew-entries">
            <div v-for="(entry, idx) in log.entries" :key="idx" class="whatsnew-entry">
              <i
                :class="iconName(entry.type)"
                :style="{ fontSize: '14px', color: iconColor(entry.type) }"
                class="whatsnew-entry-icon"
              ></i>
              <div class="whatsnew-entry-content">
                <span class="whatsnew-entry-badge" :class="'badge--' + entry.type">
                  {{ t('changelog.' + entry.type) }}
                </span>
                <span class="whatsnew-entry-message">{{ entry.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="whatsnew-empty">
        {{ t('changelog.noChanges') }}
      </div>

      <div class="whatsnew-footer" v-if="unreadCount > 0">
        <Button :label="t('changelog.markAsRead')" class="me-btn me-btn--accent" @click="handleMarkAsRead" />
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import api from '../../services/api';

interface ChangelogEntry {
  type: 'feature' | 'fix' | 'improvement';
  message: string;
}

interface ChangelogItem {
  _id: string;
  version: string;
  date: string;
  entries: ChangelogEntry[];
}

defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'read'): void;
}>();

const { t, locale } = useI18n();
const changelogs = ref<ChangelogItem[]>([]);
const unreadCount = ref(0);

function iconName(type: string): string {
  switch (type) {
    case 'feature': return 'pi pi-star';
    case 'fix': return 'pi pi-wrench';
    case 'improvement': return 'pi pi-arrow-up';
    default: return 'pi pi-info-circle';
  }
}

function iconColor(type: string): string {
  switch (type) {
    case 'feature': return '#81b29a';
    case 'fix': return '#e0af68';
    case 'improvement': return '#6391d6';
    default: return 'grey';
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function loadChangelog() {
  try {
    const { data } = await api.get('/changelog');
    changelogs.value = data.changelogs;
    unreadCount.value = data.unreadCount;
  } catch {
    // silent
  }
}

async function handleMarkAsRead() {
  try {
    await api.post('/changelog/read');
    unreadCount.value = 0;
    emit('read');
  } catch {
    // silent
  }
}

onMounted(loadChangelog);
</script>

<style scoped>
.whatsnew-dialog {
  padding: 0;
  overflow: hidden;
}
.whatsnew-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--me-border);
}
.whatsnew-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin: 0;
}
.whatsnew-body {
  max-height: 420px;
  overflow-y: auto;
  padding: 12px 20px;
}
.whatsnew-version-block {
  margin-bottom: 20px;
}
.whatsnew-version-block:last-child {
  margin-bottom: 0;
}
.whatsnew-version-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--me-border);
}
.whatsnew-version {
  font-size: 14px;
  font-weight: 600;
  color: var(--me-accent);
}
.whatsnew-date {
  font-size: 11px;
  color: var(--me-text-muted);
}
.whatsnew-entries {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.whatsnew-entry {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.whatsnew-entry-icon {
  flex-shrink: 0;
  margin-top: 2px;
}
.whatsnew-entry-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.whatsnew-entry-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: var(--me-font-mono);
}
.badge--feature {
  color: #81b29a;
}
.badge--fix {
  color: #e0af68;
}
.badge--improvement {
  color: #6391d6;
}
.whatsnew-entry-message {
  font-size: 13px;
  color: var(--me-text-secondary);
  line-height: 1.4;
}
.whatsnew-empty {
  padding: 32px 20px;
  text-align: center;
  color: var(--me-text-muted);
  font-size: 14px;
}
.whatsnew-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--me-border);
  display: flex;
  justify-content: flex-end;
}
.me-btn--accent.p-button {
  background: var(--me-accent);
  color: var(--me-bg-deep);
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.me-btn--accent.p-button:hover {
  opacity: 0.85;
}
</style>

<style>
/* Dialog root overrides — unscoped so PrimeVue passthrough classes apply */
.whatsnew-dialog-root.p-dialog {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  overflow: visible;
}
.whatsnew-dialog-content.p-dialog-content {
  background: transparent;
  padding: 0;
}
.whatsnew-dialog-mask {
  backdrop-filter: blur(4px);
}
</style>
