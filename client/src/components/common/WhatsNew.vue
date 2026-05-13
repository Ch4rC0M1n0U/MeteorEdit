<!--
  WhatsNew.vue — changelog modal v3
  Logique paginée existante conservée. Ici on plaque le template v3 (DialogShell + liste timeline).
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import DialogShell from './DialogShell.vue';
import api from '@/services/api';

export interface ChangelogEntry {
  _id: string;
  version: string;
  date: string;
  title: string;
  body: string;
  highlights?: string[];
  tag?: 'feature' | 'fix' | 'breaking' | 'security';
}

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'read'): void;
}>();

const { t, locale } = useI18n();

const entries = ref<ChangelogEntry[]>([]);
const loading = ref(false);
const expanded = ref<Set<string>>(new Set());

async function fetchEntries() {
  loading.value = true;
  try {
    const { data } = await api.get('/changelog');
    entries.value = data.entries || [];
    if (data.entries?.length) {
      await api.post('/changelog/read').catch(() => {});
      emit('read');
    }
  } finally { loading.value = false; }
}

watch(() => props.modelValue, (v) => { if (v) fetchEntries(); });

function toggle(id: string) {
  if (expanded.value.has(id)) expanded.value.delete(id);
  else expanded.value.add(id);
}

function fmt(d: string) {
  return new Intl.DateTimeFormat(locale.value, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(d));
}
</script>

<template>
  <DialogShell
    :modelValue="modelValue"
    @update:modelValue="(v) => emit('update:modelValue', v)"
    :title="t('modal.whatsNew.title')"
    icon="pi-gift"
    width="lg"
  >
    <div v-if="loading" class="wn__loading">
      <i class="pi pi-spin pi-spinner" />
    </div>
    <div v-else-if="!entries.length" class="wn__empty">
      <i class="pi pi-inbox" />
      <p>{{ t('empty.generic.title') }}</p>
    </div>
    <div v-else class="wn__list">
      <article v-for="e in entries" :key="e._id" class="wn__entry">
        <div class="wn__entry-head">
          <span class="wn__version num">v{{ e.version }}</span>
          <span class="wn__date">{{ fmt(e.date) }}</span>
          <span v-if="e.tag" class="wn__tag" :class="`wn__tag--${e.tag}`">{{ t(`modal.whatsNew.tag.${e.tag}`) }}</span>
        </div>
        <h3 class="wn__title">{{ e.title }}</h3>
        <ul v-if="e.highlights?.length" class="wn__highlights">
          <li v-for="(h, i) in e.highlights" :key="i">{{ h }}</li>
        </ul>
        <div v-if="expanded.has(e._id)" class="wn__body" v-html="e.body" />
        <button
          v-if="e.body"
          class="wn__toggle"
          @click="toggle(e._id)"
        >
          <i class="pi" :class="expanded.has(e._id) ? 'pi-chevron-up' : 'pi-chevron-down'" />
          {{ expanded.has(e._id) ? t('common.collapse') : t('modal.whatsNew.readMore') }}
        </button>
      </article>
    </div>

    <template #footer="{ close }">
      <Button :label="t('common.close')" text severity="secondary" @click="close()" />
    </template>
  </DialogShell>
</template>

<style scoped>
.wn__loading,
.wn__empty {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 60px 24px; gap: 12px;
  color: var(--ink-3);
}
.wn__loading .pi,
.wn__empty .pi { font-size: 28px; }

.wn__list { display: flex; flex-direction: column; gap: 20px; }
.wn__entry {
  border-left: 2px solid var(--line-2);
  padding: 4px 0 4px 16px;
  position: relative;
}
.wn__entry::before {
  content: '';
  position: absolute;
  left: -5px; top: 6px;
  width: 8px; height: 8px;
  background: var(--accent);
  border-radius: 50%;
  border: 2px solid var(--surface);
}
.wn__entry-head {
  display: flex; align-items: center; gap: 8px;
  font-size: 11.5px; color: var(--ink-3);
  margin-bottom: 4px;
}
.wn__version {
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0;
}
.wn__date::before { content: '·'; margin: 0 4px; color: var(--ink-4); }
.wn__tag {
  margin-left: auto;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 999px;
}
.wn__tag--feature  { background: var(--accent-soft); color: var(--accent); }
.wn__tag--fix      { background: var(--ok-soft); color: var(--ok); }
.wn__tag--breaking { background: var(--err-soft); color: var(--err); }
.wn__tag--security { background: var(--warn-soft); color: var(--warn); }

.wn__title {
  font-size: 14px; font-weight: 600;
  color: var(--ink);
  margin: 0 0 8px;
  letter-spacing: -0.005em;
}
.wn__highlights {
  font-size: 12.5px;
  color: var(--ink-2);
  line-height: 1.6;
  padding-left: 18px;
  margin: 0 0 8px;
}
.wn__body {
  font-size: 12.5px;
  color: var(--ink-2);
  line-height: 1.6;
  margin-bottom: 8px;
}
.wn__toggle {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11.5px; font-weight: 500;
  color: var(--accent);
  background: transparent; border: 0;
  cursor: pointer;
  padding: 0;
}
.wn__toggle:hover { color: var(--accent-hover); }
.wn__toggle .pi { font-size: 10px; }
</style>
