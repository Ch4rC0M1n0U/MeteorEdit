<template>
  <div class="me-editor glass-card" :class="{ 'me-editor--expanded': expanded }">
    <!-- Player Section -->
    <div class="me-player-section">
      <!-- Native video -->
      <video
        v-if="isNativeVideo"
        ref="playerRef"
        class="me-player-video"
        controls
        crossorigin="anonymous"
        :src="mediaSrc"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
      />

      <!-- Native audio -->
      <audio
        v-else-if="isNativeAudio"
        ref="playerRef"
        class="me-player-audio"
        controls
        :src="mediaSrc"
        @timeupdate="onTimeUpdate"
        @loadedmetadata="onLoadedMetadata"
      />

      <!-- YouTube embed -->
      <div v-else-if="youtubeId" class="me-embed-wrapper">
        <div :id="ytPlayerId" class="me-embed-iframe" />
      </div>

      <!-- Vimeo embed -->
      <div v-else-if="vimeoId" class="me-embed-wrapper">
        <iframe
          class="me-embed-iframe"
          :src="`https://player.vimeo.com/video/${vimeoId}`"
          frameborder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
        />
      </div>

      <!-- Unsupported -->
      <div v-else class="me-player-empty">
        <v-icon size="40" color="var(--me-text-muted)">mdi-play-circle-outline</v-icon>
        <span>{{ t('media.unsupportedFormat') }}</span>
      </div>

      <!-- Controls bar -->
      <div class="me-controls">
        <span class="me-time">
          {{ currentTimeFormatted }} / {{ durationFormatted }}
        </span>
        <div class="me-actions">
          <button
            class="me-btn me-btn--capture"
            :disabled="capturing"
            @click="captureFrame"
          >
            <v-icon v-if="capturing" size="14" class="me-spin">mdi-loading</v-icon>
            <v-icon v-else size="14">mdi-camera</v-icon>
            {{ capturing ? t('media.capturing') : t('media.capture') }}
          </button>
          <button class="me-btn me-btn--note" @click="addNote">
            <v-icon size="14">mdi-pencil</v-icon>
            {{ t('media.note') }}
          </button>
          <button class="me-btn me-btn--meta" @click="showMetadata = true">
            <v-icon size="14">mdi-information-outline</v-icon>
            {{ t('media.metadata') }}
          </button>
          <button class="me-btn me-btn--expand" @click="expanded = !expanded" :title="expanded ? t('media.shrinkPlayer') : t('media.expandPlayer')">
            <v-icon size="14">{{ expanded ? 'mdi-arrow-collapse' : 'mdi-arrow-expand' }}</v-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- Annotations Section -->
    <div class="me-annotations-section">
      <div class="me-annotations-header">
        <div class="me-annotations-title">
          <v-icon size="16">mdi-format-list-bulleted</v-icon>
          {{ t('media.annotations') }}
          <span class="me-ann-count">{{ filteredAnnotations.length }}</span>
        </div>
        <div class="me-annotations-toolbar">
          <input
            v-model="filter"
            type="text"
            class="me-filter-input"
            :placeholder="t('media.filterAnnotations')"
          />
          <button class="me-sort-btn" :title="sortAsc ? t('media.sortChrono') : t('media.sortRecent')" @click="sortAsc = !sortAsc">
            <v-icon size="16">{{ sortAsc ? 'mdi-sort-ascending' : 'mdi-sort-descending' }}</v-icon>
          </button>
        </div>
      </div>

      <div class="me-annotations-list">
        <div
          v-for="ann in filteredAnnotations"
          :key="ann.id"
          class="me-annotation-card"
        >
          <button class="me-ann-time" @click="seekTo(ann.timestamp)" :title="t('media.seekTo')">
            {{ formatTime(ann.timestamp) }}
          </button>

          <v-icon size="16" class="me-ann-type-icon">
            {{ ann.type === 'capture' ? 'mdi-camera' : 'mdi-pencil' }}
          </v-icon>

          <img
            v-if="ann.screenshotUrl"
            :src="decryptedScreenshots[ann.screenshotUrl] || TRANSPARENT_PIXEL"
            class="me-ann-thumb"
            :alt="t('media.capture')"
            @click="openViewer(ann)"
          />

          <div class="me-ann-content">
            <div
              v-if="editingId === ann.id"
              class="me-ann-edit-row"
            >
              <input
                :ref="(el) => { if (el) editInputRef = el as HTMLInputElement }"
                v-model="editingComment"
                class="me-ann-edit-input"
                :placeholder="t('media.addComment')"
                @keydown.enter="confirmEdit(ann)"
                @keydown.escape="cancelEdit"
                @blur="confirmEdit(ann)"
              />
            </div>
            <span
              v-else
              class="me-ann-comment"
              :class="{ 'me-ann-comment--empty': !ann.comment }"
              @click="startEdit(ann)"
            >
              {{ ann.comment || t('media.addComment') }}
            </span>
          </div>

          <div class="me-ann-actions">
            <button class="me-ann-action" @click="startEdit(ann)" :title="t('common.edit')">
              <v-icon size="14">mdi-pencil-outline</v-icon>
            </button>
            <button class="me-ann-action me-ann-action--delete" @click="deleteAnnotation(ann.id)">
              <v-icon size="14">mdi-trash-can-outline</v-icon>
            </button>
          </div>
        </div>

        <div v-if="!filteredAnnotations.length" class="me-empty">
          <v-icon size="28" color="var(--me-text-muted)">mdi-message-text-outline</v-icon>
          <span>{{ t('media.noAnnotations') }}</span>
        </div>
      </div>
    </div>

    <!-- Hidden canvas for frame capture -->
    <canvas ref="canvasRef" class="me-canvas-hidden" />

    <!-- Metadata Dialog -->
    <MediaMetadataDialog
      v-model="showMetadata"
      :metadata="currentMetadata"
      :source-url="props.node.mediaData?.source.url"
      @save="onMetadataSave"
    />

    <!-- Image Viewer Overlay -->
    <Teleport to="body">
      <div v-if="viewerSrc && !annotatorOpen" class="me-viewer-overlay" @click="viewerSrc = ''">
        <div class="me-viewer-toolbar" @click.stop>
          <button class="me-viewer-btn" @click="openAnnotator" :title="t('media.editCapture')">
            <v-icon size="20" color="#fff">mdi-pencil-outline</v-icon>
          </button>
          <button class="me-viewer-btn" @click="viewerSrc = ''">
            <v-icon size="20" color="#fff">mdi-close</v-icon>
          </button>
        </div>
        <img :src="viewerSrc" class="me-viewer-img" @click.stop />
      </div>
    </Teleport>

    <!-- Image Annotator Overlay -->
    <Teleport to="body">
      <div v-if="annotatorOpen" class="me-annotator-overlay">
        <div class="me-annotator-header">
          <span class="me-annotator-title mono">{{ t('media.editCapture') }}</span>
          <button class="me-viewer-btn" @click="annotatorOpen = false">
            <v-icon size="20" color="#fff">mdi-close</v-icon>
          </button>
        </div>
        <div class="me-annotator-body">
          <ImageAnnotator
            :image-src="viewerSrc"
            @save="onAnnotatorSave"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DossierNode, MediaAnnotation, MediaMetadata } from '../../types';
import api, { SERVER_URL } from '../../services/api';
import { useDossierStore } from '../../stores/dossier';
import { useEncryptedUpload } from '../../composables/useEncryptedUpload';
import { useDecryptedFile } from '../../composables/useDecryptedFile';
import { useEncryptionStore } from '../../stores/encryption';
import { encryptFile } from '../../utils/encryption';
import MediaMetadataDialog from './MediaMetadataDialog.vue';
import ImageAnnotator from '../editor/ImageAnnotator.vue';

const { t } = useI18n();
const dossierStore = useDossierStore();
const encryptionStore = useEncryptionStore();
const { uploadEncryptedImage } = useEncryptedUpload();
const { getDecryptedUrl } = useDecryptedFile();

const props = defineProps<{
  node: DossierNode;
}>();

// --- Refs ---
const playerRef = ref<HTMLVideoElement | HTMLAudioElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const editInputRef = ref<HTMLInputElement | null>(null);

const currentTime = ref(0);
const duration = ref(0);
const capturing = ref(false);
const showMetadata = ref(false);
const filter = ref('');
const sortAsc = ref(true);
const editingId = ref<string | null>(null);
const editingComment = ref('');
const viewerSrc = ref('');
const annotatorOpen = ref(false);
const expanded = ref(false);

const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

// --- Computed: source detection ---
const sourceUrl = computed(() => {
  const md = props.node.mediaData;
  if (!md) return '';
  if (md.source.type === 'upload' && md.source.fileUrl) {
    return `${SERVER_URL}/${md.source.fileUrl}`;
  }
  return md.source.url || '';
});

// Decrypted source URL for uploaded media files
const decryptedSourceUrl = ref('');

// Watch only the source URL/fileUrl — NOT deep, to avoid re-triggering when annotations change
watch(
  () => props.node.mediaData?.source?.fileUrl || props.node.mediaData?.source?.url || '',
  async () => {
    const source = props.node.mediaData?.source;
    if (!source) return;
    if (source.type === 'upload' && source.fileUrl && dossierStore.currentDossier) {
      try {
        const ct = source.mediaType === 'video' ? 'video/mp4' : 'audio/mpeg';
        decryptedSourceUrl.value = await getDecryptedUrl(
          dossierStore.currentDossier._id,
          source.fileUrl,
          ct
        );
      } catch (err) {
        console.error('Failed to decrypt media source:', err);
        // Don't fallback to raw encrypted URL — it would serve unreadable bytes
      }
    } else if (source.url) {
      decryptedSourceUrl.value = source.url;
    }
  },
  { immediate: true }
);

const youtubeId = computed(() => {
  const url = props.node.mediaData?.source.url || '';
  if (!url) return null;
  // youtube.com/watch?v=ID or youtu.be/ID
  const m1 = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([\w-]{11})/);
  return m1 ? m1[1] : null;
});

const vimeoId = computed(() => {
  const url = props.node.mediaData?.source.url || '';
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
});

const isEmbed = computed(() => !!youtubeId.value || !!vimeoId.value);

const isNativeVideo = computed(() => {
  if (isEmbed.value) return false;
  const md = props.node.mediaData;
  if (!md) return false;
  return md.source.mediaType === 'video';
});

const isNativeAudio = computed(() => {
  if (isEmbed.value) return false;
  const md = props.node.mediaData;
  if (!md) return false;
  return md.source.mediaType === 'audio';
});

const mediaSrc = computed(() => {
  // For uploaded files, always wait for the decrypted blob URL — never use the raw server URL
  // (it would serve encrypted bytes that the browser can't play)
  const source = props.node.mediaData?.source;
  if (source?.type === 'upload' && source.fileUrl) {
    return decryptedSourceUrl.value || '';
  }
  return decryptedSourceUrl.value || sourceUrl.value;
});

const currentMetadata = computed<MediaMetadata>(() => {
  return props.node.mediaData?.metadata || { title: '' };
});

// --- YouTube IFrame API ---
const ytPlayerId = `yt-player-${Date.now()}`;
let ytPlayer: any = null;
let ytTimeInterval: ReturnType<typeof setInterval> | null = null;

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).YT && (window as any).YT.Player) {
      resolve();
      return;
    }
    const existing = document.getElementById('yt-iframe-api');
    if (existing) {
      const prev = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        resolve();
      };
      return;
    }
    const tag = document.createElement('script');
    tag.id = 'yt-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    (window as any).onYouTubeIframeAPIReady = () => resolve();
    document.head.appendChild(tag);
  });
}

function initYouTubePlayer(videoId: string) {
  if (ytPlayer) {
    try { ytPlayer.destroy(); } catch { /* ignore */ }
    ytPlayer = null;
  }
  if (ytTimeInterval) {
    clearInterval(ytTimeInterval);
    ytTimeInterval = null;
  }
  ytPlayer = new (window as any).YT.Player(ytPlayerId, {
    videoId,
    playerVars: { enablejsapi: 1, origin: window.location.origin },
    events: {
      onReady: (event: any) => {
        duration.value = event.target.getDuration() || 0;
        ytTimeInterval = setInterval(() => {
          if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
            currentTime.value = ytPlayer.getCurrentTime() || 0;
            // Update duration if it wasn't available initially
            if (!duration.value && typeof ytPlayer.getDuration === 'function') {
              duration.value = ytPlayer.getDuration() || 0;
            }
          }
        }, 250);
      },
    },
  });
}

watch(
  () => youtubeId.value,
  async (id) => {
    if (id) {
      await loadYouTubeAPI();
      nextTick(() => initYouTubePlayer(id));
    }
  },
);

onMounted(async () => {
  if (youtubeId.value) {
    await loadYouTubeAPI();
    nextTick(() => initYouTubePlayer(youtubeId.value!));
  }
});

// --- Time formatting ---
function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const ms = Math.round((seconds - s) * 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const msStr = String(ms).padStart(3, '0');
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${msStr}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}.${msStr}`;
}

const currentTimeFormatted = computed(() => formatTime(currentTime.value));
const durationFormatted = computed(() => formatTime(duration.value));

// --- Player events ---
function onTimeUpdate() {
  if (playerRef.value) {
    currentTime.value = playerRef.value.currentTime;
  }
}

function onLoadedMetadata() {
  if (playerRef.value) {
    duration.value = playerRef.value.duration;
  }
}

// --- Annotations computed ---
const annotations = computed(() => {
  return props.node.mediaData?.annotations || [];
});

const filteredAnnotations = computed(() => {
  let list = [...annotations.value];
  if (filter.value.trim()) {
    const q = filter.value.toLowerCase();
    list = list.filter(
      (a) =>
        (a.comment && a.comment.toLowerCase().includes(q)) ||
        formatTime(a.timestamp).includes(q)
    );
  }
  list.sort((a, b) => (sortAsc.value ? a.timestamp - b.timestamp : b.timestamp - a.timestamp));
  return list;
});

// --- Capture frame ---
async function captureFrame() {
  if (!props.node.mediaData || capturing.value) return;
  // Ensure annotations array exists
  if (!props.node.mediaData.annotations) {
    props.node.mediaData.annotations = [];
  }
  capturing.value = true;

  try {
    // Get timestamp from YouTube API, native player, or fallback to currentTime ref
    const ts = ytPlayer && typeof ytPlayer.getCurrentTime === 'function'
      ? ytPlayer.getCurrentTime()
      : playerRef.value ? playerRef.value.currentTime : currentTime.value;

    if (!isEmbed.value && playerRef.value && playerRef.value instanceof HTMLVideoElement) {
      // Native video: draw frame to canvas
      const video = playerRef.value;
      video.pause();
      const canvas = canvasRef.value!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Encrypt capture if dossier has encryption enabled
      const dossierId = props.node.dossierId?.toString();
      let data: any;
      if (dossierId) {
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
        const captureFile = new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' });
        const url = await uploadEncryptedImage(dossierId, captureFile);
        data = { screenshotUrl: url.replace(/^\//, '') };
      } else {
        const imageData = canvas.toDataURL('image/png');
        const res = await api.post('/media/capture', {
          nodeId: props.node._id,
          dossierId: props.node.dossierId,
          imageData,
          timestamp: ts,
        });
        data = res.data;
      }

      const annotation: MediaAnnotation = {
        id: crypto.randomUUID(),
        timestamp: ts,
        type: 'capture',
        comment: '',
        screenshotUrl: data.screenshotUrl || data.fileUrl,
        createdAt: new Date().toISOString(),
      };
      props.node.mediaData.annotations.push(annotation);
      saveMediaData();
    } else if (isEmbed.value) {
      // Embed (YouTube/Vimeo): extract frame server-side via yt-dlp + ffmpeg
      const url = props.node.mediaData.source.url || '';
      const { data } = await api.post('/media/capture-embed', {
        nodeId: props.node._id,
        dossierId: props.node.dossierId,
        url,
        timestamp: ts,
      });

      let finalScreenshotUrl = data.screenshotUrl || data.fileUrl;

      // Encrypt the server-generated capture if dossier has encryption
      const dossierId = props.node.dossierId?.toString();
      if (dossierId) {
        const dossierKey = await encryptionStore.getDossierKey(dossierId);
        if (dossierKey) {
          try {
            // Download the plaintext capture from server
            const filename = finalScreenshotUrl.split('/').pop() || '';
            const response = await api.get(`/files/${filename}`, { responseType: 'arraybuffer' });
            // Encrypt it
            const encryptedBuffer = await encryptFile(dossierKey, response.data);
            const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
            // Re-upload encrypted version
            const formData = new FormData();
            formData.append('file', encryptedBlob, filename + '.enc');
            formData.append('screenshotUrl', finalScreenshotUrl);
            const replaceRes = await api.post('/media/replace-capture-encrypted', formData);
            finalScreenshotUrl = replaceRes.data.screenshotUrl;
          } catch (err) {
            console.error('Failed to encrypt embed capture:', err);
          }
        }
      }

      const annotation: MediaAnnotation = {
        id: crypto.randomUUID(),
        timestamp: ts,
        type: 'capture',
        comment: '',
        screenshotUrl: finalScreenshotUrl,
        createdAt: new Date().toISOString(),
      };
      props.node.mediaData.annotations.push(annotation);
      saveMediaData();
    }
  } catch (err) {
    console.error('Capture failed:', err);
  } finally {
    capturing.value = false;
  }
}

// --- Add note ---
function addNote() {
  if (!props.node.mediaData) return;
  // Ensure annotations array exists
  if (!props.node.mediaData.annotations) {
    props.node.mediaData.annotations = [];
  }
  const ts = ytPlayer && typeof ytPlayer.getCurrentTime === 'function'
    ? ytPlayer.getCurrentTime()
    : playerRef.value ? playerRef.value.currentTime : currentTime.value;

  const annotation: MediaAnnotation = {
    id: crypto.randomUUID(),
    timestamp: ts,
    type: 'note',
    comment: '',
    createdAt: new Date().toISOString(),
  };
  props.node.mediaData.annotations.push(annotation);
  saveMediaData();

  // Start editing the new note immediately
  nextTick(() => {
    startEdit(annotation);
  });
}

// --- Delete annotation ---
function deleteAnnotation(id: string) {
  if (!props.node.mediaData) return;
  const idx = props.node.mediaData.annotations.findIndex((a) => a.id === id);
  if (idx >= 0) {
    const ann = props.node.mediaData.annotations[idx]!;
    // Delete associated evidence record + file on server
    if (ann.screenshotUrl) {
      api.delete('/media/capture', { data: { screenshotUrl: ann.screenshotUrl } }).catch(console.error);
    }
    props.node.mediaData.annotations.splice(idx, 1);
    saveMediaData();
  }
}

// --- Inline editing ---
function startEdit(ann: MediaAnnotation) {
  editingId.value = ann.id;
  editingComment.value = ann.comment || '';
  nextTick(() => {
    editInputRef.value?.focus();
  });
}

function confirmEdit(ann: MediaAnnotation) {
  if (editingId.value !== ann.id) return;
  ann.comment = editingComment.value;
  editingId.value = null;
  editingComment.value = '';
  saveMediaData();
}

function cancelEdit() {
  editingId.value = null;
  editingComment.value = '';
}

// --- Seek ---
function seekTo(timestamp: number) {
  if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
    ytPlayer.seekTo(timestamp, true);
  } else if (playerRef.value) {
    playerRef.value.currentTime = timestamp;
    playerRef.value.play().catch(() => {});
  }
}

// --- Screenshot src (with decryption support) ---
const decryptedScreenshots = ref<Record<string, string>>({});
const decryptingScreenshots = new Set<string>();

function screenshotSrc(ann: MediaAnnotation): string {
  if (!ann.screenshotUrl) return '';
  return decryptedScreenshots.value[ann.screenshotUrl] || TRANSPARENT_PIXEL;
}

async function decryptScreenshot(ann: MediaAnnotation) {
  if (!ann.screenshotUrl || decryptedScreenshots.value[ann.screenshotUrl]) return;
  if (decryptingScreenshots.has(ann.screenshotUrl)) return;
  if (!dossierStore.currentDossier) return;
  decryptingScreenshots.add(ann.screenshotUrl);
  try {
    // Use noCache if annotation was modified (file replaced on server, browser may have cached old version)
    const needsCacheBust = !!ann.modifiedAt;
    const url = await getDecryptedUrl(
      dossierStore.currentDossier._id,
      ann.screenshotUrl,
      'image/png',
      needsCacheBust
    );
    decryptedScreenshots.value = { ...decryptedScreenshots.value, [ann.screenshotUrl]: url };
  } catch (err) {
    console.error('Failed to decrypt screenshot:', ann.screenshotUrl, err);
  } finally {
    decryptingScreenshots.delete(ann.screenshotUrl!);
  }
}

// Proactively decrypt all screenshots when annotations change
watch(filteredAnnotations, (anns) => {
  for (const ann of anns) {
    if (ann.screenshotUrl && !decryptedScreenshots.value[ann.screenshotUrl]) {
      decryptScreenshot(ann);
    }
  }
}, { immediate: true });

// --- Save (debounced for typing, immediate for file changes) ---
function saveMediaData(immediate = false) {
  if (saveTimeout) clearTimeout(saveTimeout);
  const doSave = async () => {
    if (!props.node.mediaData) return;
    try {
      await dossierStore.updateNode(props.node._id, {
        mediaData: props.node.mediaData,
      } as Partial<DossierNode>);
    } catch (err) {
      console.error('Failed to save media data:', err);
    }
  };
  if (immediate) {
    doSave();
  } else {
    saveTimeout = setTimeout(doSave, 500);
  }
}

// --- Open viewer with decrypted URL ---
async function openViewer(ann: MediaAnnotation) {
  if (!ann.screenshotUrl) return;
  // If already decrypted, use it
  const cached = decryptedScreenshots.value[ann.screenshotUrl];
  if (cached) {
    viewerSrc.value = cached;
    return;
  }
  // Otherwise decrypt and then show
  if (dossierStore.currentDossier) {
    try {
      const url = await getDecryptedUrl(
        dossierStore.currentDossier._id,
        ann.screenshotUrl,
        'image/png'
      );
      decryptedScreenshots.value = { ...decryptedScreenshots.value, [ann.screenshotUrl]: url };
      viewerSrc.value = url;
    } catch (err) {
      console.error('Failed to decrypt screenshot for viewer:', err);
    }
  }
}

// --- Image annotator ---
function openAnnotator() {
  annotatorOpen.value = true;
}

function findAnnotationBySrc(src: string): MediaAnnotation | undefined {
  if (!props.node.mediaData) return undefined;
  // Check if src is a blob URL from decrypted screenshots
  if (src.startsWith('blob:')) {
    return props.node.mediaData.annotations.find(a => {
      if (!a.screenshotUrl) return false;
      return decryptedScreenshots.value[a.screenshotUrl] === src;
    });
  }
  // Strip cache-bust query params for comparison
  const cleanSrc = src.split('?')[0];
  return props.node.mediaData.annotations.find(a => screenshotSrc(a).split('?')[0] === cleanSrc);
}

async function onAnnotatorSave(drawAnnotations: any[]) {
  try {
    // 1. Render annotations onto image
    const img = new window.Image();
    if (!viewerSrc.value.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = viewerSrc.value;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    // Keep a copy of the clean image for blur operations
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = img.naturalWidth;
    sourceCanvas.height = img.naturalHeight;
    sourceCanvas.getContext('2d')!.drawImage(img, 0, 0);

    for (const a of drawAnnotations) {
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

    // 2. Find the annotation being edited
    const ann = findAnnotationBySrc(viewerSrc.value);
    if (!ann?.screenshotUrl) {
      console.error('Could not find annotation for viewer source');
      annotatorOpen.value = false;
      return;
    }

    // 3. Convert canvas to File and upload via the PROVEN upload path
    const dossierId = dossierStore.currentDossier?._id;
    if (!dossierId) {
      console.error('No dossier context for annotation save');
      annotatorOpen.value = false;
      return;
    }

    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
    const file = new File([blob], `annotated-${Date.now()}.png`, { type: 'image/png' });
    const newUrl = await uploadEncryptedImage(dossierId, file);
    // uploadEncryptedImage returns '/uploads/uuid.enc' — strip leading slash
    const newScreenshotUrl = newUrl.replace(/^\//, '');

    // 4. Delete old file on server
    const oldUrl = ann.screenshotUrl;
    api.delete('/media/capture', { data: { screenshotUrl: oldUrl } }).catch(() => {});

    // 5. Invalidate old cache
    const updatedCache = { ...decryptedScreenshots.value };
    if (oldUrl) delete updatedCache[oldUrl];

    // 6. Update annotation with NEW URL (no cache issues — it's a brand new file)
    ann.screenshotUrl = newScreenshotUrl;
    ann.modifiedAt = new Date().toISOString();

    // 7. Save immediately
    saveMediaData(true);

    // 8. Create blob URL for immediate display
    const newBlobUrl = URL.createObjectURL(blob);
    updatedCache[newScreenshotUrl] = newBlobUrl;
    decryptedScreenshots.value = updatedCache;
    viewerSrc.value = newBlobUrl;

    annotatorOpen.value = false;
  } catch (err) {
    console.error('Annotation save failed:', err);
  }
}

// --- Metadata save ---
function onMetadataSave(metadata: MediaMetadata) {
  if (!props.node.mediaData) return;
  props.node.mediaData.metadata = metadata;
  saveMediaData();
}

// --- Cleanup ---
onBeforeUnmount(() => {
  if (saveTimeout) clearTimeout(saveTimeout);
  if (ytTimeInterval) clearInterval(ytTimeInterval);
  if (ytPlayer) {
    try { ytPlayer.destroy(); } catch { /* ignore */ }
  }
});
</script>

<style scoped>
.me-editor {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 12px;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  height: 100%;
  min-height: 0;
  overflow-y: scroll;
  overflow-x: hidden;
}

/* ── Player Section ── */
.me-player-section {
  background: var(--me-bg-deep);
  flex-shrink: 1;
  min-height: 0;
}

.me-player-video {
  display: block;
  width: 100%;
  max-height: min(520px, 55vh);
  background: #000;
  outline: none;
}
.me-editor--expanded .me-player-video {
  max-height: min(780px, 65vh);
}

.me-player-audio {
  display: block;
  width: 100%;
  padding: 24px 16px;
  background: var(--me-bg-deep);
  outline: none;
}

.me-embed-wrapper {
  position: relative;
  width: 100%;
  max-width: 960px;
  max-height: 55vh;
  margin: 0 auto;
  aspect-ratio: 16 / 9;
  background: #000;
}
.me-editor--expanded .me-embed-wrapper {
  max-width: 1440px;
  max-height: 65vh;
}
.me-embed-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
/* YouTube IFrame API replaces the div with an iframe — target it via :deep */
.me-embed-wrapper :deep(iframe) {
  width: 100%;
  height: 100%;
  border: none;
}

.me-player-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 16px;
  color: var(--me-text-muted);
  font-size: 13px;
}

/* ── Controls ── */
.me-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  gap: 12px;
  flex-wrap: wrap;
}

.me-time {
  font-size: 12px;
  font-weight: 600;
  color: var(--me-text-secondary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.me-actions {
  display: flex;
  gap: 6px;
}

.me-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs, 6px);
  background: var(--me-bg-deep);
  color: var(--me-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.me-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.me-btn:hover:not(:disabled) {
  border-color: var(--me-accent);
  color: var(--me-accent);
}

.me-btn--capture {
  border-color: rgba(var(--me-accent-rgb), 0.3);
  color: var(--me-accent);
}
.me-btn--capture:hover:not(:disabled) {
  background: rgba(var(--me-accent-rgb), 0.1);
  border-color: var(--me-accent);
}

.me-btn--note {
  border-color: rgba(129, 199, 132, 0.3);
  color: #81c784;
}
.me-btn--note:hover {
  background: rgba(129, 199, 132, 0.1);
  border-color: #81c784;
}

.me-btn--meta:hover {
  border-color: var(--me-text-secondary);
  color: var(--me-text-primary);
}

.me-btn--expand {
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-muted);
  padding: 4px 8px;
  min-width: auto;
}
.me-btn--expand:hover {
  border-color: var(--me-text-secondary);
  color: var(--me-text-primary);
}
.me-editor--expanded .me-btn--expand {
  color: var(--me-accent);
  border-color: var(--me-accent);
}

/* ── Annotations Section ── */
.me-annotations-section {
  border-top: 1px solid var(--me-border);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.me-annotations-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  gap: 10px;
  flex-wrap: wrap;
}

.me-annotations-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
  white-space: nowrap;
}

.me-ann-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: rgba(var(--me-accent-rgb), 0.15);
  color: var(--me-accent);
  font-size: 11px;
  font-weight: 600;
}

.me-annotations-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.me-filter-input {
  width: 180px;
  padding: 5px 10px;
  border-radius: var(--me-radius-xs, 6px);
  border: 1px solid var(--me-border);
  background: var(--me-bg-deep);
  color: var(--me-text-primary);
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}
.me-filter-input:focus {
  border-color: var(--me-accent);
}
.me-filter-input::placeholder {
  color: var(--me-text-muted);
}

.me-sort-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs, 6px);
  background: var(--me-bg-deep);
  color: var(--me-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.me-sort-btn:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
}

/* ── Annotations List ── */
.me-annotations-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.me-annotation-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs, 6px);
  background: var(--me-bg-deep);
  transition: all 0.15s;
}
.me-annotation-card:hover {
  border-color: rgba(var(--me-accent-rgb), 0.3);
  background: rgba(var(--me-accent-rgb), 0.04);
}

.me-ann-time {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(var(--me-accent-rgb), 0.15);
  color: var(--me-accent);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}
.me-ann-time:hover {
  background: rgba(var(--me-accent-rgb), 0.3);
  box-shadow: 0 0 6px rgba(var(--me-accent-rgb), 0.3);
}

.me-ann-type-icon {
  color: var(--me-text-muted);
  flex-shrink: 0;
}

.me-ann-thumb {
  width: 48px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--me-border);
  flex-shrink: 0;
  cursor: pointer;
  transition: opacity 0.15s;
}
.me-ann-thumb:hover {
  opacity: 0.8;
}

.me-ann-content {
  flex: 1;
  min-width: 0;
}

.me-ann-comment {
  display: block;
  font-size: 12px;
  color: var(--me-text-primary);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background 0.15s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.me-ann-comment:hover {
  background: rgba(255, 255, 255, 0.06);
}
.me-ann-comment--empty {
  color: var(--me-text-muted);
  font-style: italic;
}

.me-ann-edit-row {
  display: flex;
}

.me-ann-edit-input {
  width: 100%;
  padding: 3px 6px;
  border: 1px solid var(--me-accent);
  border-radius: 4px;
  background: var(--me-bg-surface);
  color: var(--me-text-primary);
  font-size: 12px;
  outline: none;
  font-family: inherit;
}

.me-ann-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.me-annotation-card:hover .me-ann-actions {
  opacity: 1;
}

.me-ann-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.me-ann-action:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--me-text-primary);
}
.me-ann-action--delete:hover {
  background: rgba(244, 67, 54, 0.12);
  color: #ef5350;
}

/* ── Empty state ── */
.me-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 32px 16px;
  color: var(--me-text-muted);
  font-size: 13px;
}

/* ── Hidden canvas ── */
.me-canvas-hidden {
  position: absolute;
  left: -9999px;
  top: -9999px;
  pointer-events: none;
  visibility: hidden;
}

/* ── Spin animation ── */
@keyframes me-spin {
  to { transform: rotate(360deg); }
}
.me-spin {
  animation: me-spin 1s linear infinite;
}
</style>

<style>
/* Viewer overlay — NOT scoped because it's teleported to body */
.me-viewer-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(4px);
}
.me-viewer-toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 8px;
  z-index: 1;
}
.me-viewer-btn {
  background: rgba(255, 255, 255, 0.12);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
}
.me-viewer-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}
.me-viewer-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  cursor: default;
}

/* Annotator overlay */
.me-annotator-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: var(--me-bg-deep, #0f0f14);
  display: flex;
  flex-direction: column;
}
.me-annotator-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--me-border);
}
.me-annotator-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.me-annotator-body {
  flex: 1;
  overflow: hidden;
  display: flex;
}
.me-annotator-body .ia-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.me-annotator-body .ia-canvas-wrap {
  flex: 1;
}
</style>
