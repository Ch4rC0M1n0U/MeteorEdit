import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { encryptDmBody, decryptDmBody } from '../utils/messageEncryption';
import { useEncryptionStore } from './encryption';

export interface MessageAuthor {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  avatarUrl?: string | null;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  authorId: MessageAuthor | string;
  body: string;
  isEncrypted?: boolean;
  mentions?: string[];
  replyTo?: string | null;
  nodeRef?: { dossierId: string; nodeId: string } | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  pinnedAt?: string | null;
  pinnedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatReaction {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface ChatConversation {
  _id: string;
  type: 'channel-dossier' | 'direct';
  /** Either a string (raw id) or a populated `{ _id, title }` object after server populate */
  dossierId?: string | { _id: string; title?: string } | null;
  participants: MessageAuthor[];
  adminId?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount?: number;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Resolved display title — dossier name for channels, peer's name for DMs. */
export function conversationTitle(c: ChatConversation, currentUserId?: string): string {
  if (c.type === 'channel-dossier') {
    if (c.dossierId && typeof c.dossierId === 'object' && c.dossierId.title) {
      return c.dossierId.title;
    }
    return '';
  }
  // direct
  const other = c.participants.find((p) => p._id !== currentUserId);
  if (!other) return '';
  return `${other.firstName ?? ''} ${other.lastName ?? ''}`.trim() || other.email;
}

/** The other participant in a DM, or first participant in a channel. */
export function conversationPeer(c: ChatConversation, currentUserId?: string): MessageAuthor | undefined {
  if (c.type === 'channel-dossier') return c.participants[0];
  return c.participants.find((p) => p._id !== currentUserId) ?? c.participants[0];
}

export interface ReadState {
  userId: string;
  lastReadMessageId: string;
}

export interface DmContact {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  avatarUrl?: string | null;
}

export const useMessagingStore = defineStore('messaging', () => {
  const conversations = ref<ChatConversation[]>([]);
  const messagesByConv = ref<Map<string, ChatMessage[]>>(new Map());
  const hasMoreByConv = ref<Map<string, boolean>>(new Map());
  const typingByConv = ref<Map<string, Set<string>>>(new Map());
  const readsByConv = ref<Map<string, ReadState[]>>(new Map());
  const activeConversationId = ref<string | null>(null);
  const loading = ref(false);
  const sending = ref(false);

  let socketBound = false;

  const totalUnread = computed(() =>
    conversations.value.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)
  );

  const activeConversation = computed(() =>
    conversations.value.find((c) => c._id === activeConversationId.value) ?? null
  );

  function bindSocket(): void {
    if (socketBound) return;
    const s = getSocket();
    if (!s) return;
    socketBound = true;

    s.on('message:new', (payload: any) => {
      const msg: ChatMessage = payload.message;
      const convId: string = payload.conversationId;
      const list = messagesByConv.value.get(convId) ?? [];
      if (!list.find((m) => m._id === msg._id)) {
        list.push(msg);
        messagesByConv.value.set(convId, list);
      }
      // Update conversation preview + unread count
      const conv = conversations.value.find((c) => c._id === convId);
      if (conv) {
        conv.lastMessageAt = payload.lastMessageAt ?? msg.createdAt;
        conv.lastMessagePreview = payload.lastMessagePreview ?? '';
        if (convId !== activeConversationId.value) {
          conv.unreadCount = (conv.unreadCount ?? 0) + 1;
        }
      }
    });

    s.on('message:edit', (payload: any) => {
      const msg: ChatMessage = payload.message;
      const list = messagesByConv.value.get(payload.conversationId) ?? [];
      const idx = list.findIndex((m) => m._id === msg._id);
      if (idx >= 0) list[idx] = msg;
    });

    s.on('message:delete', (payload: any) => {
      const list = messagesByConv.value.get(payload.conversationId) ?? [];
      const target = list.find((m) => m._id === payload.messageId);
      if (target) target.deletedAt = new Date().toISOString();
    });

    s.on('typing:update', (payload: any) => {
      const set = typingByConv.value.get(payload.conversationId) ?? new Set<string>();
      if (payload.isTyping) set.add(payload.userId);
      else set.delete(payload.userId);
      typingByConv.value.set(payload.conversationId, set);
    });

    s.on('read:update', (payload: any) => {
      const list = readsByConv.value.get(payload.conversationId) ?? [];
      const idx = list.findIndex((r) => r.userId === payload.userId);
      const entry = { userId: payload.userId, lastReadMessageId: payload.lastReadMessageId };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      readsByConv.value.set(payload.conversationId, list);
    });

    s.on('reaction:add', (payload: any) => {
      applyReactionAdd(payload.conversationId, payload.messageId, payload.userId, payload.emoji);
    });

    s.on('reaction:remove', (payload: any) => {
      applyReactionRemove(payload.conversationId, payload.messageId, payload.userId, payload.emoji);
    });

    s.on('message:pin', (payload: any) => {
      const list = messagesByConv.value.get(payload.conversationId) ?? [];
      const m = list.find((x) => x._id === payload.messageId);
      if (m) {
        m.pinnedAt = payload.pinned ? (payload.pinnedAt ?? new Date().toISOString()) : null;
        m.pinnedBy = payload.pinned ? payload.pinnedBy : null;
      }
    });
  }

  function joinConversation(conversationId: string): void {
    bindSocket();
    getSocket()?.emit('conv:join', conversationId);
  }

  function leaveConversation(conversationId: string): void {
    getSocket()?.emit('conv:leave', conversationId);
  }

  function emitTyping(conversationId: string, isTyping: boolean): void {
    getSocket()?.emit(isTyping ? 'typing:start' : 'typing:stop', conversationId);
  }

  async function loadConversations(): Promise<void> {
    loading.value = true;
    try {
      const { data } = await api.get<{ conversations: ChatConversation[] }>('/messaging/conversations');
      conversations.value = data.conversations;
    } finally {
      loading.value = false;
    }
  }

  // Cache of decrypted DM bodies keyed by message _id (avoid re-decrypting)
  const decryptedCache = ref<Map<string, string>>(new Map());

  // Reactions: convId -> messageId -> emoji -> Set<userId>
  const reactionsByConv = ref<Map<string, Map<string, Map<string, Set<string>>>>>(new Map());

  function applyReactionAdd(convId: string, messageId: string, userId: string, emoji: string): void {
    let convMap = reactionsByConv.value.get(convId);
    if (!convMap) { convMap = new Map(); reactionsByConv.value.set(convId, convMap); }
    let msgMap = convMap.get(messageId);
    if (!msgMap) { msgMap = new Map(); convMap.set(messageId, msgMap); }
    let users = msgMap.get(emoji);
    if (!users) { users = new Set(); msgMap.set(emoji, users); }
    users.add(userId);
  }

  function applyReactionRemove(convId: string, messageId: string, userId: string, emoji: string): void {
    const users = reactionsByConv.value.get(convId)?.get(messageId)?.get(emoji);
    if (!users) return;
    users.delete(userId);
    if (users.size === 0) reactionsByConv.value.get(convId)?.get(messageId)?.delete(emoji);
  }

  async function loadReactions(conversationId: string): Promise<void> {
    const { data } = await api.get<{ reactions: ChatReaction[] }>(
      `/messaging/conversations/${conversationId}/reactions`
    );
    const map = new Map<string, Map<string, Set<string>>>();
    for (const r of data.reactions) {
      let msgMap = map.get(r.messageId);
      if (!msgMap) { msgMap = new Map(); map.set(r.messageId, msgMap); }
      let users = msgMap.get(r.emoji);
      if (!users) { users = new Set(); msgMap.set(r.emoji, users); }
      users.add(r.userId);
    }
    reactionsByConv.value.set(conversationId, map);
  }

  async function addReaction(messageId: string, emoji: string): Promise<void> {
    await api.post(`/messaging/messages/${messageId}/reactions`, { emoji });
  }

  async function removeReaction(messageId: string, emoji: string): Promise<void> {
    await api.delete(`/messaging/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  }

  async function togglePin(messageId: string): Promise<void> {
    await api.post(`/messaging/messages/${messageId}/pin`);
  }

  async function loadPinned(conversationId: string): Promise<ChatMessage[]> {
    const { data } = await api.get<{ messages: ChatMessage[] }>(
      `/messaging/conversations/${conversationId}/pinned`
    );
    return data.messages;
  }

  async function archive(conversationId: string): Promise<void> {
    await api.post(`/messaging/conversations/${conversationId}/archive`);
    const conv = conversations.value.find((c) => c._id === conversationId);
    if (conv) conv.archivedAt = new Date().toISOString();
  }

  async function unarchive(conversationId: string): Promise<void> {
    await api.post(`/messaging/conversations/${conversationId}/unarchive`);
    const conv = conversations.value.find((c) => c._id === conversationId);
    if (conv) conv.archivedAt = null;
  }

  async function exportData(conversationId: string): Promise<{ conversation: any; messages: any[] }> {
    const { data } = await api.get(`/messaging/conversations/${conversationId}/export`);
    return data;
  }

  async function loadDmContacts(): Promise<DmContact[]> {
    const { data } = await api.get<{ contacts: DmContact[] }>('/messaging/contacts');
    return data.contacts;
  }

  async function openDirectWith(peerId: string): Promise<ChatConversation> {
    const { data } = await api.post<{ conversation: ChatConversation }>(
      '/messaging/conversations/direct',
      { peerId }
    );
    const existing = conversations.value.find((c) => c._id === data.conversation._id);
    if (!existing) conversations.value.unshift(data.conversation);
    else Object.assign(existing, data.conversation);
    return data.conversation;
  }

  async function getPeerPublicKey(userId: string): Promise<string | null> {
    const { data } = await api.get<{ publicKey: string | null }>(
      `/messaging/users/${userId}/pubkey`
    );
    return data.publicKey;
  }

  async function sendDmMessage(
    conversation: ChatConversation,
    body: string,
    myUserId: string
  ): Promise<ChatMessage | null> {
    if (!body.trim()) return null;

    // Build recipients map: every participant of the conversation
    const recipients: Record<string, string> = {};
    for (const p of conversation.participants) {
      const pub = await getPeerPublicKey(p._id);
      if (!pub) {
        throw new Error(
          `Le destinataire ${p.firstName ?? p.email} n'a pas activé le chiffrement E2E. Demandez-lui de le configurer dans Profile > Chiffrement.`
        );
      }
      recipients[p._id] = pub;
    }
    if (!recipients[myUserId]) {
      throw new Error('Vous devez activer le chiffrement E2E sur votre compte pour envoyer un DM.');
    }

    const ciphertext = await encryptDmBody(body, recipients);
    return sendMessage(conversation._id, ciphertext, { isEncrypted: true });
  }

  async function decryptDmMessage(message: ChatMessage, myUserId: string): Promise<string | null> {
    if (!message.isEncrypted) return message.body;
    if (decryptedCache.value.has(message._id)) return decryptedCache.value.get(message._id) ?? null;
    const enc = useEncryptionStore();
    if (!enc.privateKey) return null;
    const plain = await decryptDmBody(message.body, myUserId, enc.privateKey);
    if (plain !== null) decryptedCache.value.set(message._id, plain);
    return plain;
  }

  async function openDossierChannel(dossierId: string): Promise<ChatConversation> {
    const { data } = await api.post<{ conversation: ChatConversation }>(
      `/messaging/conversations/dossier/${dossierId}`
    );
    const existing = conversations.value.find((c) => c._id === data.conversation._id);
    if (!existing) conversations.value.unshift(data.conversation);
    else Object.assign(existing, data.conversation);
    return data.conversation;
  }

  async function loadMessages(conversationId: string, before?: string): Promise<void> {
    const params: Record<string, string> = {};
    if (before) params.before = before;
    const { data } = await api.get<{ messages: ChatMessage[]; hasMore: boolean }>(
      `/messaging/conversations/${conversationId}/messages`,
      { params }
    );
    if (before) {
      const existing = messagesByConv.value.get(conversationId) ?? [];
      messagesByConv.value.set(conversationId, [...data.messages, ...existing]);
    } else {
      messagesByConv.value.set(conversationId, data.messages);
    }
    hasMoreByConv.value.set(conversationId, data.hasMore);
  }

  async function sendMessage(
    conversationId: string,
    body: string,
    extras?: {
      replyTo?: string;
      mentions?: string[];
      nodeRef?: { dossierId: string; nodeId: string };
      isEncrypted?: boolean;
    }
  ): Promise<ChatMessage | null> {
    if (!body.trim() && !extras?.isEncrypted) return null;
    sending.value = true;
    try {
      const { data } = await api.post<{ message: ChatMessage }>(
        `/messaging/conversations/${conversationId}/messages`,
        { body, ...extras }
      );
      // The socket event will deliver to other clients; for the sender,
      // ensure idempotency by adding here only if missing.
      const list = messagesByConv.value.get(conversationId) ?? [];
      if (!list.find((m) => m._id === data.message._id)) {
        list.push(data.message);
        messagesByConv.value.set(conversationId, list);
      }
      return data.message;
    } finally {
      sending.value = false;
    }
  }

  async function editMessage(messageId: string, body: string): Promise<void> {
    await api.put(`/messaging/messages/${messageId}`, { body });
  }

  async function deleteMessage(messageId: string): Promise<void> {
    await api.delete(`/messaging/messages/${messageId}`);
  }

  async function markAsRead(conversationId: string, lastReadMessageId: string): Promise<void> {
    await api.post(`/messaging/conversations/${conversationId}/read`, { lastReadMessageId });
    const conv = conversations.value.find((c) => c._id === conversationId);
    if (conv) conv.unreadCount = 0;
  }

  function setActiveConversation(id: string | null): void {
    if (activeConversationId.value && activeConversationId.value !== id) {
      leaveConversation(activeConversationId.value);
    }
    activeConversationId.value = id;
    if (id) joinConversation(id);
  }

  function reset(): void {
    conversations.value = [];
    messagesByConv.value.clear();
    hasMoreByConv.value.clear();
    typingByConv.value.clear();
    readsByConv.value.clear();
    activeConversationId.value = null;
  }

  return {
    conversations,
    messagesByConv,
    hasMoreByConv,
    typingByConv,
    readsByConv,
    activeConversationId,
    activeConversation,
    loading,
    sending,
    totalUnread,
    bindSocket,
    joinConversation,
    leaveConversation,
    emitTyping,
    loadConversations,
    openDossierChannel,
    loadMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    setActiveConversation,
    reset,
    loadDmContacts,
    openDirectWith,
    getPeerPublicKey,
    sendDmMessage,
    decryptDmMessage,
    decryptedCache,
    reactionsByConv,
    loadReactions,
    addReaction,
    removeReaction,
    togglePin,
    loadPinned,
    archive,
    unarchive,
    exportData,
  };
});
