<template>
  <node-view-wrapper as="span" class="resizable-image-wrapper" :class="{ selected: selected }">
    <div class="ri-container" :style="{ width: imgWidth + 'px' }">
      <img
        :src="node.attrs.src"
        :alt="node.attrs.alt || ''"
        :title="node.attrs.title || ''"
        :width="imgWidth"
        class="ri-img"
        @click="selectImage"
        draggable="false"
      />
      <!-- Toolbar on selection -->
      <div v-if="selected" class="ri-toolbar">
        <button class="ri-tb-btn" @click="copyImage" :title="copied ? 'Copie !' : 'Copier l\'image'">
          <v-icon size="14">{{ copied ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
        </button>
        <button class="ri-tb-btn" @click="setSize(200)" title="Petit">S</button>
        <button class="ri-tb-btn" @click="setSize(400)" title="Moyen">M</button>
        <button class="ri-tb-btn" @click="setSize(700)" title="Grand">L</button>
        <button class="ri-tb-btn" @click="setSize(null)" title="Taille originale">
          <v-icon size="14">mdi-arrow-expand</v-icon>
        </button>
        <button class="ri-tb-btn ri-tb-danger" @click="deleteNode" title="Supprimer">
          <v-icon size="14">mdi-trash-can-outline</v-icon>
        </button>
      </div>
      <!-- Resize handle -->
      <div
        v-if="selected"
        class="ri-handle"
        @mousedown.prevent="startResize"
      />
    </div>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3';

const props = defineProps(nodeViewProps);

const imgWidth = ref<number>(0);
const selected = ref(false);
const copied = ref(false);
let resizing = false;
let startX = 0;
let startWidth = 0;

onMounted(() => {
  imgWidth.value = props.node.attrs.width || 0;
  if (!imgWidth.value) {
    // Load natural width
    const img = new window.Image();
    img.onload = () => {
      imgWidth.value = Math.min(img.naturalWidth, 700);
    };
    img.src = props.node.attrs.src;
  }
  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick);
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
});

function handleOutsideClick(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest('.resizable-image-wrapper');
  if (!el) {
    selected.value = false;
  }
}

function selectImage() {
  selected.value = true;
}

function setSize(w: number | null) {
  if (w === null) {
    // Reset to natural
    const img = new window.Image();
    img.onload = () => {
      imgWidth.value = Math.min(img.naturalWidth, 700);
      updateAttrs();
    };
    img.src = props.node.attrs.src;
    return;
  }
  imgWidth.value = w;
  updateAttrs();
}

function updateAttrs() {
  props.updateAttributes({ width: imgWidth.value });
}

function startResize(e: MouseEvent) {
  resizing = true;
  startX = e.clientX;
  startWidth = imgWidth.value;
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
}

function onResize(e: MouseEvent) {
  if (!resizing) return;
  const diff = e.clientX - startX;
  imgWidth.value = Math.max(80, startWidth + diff);
}

function stopResize() {
  if (resizing) {
    resizing = false;
    updateAttrs();
  }
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
}

async function copyImage() {
  try {
    const response = await fetch(props.node.attrs.src);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type]: blob }),
    ]);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch {
    // Fallback: copy URL
    await navigator.clipboard.writeText(props.node.attrs.src);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!selected.value) return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault();
    copyImage();
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
    e.preventDefault();
    copyImage().then(() => props.deleteNode());
  }
}

function deleteNode() {
  props.deleteNode();
}
</script>

<style>
.resizable-image-wrapper {
  display: inline-block;
  position: relative;
  line-height: 0;
  margin: 4px 0;
}
.ri-container {
  position: relative;
  display: inline-block;
}
.ri-img {
  border-radius: var(--me-radius-sm);
  display: block;
  max-width: 100%;
  cursor: pointer;
  transition: outline 0.1s;
}
.resizable-image-wrapper.selected .ri-img {
  outline: 2px solid var(--me-accent);
  outline-offset: 2px;
}
.ri-toolbar {
  position: absolute;
  top: -36px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs);
  box-shadow: var(--me-shadow);
  z-index: 10;
  white-space: nowrap;
}
.ri-tb-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--me-font-mono);
  transition: all 0.12s;
}
.ri-tb-btn:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.ri-tb-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  color: var(--me-error);
}
.ri-handle {
  position: absolute;
  bottom: 4px;
  right: 4px;
  width: 14px;
  height: 14px;
  background: var(--me-accent);
  border-radius: 2px;
  cursor: se-resize;
  opacity: 0.8;
  z-index: 10;
}
.ri-handle:hover {
  opacity: 1;
  transform: scale(1.2);
}
</style>
