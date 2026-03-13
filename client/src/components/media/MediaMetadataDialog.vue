<template>
  <v-dialog v-model="model" max-width="520" persistent>
    <div class="md-dialog glass-card">
      <div class="md-header">
        <v-icon size="20" class="md-header-icon">mdi-text-box-edit-outline</v-icon>
        <span>{{ $t('media.editMetadata') }}</span>
        <button class="md-close" @click="cancel">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <div class="md-body">
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

        <!-- Platform -->
        <div class="md-field">
          <label class="md-label">{{ $t('media.platform') }}</label>
          <input
            v-model="local.platform"
            type="text"
            class="md-input"
            placeholder="YouTube, Vimeo, SoundCloud..."
          />
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
          <div class="md-field" style="width: 140px;">
            <label class="md-label">{{ $t('media.duration') }} (s)</label>
            <input
              v-model.number="local.duration"
              type="number"
              min="0"
              class="md-input"
            />
            <span v-if="local.duration" class="md-duration-display">{{ formatDuration(local.duration) }}</span>
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
          <input
            v-model="tagsString"
            type="text"
            class="md-input"
          />
          <span class="md-hint">{{ $t('media.tagsCommaSeparated') }}</span>
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
import { ref, computed, watch } from 'vue';
import type { MediaMetadata } from '../../types';

const model = defineModel<boolean>({ default: false });

const props = defineProps<{
  metadata: MediaMetadata;
}>();

const emit = defineEmits<{
  'save': [metadata: MediaMetadata];
}>();

const local = ref<MediaMetadata>({ title: '' });

const tagsString = computed({
  get: () => (local.value.tags ?? []).join(', '),
  set: (val: string) => {
    local.value.tags = val
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  },
});

// Clone metadata into local state when dialog opens
watch(model, (open) => {
  if (open) {
    local.value = {
      title: props.metadata.title ?? '',
      platform: props.metadata.platform ?? '',
      channelName: props.metadata.channelName ?? '',
      channelUrl: props.metadata.channelUrl ?? '',
      publishedAt: props.metadata.publishedAt ?? '',
      duration: props.metadata.duration ?? 0,
      description: props.metadata.description ?? '',
      tags: [...(props.metadata.tags ?? [])],
      thumbnailUrl: props.metadata.thumbnailUrl ?? '',
    };
  }
});

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
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

.md-textarea { resize: vertical; min-height: 60px; }

.md-hint { font-size: 11px; color: var(--me-text-muted); }

.md-duration-display { font-size: 11px; color: var(--me-accent); font-weight: 500; }

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
