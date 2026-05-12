<template>
  <header class="topbar">
    <div class="topbar-left">
      <Button icon="pi pi-bars" text rounded severity="secondary" class="topbar-menu-btn" @click="$emit('toggle-sidebar')" />
      <div v-if="dossierIcon" class="topbar-dossier-icon">
        <span :class="'mdi ' + dossierIcon" style="font-size: 18px;"></span>
      </div>
      <h1 class="page-title">{{ title }}</h1>
      <Tag v-if="subtitle" :value="subtitle" severity="secondary" rounded class="page-tag" />
    </div>

    <div class="topbar-center">
      <div class="topbar-search-wrap">
        <SearchBar />
        <span class="topbar-search-kbd mono" aria-hidden="true">⌘K</span>
      </div>
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

defineProps<{ title: string; subtitle?: string; dossierIcon?: string }>();
defineEmits<{ 'toggle-sidebar': [] }>();

const whatsNewOpen = ref(false);
const whatsNewCount = ref(0);

onMounted(async () => {
  try { const { data } = await api.get('/changelog'); whatsNewCount.value = data.unreadCount; } catch { /* silent */ }
});
</script>

<style scoped>
/* ─── v3.33 — Tokens locaux scopés à AppTopbar (light + dark warm) ─── */
.topbar {
  --v3-bg-2: var(--me-bg-surface);
  --v3-bg-3: var(--me-bg-elevated);
  --v3-ink: var(--me-text-primary);
  --v3-ink-2: var(--me-text-secondary);
  --v3-ink-3: var(--me-text-muted);
  --v3-line: var(--me-border);
  --v3-accent: var(--me-accent);
}
:global([data-theme='light']) .topbar {
  --v3-bg-2: #FFFFFF;
  --v3-bg-3: #F5F4EF;
  --v3-ink: #1C1B18;
  --v3-ink-2: #45433D;
  --v3-ink-3: #6F6C63;
  --v3-line: #E7E5DD;
  --v3-accent: #2E4FA8;
}

.topbar {
  /* v3 tweak : topbar plus compacte (48px), surface neutre, bord cream */
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid var(--v3-line);
  background: var(--v3-bg-2);
  gap: 16px;
  flex-shrink: 0;
}
.topbar-left { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.topbar-dossier-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--v3-bg-3);
  border: 1px solid var(--v3-line);
  color: var(--v3-accent);
  flex-shrink: 0;
}
.topbar-menu-btn { display: none; }
.page-title {
  /* v3 tweak : titre topbar plus calme (14px, 550, tracking serré) */
  font-size: 14px;
  font-weight: 550;
  color: var(--v3-ink);
  letter-spacing: -0.2px;
  margin: 0;
}
.page-tag { font-size: 11px; }
.topbar-center { flex: 1; max-width: 480px; margin: 0 auto; }
.topbar-search-wrap { position: relative; }
.topbar-search-kbd {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10.5px;
  color: var(--v3-ink-3);
  background: var(--v3-bg-3);
  border: 1px solid var(--v3-line);
  border-radius: 4px;
  padding: 2px 6px;
  pointer-events: none;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
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
