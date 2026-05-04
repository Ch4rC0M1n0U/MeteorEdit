<template>
  <div class="conv-list">
    <header class="conv-list-header">
      <h2>{{ $t('messaging.conversations') }}</h2>
      <Button
        icon="pi pi-refresh"
        text
        rounded
        size="small"
        :title="$t('common.refresh')"
        @click="store.loadConversations()"
      />
    </header>

    <div v-if="store.loading" class="conv-list-empty">
      <i class="pi pi-spin pi-spinner" /> {{ $t('common.loading') }}
    </div>

    <div v-else-if="store.conversations.length === 0" class="conv-list-empty">
      <i class="mdi mdi-chat-outline" />
      <span>{{ $t('messaging.noConversations') }}</span>
    </div>

    <ScrollPanel v-else class="conv-items-scroll">
      <ul class="conv-items">
        <li
          v-for="c in sorted"
          :key="c._id"
          :class="['conv-item', { 'conv-item--active': c._id === store.activeConversationId }]"
          @click="onPick(c._id)"
        >
          <UserAvatar :user="primaryParticipant(c)" :size="40" />
          <div class="conv-item-main">
            <div class="conv-item-row">
              <span class="conv-item-title">{{ titleOf(c) }}</span>
              <span v-if="c.lastMessageAt" class="conv-item-time">
                {{ formatTime(c.lastMessageAt) }}
              </span>
            </div>
            <div class="conv-item-row">
              <span class="conv-item-preview">{{ c.lastMessagePreview || $t('messaging.noMessages') }}</span>
              <Badge
                v-if="(c.unreadCount ?? 0) > 0"
                :value="c.unreadCount"
                severity="info"
              />
            </div>
          </div>
        </li>
      </ul>
    </ScrollPanel>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import ScrollPanel from 'primevue/scrollpanel';
import { useMessagingStore, type ChatConversation, type MessageAuthor } from '../../stores/messaging';
import { useAuthStore } from '../../stores/auth';
import UserAvatar from './UserAvatar.vue';

const emit = defineEmits<{ pick: [id: string] }>();

const { locale, t } = useI18n();
const store = useMessagingStore();
const auth = useAuthStore();

const sorted = computed(() =>
  [...store.conversations].sort((a, b) => {
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bt - at;
  })
);

function titleOf(c: ChatConversation): string {
  if (c.type === 'channel-dossier') return t('messaging.channelDossierLabel');
  // Direct: use the other participant's name
  const me = auth.user?._id;
  const other = c.participants.find((p) => p._id !== me);
  return displayName(other);
}

function primaryParticipant(c: ChatConversation): MessageAuthor | undefined {
  if (c.type === 'channel-dossier') return c.participants[0];
  const me = auth.user?._id;
  return c.participants.find((p) => p._id !== me) ?? c.participants[0];
}

function displayName(u?: MessageAuthor): string {
  if (!u) return t('messaging.unknownUser');
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' });
}

function onPick(id: string): void {
  store.setActiveConversation(id);
  emit('pick', id);
}
</script>

<style scoped>
.conv-list { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.conv-list-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--me-border); flex-shrink: 0; }
.conv-list-header h2 { margin: 0; font-size: 14px; font-weight: 700; color: var(--me-text-primary); }

.conv-list-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 16px; color: var(--me-text-muted); font-size: 13px; flex: 1; justify-content: center; }
.conv-list-empty i { font-size: 30px; }

.conv-items-scroll { flex: 1; min-height: 0; }
.conv-items { list-style: none; margin: 0; padding: 6px; display: flex; flex-direction: column; gap: 2px; }
.conv-item { display: flex; gap: 10px; padding: 8px 10px; border-radius: var(--me-radius-sm); cursor: pointer; transition: background 0.12s; align-items: center; }
.conv-item:hover { background: var(--me-bg-elevated); }
.conv-item--active { background: var(--me-accent-glow); }

.conv-item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.conv-item-row { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
.conv-item-title { font-size: 13px; font-weight: 600; color: var(--me-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.conv-item-time { font-size: 10px; color: var(--me-text-muted); flex-shrink: 0; }
.conv-item-preview { font-size: 12px; color: var(--me-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
</style>
