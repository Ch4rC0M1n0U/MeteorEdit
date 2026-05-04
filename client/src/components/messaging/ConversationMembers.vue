<template>
  <aside class="conv-members">
    <header class="conv-members-header">
      <h3>{{ $t('messaging.members') }}</h3>
      <Tag :value="String(participants.length)" severity="secondary" rounded />
    </header>

    <ScrollPanel class="conv-members-scroll">
      <ul class="conv-members-list">
        <li
          v-for="p in participants"
          :key="p._id"
          class="conv-member"
        >
          <UserAvatar :user="p" :size="32" />
          <div class="conv-member-info">
            <span class="conv-member-name">
              {{ displayName(p) }}
              <span v-if="p._id === auth.user?.id" class="conv-member-you">{{ $t('messaging.you') }}</span>
            </span>
            <span v-if="p._id === conversation?.adminId" class="conv-member-role">
              <i class="pi pi-star-fill" /> {{ $t('messaging.channelAdmin') }}
            </span>
          </div>
        </li>
      </ul>
    </ScrollPanel>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Tag from 'primevue/tag';
import ScrollPanel from 'primevue/scrollpanel';
import { useMessagingStore, type ChatConversation, type MessageAuthor } from '../../stores/messaging';
import { useAuthStore } from '../../stores/auth';
import UserAvatar from './UserAvatar.vue';

const props = defineProps<{ conversationId: string }>();

const { t } = useI18n();
const store = useMessagingStore();
const auth = useAuthStore();

const conversation = computed<ChatConversation | undefined>(() =>
  store.conversations.find((c) => c._id === props.conversationId)
);

const participants = computed<MessageAuthor[]>(() => conversation.value?.participants ?? []);

function displayName(u: MessageAuthor): string {
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;
}
</script>

<style scoped>
.conv-members {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-left: 1px solid var(--me-border);
  background: var(--me-bg-surface);
}

.conv-members-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--me-border);
}
.conv-members-header h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--me-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.conv-members-scroll { flex: 1; min-height: 0; }
.conv-members-list { list-style: none; margin: 0; padding: 6px; display: flex; flex-direction: column; gap: 2px; }

.conv-member { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--me-radius-sm); }
.conv-member:hover { background: var(--me-bg-elevated); }

.conv-member-info { display: flex; flex-direction: column; min-width: 0; }
.conv-member-name { font-size: 13px; font-weight: 600; color: var(--me-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.conv-member-you { font-size: 11px; color: var(--me-text-muted); margin-left: 4px; }
.conv-member-role { font-size: 11px; color: var(--me-accent); display: inline-flex; align-items: center; gap: 4px; }
.conv-member-role i { font-size: 9px; }
</style>
