<template>
  <div class="me-editor glass-card">
    <!-- Player Section -->
    <div class="me-player-section">
      <!-- Native video -->
      <video
        v-if="isNativeVideo"
        ref="playerRef"
        class="me-player-video"
        controls
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
        <iframe
          class="me-embed-iframe"
          :src="`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1`"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        />
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
            :src="screenshotSrc(ann)"
            class="me-ann-thumb"
            :alt="t('media.capture')"
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
      @save="onMetadataSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DossierNode, MediaAnnotation, MediaMetadata } from '../../types';
import api, { SERVER_URL } from '../../services/api';
import { useDossierStore } from '../../stores/dossier';
import MediaMetadataDialog from './MediaMetadataDialog.vue';

const { t } = useI18n();
const dossierStore = useDossierStore();

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

const mediaSrc = computed(() => sourceUrl.value);

const currentMetadata = computed<MediaMetadata>(() => {
  return props.node.mediaData?.metadata || { title: '' };
});

// --- Time formatting ---
function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
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
  capturing.value = true;

  try {
    const ts = playerRef.value ? playerRef.value.currentTime : 0;

    if (!isEmbed.value && playerRef.value && playerRef.value instanceof HTMLVideoElement) {
      // Native video: draw frame to canvas
      const video = playerRef.value;
      video.pause();
      const canvas = canvasRef.value!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/png');

      const { data } = await api.post('/media/capture', {
        nodeId: props.node._id,
        dossierId: props.node.dossierId,
        imageData,
        timestamp: ts,
      });

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
      // Embed: use server-side capture
      const url = props.node.mediaData.source.url || '';
      const { data } = await api.post('/media/capture-embed', {
        nodeId: props.node._id,
        dossierId: props.node.dossierId,
        url,
        timestamp: 0,
      });

      const annotation: MediaAnnotation = {
        id: crypto.randomUUID(),
        timestamp: 0,
        type: 'capture',
        comment: '',
        screenshotUrl: data.screenshotUrl || data.fileUrl,
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
  const ts = playerRef.value ? playerRef.value.currentTime : 0;

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
  if (playerRef.value) {
    playerRef.value.currentTime = timestamp;
    playerRef.value.play().catch(() => {});
  }
}

// --- Screenshot src ---
function screenshotSrc(ann: MediaAnnotation): string {
  if (!ann.screenshotUrl) return '';
  if (ann.screenshotUrl.startsWith('http')) return ann.screenshotUrl;
  return `${SERVER_URL}/${ann.screenshotUrl}`;
}

// --- Save (debounced) ---
function saveMediaData() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (!props.node.mediaData) return;
    try {
      await dossierStore.updateNode(props.node._id, {
        mediaData: props.node.mediaData,
      } as Partial<DossierNode>);
    } catch (err) {
      console.error('Failed to save media data:', err);
    }
  }, 500);
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
});
</script>

<style scoped>
.me-editor {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
}

/* ── Player Section ── */
.me-player-section {
  background: var(--me-bg-deep);
}

.me-player-video {
  display: block;
  width: 100%;
  max-height: 520px;
  background: #000;
  outline: none;
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
  padding-bottom: 56.25%; /* 16:9 */
  background: #000;
}
.me-embed-iframe {
  position: absolute;
  top: 0;
  left: 0;
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

/* ── Annotations Section ── */
.me-annotations-section {
  border-top: 1px solid var(--me-border);
  display: flex;
  flex-direction: column;
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
  max-height: 400px;
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
