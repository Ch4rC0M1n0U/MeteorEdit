<template>
  <div class="comment-sidebar" :class="{ open: modelValue }">
    <div class="cs-header">
      <h3 class="cs-title mono">
        <v-icon size="18" class="mr-1">mdi-comment-text-outline</v-icon>
        Commentaires
        <span v-if="comments.length" class="cs-count">{{ comments.length }}</span>
      </h3>
      <button class="cs-close" @click="$emit('update:modelValue', false)">
        <v-icon size="18">mdi-close</v-icon>
      </button>
    </div>

    <div class="cs-form">
      <textarea
        v-model="newComment"
        class="cs-input"
        placeholder="Ajouter un commentaire..."
        rows="2"
        @keydown.ctrl.enter="postComment"
      />
      <button class="cs-send" :disabled="!newComment.trim() || posting" @click="postComment">
        <v-icon size="16">mdi-send</v-icon>
      </button>
    </div>

    <div class="cs-list" ref="listRef">
      <div v-if="loading" class="cs-empty">Chargement...</div>
      <div v-else-if="!comments.length" class="cs-empty">Aucun commentaire</div>
      <div v-for="c in comments" :key="c._id" class="cs-comment">
        <div class="cs-comment-header">
          <img v-if="c.user?.avatarUrl" :src="c.user.avatarUrl" class="cs-avatar cs-avatar-img" :alt="c.user.name" />
          <span v-else class="cs-avatar" :style="{ background: hashColor(c.user?.name || '') }">
            {{ getInitials(c.user?.name || '?') }}
          </span>
          <div class="cs-meta">
            <span class="cs-author">{{ c.user?.name }}</span>
            <span class="cs-time">{{ formatTime(c.createdAt) }}</span>
          </div>
          <button
            v-if="c.canDelete"
            class="cs-delete"
            @click="removeComment(c._id)"
            title="Supprimer"
          >
            <v-icon size="14">mdi-delete-outline</v-icon>
          </button>
        </div>
        <p class="cs-body">{{ c.content }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import api, { SERVER_URL } from '../../services/api';
import { useAuthStore } from '../../stores/auth';

interface CommentData {
  _id: string;
  content: string;
  createdAt: string;
  user: { name: string; avatarUrl: string | null };
  canDelete: boolean;
}

const props = defineProps<{ modelValue: boolean; nodeId: string }>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'count-change': [count: number];
}>();

const authStore = useAuthStore();
const comments = ref<CommentData[]>([]);
const newComment = ref('');
const loading = ref(false);
const posting = ref(false);
const listRef = ref<HTMLElement | null>(null);

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "a l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function mapComment(raw: any): CommentData {
  const userId = raw.userId;
  const name = userId ? `${userId.firstName} ${userId.lastName}` : 'Inconnu';
  const avatarPath = userId?.avatarPath;
  return {
    _id: raw._id,
    content: raw.content,
    createdAt: raw.createdAt,
    user: {
      name,
      avatarUrl: avatarPath ? `${SERVER_URL}/${avatarPath}` : null,
    },
    canDelete: (userId?._id === authStore.user?.id) || authStore.isAdmin,
  };
}

async function fetchComments() {
  loading.value = true;
  try {
    const { data } = await api.get(`/nodes/${props.nodeId}/comments`);
    comments.value = data.map(mapComment);
    emit('count-change', comments.value.length);
  } finally {
    loading.value = false;
  }
}

async function postComment() {
  if (!newComment.value.trim() || posting.value) return;
  posting.value = true;
  try {
    const { data } = await api.post(`/nodes/${props.nodeId}/comments`, { content: newComment.value });
    comments.value.unshift(mapComment(data));
    newComment.value = '';
    emit('count-change', comments.value.length);
  } finally {
    posting.value = false;
  }
}

async function removeComment(id: string) {
  await api.delete(`/comments/${id}`);
  comments.value = comments.value.filter(c => c._id !== id);
  emit('count-change', comments.value.length);
}

// Fetch on open or nodeId change
watch(() => props.modelValue, (open) => {
  if (open) fetchComments();
});

watch(() => props.nodeId, () => {
  comments.value = [];
  if (props.modelValue) fetchComments();
});

onMounted(() => {
  // Fetch count on mount
  api.get(`/nodes/${props.nodeId}/comments/count`).then(({ data }) => {
    emit('count-change', data.count);
  });
});
</script>

<style scoped>
.comment-sidebar {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 340px;
  background: var(--me-bg-surface);
  border-left: 1px solid var(--me-border);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 0.25s ease;
  z-index: 20;
}
.comment-sidebar.open {
  transform: translateX(0);
}
.cs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
}
.cs-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.cs-count {
  background: var(--me-accent);
  color: var(--me-bg-deep);
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 10px;
  margin-left: 4px;
}
.cs-close {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--me-radius-xs);
}
.cs-close:hover {
  color: var(--me-text-primary);
  background: var(--me-accent-glow);
}
.cs-form {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
}
.cs-input {
  flex: 1;
  resize: none;
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs);
  padding: 8px 10px;
  font-size: 13px;
  background: var(--me-bg-base);
  color: var(--me-text-primary);
  font-family: inherit;
}
.cs-input:focus {
  outline: none;
  border-color: var(--me-accent);
}
.cs-send {
  align-self: flex-end;
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  width: 32px;
  height: 32px;
  border-radius: var(--me-radius-xs);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cs-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.cs-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
.cs-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--me-text-muted);
  font-size: 13px;
}
.cs-comment {
  padding: 10px 16px;
  border-bottom: 1px solid var(--me-border);
}
.cs-comment:last-child {
  border-bottom: none;
}
.cs-comment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.cs-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  font-family: var(--me-font-mono);
  flex-shrink: 0;
}
.cs-avatar-img {
  object-fit: cover;
}
.cs-meta {
  flex: 1;
  min-width: 0;
}
.cs-author {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--me-text-primary);
  line-height: 1.2;
}
.cs-time {
  display: block;
  font-size: 11px;
  color: var(--me-text-muted);
  font-family: var(--me-font-mono);
}
.cs-delete {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--me-radius-xs);
  opacity: 0;
  transition: opacity 0.15s;
}
.cs-comment:hover .cs-delete {
  opacity: 1;
}
.cs-delete:hover {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}
.cs-body {
  font-size: 13px;
  color: var(--me-text-secondary);
  line-height: 1.5;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
