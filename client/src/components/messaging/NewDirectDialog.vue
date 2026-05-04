<template>
  <Dialog
    v-model:visible="visible"
    modal
    dismissable-mask
    :header="$t('messaging.newDmTitle')"
    :style="{ width: 'min(92vw, 460px)' }"
  >
    <div class="ndm">
      <p class="ndm-hint">{{ $t('messaging.newDmHint') }}</p>

      <div v-if="loading" class="ndm-empty">
        <i class="pi pi-spin pi-spinner" /> {{ $t('common.loading') }}
      </div>

      <div v-else-if="contacts.length === 0" class="ndm-empty">
        <i class="mdi mdi-account-multiple-outline" />
        <span>{{ $t('messaging.noContacts') }}</span>
      </div>

      <div v-else>
        <span class="p-input-icon-left ndm-search-wrap">
          <i class="pi pi-search" />
          <InputText v-model="filter" :placeholder="$t('common.search')" class="w-full" />
        </span>

        <ScrollPanel class="ndm-list-scroll">
          <ul class="ndm-list">
            <li
              v-for="c in filtered"
              :key="c._id"
              :class="['ndm-item', { 'ndm-item--selected': selected === c._id }]"
              @click="selected = c._id"
            >
              <UserAvatar :user="c" :size="36" />
              <div class="ndm-item-main">
                <div class="ndm-item-name">{{ displayName(c) }}</div>
                <div class="ndm-item-email">{{ c.email }}</div>
              </div>
              <i v-if="selected === c._id" class="pi pi-check ndm-item-check" />
            </li>
          </ul>
        </ScrollPanel>
      </div>
    </div>

    <template #footer>
      <Button :label="$t('common.cancel')" text @click="visible = false" />
      <Button
        :label="$t('messaging.startDm')"
        icon="pi pi-comments"
        :disabled="!selected || starting"
        :loading="starting"
        @click="onStart"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ScrollPanel from 'primevue/scrollpanel';
import { useMessagingStore, type DmContact } from '../../stores/messaging';
import UserAvatar from './UserAvatar.vue';

const visible = defineModel<boolean>('visible', { default: false });
const emit = defineEmits<{ opened: [conversationId: string] }>();

const { t } = useI18n();
const toast = useToast();
const store = useMessagingStore();

const contacts = ref<DmContact[]>([]);
const loading = ref(false);
const starting = ref(false);
const filter = ref('');
const selected = ref<string | null>(null);

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return contacts.value;
  return contacts.value.filter((c) => {
    const name = displayName(c).toLowerCase();
    return name.includes(q) || c.email.toLowerCase().includes(q);
  });
});

function displayName(c: DmContact): string {
  return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.email;
}

watch(visible, async (v) => {
  if (!v) return;
  filter.value = '';
  selected.value = null;
  loading.value = true;
  try {
    contacts.value = await store.loadDmContacts();
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: err.response?.data?.message ?? err.message,
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
});

async function onStart(): Promise<void> {
  if (!selected.value) return;
  starting.value = true;
  try {
    const conv = await store.openDirectWith(selected.value);
    emit('opened', conv._id);
    visible.value = false;
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: t('messaging.dmFailed'),
      detail: err.response?.data?.message ?? err.message,
      life: 5000,
    });
  } finally {
    starting.value = false;
  }
}
</script>

<style scoped>
.ndm { display: flex; flex-direction: column; gap: 12px; }
.ndm-hint { margin: 0; color: var(--me-text-muted); font-size: 13px; }
.ndm-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 30px 0; color: var(--me-text-muted); font-size: 13px; }
.ndm-empty i { font-size: 28px; }
.ndm-search-wrap { display: block; }
.ndm-search-wrap :deep(input) { width: 100%; }
.ndm-list-scroll { height: 280px; }
.ndm-list { list-style: none; margin: 0; padding: 4px; display: flex; flex-direction: column; gap: 2px; }
.ndm-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--me-radius-sm); cursor: pointer; transition: background 0.12s; }
.ndm-item:hover { background: var(--me-bg-elevated); }
.ndm-item--selected { background: var(--me-accent-glow); }
.ndm-item-main { flex: 1; min-width: 0; }
.ndm-item-name { font-size: 13px; font-weight: 600; color: var(--me-text-primary); }
.ndm-item-email { font-size: 11px; color: var(--me-text-muted); }
.ndm-item-check { color: var(--me-accent); font-size: 14px; }
</style>
