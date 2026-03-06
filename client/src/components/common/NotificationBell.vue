<template>
  <div class="notif-bell-wrapper" ref="wrapperRef">
    <button class="notif-bell-btn" @click="toggleDropdown" title="Notifications">
      <v-icon size="20">mdi-bell-outline</v-icon>
      <span v-if="unreadCount > 0" class="notif-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <div v-if="open" class="notif-dropdown glass-card">
      <div class="notif-dropdown-header">
        <span class="notif-dropdown-title">Notifications</span>
        <button v-if="unreadCount > 0" class="notif-mark-all" @click="handleMarkAllRead">Tout lire</button>
      </div>

      <div class="notif-dropdown-list">
        <div
          v-for="notif in notifications"
          :key="notif._id"
          class="notif-item"
          :class="{ 'notif-item--unread': !notif.read }"
          @click="handleClick(notif)"
        >
          <div class="notif-item-icon">
            <v-icon size="18" :color="notif.read ? undefined : 'var(--me-accent)'">{{ iconFor(notif.type) }}</v-icon>
          </div>
          <div class="notif-item-content">
            <span class="notif-item-message">{{ notif.message }}</span>
            <span class="notif-item-time mono">{{ timeAgo(notif.createdAt) }}</span>
          </div>
          <span v-if="!notif.read" class="notif-unread-dot" />
        </div>

        <div v-if="notifications.length === 0" class="notif-empty">
          Aucune notification
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useNotifications } from '../../composables/useNotifications';
import { useDossierStore } from '../../stores/dossier';

const { notifications, unreadCount, fetchNotifications, markRead, markAllRead, setupSocketListener, cleanupSocketListener } = useNotifications();
const dossierStore = useDossierStore();

const open = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);

function toggleDropdown() {
  open.value = !open.value;
}

function iconFor(type: string): string {
  switch (type) {
    case 'collaborator.added': return 'mdi-account-plus';
    case 'collaborator.removed': return 'mdi-account-minus';
    case 'dossier.updated': return 'mdi-folder-edit';
    case 'node.updated': return 'mdi-note-edit';
    default: return 'mdi-bell-outline';
  }
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'A l\'instant';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

async function handleClick(notif: { _id: string; read: boolean; dossierId: string | null }) {
  if (!notif.read) {
    await markRead(notif._id);
  }
  if (notif.dossierId) {
    dossierStore.openDossier(notif.dossierId);
    open.value = false;
  }
}

async function handleMarkAllRead() {
  await markAllRead();
}

function onClickOutside(e: MouseEvent) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => {
  fetchNotifications();
  setupSocketListener();
  document.addEventListener('click', onClickOutside);
});

onUnmounted(() => {
  cleanupSocketListener();
  document.removeEventListener('click', onClickOutside);
});
</script>

<style scoped>
.notif-bell-wrapper {
  position: relative;
}

.notif-bell-btn {
  position: relative;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.notif-bell-btn:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}

.notif-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--me-accent);
  color: var(--me-bg-deep);
  font-size: 10px;
  font-weight: 700;
  font-family: var(--me-font-mono);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.notif-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 360px;
  z-index: 200;
  padding: 0;
  overflow: hidden;
}

.notif-dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--me-border);
}

.notif-dropdown-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--me-text-primary);
}

.notif-mark-all {
  background: none;
  border: none;
  color: var(--me-accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--me-radius-xs);
  transition: background 0.15s;
}

.notif-mark-all:hover {
  background: var(--me-accent-glow);
}

.notif-dropdown-list {
  max-height: 400px;
  overflow-y: auto;
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.notif-item:hover {
  background: var(--me-accent-glow);
}

.notif-item--unread {
  background: var(--me-bg-elevated);
}

.notif-item-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-surface);
}

.notif-item-content {
  flex: 1;
  min-width: 0;
}

.notif-item-message {
  display: block;
  font-size: 13px;
  color: var(--me-text-primary);
  line-height: 1.4;
}

.notif-item-time {
  display: block;
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: 2px;
}

.notif-unread-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--me-accent);
  margin-top: 6px;
}

.notif-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--me-text-muted);
  font-size: 13px;
}
</style>
