<template>
  <div class="msgs-view">
    <aside class="msgs-side">
      <div class="msgs-side-actions">
        <Button
          icon="pi pi-plus"
          :label="$t('messaging.newDmTitle')"
          size="small"
          severity="primary"
          @click="newDmOpen = true"
        />
      </div>
      <ConversationList />
    </aside>

    <main class="msgs-main">
      <ConversationView
        v-if="store.activeConversationId"
        :conversation-id="store.activeConversationId"
        @back="store.setActiveConversation(null)"
      />
      <div v-else class="msgs-empty">
        <i class="pi pi-comments msgs-empty-icon" />
        <h3>{{ $t('messaging.pickAConversation') }}</h3>
        <p>{{ $t('messaging.pickAConversationHint') }}</p>
      </div>
    </main>

    <NewDirectDialog v-model:visible="newDmOpen" @opened="onDmOpened" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from 'primevue/button';
import { useMessagingStore } from '../stores/messaging';
import ConversationList from '../components/messaging/ConversationList.vue';
import ConversationView from '../components/messaging/ConversationView.vue';
import NewDirectDialog from '../components/messaging/NewDirectDialog.vue';

const store = useMessagingStore();
const newDmOpen = ref(false);

function onDmOpened(conversationId: string): void {
  store.setActiveConversation(conversationId);
}

onMounted(() => {
  store.bindSocket();
  store.loadConversations().catch(() => { /* ignore */ });
});
</script>

<style scoped>
.msgs-view {
  display: grid;
  grid-template-columns: 320px 1fr;
  height: calc(100vh - 56px);
  background: var(--me-bg-app);
}
.msgs-side {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  min-height: 0;
}
.msgs-side-actions {
  padding: 12px;
  border-bottom: 1px solid var(--me-border);
  display: flex;
  justify-content: flex-end;
}
.msgs-main {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.msgs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 40px;
  color: var(--me-text-muted);
  text-align: center;
  flex: 1;
}
.msgs-empty-icon { font-size: 48px; color: var(--me-text-muted); }
.msgs-empty h3 { margin: 0; font-size: 18px; font-weight: 700; color: var(--me-text-primary); }
.msgs-empty p { margin: 0; font-size: 14px; max-width: 360px; }
</style>
