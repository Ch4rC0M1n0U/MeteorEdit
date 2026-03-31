<template>
  <div class="admin-osint">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-earth-arrow-right</v-icon>
        {{ $t('admin.osint.title') }}
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.osint.subtitle') }}</p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <div class="osint-grid fade-in fade-in-delay-1">
      <!-- Tool Detection -->
      <div class="branding-card glass-card">
        <h3 class="branding-card-title mono">
          <v-icon size="16" class="mr-1">mdi-wrench-outline</v-icon>
          {{ $t('admin.osint.toolDetection') }}
        </h3>
        <p class="branding-card-desc">{{ $t('admin.osint.toolDetectionDesc') }}</p>

        <div class="tool-list">
          <div class="tool-row">
            <div class="tool-info">
              <span class="tool-name mono">yt-dlp</span>
              <span :class="['status-dot', osint.ytdlpVersion ? 'status-dot--active' : 'status-dot--error']" />
            </div>
            <v-chip
              :color="osint.ytdlpVersion ? 'success' : 'error'"
              size="small"
              variant="tonal"
              class="mono"
            >
              {{ osint.ytdlpVersion || $t('admin.osint.notDetected') }}
            </v-chip>
          </div>

          <div class="tool-row">
            <div class="tool-info">
              <span class="tool-name mono">ffmpeg</span>
              <span :class="['status-dot', osint.ffmpegVersion ? 'status-dot--active' : 'status-dot--error']" />
            </div>
            <v-chip
              :color="osint.ffmpegVersion ? 'success' : 'error'"
              size="small"
              variant="tonal"
              class="mono"
            >
              {{ osint.ffmpegVersion || $t('admin.osint.notDetected') }}
            </v-chip>
          </div>

          <div class="tool-row">
            <div class="tool-info">
              <span class="tool-name mono">Python</span>
              <span :class="['status-dot', osint.pythonVersion ? 'status-dot--active' : 'status-dot--error']" />
            </div>
            <v-chip
              :color="osint.pythonVersion ? 'success' : 'error'"
              size="small"
              variant="tonal"
              class="mono"
            >
              {{ osint.pythonVersion || $t('admin.osint.notDetected') }}
            </v-chip>
          </div>

          <div class="tool-row">
            <div class="tool-info">
              <span class="tool-name mono">Telethon</span>
              <span :class="['status-dot', osint.telethonVersion ? 'status-dot--active' : 'status-dot--error']" />
            </div>
            <v-chip
              :color="osint.telethonVersion ? 'success' : 'error'"
              size="small"
              variant="tonal"
              class="mono"
            >
              {{ osint.telethonVersion || $t('admin.osint.notDetected') }}
            </v-chip>
          </div>

          <div class="tool-row">
            <div class="tool-info">
              <span class="tool-name mono">ExifTool</span>
              <span :class="['status-dot', osint.exiftoolVersion ? 'status-dot--active' : 'status-dot--error']" />
            </div>
            <v-chip
              :color="osint.exiftoolVersion ? 'success' : 'error'"
              size="small"
              variant="tonal"
              class="mono"
            >
              {{ osint.exiftoolVersion || $t('admin.osint.notDetected') }}
            </v-chip>
          </div>
        </div>

        <div class="tool-actions">
          <button class="me-btn-ghost" @click="testTools" :disabled="testing">
            <v-icon size="14" class="mr-1">mdi-refresh</v-icon>
            {{ testing ? $t('admin.osint.testing') : $t('admin.osint.test') }}
          </button>
        </div>
      </div>

      <!-- Download Configuration -->
      <div class="branding-card glass-card">
        <h3 class="branding-card-title mono">
          <v-icon size="16" class="mr-1">mdi-download-outline</v-icon>
          {{ $t('admin.osint.downloadConfig') }}
        </h3>
        <p class="branding-card-desc">{{ $t('admin.osint.downloadConfigDesc') }}</p>

        <div class="config-field">
          <label class="config-label">{{ $t('admin.osint.maxVideoSize') }}</label>
          <div class="slider-row">
            <v-slider
              v-model="osint.maxVideoSize"
              :min="50"
              :max="500"
              :step="50"
              color="primary"
              thumb-label
              hide-details
              class="config-slider"
            >
              <template #thumb-label="{ modelValue }">
                {{ modelValue }} MB
              </template>
            </v-slider>
            <span class="slider-value mono">{{ osint.maxVideoSize }} MB</span>
          </div>
        </div>

        <div class="config-field mt-4">
          <label class="config-label">{{ $t('admin.osint.maxConcurrentDownloads') }}</label>
          <v-text-field
            v-model.number="osint.maxConcurrentDownloads"
            type="number"
            :min="1"
            :max="10"
            density="compact"
            hide-details
            style="max-width: 120px;"
          />
        </div>
      </div>

      <!-- Enabled Platforms -->
      <div class="branding-card glass-card">
        <h3 class="branding-card-title mono">
          <v-icon size="16" class="mr-1">mdi-apps</v-icon>
          {{ $t('admin.osint.enabledPlatforms') }}
        </h3>
        <p class="branding-card-desc">{{ $t('admin.osint.enabledPlatformsDesc') }}</p>

        <div class="platforms-list">
          <div v-for="platform in platforms" :key="platform.key" class="platform-row">
            <div class="platform-info">
              <v-icon size="20" :color="isPlatformEnabled(platform.key) ? 'primary' : undefined">{{ platform.icon }}</v-icon>
              <span class="platform-name">{{ platform.name }}</span>
            </div>
            <v-switch
              :model-value="isPlatformEnabled(platform.key)"
              @update:model-value="togglePlatform(platform.key, $event)"
              color="primary"
              hide-details
              density="compact"
            />
          </div>
        </div>
      </div>

      <!-- Telegram API Configuration -->
      <div class="branding-card glass-card">
        <h3 class="branding-card-title mono">
          <v-icon size="16" class="mr-1">mdi-send</v-icon>
          {{ $t('admin.osint.telegramConfig') }}
        </h3>
        <p class="branding-card-desc">{{ $t('admin.osint.telegramConfigDesc') }}</p>

        <div class="config-field">
          <label class="config-label">API ID</label>
          <v-text-field
            v-model.number="telegramConfig.apiId"
            type="number"
            density="compact"
            hide-details
            :placeholder="$t('admin.osint.telegramApiIdPlaceholder')"
            style="max-width: 240px;"
          />
        </div>

        <div class="config-field mt-4">
          <label class="config-label">API Hash</label>
          <v-text-field
            v-model="telegramConfig.apiHash"
            density="compact"
            hide-details
            :placeholder="$t('admin.osint.telegramApiHashPlaceholder')"
          />
        </div>

        <div class="config-field mt-4">
          <label class="config-label">{{ $t('admin.osint.telegramSession') }}</label>
          <v-textarea
            v-model="telegramConfig.session"
            density="compact"
            hide-details
            rows="2"
            :placeholder="$t('admin.osint.telegramSessionPlaceholder')"
          />
        </div>

        <div class="telegram-help mt-4">
          <v-icon size="14" class="mr-1" color="var(--me-text-muted)">mdi-information-outline</v-icon>
          <span>{{ $t('admin.osint.telegramHelp') }}</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="branding-actions fade-in fade-in-delay-2">
      <button class="me-btn-primary" @click="saveSettings" :disabled="saving">
        <v-icon size="14" class="mr-1">mdi-content-save-outline</v-icon>
        {{ saving ? $t('admin.saving') : $t('common.save') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t } = useI18n();

const loading = ref(false);
const saving = ref(false);
const testing = ref(false);

const osint = reactive({
  maxVideoSize: 200,
  maxConcurrentDownloads: 3,
  enabledPlatforms: [] as string[],
  ytdlpPath: '',
  ffmpegPath: '',
  ytdlpVersion: '',
  ffmpegVersion: '',
  pythonVersion: '',
  telethonVersion: '',
  exiftoolVersion: '',
});

const telegramConfig = reactive({
  apiId: 0,
  apiHash: '',
  session: '',
});

const platforms = [
  { key: 'youtube', name: 'YouTube', icon: 'mdi-youtube' },
  { key: 'instagram', name: 'Instagram', icon: 'mdi-instagram' },
  { key: 'tiktok', name: 'TikTok', icon: 'mdi-music-note-outline' },
  { key: 'snapchat', name: 'Snapchat', icon: 'mdi-snapchat' },
  { key: 'facebook', name: 'Facebook', icon: 'mdi-facebook' },
  { key: 'x', name: 'X', icon: 'mdi-twitter' },
  { key: 'whatsapp', name: 'WhatsApp', icon: 'mdi-whatsapp' },
  { key: 'threads', name: 'Threads', icon: 'mdi-at' },
  { key: 'linkedin', name: 'LinkedIn', icon: 'mdi-linkedin' },
  { key: 'linktree', name: 'Linktree', icon: 'mdi-link-variant' },
  { key: 'paypal', name: 'PayPal', icon: 'mdi-credit-card-outline' },
  { key: 'telegram', name: 'Telegram', icon: 'mdi-send' },
  { key: 'strava', name: 'Strava', icon: 'mdi-run' },
  { key: 'mastodon', name: 'Mastodon', icon: 'mdi-mastodon' },
];

function isPlatformEnabled(key: string): boolean {
  return osint.enabledPlatforms.includes(key);
}

function togglePlatform(key: string, enabled: unknown) {
  if (enabled) {
    if (!osint.enabledPlatforms.includes(key)) {
      osint.enabledPlatforms.push(key);
    }
  } else {
    osint.enabledPlatforms = osint.enabledPlatforms.filter(p => p !== key);
  }
}

async function loadSettings() {
  loading.value = true;
  try {
    const { data } = await api.get('/settings/branding');
    if (data.osint) {
      osint.maxVideoSize = data.osint.maxVideoSize ?? 200;
      osint.maxConcurrentDownloads = data.osint.maxConcurrentDownloads ?? 3;
      osint.enabledPlatforms = data.osint.enabledPlatforms ?? [];
      osint.ytdlpPath = data.osint.ytdlpPath ?? '';
      osint.ffmpegPath = data.osint.ffmpegPath ?? '';
      osint.ytdlpVersion = data.osint.ytdlpVersion ?? '';
      osint.ffmpegVersion = data.osint.ffmpegVersion ?? '';
      osint.pythonVersion = data.osint.pythonVersion ?? '';
      osint.telethonVersion = data.osint.telethonVersion ?? '';
      osint.exiftoolVersion = data.osint.exiftoolVersion ?? '';
      if (data.osint.telegramConfig) {
        telegramConfig.apiId = data.osint.telegramConfig.apiId ?? 0;
        telegramConfig.apiHash = data.osint.telegramConfig.apiHash ?? '';
        telegramConfig.session = data.osint.telegramConfig.session ?? '';
      }
    }
  } finally {
    loading.value = false;
  }
}

async function testTools() {
  testing.value = true;
  try {
    await api.post('/admin/settings/detect-osint');
    const { data } = await api.get('/settings/branding');
    if (data.osint) {
      osint.ytdlpVersion = data.osint.ytdlpVersion ?? '';
      osint.ffmpegVersion = data.osint.ffmpegVersion ?? '';
      osint.pythonVersion = data.osint.pythonVersion ?? '';
      osint.telethonVersion = data.osint.telethonVersion ?? '';
      osint.exiftoolVersion = data.osint.exiftoolVersion ?? '';
    }
  } finally {
    testing.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    await api.put('/admin/settings', {
      osint: {
        maxVideoSize: osint.maxVideoSize,
        maxConcurrentDownloads: osint.maxConcurrentDownloads,
        enabledPlatforms: osint.enabledPlatforms,
        ytdlpPath: osint.ytdlpPath,
        ffmpegPath: osint.ffmpegPath,
        telegramConfig: {
          apiId: telegramConfig.apiId || 0,
          apiHash: telegramConfig.apiHash || '',
          session: telegramConfig.session || '',
        },
      },
    });
  } finally {
    saving.value = false;
  }
}

onMounted(loadSettings);
</script>

<style scoped>
.admin-section-header { margin-bottom: 24px; }
.admin-section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
}
.admin-section-subtitle {
  font-size: 13px;
  color: var(--me-text-muted);
  margin-top: 4px;
  font-family: var(--me-font-mono);
}
.osint-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.branding-card { padding: 20px; }
.branding-card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
}
.branding-card-desc {
  font-size: 12px;
  color: var(--me-text-muted);
  margin-bottom: 12px;
}

/* Tool Detection */
.tool-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tool-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
}
.tool-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tool-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.status-dot--active { background: #34d399; box-shadow: 0 0 6px rgba(52, 211, 153, 0.4); }
.status-dot--error { background: #f87171; box-shadow: 0 0 6px rgba(248, 113, 113, 0.4); }
.tool-actions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

/* Download Config */
.config-field { }
.config-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-secondary);
  margin-bottom: 8px;
  display: block;
}
.slider-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.config-slider {
  flex: 1;
}
.slider-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--me-accent);
  min-width: 60px;
  text-align: right;
}
.mt-4 { margin-top: 16px; }

/* Platforms */
.platforms-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.platform-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: var(--me-radius-xs);
  transition: background 0.15s;
}
.platform-row:hover {
  background: var(--me-accent-glow);
}
.platform-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
.platform-name {
  font-size: 14px;
  color: var(--me-text-primary);
  font-weight: 500;
}

/* Actions */
.branding-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--me-border);
}
.me-btn-ghost {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
}
.me-btn-ghost:hover {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
}
.me-btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.me-btn-primary {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
}
.me-btn-primary:hover {
  box-shadow: 0 0 16px var(--me-accent-glow);
}
.me-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.telegram-help {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 11px;
  color: var(--me-text-muted);
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--me-bg-elevated);
  line-height: 1.5;
}
.mr-1 { margin-right: 4px; }
.mb-4 { margin-bottom: 16px; }
</style>
