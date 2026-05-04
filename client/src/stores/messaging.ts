import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';
import { getSocket } from '../services/socket';

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
  createdAt: string;
  updatedAt: string;
}

export interface ChatConversation {
  _id: string;
  type: 'channel-dossier' | 'direct';
  dossierId?: string | null;
  participants: MessageAuthor[];
  adminId?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount?: number;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReadState {
  userId: string;
  lastReadMessageId: string;
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
  };
});
