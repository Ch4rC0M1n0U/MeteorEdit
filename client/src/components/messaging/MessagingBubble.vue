<template>
  <div v-if="auth.user && !isOnMessagesPage" class="me-bubble-root">
    <Button
      v-show="!opened"
      class="me-bubble-fab"
      rounded
      :title="$t('messaging.openMessages')"
      @click="open"
    >
      <i class="mdi mdi-message-outline me-bubble-fab-icon" />
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
              {{ activeTitle }}
            </h2>
            <Button
              v-if="!store.activeConversationId"
              icon="pi pi-plus"
              text
              rounded
              size="small"
              :title="$t('messaging.newDmTitle')"
              @click="newDmOpen = true"
            />
            <Button
              icon="pi pi-window-maximize"
              text
              rounded
              size="small"
              :title="$t('messaging.openFullPage')"
              @click="goFullPage"
            />
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

    <NewDirectDialog v-model:visible="newDmOpen" @opened="onDmOpened" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Card from 'primevue/card';
import OverlayBadge from 'primevue/overlaybadge';
import { useMessagingStore, conversationTitle } from '../../stores/messaging';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../../stores/auth';
import ConversationList from './ConversationList.vue';
import ConversationView from './ConversationView.vue';
import NewDirectDialog from './NewDirectDialog.vue';

const { t } = useI18n();
const auth = useAuthStore();
const store = useMessagingStore();
const router = useRouter();
const route = useRoute();
const isOnMessagesPage = computed(() => route.name === 'messages');

const activeTitle = computed(() => {
  if (!store.activeConversationId) return t('messaging.title');
  const c = store.conversations.find((x) => x._id === store.activeConversationId);
  if (!c) return t('messaging.title');
  return conversationTitle(c, auth.user?.id) || t('messaging.channelDossierLabel');
});

function goFullPage(): void {
  opened.value = false;
  router.push('/messages');
}

const opened = ref(false);
const newDmOpen = ref(false);

function open(): void {
  opened.value = true;
}

function onPick(_id: string): void {
  // store already sets active; no extra action needed
}

function onDmOpened(conversationId: string): void {
  store.setActiveConversation(conversationId);
}

watch(() => auth.user?.id, (id) => {
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
  width: 60px; height: 60px;
  border-radius: 50% !important;
  background: var(--me-bg-elevated) !important;
  border: 1px solid var(--me-border) !important;
  color: var(--me-text-primary) !important;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
  transition: all 0.18s ease;
  display: flex; align-items: center; justify-content: center;
  padding: 0 !important;
}
.me-bubble-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
  border-color: var(--me-accent) !important;
  color: var(--me-accent) !important;
}
.me-bubble-fab-icon { font-size: 26px; line-height: 1; }

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
