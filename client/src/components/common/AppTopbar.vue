<template>
  <header class="topbar">
    <div class="topbar-left">
      <Button icon="pi pi-bars" text rounded severity="secondary" class="topbar-menu-btn" @click="$emit('toggle-sidebar')" />
      <h1 class="page-title">{{ title }}</h1>
      <Tag v-if="subtitle" :value="subtitle" severity="secondary" rounded class="page-tag" />
    </div>

    <div class="topbar-center">
      <SearchBar />
    </div>

    <div class="topbar-right">
      <NotificationBell />

      <Button
        v-if="whatsNewCount > 0"
        icon="pi pi-gift"
        text rounded
        severity="warn"
        :badge="String(whatsNewCount)"
        badgeSeverity="danger"
        class="topbar-btn"
        @click="whatsNewOpen = true"
      />
      <Button v-else icon="pi pi-gift" text rounded severity="secondary" class="topbar-btn" @click="whatsNewOpen = true" />

      <WhatsNew v-model="whatsNewOpen" @read="whatsNewCount = 0" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import SearchBar from './SearchBar.vue';
import NotificationBell from './NotificationBell.vue';
import WhatsNew from './WhatsNew.vue';
import api from '../../services/api';

defineProps<{ title: string; subtitle?: string }>();
defineEmits<{ 'toggle-sidebar': [] }>();

const whatsNewOpen = ref(false);
const whatsNewCount = ref(0);

onMounted(async () => {
  try { const { data } = await api.get('/changelog'); whatsNewCount.value = data.unreadCount; } catch { /* silent */ }
});
</script>

<style scoped>
.topbar {
  height: 52px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  gap: 16px;
  flex-shrink: 0;
}
.topbar-left { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.topbar-menu-btn { display: none; }
.page-title { font-size: 16px; font-weight: 700; color: var(--me-text-primary); }
.page-tag { font-size: 11px; }
.topbar-center { flex: 1; max-width: 480px; margin: 0 auto; }
.topbar-right { flex-shrink: 0; display: flex; align-items: center; gap: 4px; }
.topbar-btn { width: 36px !important; height: 36px !important; overflow: visible !important; position: relative; }
.topbar-btn :deep(.p-badge) {
  position: absolute;
  top: -2px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  font-size: 11px;
  padding: 0 4px;
  border-radius: 9px;
}

@media (max-width: 768px) {
  .topbar-menu-btn { display: inline-flex; }
  .topbar-center { display: none; }
}
</style>
