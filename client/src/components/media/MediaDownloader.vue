<template>
  <div class="mdl-downloader">
    <!-- Header -->
    <div class="mdl-header">
      <v-icon size="16">mdi-download</v-icon>
      <span class="mdl-title">{{ t('media.download.title') }}</span>
    </div>

    <!-- URL Input + Platform badge -->
    <div class="mdl-input-row">
      <div class="mdl-input-wrap">
        <input
          v-model="urlInput"
          type="url"
          class="mdl-input"
          :placeholder="t('media.download.urlPlaceholder')"
          :disabled="downloading"
          @input="onUrlChange"
          @keydown.enter="startDownload"
        />
        <!-- Platform badge -->
        <div v-if="detectedPlatform" class="mdl-platform-badge" :class="`mdl-platform--${detectedPlatform.key}`">
          <v-icon size="14">{{ detectedPlatform.icon }}</v-icon>
          <span>{{ detectedPlatform.label }}</span>
        </div>
      </div>

      <button
        class="mdl-btn mdl-btn--download"
        :disabled="!canDownload"
        @click="startDownload"
      >
        <v-icon v-if="downloading" size="14" class="mdl-spin">mdi-loading</v-icon>
        <v-icon v-else size="14">mdi-download</v-icon>
        {{ t('media.download.button') }}
      </button>
    </div>

    <!-- Tracking params warning -->
    <div v-if="hasTrackingParams && !downloading" class="mdl-tracking-warning">
      <v-icon size="14">mdi-link-variant-off</v-icon>
      <span>{{ t('media.download.trackingParams') }}</span>
      <button class="mdl-clean-btn" @click="autoCleanUrl">
        {{ t('media.download.cleanUrl') }}
      </button>
    </div>

    <!-- Cookie warning -->
    <div v-if="cookieWarning" class="mdl-cookie-warning">
      <v-icon size="14">mdi-cookie-alert-outline</v-icon>
      <span>{{ t('media.download.noCookies', { platform: detectedPlatform?.label || '' }) }}</span>
      <button class="mdl-cookie-link" @click="$emit('openSessionManager')">
        {{ t('media.download.sessionManager') }}
      </button>
    </div>

    <!-- Progress section -->
    <div v-if="downloading || downloadComplete || downloadError" class="mdl-progress-section">
      <!-- Stage label + percentage -->
      <div class="mdl-progress-info">
        <span class="mdl-stage">{{ currentStageLabel }}</span>
        <span class="mdl-percent">{{ Math.round(progress) }}%</span>
      </div>

      <!-- Progress bar -->
      <div class="mdl-progress-bar">
        <div
          class="mdl-progress-fill"
          :class="{
            'mdl-progress-fill--complete': downloadComplete,
            'mdl-progress-fill--error': downloadError,
          }"
          :style="{ width: `${progress}%` }"
        />
      </div>

      <!-- Status message -->
      <div v-if="statusMessage" class="mdl-status-msg" :class="{ 'mdl-status-msg--error': downloadError }">
        <v-icon v-if="downloadComplete" size="14" color="success">mdi-check-circle</v-icon>
        <v-icon v-else-if="downloadError" size="14" color="error">mdi-alert-circle</v-icon>
        <span>{{ statusMessage }}</span>
      </div>

      <!-- Cancel button -->
      <button
        v-if="downloading && !downloadComplete && !downloadError"
        class="mdl-btn mdl-btn--cancel"
        @click="cancelDownload"
      >
        <v-icon size="14">mdi-close</v-icon>
        {{ t('media.download.cancel') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api, { SERVER_URL } from '../../services/api';
import { useEncryptionStore } from '../../stores/encryption';
import { encryptFile } from '../../utils/encryption';

const { t } = useI18n();
const encryptionStore = useEncryptionStore();

const props = defineProps<{
  dossierId: string;
  parentId?: string | null;
  nodeId?: string | null;
  initialUrl?: string;
}>();

const emit = defineEmits<{
  'downloaded': [node: any];
  'openSessionManager': [];
}>();

// --- Platform detection ---
interface PlatformInfo {
  key: string;
  label: string;
  icon: string;
  pattern: RegExp;
}

const platforms: PlatformInfo[] = [
  { key: 'youtube', label: 'YouTube', icon: 'mdi-youtube', pattern: /youtube\.com|youtu\.be/i },
  { key: 'tiktok', label: 'TikTok', icon: 'mdi-music-note', pattern: /tiktok\.com/i },
  { key: 'snapchat', label: 'Snapchat', icon: 'mdi-snapchat', pattern: /snapchat\.com/i },
  { key: 'instagram', label: 'Instagram', icon: 'mdi-instagram', pattern: /instagram\.com/i },
  { key: 'facebook', label: 'Facebook', icon: 'mdi-facebook', pattern: /facebook\.com/i },
  { key: 'x', label: 'X', icon: 'mdi-twitter', pattern: /twitter\.com|x\.com/i },
];

// --- State ---
const urlInput = ref('');
const downloading = ref(false);
const downloadComplete = ref(false);
const downloadError = ref(false);
const progress = ref(0);
const currentStage = ref('');
const statusMessage = ref('');
const cookieWarning = ref(false);

let abortController: AbortController | null = null;

// Pre-fill URL from prop
onMounted(() => {
  if (props.initialUrl) {
    urlInput.value = props.initialUrl;
  }
});
watch(() => props.initialUrl, (val) => {
  if (val) {
    urlInput.value = val;
    // Reset download state for new URL
    downloadComplete.value = false;
    downloadError.value = false;
    statusMessage.value = '';
    progress.value = 0;
    currentStage.value = '';
  }
});

// --- Computed ---
const detectedPlatform = computed<PlatformInfo | null>(() => {
  if (!urlInput.value.trim()) return null;
  for (const p of platforms) {
    if (p.pattern.test(urlInput.value)) return p;
  }
  return null;
});

// Tracking params that can cause issues with yt-dlp
const TRACKING_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'igsh', 'ig_web_copy_link', 'fbclid', 'ref', 'ref_src', 'ref_url', 'si'];

const hasTrackingParams = computed(() => {
  try {
    const u = new URL(urlInput.value.trim());
    return TRACKING_PARAMS.some(p => u.searchParams.has(p));
  } catch { return false; }
});

/** Return cleaned URL (without tracking params) */
function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    TRACKING_PARAMS.forEach(p => u.searchParams.delete(p));
    // Remove empty search
    return u.toString().replace(/\?$/, '');
  } catch { return raw.trim(); }
}

function autoCleanUrl() {
  urlInput.value = cleanUrl(urlInput.value);
}

const canDownload = computed(() => {
  return urlInput.value.trim().length > 0 && detectedPlatform.value !== null && !downloading.value;
});

const currentStageLabel = computed(() => {
  const stageMap: Record<string, string> = {
    preparation: t('media.download.stagePreparation'),
    downloading: t('media.download.stageDownloading'),
    finalisation: t('media.download.stageFinalisation'),
    done: t('media.download.stageDone'),
    error: t('media.download.stageError'),
    fetching_metadata: t('media.download.stagePreparation'),
  };
  return stageMap[currentStage.value] || currentStage.value || t('media.download.stagePreparation');
});

// --- Methods ---
function onUrlChange() {
  cookieWarning.value = false;
  downloadComplete.value = false;
  downloadError.value = false;
  statusMessage.value = '';
  progress.value = 0;
  currentStage.value = '';
}

async function checkCookies(): Promise<boolean> {
  if (!detectedPlatform.value) return false;
  try {
    const { data } = await api.get('/social/cookies');
    const cookies: Array<{ platform: string }> = data.cookies || data || [];
    const hasCookies = cookies.some(
      (c) => c.platform?.toLowerCase() === detectedPlatform.value!.key.toLowerCase()
    );
    if (!hasCookies) {
      cookieWarning.value = true;
      return false;
    }
    cookieWarning.value = false;
    return true;
  } catch {
    cookieWarning.value = false;
    return true;
  }
}

async function startDownload() {
  if (!canDownload.value) return;

  // Auto-clean tracking params before download
  if (hasTrackingParams.value) {
    autoCleanUrl();
  }

  downloading.value = true;
  downloadComplete.value = false;
  downloadError.value = false;
  progress.value = 0;
  currentStage.value = 'preparation';
  statusMessage.value = '';
  cookieWarning.value = false;

  await checkCookies();

  abortController = new AbortController();

  try {
    const token = localStorage.getItem('accessToken') || '';
    const response = await fetch(`${SERVER_URL}/api/media/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        url: urlInput.value.trim(),
        dossierId: props.dossierId,
        parentId: props.parentId || undefined,
        nodeId: props.nodeId || undefined,
      }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
    }

    // Read SSE stream from response body
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream non disponible');

    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const payload = JSON.parse(line.slice(6));
            handleSSEEvent(currentEvent, payload);
          } catch { /* ignore parse errors */ }
          currentEvent = '';
        }
        // Empty line = end of SSE message block (reset event)
        if (line.trim() === '') {
          currentEvent = '';
        }
      }
    }

    // Stream ended — mark complete if download was in progress
    if (downloading.value && !downloadComplete.value && !downloadError.value) {
      downloading.value = false;
      if (progress.value >= 95) {
        downloadComplete.value = true;
        emit('downloaded', null);
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return; // Cancelled by user
    downloading.value = false;
    downloadError.value = true;
    statusMessage.value = err.message || t('media.download.errorGeneric');
  } finally {
    abortController = null;
  }
}

function handleSSEEvent(event: string, payload: any) {
  switch (event) {
    case 'status':
      if (payload.status === 'fetching_metadata') currentStage.value = 'preparation';
      else if (payload.status === 'downloading') currentStage.value = 'downloading';
      break;
    case 'metadata':
      if (payload.title) statusMessage.value = payload.title;
      break;
    case 'progress':
      if (typeof payload.progress === 'number') {
        progress.value = payload.progress;
        currentStage.value = 'downloading';
      }
      break;
    case 'complete':
      onDownloadComplete(payload);
      break;
    case 'error':
      downloading.value = false;
      downloadError.value = true;
      statusMessage.value = payload.error || t('media.download.errorGeneric');
      break;
    default:
      // Fallback: try to infer from payload
      if (typeof payload.progress === 'number') {
        progress.value = payload.progress;
        currentStage.value = 'downloading';
      }
      if (payload.node) {
        onDownloadComplete(payload);
      }
      break;
  }
}

async function onDownloadComplete(payload: any) {
  progress.value = 100;
  currentStage.value = 'finalisation';
  statusMessage.value = t('media.download.stageFinalisation');

  // Encrypt the downloaded file client-side
  const fileUrl = payload.node?.mediaData?.source?.fileUrl;
  if (fileUrl) {
    try {
      const dossierKey = await encryptionStore.getDossierKey(props.dossierId);
      if (dossierKey) {
        // Fetch the raw file
        const filename = fileUrl.split('/').pop() || '';
        const response = await api.get(`/files/${filename}`, { responseType: 'arraybuffer' });

        // Encrypt
        const encryptedBuffer = await encryptFile(dossierKey, response.data);
        const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
        const encryptedFile = new File([encryptedBlob], filename + '.enc', { type: 'application/octet-stream' });

        // Upload encrypted version
        const formData = new FormData();
        formData.append('file', encryptedFile);
        formData.append('fileUrl', fileUrl);
        await api.post('/media/encrypt-file', formData);
      }
    } catch (err) {
      console.warn('[MediaDownloader] Failed to encrypt downloaded file:', err);
      // Non-blocking — file remains unencrypted but usable
    }
  }

  currentStage.value = 'done';
  downloading.value = false;
  downloadComplete.value = true;
  emit('downloaded', payload.node);
}

function cancelDownload() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  downloading.value = false;
  downloadError.value = false;
  downloadComplete.value = false;
  progress.value = 0;
  currentStage.value = '';
  statusMessage.value = '';
}

// --- Cleanup ---
onBeforeUnmount(() => {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
});
</script>

<style scoped>
.mdl-downloader {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid var(--me-border);
  background: var(--me-bg-surface);
}

.mdl-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
}

/* Input row */
.mdl-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.mdl-input-wrap {
  flex: 1;
  position: relative;
}

.mdl-input {
  width: 100%;
  padding: 8px 10px;
  padding-right: 110px;
  border-radius: var(--me-radius-xs, 6px);
  border: 1px solid var(--me-border);
  background: var(--me-bg-deep);
  color: var(--me-text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.mdl-input:focus {
  border-color: var(--me-accent);
}
.mdl-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.mdl-input::placeholder {
  color: var(--me-text-muted);
}

/* Platform badge */
.mdl-platform-badge {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
}
.mdl-platform--youtube { background: rgba(255, 0, 0, 0.12); color: #ff4444; }
.mdl-platform--tiktok { background: rgba(0, 0, 0, 0.12); color: #69c9d0; }
.mdl-platform--snapchat { background: rgba(255, 252, 0, 0.15); color: #c4b400; }
.mdl-platform--instagram { background: rgba(225, 48, 108, 0.12); color: #e1306c; }
.mdl-platform--facebook { background: rgba(24, 119, 242, 0.12); color: #1877f2; }
.mdl-platform--x { background: rgba(255, 255, 255, 0.08); color: var(--me-text-secondary); }

/* Buttons */
.mdl-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
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
.mdl-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mdl-btn--download {
  border-color: rgba(var(--me-accent-rgb), 0.3);
  color: var(--me-accent);
}
.mdl-btn--download:hover:not(:disabled) {
  background: rgba(var(--me-accent-rgb), 0.1);
  border-color: var(--me-accent);
}

.mdl-btn--cancel {
  border-color: rgba(244, 67, 54, 0.3);
  color: #ef5350;
  align-self: flex-start;
}
.mdl-btn--cancel:hover {
  background: rgba(244, 67, 54, 0.1);
  border-color: #ef5350;
}

/* Tracking params warning */
.mdl-tracking-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: var(--me-radius-xs, 6px);
  background: rgba(255, 152, 0, 0.1);
  border: 1px solid rgba(255, 152, 0, 0.25);
  color: #ff9800;
  font-size: 12px;
}
.mdl-clean-btn {
  background: none;
  border: 1px solid rgba(255, 152, 0, 0.4);
  border-radius: 4px;
  color: #ff9800;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 8px;
  margin-left: auto;
  white-space: nowrap;
  transition: all 0.15s;
}
.mdl-clean-btn:hover {
  background: rgba(255, 152, 0, 0.15);
  border-color: #ff9800;
}

/* Cookie warning */
.mdl-cookie-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: var(--me-radius-xs, 6px);
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.25);
  color: #ffc107;
  font-size: 12px;
}
.mdl-cookie-link {
  background: none;
  border: none;
  color: var(--me-accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  margin-left: auto;
  white-space: nowrap;
}
.mdl-cookie-link:hover {
  filter: brightness(1.2);
}

/* Progress section */
.mdl-progress-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mdl-progress-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mdl-stage {
  font-size: 12px;
  font-weight: 500;
  color: var(--me-text-secondary);
}

.mdl-percent {
  font-size: 12px;
  font-weight: 700;
  color: var(--me-accent);
  font-variant-numeric: tabular-nums;
}

.mdl-progress-bar {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--me-bg-deep);
  overflow: hidden;
}

.mdl-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--me-accent);
  transition: width 0.3s ease;
}
.mdl-progress-fill--complete {
  background: #4caf50;
}
.mdl-progress-fill--error {
  background: #ef5350;
}

/* Status message */
.mdl-status-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--me-text-secondary);
}
.mdl-status-msg--error {
  color: #ef5350;
}

/* Spin animation */
@keyframes mdl-spin {
  to { transform: rotate(360deg); }
}
.mdl-spin {
  animation: mdl-spin 1s linear infinite;
}
</style>
