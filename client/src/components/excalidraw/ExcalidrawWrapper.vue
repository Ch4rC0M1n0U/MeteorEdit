<template>
  <div class="excalidraw-outer">
    <div class="excalidraw-toolbar">
      <div v-if="awarenessUsers.length" class="collab-presence">
        <template v-for="u in awarenessUsers">
          <img v-if="u.avatarUrl" :key="'img-'+u.name" :src="u.avatarUrl" :alt="u.name" class="collab-user collab-user-img" :title="u.name" />
          <span v-else :key="u.name" class="collab-user" :style="{ background: u.color }" :title="u.name">
            {{ u.initials }}
          </span>
        </template>
      </div>
      <div class="ex-toolbar-spacer" />
      <slot name="toolbar-end" />
      <button class="ex-tb-btn" @click="copyAsImage" :disabled="!excalidrawApi" :title="copyMsg || 'Copier comme image'">
        <v-icon size="16">{{ copyMsg ? 'mdi-check' : 'mdi-camera' }}</v-icon>
      </button>
      <button class="ex-tb-btn ex-tb-btn-comments" :class="{ active: showComments }" @click="showComments = !showComments" title="Commentaires">
        <v-icon size="16">mdi-comment-text-outline</v-icon>
        <span v-if="commentCount" class="ex-comment-badge">{{ commentCount }}</span>
      </button>
    </div>
    <div class="excalidraw-body">
      <div ref="containerRef" class="excalidraw-container" />
      <CommentSidebar
        v-model="showComments"
        :node-id="props.nodeId"
        @count-change="commentCount = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import api, { SERVER_URL } from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import CommentSidebar from '../editor/CommentSidebar.vue';

const props = defineProps<{ data: any; nodeId: string }>();
const emit = defineEmits<{ 'update:data': [value: any] }>();
const containerRef = ref<HTMLElement | null>(null);
const copyMsg = ref('');
const showComments = ref(false);
const commentCount = ref(0);
const awarenessUsers = ref<Array<{ name: string; color: string; initials: string; avatarUrl: string | null }>>([]);
let root: Root | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let lastData: any = null;
let excalidrawApi: any = null;
let yjsSyncTimeout: ReturnType<typeof setTimeout> | null = null;

// Yjs
let ydoc: Y.Doc | null = null;
let provider: WebsocketProvider | null = null;
let yElements: Y.Map<any> | null = null;

const authStore = useAuthStore();

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 70%, 60%)`;
}

const userName = authStore.user ? `${authStore.user.firstName} ${authStore.user.lastName}` : 'Anonyme';
const userColor = hashColor(authStore.user?.id || 'default');

function setupYjs() {
  cleanupYjs();

  ydoc = new Y.Doc();
  const yjsUrl = import.meta.env.VITE_YJS_URL || 'ws://localhost:3002';
  const token = localStorage.getItem('accessToken') || '';
  provider = new WebsocketProvider(yjsUrl, `node:${props.nodeId}`, ydoc, {
    params: { token },
  });
  yElements = ydoc.getMap('excalidraw-elements');

  // Awareness (presence)
  const userAvatarUrl = authStore.user?.avatarPath ? `${SERVER_URL}/${authStore.user.avatarPath}` : null;
  provider.awareness.setLocalStateField('user', { name: userName, color: userColor, avatarUrl: userAvatarUrl });
  provider.awareness.on('change', () => {
    if (!provider) return;
    const states = Array.from(provider.awareness.getStates().values());
    awarenessUsers.value = states
      .filter((s: any) => s.user && s.user.name !== userName)
      .map((s: any) => ({ name: s.user.name, color: s.user.color, initials: s.user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2), avatarUrl: s.user.avatarUrl || null }));
  });

  // Remote element changes -> update Excalidraw
  yElements.observe((_event: any, transaction: Y.Transaction) => {
    if (transaction.local) return;
    if (!yElements || !excalidrawApi) return;
    const elements = yElements.get('elements');
    if (elements) {
      excalidrawApi.updateScene({ elements });
    }
  });

  // Initial sync
  provider.on('sync', (isSynced: boolean) => {
    if (!isSynced || !yElements) return;
    const existingElements = yElements.get('elements');
    if (!existingElements && props.data?.elements) {
      yElements.set('elements', JSON.parse(JSON.stringify(props.data.elements)));
    } else if (existingElements && excalidrawApi) {
      excalidrawApi.updateScene({ elements: existingElements });
    }
  });
}

function flushYjsSync() {
  if (yjsSyncTimeout) {
    clearTimeout(yjsSyncTimeout);
    yjsSyncTimeout = null;
  }
  if (!yElements || !ydoc || !excalidrawApi) return;
  const elements = excalidrawApi.getSceneElements();
  ydoc.transact(() => {
    yElements!.set('elements', JSON.parse(JSON.stringify(elements)));
  });
}

function cleanupYjs() {
  if (yjsSyncTimeout) {
    clearTimeout(yjsSyncTimeout);
    yjsSyncTimeout = null;
  }
  if (provider) {
    provider.destroy();
    provider = null;
  }
  if (ydoc) {
    ydoc.destroy();
    ydoc = null;
  }
  yElements = null;
  awarenessUsers.value = [];
}

function flushSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (lastData) {
    api.put(`/nodes/${props.nodeId}`, { excalidrawData: lastData });
    lastData = null;
  }
}

function scheduleSave(data: any, immediate = false) {
  lastData = data;
  if (saveTimeout) clearTimeout(saveTimeout);
  if (immediate) {
    api.put(`/nodes/${props.nodeId}`, { excalidrawData: lastData });
    lastData = null;
    return;
  }
  saveTimeout = setTimeout(() => {
    api.put(`/nodes/${props.nodeId}`, { excalidrawData: lastData });
    lastData = null;
    saveTimeout = null;
  }, 3000);
}

async function copyAsImage() {
  if (!excalidrawApi) return;
  try {
    const { exportToBlob } = await import('@excalidraw/excalidraw');
    const elements = excalidrawApi.getSceneElements();
    const appState = excalidrawApi.getAppState();
    const files = excalidrawApi.getFiles();
    const blob = await exportToBlob({
      elements,
      appState: { ...appState, exportBackground: true },
      files,
    });
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    copyMsg.value = 'Copie !';
    setTimeout(() => { copyMsg.value = ''; }, 2000);
  } catch (err) {
    console.error('Export failed:', err);
  }
}

async function handleCopycut(e: KeyboardEvent) {
  if (!excalidrawApi) return;
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key !== 'c' && e.key !== 'x') return;
  const elements = excalidrawApi.getSceneElements();
  const selectedEls = elements.filter((el: any) => !el.isDeleted && excalidrawApi.getAppState().selectedElementIds?.[el.id]);
  if (!selectedEls.length) return;
  e.preventDefault();
  e.stopPropagation();
  try {
    const { exportToBlob } = await import('@excalidraw/excalidraw');
    const appState = excalidrawApi.getAppState();
    const files = excalidrawApi.getFiles();
    const blob = await exportToBlob({
      elements: selectedEls,
      appState: { ...appState, exportBackground: true },
      files,
    });
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    if (e.key === 'x') {
      const ids = new Set(selectedEls.map((el: any) => el.id));
      excalidrawApi.updateScene({
        elements: elements.map((el: any) => ids.has(el.id) ? { ...el, isDeleted: true } : el),
      });
    }
  } catch (err) {
    console.error('Copy/cut failed:', err);
  }
}

async function renderExcalidraw() {
  if (!containerRef.value) return;
  const { Excalidraw } = await import('@excalidraw/excalidraw');
  if (!root) root = createRoot(containerRef.value);

  const element = React.createElement(Excalidraw, {
    initialData: props.data || undefined,
    theme: 'light',
    excalidrawAPI: (apiRef: any) => { excalidrawApi = apiRef; },
    onChange: (elements: any, appState: any, files: any) => {
      const data = {
        elements,
        appState: { ...appState, collaborators: [] },
        files: files || {},
      };
      emit('update:data', data);
      scheduleSave(data);

      // Debounced sync to Yjs — compare with current Yjs data to prevent ping-pong
      if (yElements && ydoc) {
        if (yjsSyncTimeout) clearTimeout(yjsSyncTimeout);
        yjsSyncTimeout = setTimeout(() => {
          if (!yElements || !ydoc) return;
          const newSerialized = JSON.stringify(elements);
          const currentYjs = JSON.stringify(yElements.get('elements'));
          if (newSerialized === currentYjs) return; // Same data, skip (echo from remote)
          ydoc.transact(() => {
            yElements!.set('elements', JSON.parse(newSerialized));
          });
        }, 200);
      }
    },
  } as any);

  root.render(element);
}

onMounted(() => {
  renderExcalidraw();
  setupYjs();
  containerRef.value?.addEventListener('keydown', handleCopycut as EventListener, true);
});

watch(() => props.nodeId, () => {
  flushYjsSync();
  flushSave();
  cleanupYjs();
  excalidrawApi = null;
  if (root) { root.unmount(); root = null; }
  renderExcalidraw();
  setupYjs();
});

onBeforeUnmount(() => {
  containerRef.value?.removeEventListener('keydown', handleCopycut as EventListener, true);
  flushYjsSync();
  flushSave();
  cleanupYjs();
  excalidrawApi = null;
  if (root) { root.unmount(); root = null; }
});
</script>

<style>
.excalidraw-outer { height: 100%; width: 100%; display: flex; flex-direction: column; }
.excalidraw-toolbar { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--me-bg-surface); border-bottom: 1px solid var(--me-border); flex-shrink: 0; z-index: 10; }
.ex-tb-btn { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: var(--me-radius-xs); background: none; border: 1px solid var(--me-border); color: var(--me-text-secondary); cursor: pointer; font-size: 12px; transition: all 0.15s; }
.ex-tb-btn:hover:not(:disabled) { border-color: var(--me-accent); color: var(--me-accent); background: var(--me-accent-glow); }
.ex-tb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ex-tb-btn.active { border-color: var(--me-accent); color: var(--me-accent); background: var(--me-accent-glow); }
.ex-toolbar-spacer { flex: 1; }
.ex-tb-btn-comments { position: relative; }
.ex-comment-badge { position: absolute; top: -4px; right: -4px; background: var(--me-accent); color: var(--me-bg-deep); font-size: 10px; font-weight: 700; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 4px; font-family: var(--me-font-mono); }
.excalidraw-body { flex: 1; min-height: 0; display: flex; position: relative; overflow: hidden; }
.excalidraw-body .comment-sidebar { z-index: 50; }
.excalidraw-container { flex: 1; min-height: 0; }
.excalidraw-container .excalidraw { height: 100%; width: 100%; }
.collab-presence { display: flex; align-items: center; gap: 4px; }
.collab-user { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--me-bg-surface); font-size: 11px; font-weight: 700; color: #fff; font-family: var(--me-font-mono); cursor: default; }
.collab-user-img { object-fit: cover; }
</style>
