<template>
  <div v-if="auth.user" class="me-bubble-root">
    <Button
      v-show="!opened"
      class="me-bubble-fab"
      icon="pi pi-comments"
      rounded
      severity="primary"
      :title="$t('messaging.openMessages')"
      @click="open"
    >
      <OverlayBadge
        v-if="store.totalUnread > 0"
        :value="store.totalUnread > 99 ? '99+' : String(store.totalUnread)"
        severity="danger"
      />
    </Button>

    <Card v-show="opened" class="me-bubble-panel">
      <template #content>
        <div class="me-bubble-shell">
          <header class="me-bubble-header">
            <Button
              v-if="store.activeConversationId"
              icon="pi pi-arrow-left"
              text
              rounded
              size="small"
              :title="$t('common.back')"
              @click="store.setActiveConversation(null)"
            />
            <h2 class="me-bubble-title">
              {{ store.activeConversationId ? '' : $t('messaging.title') }}
            </h2>
            <Button
              icon="pi pi-times"
              text
              rounded
              size="small"
              :title="$t('common.close')"
              @click="opened = false"
            />
          </header>

          <div class="me-bubble-body">
            <ConversationList
              v-if="!store.activeConversationId"
              @pick="onPick"
            />
            <ConversationView
              v-else
              :conversation-id="store.activeConversationId"
              @back="store.setActiveConversation(null)"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import OverlayBadge from 'primevue/overlaybadge';
import { useMessagingStore } from '../../stores/messaging';
import { useAuthStore } from '../../stores/auth';
import ConversationList from './ConversationList.vue';
import ConversationView from './ConversationView.vue';

const auth = useAuthStore();
const store = useMessagingStore();

const opened = ref(false);

function open(): void {
  opened.value = true;
}

function onPick(_id: string): void {
  // store already sets active; no extra action needed
}

watch(() => auth.user?._id, (id) => {
  if (id) {
    store.bindSocket();
    store.loadConversations().catch(() => { /* ignore */ });
  } else {
    store.reset();
    opened.value = false;
  }
}, { immediate: true });

onMounted(() => {
  if (auth.user) {
    store.bindSocket();
    store.loadConversations().catch(() => { /* ignore */ });
  }
});
</script>

<style scoped>
.me-bubble-root { position: fixed; bottom: 20px; right: 20px; z-index: 9000; }

.me-bubble-fab {
  width: 56px; height: 56px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}
.me-bubble-fab :deep(.p-button-icon) { font-size: 22px; }

.me-bubble-panel {
  width: 380px;
  height: 540px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 80px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  border-radius: var(--me-radius-lg, 14px);
  overflow: hidden;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
}
.me-bubble-panel :deep(.p-card-body) { padding: 0; height: 100%; }
.me-bubble-panel :deep(.p-card-content) { padding: 0; height: 100%; }

.me-bubble-shell { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.me-bubble-header {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  flex-shrink: 0;
}
.me-bubble-title { flex: 1; margin: 0; font-size: 14px; font-weight: 700; color: var(--me-text-primary); text-align: center; }

.me-bubble-body { flex: 1; min-height: 0; overflow: hidden; }
</style>
