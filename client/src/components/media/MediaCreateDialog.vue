<template>
  <v-dialog v-model="model" max-width="560" persistent>
    <div class="es-dialog glass-card">
      <div class="es-header">
        <v-icon size="20" class="es-header-icon">mdi-play-circle-outline</v-icon>
        <span>{{ $t('media.createMedia') }}</span>
        <button class="es-close" @click="close">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <div class="es-body">
        <!-- Mode tabs -->
        <div class="es-tabs">
          <button
            class="es-tab"
            :class="{ 'es-tab--active': mode === 'url' }"
            @click="mode = 'url'"
          >
            <v-icon size="16">mdi-link-variant</v-icon>
            {{ $t('media.addUrl') }}
          </button>
          <button
            class="es-tab"
            :class="{ 'es-tab--active': mode === 'upload' }"
            @click="mode = 'upload'"
          >
            <v-icon size="16">mdi-upload</v-icon>
            {{ $t('media.uploadFile') }}
          </button>
        </div>

        <!-- URL mode -->
        <div v-if="mode === 'url'" class="es-section">
          <div class="es-field">
            <label class="es-label">{{ $t('media.url') }}</label>
            <div class="es-url-row">
              <input
                v-model="urlInput"
                type="url"
                class="es-input es-input--grow"
                :placeholder="$t('media.urlPlaceholder')"
                @keydown.enter="detectOembed"
              />
              <button
                class="es-btn es-btn--detect"
                :disabled="!urlInput || detecting"
                @click="detectOembed"
              >
                <v-icon v-if="detecting" size="14" class="es-spin">mdi-loading</v-icon>
                <v-icon v-else size="14">mdi-magnify</v-icon>
                {{ detecting ? $t('media.detecting') : $t('media.detect') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Upload mode -->
        <div v-if="mode === 'upload'" class="es-section">
          <div class="es-field">
            <label class="es-label">{{ $t('media.videoAudio') }}</label>
            <div class="es-upload-zone" @click="triggerFileInput" @dragover.prevent @drop.prevent="onDrop">
              <input
                ref="fileInputRef"
                type="file"
                accept="video/*,audio/*"
                class="es-file-hidden"
                @change="onFileSelected"
              />
              <div v-if="!selectedFile" class="es-upload-placeholder">
                <v-icon size="28" color="var(--me-text-muted)">mdi-cloud-upload-outline</v-icon>
                <span>{{ $t('media.uploadFile') }}</span>
              </div>
              <div v-else class="es-upload-info">
                <v-icon size="18">mdi-file-music-outline</v-icon>
                <span class="es-upload-name">{{ selectedFile.name }}</span>
                <span class="es-upload-size">{{ formatSize(selectedFile.size) }}</span>
                <button class="es-upload-remove" @click.stop="removeFile">
                  <v-icon size="14">mdi-close</v-icon>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Title -->
        <div class="es-field">
          <label class="es-label">{{ $t('media.mediaName') }}</label>
          <input
            v-model="title"
            type="text"
            class="es-input"
            :placeholder="$t('media.mediaName')"
          />
        </div>

        <!-- Metadata preview -->
        <div v-if="hasMetadata" class="es-meta-preview">
          <div class="es-meta-header">
            <v-icon size="14">mdi-information-outline</v-icon>
            {{ $t('media.metadata') }}
          </div>
          <div class="es-meta-grid">
            <template v-if="metadata.platform">
              <span class="es-meta-label">{{ $t('media.platform') }}</span>
              <span class="es-meta-value">{{ metadata.platform }}</span>
            </template>
            <template v-if="metadata.channelName">
              <span class="es-meta-label">{{ $t('media.channel') }}</span>
              <span class="es-meta-value">{{ metadata.channelName }}</span>
            </template>
            <template v-if="metadata.duration">
              <span class="es-meta-label">{{ $t('media.duration') }}</span>
              <span class="es-meta-value">{{ formatDuration(metadata.duration) }}</span>
            </template>
          </div>
          <div v-if="metadata.thumbnailUrl" class="es-meta-thumb">
            <img :src="metadata.thumbnailUrl" alt="thumbnail" />
          </div>
        </div>

        <!-- Error -->
        <div v-if="errorMsg" class="es-error">
          <v-icon size="14">mdi-alert-circle-outline</v-icon>
          {{ errorMsg }}
        </div>
      </div>

      <div class="es-footer">
        <div class="es-footer-btns">
          <button class="es-btn es-btn--cancel" @click="close">{{ $t('media.cancel') }}</button>
          <button
            class="es-btn es-btn--confirm"
            :disabled="!canConfirm || uploading"
            @click="confirm"
          >
            <v-icon v-if="uploading" size="14" class="es-spin">mdi-loading</v-icon>
            <v-icon v-else size="14">mdi-check</v-icon>
            {{ $t('media.save') }}
          </button>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { MediaData, MediaSource, MediaMetadata } from '../../types';
import api from '../../services/api';

const { t } = useI18n();

const model = defineModel<boolean>({ default: false });

const props = defineProps<{
  parentId: string | null;
}>();

const emit = defineEmits<{
  'created': [title: string, mediaData: MediaData];
}>();

const mode = ref<'url' | 'upload'>('url');
const urlInput = ref('');
const title = ref('');
const detecting = ref(false);
const uploading = ref(false);
const errorMsg = ref('');
const selectedFile = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const uploadedFileUrl = ref('');
const uploadedFileName = ref('');
const uploadedMimeType = ref('');

const metadata = ref<MediaMetadata>({
  title: '',
  platform: '',
  channelName: '',
  channelUrl: '',
  publishedAt: '',
  duration: 0,
  thumbnailUrl: '',
  description: '',
  tags: [],
});

const hasMetadata = computed(() =>
  metadata.value.platform || metadata.value.channelName || metadata.value.duration || metadata.value.thumbnailUrl
);

const canConfirm = computed(() => {
  if (!title.value.trim()) return false;
  if (mode.value === 'url') return !!urlInput.value.trim();
  if (mode.value === 'upload') return !!selectedFile.value || !!uploadedFileUrl.value;
  return false;
});

// Reset state when dialog opens
watch(model, (open) => {
  if (open) {
    mode.value = 'url';
    urlInput.value = '';
    title.value = '';
    detecting.value = false;
    uploading.value = false;
    errorMsg.value = '';
    selectedFile.value = null;
    uploadedFileUrl.value = '';
    uploadedFileName.value = '';
    uploadedMimeType.value = '';
    metadata.value = {
      title: '',
      platform: '',
      channelName: '',
      channelUrl: '',
      publishedAt: '',
      duration: 0,
      thumbnailUrl: '',
      description: '',
      tags: [],
    };
  }
});

async function detectOembed() {
  if (!urlInput.value.trim() || detecting.value) return;
  detecting.value = true;
  errorMsg.value = '';
  try {
    const { data } = await api.post('/media/oembed', { url: urlInput.value.trim() });
    if (data.title && !title.value) {
      title.value = data.title;
    }
    metadata.value = {
      title: data.title || '',
      platform: data.platform || '',
      channelName: data.channelName || data.author_name || '',
      channelUrl: data.channelUrl || data.author_url || '',
      publishedAt: data.publishedAt || '',
      duration: data.duration || 0,
      thumbnailUrl: data.thumbnailUrl || data.thumbnail_url || '',
      description: data.description || '',
      tags: data.tags || [],
    };
  } catch (err: any) {
    errorMsg.value = err.response?.data?.message || t('media.unsupportedFormat');
  } finally {
    detecting.value = false;
  }
}

function triggerFileInput() {
  fileInputRef.value?.click();
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) {
    handleFile(input.files[0]);
  }
}

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (file && (file.type.startsWith('video/') || file.type.startsWith('audio/'))) {
    handleFile(file);
  }
}

function handleFile(file: File) {
  selectedFile.value = file;
  uploadedFileUrl.value = '';
  uploadedFileName.value = file.name;
  uploadedMimeType.value = file.type;
  if (!title.value) {
    title.value = file.name.replace(/\.[^/.]+$/, '');
  }
  errorMsg.value = '';
}

function removeFile() {
  selectedFile.value = null;
  uploadedFileUrl.value = '';
  uploadedFileName.value = '';
  uploadedMimeType.value = '';
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function guessMimeType(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('youtube') || lower.includes('youtu.be') || lower.includes('vimeo') || lower.includes('dailymotion')) return 'video/mp4';
  if (lower.includes('soundcloud') || lower.includes('spotify')) return 'audio/mpeg';
  if (lower.match(/\.(mp4|webm|ogg|ogv|mov|avi|mkv)(\?|$)/)) return 'video/' + (lower.match(/\.(mp4|webm|ogg|ogv|mov|avi|mkv)/)?.[1] || 'mp4');
  if (lower.match(/\.(mp3|wav|flac|aac|m4a|opus)(\?|$)/)) return 'audio/' + (lower.match(/\.(mp3|wav|flac|aac|m4a|opus)/)?.[1] || 'mpeg');
  return 'video/mp4';
}

function guessMediaType(mimeType: string): 'video' | 'audio' {
  return mimeType.startsWith('audio/') ? 'audio' : 'video';
}

async function confirm() {
  if (!canConfirm.value || uploading.value) return;
  errorMsg.value = '';

  let source: MediaSource;

  if (mode.value === 'upload' && selectedFile.value) {
    // Upload the file first
    uploading.value = true;
    try {
      const formData = new FormData();
      formData.append('file', selectedFile.value);
      const { data } = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      source = {
        type: 'upload',
        fileUrl: data.fileUrl,
        fileName: data.fileName || selectedFile.value.name,
        mimeType: data.mimeType || selectedFile.value.type,
        mediaType: guessMediaType(data.mimeType || selectedFile.value.type),
      };
    } catch (err: any) {
      errorMsg.value = err.response?.data?.message || t('media.unsupportedFormat');
      uploading.value = false;
      return;
    } finally {
      uploading.value = false;
    }
  } else {
    // URL mode
    const mime = guessMimeType(urlInput.value);
    source = {
      type: 'url',
      url: urlInput.value.trim(),
      mimeType: mime,
      mediaType: guessMediaType(mime),
    };
  }

  const mediaData: MediaData = {
    source,
    metadata: {
      title: title.value.trim(),
      platform: metadata.value.platform || undefined,
      channelName: metadata.value.channelName || undefined,
      channelUrl: metadata.value.channelUrl || undefined,
      publishedAt: metadata.value.publishedAt || undefined,
      duration: metadata.value.duration || undefined,
      thumbnailUrl: metadata.value.thumbnailUrl || undefined,
      description: metadata.value.description || undefined,
      tags: metadata.value.tags?.length ? metadata.value.tags : undefined,
    },
    annotations: [],
  };

  emit('created', title.value.trim(), mediaData);
  model.value = false;
}

function close() {
  model.value = false;
}
</script>

<style scoped>
.es-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.es-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.es-header-icon { color: var(--me-accent); }
.es-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; transition: all 0.15s; }
.es-close:hover { background: rgba(255,255,255,0.08); color: var(--me-text-primary); }

.es-body { padding: 14px 18px; display: flex; flex-direction: column; gap: 12px; }

.es-tabs { display: flex; gap: 4px; background: var(--me-bg-deep); border-radius: var(--me-radius-xs, 8px); padding: 3px; }
.es-tab {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px 12px; border: none; border-radius: var(--me-radius-xs, 6px);
  background: transparent; color: var(--me-text-secondary); font-size: 13px;
  font-weight: 500; cursor: pointer; transition: all 0.15s;
}
.es-tab:hover { color: var(--me-text-primary); }
.es-tab--active { background: var(--me-bg-surface); color: var(--me-accent); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }

.es-section { display: flex; flex-direction: column; gap: 10px; }
.es-field { display: flex; flex-direction: column; gap: 4px; }
.es-label { font-size: 12px; font-weight: 500; color: var(--me-text-secondary); }

.es-input {
  width: 100%; padding: 8px 10px; border-radius: var(--me-radius-xs, 6px);
  border: 1px solid var(--me-border); background: var(--me-bg-deep);
  color: var(--me-text-primary); font-size: 13px; outline: none;
  transition: border-color 0.15s;
}
.es-input:focus { border-color: var(--me-accent); }
.es-input--grow { flex: 1; }

.es-url-row { display: flex; gap: 8px; }

.es-btn {
  padding: 7px 16px; border-radius: 8px; border: none;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.15s; display: flex; align-items: center; gap: 6px;
  white-space: nowrap;
}
.es-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.es-btn--detect { background: var(--me-bg-deep); color: var(--me-text-secondary); border: 1px solid var(--me-border); }
.es-btn--detect:hover:not(:disabled) { border-color: var(--me-accent); color: var(--me-accent); }
.es-btn--cancel { background: none; color: var(--me-text-muted); }
.es-btn--cancel:hover { background: rgba(255,255,255,0.06); color: var(--me-text-primary); }
.es-btn--confirm { background: var(--me-accent); color: #fff; }
.es-btn--confirm:hover:not(:disabled) { filter: brightness(1.15); }

.es-upload-zone {
  border: 2px dashed var(--me-border); border-radius: var(--me-radius-xs, 8px);
  padding: 20px; text-align: center; cursor: pointer;
  transition: all 0.15s; background: var(--me-bg-deep);
}
.es-upload-zone:hover { border-color: var(--me-accent); }
.es-file-hidden { display: none; }
.es-upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--me-text-muted); font-size: 13px; }
.es-upload-info { display: flex; align-items: center; gap: 8px; color: var(--me-text-primary); font-size: 13px; }
.es-upload-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.es-upload-size { color: var(--me-text-muted); font-size: 12px; white-space: nowrap; }
.es-upload-remove { background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 2px; border-radius: 4px; display: flex; }
.es-upload-remove:hover { background: rgba(255,255,255,0.08); color: var(--me-text-primary); }

.es-meta-preview {
  border: 1px solid var(--me-border); border-radius: var(--me-radius-xs, 8px);
  background: var(--me-bg-deep); overflow: hidden;
}
.es-meta-header {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; font-size: 12px; font-weight: 600;
  color: var(--me-text-secondary); border-bottom: 1px solid var(--me-border);
}
.es-meta-grid {
  display: grid; grid-template-columns: auto 1fr; gap: 4px 12px;
  padding: 10px 12px; font-size: 12px;
}
.es-meta-label { color: var(--me-text-muted); }
.es-meta-value { color: var(--me-text-primary); }
.es-meta-thumb { padding: 8px 12px; }
.es-meta-thumb img { width: 100%; max-height: 140px; object-fit: cover; border-radius: 6px; }

.es-error {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px; border-radius: var(--me-radius-xs, 6px);
  background: rgba(244,67,54,0.12); color: #ef5350; font-size: 12px;
}

.es-footer {
  display: flex; align-items: center; justify-content: flex-end;
  padding: 12px 18px; border-top: 1px solid var(--me-border);
}
.es-footer-btns { display: flex; gap: 8px; }

@keyframes spin { to { transform: rotate(360deg); } }
.es-spin { animation: spin 1s linear infinite; }
</style>
