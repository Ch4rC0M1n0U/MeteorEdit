<template>
  <div class="conv-view">
    <header class="conv-view-header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        size="small"
        :title="$t('common.back')"
        class="conv-view-back"
        @click="emit('back')"
      />
      <div class="conv-view-title">
        <UserAvatar :user="primaryParticipant" :size="32" />
        <div class="conv-view-info">
          <span class="conv-view-name">{{ title }}</span>
          <span class="conv-view-meta">
            <template v-if="typingNames.length > 0">
              <i class="pi pi-pencil" /> {{ typingLabel }}
            </template>
            <template v-else>
              {{ $t('messaging.participantsCount', { n: participantCount }) }}
            </template>
          </span>
        </div>
      </div>
      <Button
        icon="pi pi-cog"
        text
        rounded
        size="small"
        :title="$t('common.actions')"
        @click="(e) => convMenu?.show(e)"
      />
      <Menu ref="convMenu" :model="convMenuModel" :popup="true" />
    </header>

    <div ref="scrollEl" class="conv-view-body">
      <div v-if="hasMore" class="conv-view-load-more">
        <Button
          :label="$t('messaging.loadMore')"
          icon="pi pi-arrow-up"
          text
          size="small"
          :loading="loadingMore"
          @click="onLoadMore"
        />
      </div>

      <div v-if="messages.length === 0" class="conv-view-empty">
        <i class="pi pi-comments" />
        <span>{{ $t('messaging.startTalking') }}</span>
      </div>

      <ul v-else class="conv-msgs">
        <li
          v-for="(m, i) in messages"
          :key="m._id"
          :class="['conv-msg', { 'conv-msg--mine': isMine(m), 'conv-msg--first-of-day': showDayHeader(i) }]"
        >
          <div v-if="showDayHeader(i)" class="conv-msg-day-header">
            <Tag :value="formatDay(m.createdAt)" severity="secondary" rounded />
          </div>

          <div class="conv-msg-row">
            <UserAvatar v-if="!isMine(m)" :user="authorOf(m)" :size="28" class="conv-msg-avatar" />
            <div class="conv-msg-bubble">
              <div v-if="!isMine(m) && showAuthor(i)" class="conv-msg-author">
                {{ authorName(m) }}
              </div>

              <div v-if="m.replyTo" class="conv-msg-quote">
                <i class="pi pi-reply" />
                <span>{{ quotedBody(m.replyTo) }}</span>
              </div>

              <p class="conv-msg-body">{{ bodyOf(m) }}</p>

              <div v-if="reactionsOf(m._id).length > 0" class="conv-msg-reactions">
                <button
                  v-for="r in reactionsOf(m._id)"
                  :key="r.emoji"
                  type="button"
                  :class="['conv-msg-reaction', { 'conv-msg-reaction--mine': r.mine }]"
                  @click="onToggleReaction(m._id, r.emoji, r.mine)"
                >
                  <span>{{ r.emoji }}</span>
                  <span class="conv-msg-reaction-count">{{ r.count }}</span>
                </button>
              </div>

              <div class="conv-msg-footer">
                <span v-if="m.pinnedAt" class="conv-msg-pin" :title="$t('messaging.pinned')">
                  <i class="pi pi-bookmark-fill" />
                </span>
                <span class="conv-msg-time">{{ formatTime(m.createdAt) }}</span>
                <span v-if="m.editedAt" class="conv-msg-edited">{{ $t('messaging.edited') }}</span>
                <span v-if="isMine(m)" class="conv-msg-status" :title="readStatusTitle(m)">
                  <i :class="readStatusIcon(m)" />
                </span>
              </div>
            </div>
            <Button
              v-if="!m.deletedAt"
              icon="pi pi-face-smile"
              text
              rounded
              size="small"
              class="conv-msg-actions"
              :title="$t('messaging.addReaction')"
              @click="(e) => openEmojiPicker(e, m)"
            />
            <Button
              v-if="!m.deletedAt"
              icon="pi pi-ellipsis-v"
              text
              rounded
              size="small"
              class="conv-msg-actions"
              :title="$t('common.actions')"
              @click="(e) => openActions(e, m)"
            />
          </div>
        </li>
      </ul>
    </div>

    <Menu ref="actionsMenu" :model="actionsModel" :popup="true" />
    <Menu ref="emojiMenu" :model="emojiModel" :popup="true" class="conv-emoji-menu" />

    <Dialog
      v-model:visible="editOpen"
      modal
      dismissable-mask
      :header="$t('messaging.editPrompt')"
      :style="{ width: 'min(92vw, 520px)' }"
    >
      <Textarea v-model="editDraft" rows="4" autoResize :maxlength="4000" class="w-full" />
      <template #footer>
        <Button :label="$t('common.cancel')" text @click="editOpen = false" />
        <Button
          :label="$t('common.save')"
          icon="pi pi-check"
          :disabled="!editDraft.trim()"
          @click="confirmEdit"
        />
      </template>
    </Dialog>

    <ConfirmDialog />

    <div v-if="replyToTarget" class="conv-view-reply-banner">
      <i class="pi pi-reply" />
      <span class="conv-view-reply-quote">{{ quotedBody(replyToTarget._id) }}</span>
      <Button
        icon="pi pi-times"
        text
        rounded
        size="small"
        @click="replyToTarget = null"
      />
    </div>

    <footer class="conv-view-input">
      <Textarea
        v-model="draft"
        :placeholder="$t('messaging.typeMessage')"
        rows="1"
        autoResize
        :maxlength="4000"
        @input="onInput"
        @keydown="onKeydown"
        class="conv-view-textarea"
      />
      <Button
        icon="pi pi-send"
        rounded
        :disabled="!canSend"
        :loading="store.sending"
        :title="$t('messaging.send')"
        @click="onSend"
      />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import Tag from 'primevue/tag';
import Menu from 'primevue/menu';
import Dialog from 'primevue/dialog';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useMessagingStore, conversationTitle, conversationPeer, type ChatMessage, type MessageAuthor } from '../../stores/messaging';
import { useAuthStore } from '../../stores/auth';
import UserAvatar from './UserAvatar.vue';

const props = defineProps<{ conversationId: string }>();
const emit = defineEmits<{ back: [] }>();

const { t, locale } = useI18n();
const store = useMessagingStore();
const auth = useAuthStore();
const confirm = useConfirm();

const draft = ref('');
const editOpen = ref(false);
const editDraft = ref('');
const editTarget = ref<ChatMessage | null>(null);
const replyToTarget = ref<ChatMessage | null>(null);
const emojiMenu = ref<{ show: (e: Event) => void; hide: () => void } | null>(null);
const emojiTarget = ref<ChatMessage | null>(null);

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🙏', '🔥', '💯', '✅', '❌'];

const convMenu = ref<{ show: (e: Event) => void; hide: () => void } | null>(null);

const convMenuModel = computed(() => {
  const c = conversation.value;
  if (!c) return [];
  const meId = auth.user?.id;
  const isOwner = String(c.adminId ?? '') === meId;
  const isChannel = c.type === 'channel-dossier';
  const items: any[] = [
    { label: t('messaging.exportConv'), icon: 'pi pi-download', command: () => onExport() },
  ];
  if (!isChannel || isOwner) {
    items.push({
      label: c.archivedAt ? t('messaging.unarchive') : t('messaging.archive'),
      icon: c.archivedAt ? 'pi pi-folder-open' : 'pi pi-inbox',
      command: () => c.archivedAt ? store.unarchive(c._id) : store.archive(c._id),
    });
  }
  return items;
});

async function onExport(): Promise<void> {
  const data = await store.exportData(props.conversationId);
  const me = auth.user?.id;
  const lines: string[] = [
    `# Export — ${title.value}`,
    `Exported: ${new Date().toISOString()}`,
    '',
  ];
  for (const m of data.messages) {
    const author = typeof m.authorId === 'object' && m.authorId
      ? `${m.authorId.firstName ?? ''} ${m.authorId.lastName ?? ''}`.trim() || m.authorId.email
      : 'Unknown';
    let body = m.body;
    if (m.isEncrypted && me) {
      const list = store.messagesByConv.get(props.conversationId) ?? [];
      const fresh = list.find((x) => x._id === m._id);
      if (fresh) {
        const plain = await store.decryptDmMessage(fresh, me);
        body = plain ?? '[unable to decrypt]';
      } else {
        body = '[unable to decrypt]';
      }
    }
    const date = new Date(m.createdAt).toISOString();
    const pinned = m.pinnedAt ? ' 📌' : '';
    lines.push(`**${author}** — _${date}_${pinned}`);
    lines.push(body);
    lines.push('');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `conversation-${props.conversationId}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function quotedBody(messageId: string): string {
  const list = store.messagesByConv.get(props.conversationId) ?? [];
  const m = list.find((x) => x._id === messageId);
  if (!m) return t('messaging.deletedQuote');
  if (m.deletedAt) return t('messaging.deletedQuote');
  if (m.isEncrypted) {
    return decryptedBodies.value.get(m._id) ?? t('messaging.encryptedPlaceholder');
  }
  const b = m.body.replace(/\s+/g, ' ').trim();
  return b.length > 100 ? b.slice(0, 97) + '…' : b;
}

function reactionsOf(messageId: string): Array<{ emoji: string; count: number; mine: boolean }> {
  const me = auth.user?.id;
  const map = store.reactionsByConv.get(props.conversationId)?.get(messageId);
  if (!map) return [];
  const out: Array<{ emoji: string; count: number; mine: boolean }> = [];
  for (const [emoji, users] of map.entries()) {
    out.push({ emoji, count: users.size, mine: !!me && users.has(me) });
  }
  return out;
}

async function onToggleReaction(messageId: string, emoji: string, mine: boolean): Promise<void> {
  if (mine) await store.removeReaction(messageId, emoji);
  else await store.addReaction(messageId, emoji);
}

function openEmojiPicker(e: Event, m: ChatMessage): void {
  emojiTarget.value = m;
  emojiMenu.value?.show(e);
}

function pickEmoji(emoji: string): void {
  if (!emojiTarget.value) return;
  const me = auth.user?.id;
  const existing = reactionsOf(emojiTarget.value._id).find((r) => r.emoji === emoji);
  if (existing?.mine && me) onToggleReaction(emojiTarget.value._id, emoji, true);
  else onToggleReaction(emojiTarget.value._id, emoji, false);
  emojiMenu.value?.hide();
}

const emojiModel = computed(() =>
  REACTION_EMOJIS.map((emoji) => ({
    label: emoji,
    command: () => pickEmoji(emoji),
  }))
);
const scrollEl = ref<HTMLElement | null>(null);
const loadingMore = ref(false);
const typingDebounce = ref<number | null>(null);
const lastTypingSignal = ref(0);
const actionsMenu = ref<{ show: (e: Event) => void; hide: () => void } | null>(null);
const actionsTarget = ref<ChatMessage | null>(null);

const conversation = computed(() => store.activeConversation);
const messages = computed<ChatMessage[]>(() =>
  store.messagesByConv.get(props.conversationId) ?? []
);
const hasMore = computed(() => store.hasMoreByConv.get(props.conversationId) ?? false);

const primaryParticipant = computed<MessageAuthor | undefined>(() =>
  conversation.value ? conversationPeer(conversation.value, auth.user?.id) : undefined
);

const title = computed(() => {
  if (!conversation.value) return '';
  return conversationTitle(conversation.value, auth.user?.id) || t('messaging.channelDossierLabel');
});

const participantCount = computed(() => conversation.value?.participants.length ?? 0);

const typingNames = computed(() => {
  const ids = store.typingByConv.get(props.conversationId) ?? new Set<string>();
  const me = auth.user?.id;
  return Array.from(ids)
    .filter((id) => id !== me)
    .map((id) => {
      const p = conversation.value?.participants.find((x) => x._id === id);
      if (!p) return t('messaging.someone');
      return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.email;
    });
});

const typingLabel = computed(() => {
  if (typingNames.value.length === 1) return t('messaging.isTyping', { name: typingNames.value[0] });
  if (typingNames.value.length > 1) return t('messaging.peopleTyping', { n: typingNames.value.length });
  return '';
});

const canSend = computed(() => draft.value.trim().length > 0 && !store.sending);

function isMine(m: ChatMessage): boolean {
  const id = typeof m.authorId === 'string' ? m.authorId : m.authorId._id;
  return id === auth.user?.id;
}

function authorOf(m: ChatMessage): MessageAuthor | undefined {
  if (typeof m.authorId === 'string') {
    return conversation.value?.participants.find((p) => p._id === m.authorId);
  }
  return m.authorId;
}

function authorName(m: ChatMessage): string {
  const u = authorOf(m);
  if (!u) return t('messaging.unknownUser');
  return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email;
}

const decryptedBodies = ref<Map<string, string>>(new Map());

function bodyOf(m: ChatMessage): string {
  if (m.deletedAt) return t('messaging.messageDeleted');
  if (m.isEncrypted) {
    return decryptedBodies.value.get(m._id) ?? t('messaging.encryptedPlaceholder');
  }
  return m.body;
}

async function decryptVisible(): Promise<void> {
  const me = auth.user?.id;
  if (!me) return;
  for (const m of messages.value) {
    if (!m.isEncrypted || decryptedBodies.value.has(m._id)) continue;
    const plain = await store.decryptDmMessage(m, me);
    if (plain !== null) decryptedBodies.value.set(m._id, plain);
  }
}

function showDayHeader(i: number): boolean {
  if (i === 0) return true;
  const prev = messages.value[i - 1];
  const cur = messages.value[i];
  return new Date(prev.createdAt).toDateString() !== new Date(cur.createdAt).toDateString();
}

function showAuthor(i: number): boolean {
  if (i === 0) return true;
  const prev = messages.value[i - 1];
  const cur = messages.value[i];
  const prevAuthor = typeof prev.authorId === 'string' ? prev.authorId : prev.authorId._id;
  const curAuthor = typeof cur.authorId === 'string' ? cur.authorId : cur.authorId._id;
  if (prevAuthor !== curAuthor) return true;
  return showDayHeader(i);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(locale.value, { weekday: 'long', day: 'numeric', month: 'long' });
}

function readStatusIcon(m: ChatMessage): string {
  // ✓ sent / ✓✓ read by all others
  const reads = store.readsByConv.get(props.conversationId) ?? [];
  const me = auth.user?.id;
  const others = (conversation.value?.participants ?? []).filter((p) => p._id !== me);
  if (others.length === 0) return 'pi pi-check';
  const allRead = others.every((p) => {
    const r = reads.find((x) => x.userId === p._id);
    if (!r) return false;
    return String(r.lastReadMessageId) >= String(m._id);
  });
  return allRead ? 'pi pi-check-circle conv-msg-status--read' : 'pi pi-check';
}

function readStatusTitle(m: ChatMessage): string {
  return readStatusIcon(m).includes('check-circle') ? t('messaging.readByAll') : t('messaging.sent');
}

const actionsModel = computed(() => {
  const m = actionsTarget.value;
  if (!m) return [];
  const meId = auth.user?.id;
  const isMine = (typeof m.authorId === 'string' ? m.authorId : m.authorId._id) === meId;
  const isAdmin = String(conversation.value?.adminId ?? '') === meId;
  const items: any[] = [
    { label: t('messaging.reply'), icon: 'pi pi-reply', command: () => { replyToTarget.value = m; } },
    { label: m.pinnedAt ? t('messaging.unpin') : t('messaging.pin'),
      icon: m.pinnedAt ? 'pi pi-bookmark' : 'pi pi-bookmark-fill',
      visible: isMine || isAdmin,
      command: () => store.togglePin(m._id) },
  ];
  if (isMine) {
    items.push({ separator: true });
    items.push({ label: t('common.edit'), icon: 'pi pi-pencil', command: () => onEdit(m) });
    items.push({ label: t('common.delete'), icon: 'pi pi-trash', command: () => onDelete(m) });
  }
  return items;
});

function openActions(e: Event, m: ChatMessage): void {
  actionsTarget.value = m;
  actionsMenu.value?.show(e);
}

function onEdit(m: ChatMessage): void {
  editTarget.value = m;
  editDraft.value = m.body;
  editOpen.value = true;
}

async function confirmEdit(): Promise<void> {
  const trimmed = editDraft.value.trim();
  if (!trimmed || !editTarget.value) {
    editOpen.value = false;
    return;
  }
  await store.editMessage(editTarget.value._id, trimmed);
  editOpen.value = false;
  editTarget.value = null;
  editDraft.value = '';
}

function onDelete(m: ChatMessage): void {
  confirm.require({
    message: t('messaging.deleteConfirm'),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('common.delete'),
    rejectLabel: t('common.cancel'),
    accept: async () => {
      await store.deleteMessage(m._id);
    },
  });
}

async function onLoadMore(): Promise<void> {
  if (loadingMore.value || messages.value.length === 0) return;
  loadingMore.value = true;
  try {
    const oldest = messages.value[0];
    await store.loadMessages(props.conversationId, oldest._id);
  } finally {
    loadingMore.value = false;
  }
}

function onInput(): void {
  const now = Date.now();
  if (now - lastTypingSignal.value > 2500) {
    lastTypingSignal.value = now;
    store.emitTyping(props.conversationId, true);
  }
  if (typingDebounce.value) window.clearTimeout(typingDebounce.value);
  typingDebounce.value = window.setTimeout(() => {
    store.emitTyping(props.conversationId, false);
    lastTypingSignal.value = 0;
  }, 4000);
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    onSend();
  }
}

async function onSend(): Promise<void> {
  if (!canSend.value) return;
  const body = draft.value.trim();
  draft.value = '';
  store.emitTyping(props.conversationId, false);

  const replyToId = replyToTarget.value?._id;
  replyToTarget.value = null;

  try {
    if (conversation.value?.type === 'direct') {
      const me = auth.user?.id;
      if (!me) throw new Error('Not authenticated');
      await store.sendDmMessage(conversation.value, body, me);
      // Cache local plaintext so we don't need to decrypt our own message
      const list = store.messagesByConv.get(props.conversationId) ?? [];
      const last = list[list.length - 1];
      if (last && last.isEncrypted) decryptedBodies.value.set(last._id, body);
    } else {
      await store.sendMessage(props.conversationId, body, replyToId ? { replyTo: replyToId } : undefined);
    }
  } catch (err: any) {
    // Restore draft on error so the user doesn't lose their message
    draft.value = body;
    throw err;
  }

  await nextTick();
  scrollToBottom();
  await markLatestAsRead();
}

function scrollToBottom(): void {
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  }
}

async function markLatestAsRead(): Promise<void> {
  const last = messages.value[messages.value.length - 1];
  if (!last) return;
  await store.markAsRead(props.conversationId, last._id).catch(() => { /* ignore */ });
}

watch(messages, async (curr, prev) => {
  await decryptVisible();
  if (curr.length > (prev?.length ?? 0)) {
    await nextTick();
    // Only auto-scroll if we are near the bottom already
    if (scrollEl.value) {
      const dist = scrollEl.value.scrollHeight - scrollEl.value.scrollTop - scrollEl.value.clientHeight;
      if (dist < 200) scrollToBottom();
    }
    await markLatestAsRead();
  }
}, { flush: 'post' });

onMounted(async () => {
  await store.loadMessages(props.conversationId);
  await store.loadReactions(props.conversationId).catch(() => { /* ignore */ });
  await decryptVisible();
  await nextTick();
  scrollToBottom();
  await markLatestAsRead();
});

onBeforeUnmount(() => {
  if (typingDebounce.value) window.clearTimeout(typingDebounce.value);
  store.emitTyping(props.conversationId, false);
});
</script>

<style scoped>
.conv-view { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--me-bg-app); }

.conv-view-header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--me-border); background: var(--me-bg-surface); flex-shrink: 0; }
.conv-view-back { flex-shrink: 0; }
.conv-view-title { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.conv-view-info { display: flex; flex-direction: column; min-width: 0; }
.conv-view-name { font-size: 14px; font-weight: 700; color: var(--me-text-primary); }
.conv-view-meta { font-size: 11px; color: var(--me-text-muted); display: flex; align-items: center; gap: 4px; }
.conv-view-meta i { font-size: 10px; }

.conv-view-body { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; }
.conv-view-load-more { display: flex; justify-content: center; margin-bottom: 8px; }
.conv-view-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px 16px; color: var(--me-text-muted); font-size: 13px; }
.conv-view-empty i { font-size: 36px; }

.conv-msgs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.conv-msg { display: flex; flex-direction: column; gap: 4px; }
.conv-msg-day-header { display: flex; justify-content: center; padding: 10px 0; }

.conv-msg-row { display: flex; gap: 8px; align-items: flex-end; }
.conv-msg--mine .conv-msg-row { justify-content: flex-end; }
.conv-msg-avatar { flex-shrink: 0; }

.conv-msg-bubble {
  max-width: 75%;
  padding: 8px 12px;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: 14px 14px 14px 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.conv-msg--mine .conv-msg-bubble {
  background: var(--me-accent-glow);
  border-color: var(--me-accent);
  color: var(--me-text-primary);
  border-radius: 14px 14px 4px 14px;
}
.conv-msg-author { font-size: 11px; font-weight: 700; color: var(--me-accent); }
.conv-msg-body { margin: 0; font-size: 13px; line-height: 1.45; color: var(--me-text-primary); white-space: pre-wrap; word-break: break-word; }
.conv-msg-footer { display: flex; gap: 6px; align-items: center; justify-content: flex-end; margin-top: 2px; }
.conv-msg-time { font-size: 10px; color: var(--me-text-muted); }
.conv-msg-edited { font-size: 10px; color: var(--me-text-muted); font-style: italic; }
.conv-msg-status i { font-size: 11px; color: var(--me-text-muted); }
.conv-msg-status--read { color: var(--me-accent) !important; }
.conv-msg-actions { opacity: 0; transition: opacity 0.15s; }
.conv-msg-row:hover .conv-msg-actions { opacity: 1; }

.conv-msg-quote {
  display: flex; gap: 6px; align-items: center;
  padding: 4px 8px; margin-bottom: 4px;
  border-left: 3px solid var(--me-accent);
  background: var(--me-bg-app); border-radius: 4px;
  font-size: 12px; color: var(--me-text-muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.conv-msg-quote i { font-size: 10px; }

.conv-msg-reactions { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.conv-msg-reaction {
  display: inline-flex; gap: 4px; align-items: center;
  padding: 2px 6px; border-radius: 10px;
  background: var(--me-bg-app); border: 1px solid var(--me-border);
  cursor: pointer; font-size: 12px; transition: all 0.15s;
}
.conv-msg-reaction:hover { border-color: var(--me-accent); }
.conv-msg-reaction--mine { background: var(--me-accent-glow); border-color: var(--me-accent); }
.conv-msg-reaction-count { font-size: 10px; font-weight: 700; color: var(--me-text-muted); }
.conv-msg-reaction--mine .conv-msg-reaction-count { color: var(--me-accent); }

.conv-msg-pin { color: var(--me-accent); font-size: 11px; }

.conv-view-reply-banner {
  display: flex; gap: 8px; align-items: center;
  padding: 6px 12px; background: var(--me-bg-elevated); border-top: 1px solid var(--me-border);
  font-size: 12px; color: var(--me-text-muted); flex-shrink: 0;
}
.conv-view-reply-quote {
  flex: 1; min-width: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-style: italic;
}

:deep(.conv-emoji-menu) .p-menuitem-text { font-size: 18px; }
:deep(.conv-emoji-menu) .p-menuitem { padding: 0 !important; }
:deep(.conv-emoji-menu .p-menu-list) { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px; padding: 4px; }
:deep(.conv-emoji-menu .p-menuitem-content) { padding: 6px 10px; cursor: pointer; border-radius: 6px; }
:deep(.conv-emoji-menu .p-menuitem-content:hover) { background: var(--me-accent-glow); }

.conv-view-input {
  display: flex; gap: 8px; align-items: flex-end; padding: 10px 12px;
  border-top: 1px solid var(--me-border); background: var(--me-bg-surface); flex-shrink: 0;
}
.conv-view-textarea { flex: 1; resize: none; max-height: 120px; }
</style>
