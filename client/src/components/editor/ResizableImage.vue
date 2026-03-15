<template>
  <node-view-wrapper as="span" class="resizable-image-wrapper" :class="{ selected: selected }">
    <div class="ri-container" :style="{ width: imgWidth + 'px' }">
      <img
        :src="displaySrc"
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
        <button class="ri-tb-btn" @click="openAnnotator" title="Annoter">
          <v-icon size="14">mdi-draw</v-icon>
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

    <!-- Annotation dialog (teleported to body to escape TipTap) -->
    <Teleport to="body">
      <div v-if="annotatorOpen" class="ri-annotator-overlay" @click.self="annotatorOpen = false">
        <div class="ri-annotator-dialog">
          <div class="ri-annotator-header">
            <span class="ri-annotator-title">Annoter l'image</span>
            <button class="ri-annotator-close" @click="annotatorOpen = false">
              <v-icon size="18">mdi-close</v-icon>
            </button>
          </div>
          <ImageAnnotator
            :key="annotatorImageSrc"
            :image-src="annotatorImageSrc"
            @save="onAnnotationSave"
          />
        </div>
      </div>
    </Teleport>
  </node-view-wrapper>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3';
import ImageAnnotator from './ImageAnnotator.vue';
import api, { SERVER_URL } from '../../services/api';
import { useDecryptedFile } from '../../composables/useDecryptedFile';
import { useEncryptedUpload } from '../../composables/useEncryptedUpload';
import { useDossierStore } from '../../stores/dossier';

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const props = defineProps(nodeViewProps);
const { getDecryptedUrl } = useDecryptedFile();
const { uploadEncryptedImage } = useEncryptedUpload();
const dossierStore = useDossierStore();
const decryptedSrc = ref('');
const loading = ref(false);

// Show transparent placeholder while loading, decrypted URL when ready, or raw src for external images
const displaySrc = computed(() => {
  if (decryptedSrc.value) return decryptedSrc.value;
  const src = props.node?.attrs?.src || '';
  // If it's a /uploads/ URL, show placeholder while decrypting (don't hit removed static route)
  if (src.includes('/uploads/')) return TRANSPARENT_PIXEL;
  // External URLs or data URIs can be shown directly
  return src;
});

// Watch the image src and decrypt when needed
watch(() => props.node?.attrs?.src, async (src) => {
  if (!src) return;
  if (src.includes('/uploads/') && dossierStore.currentDossier) {
    loading.value = true;
    try {
      decryptedSrc.value = await getDecryptedUrl(
        dossierStore.currentDossier._id,
        src,
        'image/png'
      );
    } catch {
      // Can't decrypt — try direct URL as last resort
      decryptedSrc.value = src;
    } finally {
      loading.value = false;
    }
  } else {
    decryptedSrc.value = src;
  }
}, { immediate: true });

const imgWidth = ref<number>(0);
const selected = ref(false);
const copied = ref(false);
const annotatorOpen = ref(false);
const annotatorImageSrc = ref('');
let resizing = false;
let startX = 0;
let startWidth = 0;

onMounted(() => {
  imgWidth.value = props.node.attrs.width || 0;
  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleKeydown);
});

// Auto-detect natural width once decrypted src is available
watch(decryptedSrc, (src) => {
  if (src && !imgWidth.value) {
    const img = new window.Image();
    img.onload = () => {
      imgWidth.value = Math.min(img.naturalWidth, 700);
    };
    img.src = src;
  }
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
    img.src = decryptedSrc.value || displaySrc.value;
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
    const imgSrc = decryptedSrc.value || props.node.attrs.src;
    const response = await fetch(imgSrc);
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

function openAnnotator() {
  // Always use decrypted URL — raw /uploads/ URLs are no longer served
  annotatorImageSrc.value = decryptedSrc.value || displaySrc.value;
  annotatorOpen.value = true;
}

async function onAnnotationSave(annotations: any[]) {
  // Render annotations onto the image using a canvas, then upload as new image
  try {
    const img = new window.Image();
    // Only set crossOrigin for remote URLs, not blob URLs
    const imgSrcToUse = decryptedSrc.value || displaySrc.value;
    if (!imgSrcToUse.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = imgSrcToUse;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    // Draw annotations (coordinates are in natural image pixels)
    // Keep a copy of the clean image for blur operations
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.naturalWidth;
    sourceCanvas.height = img.naturalHeight;
    sourceCanvas.getContext('2d')!.drawImage(img, 0, 0);

    for (const a of annotations) {
      if (a.type === 'blur') {
        // Pixelate the region
        const nx = a.x, ny = a.y, nw = Math.abs(a.w), nh = Math.abs(a.h);
        if (nw > 2 && nh > 2) {
          const blockSize = 12;
          const tilesX = Math.max(1, Math.ceil(nw / blockSize));
          const tilesY = Math.max(1, Math.ceil(nh / blockSize));
          const off = document.createElement('canvas');
          off.width = tilesX;
          off.height = tilesY;
          const offCtx = off.getContext('2d')!;
          offCtx.imageSmoothingEnabled = true;
          offCtx.drawImage(sourceCanvas, nx, ny, nw, nh, 0, 0, tilesX, tilesY);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(off, 0, 0, tilesX, tilesY, nx, ny, nw, nh);
          ctx.imageSmoothingEnabled = true;
        }
        continue;
      }

      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = a.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (a.type === 'rect') {
        ctx.strokeRect(a.x, a.y, a.w, a.h);
      } else if (a.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(a.x + a.w / 2, a.y + a.h / 2, Math.abs(a.w / 2), Math.abs(a.h / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (a.type === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(a.x1, a.y1);
        ctx.lineTo(a.x2, a.y2);
        ctx.stroke();
        const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
        const headLen = 12 * (a.strokeWidth / 2);
        ctx.beginPath();
        ctx.moveTo(a.x2, a.y2);
        ctx.lineTo(a.x2 - headLen * Math.cos(angle - Math.PI / 6), a.y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(a.x2, a.y2);
        ctx.lineTo(a.x2 - headLen * Math.cos(angle + Math.PI / 6), a.y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (a.type === 'freehand' && a.points?.length) {
        ctx.beginPath();
        ctx.moveTo(a.points[0].x, a.points[0].y);
        for (let i = 1; i < a.points.length; i++) {
          ctx.lineTo(a.points[i].x, a.points[i].y);
        }
        ctx.stroke();
      } else if (a.type === 'text' && a.text) {
        ctx.font = `bold ${a.fontSize || 16}px sans-serif`;
        ctx.fillText(a.text, a.x, a.y);
      }
    }

    // Upload annotated image as a NEW file (proven path, no cache issues)
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png');
    });
    const dossierId = dossierStore.currentDossier?._id;
    let newUrl: string;
    if (dossierId) {
      const file = new File([blob], `annotated-${Date.now()}.png`, { type: 'image/png' });
      const url = await uploadEncryptedImage(dossierId, file);
      newUrl = `${SERVER_URL}${url}`;
    } else {
      const formData = new FormData();
      formData.append('image', blob, 'annotated.png');
      const { data } = await api.post('/upload/image', formData);
      newUrl = `${SERVER_URL}${data.url}`;
    }

    // Delete old file on server
    const oldSrc = props.node.attrs.src as string;
    const oldFilename = oldSrc.split('/uploads/').pop()?.split('?')[0];
    if (oldFilename) {
      api.delete(`/upload/${oldFilename}`).catch(() => {});
    }

    // Update TipTap node with new URL — triggers watch → decrypts → displays
    props.updateAttributes({ src: newUrl });
    // Update local decrypted src for immediate display
    decryptedSrc.value = URL.createObjectURL(blob);

    annotatorOpen.value = false;
  } catch (err) {
    console.error('Annotation save failed:', err);
  }
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
/* Annotator overlay */
.ri-annotator-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ri-annotator-dialog {
  width: 90vw;
  height: 85vh;
  background: var(--me-bg-surface);
  border-radius: 12px;
  border: 1px solid var(--me-border);
  box-shadow: var(--me-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ri-annotator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
}
.ri-annotator-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  font-family: var(--me-font-mono);
}
.ri-annotator-close {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s;
}
.ri-annotator-close:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
</style>
