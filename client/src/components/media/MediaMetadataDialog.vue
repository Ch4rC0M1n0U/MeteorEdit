<template>
  <v-dialog v-model="model" max-width="540" persistent>
    <div class="md-dialog glass-card">
      <div class="md-header">
        <v-icon size="20" class="md-header-icon">mdi-text-box-edit-outline</v-icon>
        <span>{{ $t('media.editMetadata') }}</span>
        <button class="md-close" @click="cancel">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <div class="md-body">
        <!-- Source URL (read-only) -->
        <div v-if="sourceUrl" class="md-field">
          <label class="md-label">{{ $t('media.sourceUrl') }}</label>
          <div class="md-url-row">
            <input
              :value="sourceUrl"
              type="text"
              class="md-input md-input--readonly"
              readonly
            />
            <button class="md-copy-btn" :title="$t('media.copyUrl')" @click="copyUrl">
              <v-icon size="16">{{ copied ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
            </button>
            <button class="md-fetch-btn" :title="$t('media.refetch')" :disabled="fetching" @click="refetchMetadata">
              <v-icon size="16" :class="{ 'md-spin': fetching }">mdi-refresh</v-icon>
            </button>
          </div>
        </div>

        <!-- Title (required) -->
        <div class="md-field">
          <label class="md-label">{{ $t('media.mediaName') }} *</label>
          <input
            v-model="local.title"
            type="text"
            class="md-input"
            required
          />
        </div>

        <!-- Platform with logo -->
        <div class="md-field">
          <label class="md-label">{{ $t('media.platform') }}</label>
          <div class="md-platform-row">
            <div v-if="platformIcon" class="md-platform-logo" :title="local.platform">
              <component :is="platformIcon" />
            </div>
            <input
              v-model="local.platform"
              type="text"
              class="md-input"
              placeholder="YouTube, Vimeo, SoundCloud, Dailymotion..."
            />
          </div>
        </div>

        <!-- Channel name + URL row -->
        <div class="md-row">
          <div class="md-field md-field--grow">
            <label class="md-label">{{ $t('media.channel') }}</label>
            <input
              v-model="local.channelName"
              type="text"
              class="md-input"
            />
          </div>
          <div class="md-field md-field--grow">
            <label class="md-label">{{ $t('media.channelUrl') }}</label>
            <input
              v-model="local.channelUrl"
              type="text"
              class="md-input"
            />
          </div>
        </div>

        <!-- Published date + Duration row -->
        <div class="md-row">
          <div class="md-field md-field--grow">
            <label class="md-label">{{ $t('media.publishedAt') }}</label>
            <input
              v-model="local.publishedAt"
              type="date"
              class="md-input"
            />
          </div>
          <div class="md-field" style="width: 160px;">
            <label class="md-label">{{ $t('media.duration') }}</label>
            <div class="md-duration-row">
              <input
                v-model.number="local.duration"
                type="number"
                min="0"
                class="md-input md-input--duration"
                :placeholder="$t('media.seconds')"
              />
              <span v-if="local.duration" class="md-duration-display">{{ formatDuration(local.duration) }}</span>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="md-field">
          <label class="md-label">{{ $t('media.description') }}</label>
          <textarea
            v-model="local.description"
            class="md-input md-textarea"
            rows="3"
          ></textarea>
        </div>

        <!-- Tags -->
        <div class="md-field">
          <label class="md-label">{{ $t('media.tags') }}</label>
          <div class="md-tags-container">
            <div v-if="local.tags?.length" class="md-tags-list">
              <span v-for="(tag, i) in local.tags" :key="i" class="md-tag">
                {{ tag }}
                <button class="md-tag-remove" @click="removeTag(i)">
                  <v-icon size="12">mdi-close</v-icon>
                </button>
              </span>
            </div>
            <input
              v-model="newTag"
              type="text"
              class="md-input"
              :placeholder="$t('media.addTag')"
              @keydown.enter.prevent="addTag"
              @keydown.,="addTag"
            />
          </div>
        </div>

        <!-- Thumbnail URL + preview -->
        <div class="md-field">
          <label class="md-label">{{ $t('media.thumbnailUrl') }}</label>
          <input
            v-model="local.thumbnailUrl"
            type="text"
            class="md-input"
          />
          <div v-if="local.thumbnailUrl" class="md-thumb-preview">
            <img :src="local.thumbnailUrl" :alt="$t('media.preview')" @error="onThumbError" />
          </div>
        </div>
      </div>

      <div class="md-footer">
        <button class="md-btn md-btn--cancel" @click="cancel">{{ $t('media.cancel') }}</button>
        <button class="md-btn md-btn--confirm" :disabled="!local.title?.trim()" @click="save">
          <v-icon size="14">mdi-check</v-icon>
          {{ $t('media.save') }}
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, h, type FunctionalComponent } from 'vue';
import type { MediaMetadata } from '../../types';
import api from '../../services/api';

const model = defineModel<boolean>({ default: false });

const props = defineProps<{
  metadata: MediaMetadata;
  sourceUrl?: string;
}>();

const emit = defineEmits<{
  'save': [metadata: MediaMetadata];
}>();

const local = ref<MediaMetadata>({ title: '' });
const newTag = ref('');
const copied = ref(false);
const fetching = ref(false);

// --- Platform logo SVGs ---
const platformLogos: Record<string, FunctionalComponent> = {
  youtube: () => h('svg', { viewBox: '0 0 24 24', width: '24', height: '24' }, [
    h('path', { d: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814Z', fill: '#FF0000' }),
    h('path', { d: 'm9.545 15.568 6.273-3.568-6.273-3.568v7.136Z', fill: '#FFF' }),
  ]),
  vimeo: () => h('svg', { viewBox: '0 0 24 24', width: '24', height: '24' }, [
    h('path', { d: 'M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609C15.906 20.365 13.024 22.5 10.62 22.5c-1.487 0-2.746-1.373-3.777-4.115C5.946 15.224 5.197 9.818 3.93 9.818c-.175 0-.786.367-1.834 1.1L.878 9.37c1.152-1.013 2.288-2.027 3.406-3.042 1.535-1.327 2.687-2.027 3.455-2.098 1.815-.175 2.932 1.066 3.355 3.722.455 2.868.771 4.653.947 5.355.526 2.393 1.105 3.588 1.735 3.588.49 0 1.225-.775 2.205-2.327.98-1.55 1.505-2.731 1.576-3.543.14-1.343-.387-2.013-1.576-2.013-.561 0-1.139.128-1.735.387 1.152-3.774 3.353-5.609 6.605-5.505 2.412.07 3.548 1.634 3.411 4.692Z', fill: '#1AB7EA' }),
  ]),
  soundcloud: () => h('svg', { viewBox: '0 0 24 24', width: '24', height: '24' }, [
    h('path', { d: 'M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.308c.013.06.045.094.104.094.053 0 .088-.035.104-.094l.2-1.308-.2-1.332c-.016-.06-.05-.094-.104-.094m1.8-.586c-.064 0-.104.044-.11.105l-.21 2.014.21 1.96c.006.06.046.1.11.1.057 0 .1-.04.108-.1l.234-1.96-.234-2.014c-.008-.06-.05-.105-.108-.105m.907-.482c-.073 0-.116.05-.122.11l-.2 2.496.2 2.01c.006.063.049.108.122.108.072 0 .115-.045.123-.108l.227-2.01-.227-2.496c-.008-.06-.051-.11-.123-.11m.96-.236c-.08 0-.127.055-.133.12l-.18 2.732.18 2.02c.006.072.053.12.133.12.077 0 .123-.048.133-.12l.2-2.02-.2-2.732c-.01-.065-.056-.12-.133-.12m.965-.143c-.088 0-.138.06-.143.128l-.168 2.875.168 2.02c.005.073.055.123.143.123.085 0 .135-.05.143-.123l.19-2.02-.19-2.875c-.008-.068-.058-.128-.143-.128m.976-.097c-.095 0-.148.066-.153.136l-.158 2.972.158 2.02c.005.078.058.13.153.13.093 0 .146-.052.154-.13l.176-2.02-.176-2.972c-.008-.07-.061-.136-.154-.136m.982-.063c-.102 0-.156.074-.16.146l-.15 3.035.15 2.017c.004.082.058.138.16.138.098 0 .155-.056.162-.138l.17-2.017-.17-3.035c-.007-.072-.064-.146-.162-.146m2.02-.283c-.12 0-.183.085-.187.167l-.13 3.318.13 2.003c.004.09.067.15.187.15.116 0 .18-.06.187-.15l.146-2.003-.146-3.318c-.007-.082-.071-.167-.187-.167m-.987.22c-.112 0-.171.08-.176.157l-.14 3.098.14 2.01c.005.086.064.143.176.143.109 0 .171-.057.178-.143l.156-2.01-.156-3.098c-.007-.077-.069-.157-.178-.157m2.007-.38c-.128 0-.194.09-.198.176l-.12 3.498.12 1.995c.004.094.07.155.198.155.124 0 .192-.061.2-.155l.134-1.995-.134-3.498c-.008-.086-.076-.176-.2-.176m1.012-.1c-.136 0-.204.095-.208.185l-.11 3.598.11 1.988c.004.098.072.16.208.16.132 0 .203-.062.21-.16l.124-1.988-.124-3.598c-.007-.09-.078-.185-.21-.185m1.022-.06c-.144 0-.213.1-.217.194l-.1 3.658.1 1.98c.004.103.073.167.217.167.14 0 .213-.064.22-.167l.114-1.98-.114-3.658c-.007-.094-.08-.194-.22-.194m1.02 0c-.152 0-.222.104-.226.202l-.093 3.658.093 1.97c.004.106.074.172.226.172.148 0 .222-.066.23-.172l.104-1.97-.104-3.658c-.008-.098-.082-.202-.23-.202m2.058-.298c-.18 0-.26.123-.264.228l-.078 3.956.078 1.94c.004.118.084.193.264.193s.26-.075.268-.193l.088-1.94-.088-3.956c-.008-.105-.088-.228-.268-.228m-1.023.236c-.16 0-.232.112-.237.216l-.086 3.72.086 1.955c.005.112.077.183.237.183.156 0 .232-.071.24-.183l.096-1.955-.096-3.72c-.008-.104-.084-.216-.24-.216m2.054-.296c-.178 0-.265.124-.27.232l-.07 3.98.07 1.93c.005.118.092.197.27.197.174 0 .262-.08.27-.197l.08-1.93-.08-3.98c-.008-.108-.096-.232-.27-.232m1.046.07c-.17 0-.264.122-.27.228l-.063 3.91.063 1.92c.006.115.1.192.27.192.168 0 .262-.077.27-.192l.072-1.92-.072-3.91c-.008-.106-.102-.228-.27-.228m1.585.57c-.085-.05-.175-.075-.27-.075-.196 0-.372.113-.448.287l-.05 3.128.07 1.907c.006.12.098.198.278.198.174 0 .27-.078.277-.198l.063-1.907-.063-3.36c-.012-.116-.062-.23-.143-.31m1.005-.356c-.198 0-.375.11-.455.28-.05.103-.077.215-.077.333v7.264c0 .296.243.54.54.54h4.2c1.65 0 2.99-1.33 2.99-2.97 0-1.647-1.34-2.98-2.99-2.98-.41 0-.8.082-1.155.23C20.77 8.28 18.863 6.42 16.61 6.42', fill: '#F70' }),
  ]),
  dailymotion: () => h('svg', { viewBox: '0 0 24 24', width: '24', height: '24' }, [
    h('path', { d: 'M11.903 20.284c-1.197 0-2.273-.344-3.169-1.015-.905-.68-1.548-1.607-1.882-2.717l-.055-.178v4.388H3.238V3.238h3.559v7.3l.055-.176c.346-1.102.977-2.019 1.882-2.694.896-.668 1.972-1.01 3.169-1.01 1.147 0 2.2.312 3.13.929.932.618 1.674 1.463 2.207 2.513.53 1.042.8 2.208.8 3.462 0 1.261-.27 2.43-.8 3.472-.533 1.048-1.275 1.891-2.208 2.505-.93.614-1.982.924-3.13.924zm-.635-3.174c.96 0 1.755-.35 2.364-1.038.612-.693.922-1.568.922-2.599 0-1.025-.31-1.896-.922-2.589-.61-.688-1.404-1.037-2.364-1.037-.96 0-1.757.349-2.37 1.037-.613.693-.924 1.564-.924 2.589 0 1.031.311 1.906.924 2.599.613.688 1.41 1.038 2.37 1.038z', fill: '#0D0D8B' }),
  ]),
};

const platformIcon = computed(() => {
  const p = (local.value.platform || '').toLowerCase().trim();
  if (p.includes('youtube')) return platformLogos.youtube;
  if (p.includes('vimeo')) return platformLogos.vimeo;
  if (p.includes('soundcloud')) return platformLogos.soundcloud;
  if (p.includes('dailymotion')) return platformLogos.dailymotion;
  return null;
});

/** Normalize any date string to YYYY-MM-DD for <input type="date"> */
function toDateInputValue(raw?: string): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw; // keep as-is if unparseable
  return d.toISOString().slice(0, 10);
}

// Clone metadata into local state when dialog opens
watch(model, (open) => {
  if (open) {
    local.value = {
      title: props.metadata.title ?? '',
      platform: props.metadata.platform ?? '',
      channelName: props.metadata.channelName ?? '',
      channelUrl: props.metadata.channelUrl ?? '',
      publishedAt: toDateInputValue(props.metadata.publishedAt),
      duration: props.metadata.duration ?? 0,
      description: props.metadata.description ?? '',
      tags: [...(props.metadata.tags ?? [])],
      thumbnailUrl: props.metadata.thumbnailUrl ?? '',
    };
    newTag.value = '';
    copied.value = false;
  }
});

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function addTag() {
  const tag = newTag.value.replace(',', '').trim();
  if (tag && !local.value.tags?.includes(tag)) {
    if (!local.value.tags) local.value.tags = [];
    local.value.tags.push(tag);
  }
  newTag.value = '';
}

function removeTag(index: number) {
  local.value.tags?.splice(index, 1);
}

async function refetchMetadata() {
  if (!props.sourceUrl || fetching.value) return;
  fetching.value = true;
  try {
    const { data } = await api.post('/media/oembed', { url: props.sourceUrl });
    const m = data.metadata;
    if (!m) return;
    // Merge: fill empty fields, don't overwrite user edits
    if (!local.value.title && m.title) local.value.title = m.title;
    if (!local.value.platform && m.platform) local.value.platform = m.platform;
    if (!local.value.channelName && m.channelName) local.value.channelName = m.channelName;
    if (!local.value.channelUrl && m.channelUrl) local.value.channelUrl = m.channelUrl;
    if (!local.value.publishedAt && m.publishedAt) local.value.publishedAt = toDateInputValue(m.publishedAt);
    if (!local.value.duration && m.duration) local.value.duration = m.duration;
    if (!local.value.description && m.description) local.value.description = m.description;
    if (!local.value.thumbnailUrl && m.thumbnailUrl) local.value.thumbnailUrl = m.thumbnailUrl;
    if ((!local.value.tags || local.value.tags.length === 0) && m.tags?.length) {
      local.value.tags = [...m.tags];
    }
  } catch (err) {
    console.error('Refetch metadata failed:', err);
  } finally {
    fetching.value = false;
  }
}

async function copyUrl() {
  if (!props.sourceUrl) return;
  try {
    await navigator.clipboard.writeText(props.sourceUrl);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch { /* fallback: ignore */ }
}

function onThumbError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none';
}

function save() {
  if (!local.value.title?.trim()) return;
  const cleaned: MediaMetadata = {
    title: local.value.title.trim(),
    platform: local.value.platform || undefined,
    channelName: local.value.channelName || undefined,
    channelUrl: local.value.channelUrl || undefined,
    publishedAt: local.value.publishedAt || undefined,
    duration: local.value.duration || undefined,
    description: local.value.description || undefined,
    tags: local.value.tags?.length ? local.value.tags : undefined,
    thumbnailUrl: local.value.thumbnailUrl || undefined,
  };
  emit('save', cleaned);
  model.value = false;
}

function cancel() {
  model.value = false;
}
</script>

<style scoped>
.md-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.md-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.md-header-icon { color: var(--me-accent); }
.md-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; transition: all 0.15s; }
.md-close:hover { background: rgba(255,255,255,0.08); color: var(--me-text-primary); }

.md-body { padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; max-height: 60vh; overflow-y: auto; }

.md-row { display: flex; gap: 10px; }

.md-field { display: flex; flex-direction: column; gap: 4px; }
.md-field--grow { flex: 1; min-width: 0; }
.md-label { font-size: 12px; font-weight: 500; color: var(--me-text-secondary); }

.md-input {
  width: 100%; padding: 7px 10px; border-radius: var(--me-radius-xs, 6px);
  border: 1px solid var(--me-border); background: var(--me-bg-deep);
  color: var(--me-text-primary); font-size: 13px; outline: none;
  transition: border-color 0.15s; font-family: inherit;
}
.md-input:focus { border-color: var(--me-accent); }
.md-input--readonly { opacity: 0.7; cursor: default; }
.md-input--duration { width: 80px; flex-shrink: 0; }

.md-textarea { resize: vertical; min-height: 60px; }

/* Source URL row */
.md-url-row { display: flex; gap: 6px; align-items: center; }
.md-url-row .md-input { flex: 1; }
.md-copy-btn {
  background: none; border: 1px solid var(--me-border); border-radius: 6px;
  padding: 6px 8px; cursor: pointer; color: var(--me-text-muted);
  display: flex; align-items: center; transition: all 0.15s;
}
.md-copy-btn:hover { color: var(--me-accent); border-color: var(--me-accent); }
.md-fetch-btn {
  background: none; border: 1px solid var(--me-border); border-radius: 6px;
  padding: 6px 8px; cursor: pointer; color: var(--me-text-muted);
  display: flex; align-items: center; transition: all 0.15s;
}
.md-fetch-btn:hover:not(:disabled) { color: var(--me-accent); border-color: var(--me-accent); }
.md-fetch-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.md-spin { animation: md-spin 0.8s linear infinite; }
@keyframes md-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Platform row */
.md-platform-row { display: flex; align-items: center; gap: 8px; }
.md-platform-row .md-input { flex: 1; }
.md-platform-logo {
  flex-shrink: 0; width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: var(--me-bg-deep); border-radius: 6px; border: 1px solid var(--me-border);
}
.md-platform-logo svg { width: 22px; height: 22px; }

/* Duration row */
.md-duration-row { display: flex; align-items: center; gap: 8px; }
.md-duration-display { font-size: 12px; color: var(--me-accent); font-weight: 500; white-space: nowrap; }

/* Tags */
.md-tags-container { display: flex; flex-direction: column; gap: 6px; }
.md-tags-list { display: flex; flex-wrap: wrap; gap: 4px; }
.md-tag {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 12px; font-size: 12px;
  background: var(--me-accent-light, rgba(255,107,53,0.12));
  color: var(--me-accent); border: 1px solid rgba(255,107,53,0.25);
}
.md-tag-remove {
  background: none; border: none; cursor: pointer; padding: 0;
  color: var(--me-accent); opacity: 0.6; display: flex;
  transition: opacity 0.15s;
}
.md-tag-remove:hover { opacity: 1; }

.md-thumb-preview { margin-top: 4px; }
.md-thumb-preview img { max-width: 100%; max-height: 100px; border-radius: var(--me-radius-xs, 6px); object-fit: cover; }

.md-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 12px 18px; border-top: 1px solid var(--me-border);
}

.md-btn {
  padding: 7px 16px; border-radius: 8px; border: none;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.15s; display: flex; align-items: center; gap: 6px;
}
.md-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.md-btn--cancel { background: none; color: var(--me-text-muted); }
.md-btn--cancel:hover { background: rgba(255,255,255,0.06); color: var(--me-text-primary); }
.md-btn--confirm { background: var(--me-accent); color: #fff; }
.md-btn--confirm:hover:not(:disabled) { filter: brightness(1.15); }
</style>
