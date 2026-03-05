<template>
  <div class="excalidraw-outer">
    <div class="excalidraw-toolbar">
      <button class="ex-tb-btn" @click="copyAsImage" :disabled="!excalidrawApi" :title="copyMsg || 'Copier le canvas comme image'">
        <v-icon size="16">{{ copyMsg ? 'mdi-check' : 'mdi-camera' }}</v-icon>
        <span class="mono">{{ copyMsg || 'Copier comme image' }}</span>
      </button>
    </div>
    <div ref="containerRef" class="excalidraw-container" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import api, { SERVER_URL } from '../../services/api';

const props = defineProps<{ data: any; nodeId: string }>();
const emit = defineEmits<{ 'update:data': [value: any] }>();
const containerRef = ref<HTMLElement | null>(null);
const copyMsg = ref('');
let root: Root | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let lastData: any = null;
let excalidrawApi: any = null;

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

function scheduleSave(data: any) {
  lastData = data;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    api.put(`/nodes/${props.nodeId}`, { excalidrawData: lastData });
    lastData = null;
    saveTimeout = null;
  }, 2000);
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

    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob }),
    ]);
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

    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob }),
    ]);

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

async function handlePasteImage(e: ClipboardEvent) {
  const items = e.clipboardData?.items;
  if (!items || !excalidrawApi) return;

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      e.stopPropagation();
      const file = item.getAsFile();
      if (!file) return;

      const formData = new FormData();
      formData.append('image', file);
      try {
        const { data } = await api.post('/upload/image', formData);

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const img = new window.Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.src = dataUrl;
        });

        const naturalW = img.naturalWidth;
        const naturalH = img.naturalHeight;
        const maxDim = 600;
        let w = naturalW;
        let h = naturalH;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        const fileId = crypto.randomUUID();

        excalidrawApi.addFiles([{
          id: fileId,
          dataURL: dataUrl,
          mimeType: file.type,
          created: Date.now(),
          lastRetrieved: Date.now(),
        }]);

        const elements = excalidrawApi.getSceneElements();
        const appState = excalidrawApi.getAppState();
        const { scrollX, scrollY, zoom, width: vpW, height: vpH } = appState;

        const centerX = -scrollX + vpW / 2 / zoom.value - w / 2;
        const centerY = -scrollY + vpH / 2 / zoom.value - h / 2;

        const imageElement = {
          type: 'image',
          id: crypto.randomUUID(),
          x: centerX,
          y: centerY,
          width: w,
          height: h,
          fileId: fileId,
          status: 'saved',
          scale: [1, 1],
          angle: 0,
          strokeColor: 'transparent',
          backgroundColor: 'transparent',
          fillStyle: 'solid',
          strokeWidth: 0,
          strokeStyle: 'solid',
          roughness: 0,
          opacity: 100,
          groupIds: [],
          roundness: null,
          seed: Math.floor(Math.random() * 100000),
          version: 1,
          versionNonce: Math.floor(Math.random() * 100000),
          isDeleted: false,
          boundElements: null,
          updated: Date.now(),
          link: null,
          locked: false,
        };

        excalidrawApi.updateScene({
          elements: [...elements, imageElement],
        });
      } catch (err) {
        console.error('Image upload failed:', err);
      }
      return;
    }
  }
}

async function renderExcalidraw() {
  if (!containerRef.value) return;

  const { Excalidraw } = await import('@excalidraw/excalidraw');

  if (!root) {
    root = createRoot(containerRef.value);
  }

  const element = React.createElement(Excalidraw, {
    initialData: props.data || undefined,
    theme: 'light',
    excalidrawAPI: (apiRef: any) => {
      excalidrawApi = apiRef;
    },
    onChange: (elements: any, appState: any, files: any) => {
      const data = {
        elements,
        appState: { ...appState, collaborators: [] },
        files: files || {},
      };
      emit('update:data', data);
      scheduleSave(data);
    },
  } as any);

  root.render(element);
}

onMounted(() => {
  renderExcalidraw();
  containerRef.value?.addEventListener('paste', handlePasteImage as EventListener, true);
  containerRef.value?.addEventListener('keydown', handleCopycut as EventListener, true);
});

watch(() => props.nodeId, () => {
  flushSave();
  excalidrawApi = null;
  if (root) {
    root.unmount();
    root = null;
  }
  renderExcalidraw();
});


onBeforeUnmount(() => {
  containerRef.value?.removeEventListener('paste', handlePasteImage as EventListener, true);
  containerRef.value?.removeEventListener('keydown', handleCopycut as EventListener, true);
  flushSave();
  excalidrawApi = null;
  if (root) {
    root.unmount();
    root = null;
  }
});
</script>

<style>
.excalidraw-outer {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}
.excalidraw-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--me-bg-surface);
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
  z-index: 10;
}
.ex-tb-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.ex-tb-btn:hover:not(:disabled) {
  border-color: var(--me-accent);
  color: var(--me-accent);
  background: var(--me-accent-glow);
}
.ex-tb-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.excalidraw-container {
  flex: 1;
  min-height: 0;
}
.excalidraw-container .excalidraw {
  height: 100%;
  width: 100%;
}
</style>
