<template>
  <div class="dossier-card glass-card" @click="$emit('open', dossier._id)">
    <div class="dc-header">
      <span v-if="dossier.isContinuous" class="dc-status-pill dc-status-pill--continuous">
        <i class="pi pi-replay" style="font-size: 11px;" />
        <span class="mono">{{ t('dossier.statusContinuous') }}</span>
      </span>
      <span v-else class="dc-status-pill" :class="`dc-status-pill--${statusDot}`">
        <span :class="['status-dot', `status-dot--${statusDot}`, statusDot === 'in-progress' ? 'status-dot--pulse' : '']" />
        <span class="mono">{{ statusLabel }}</span>
      </span>
      <div class="dc-actions">
        <button class="dc-fav" :class="{ 'dc-fav--active': isFav }" @click.stop="$emit('toggle-favorite', dossier._id)" :title="isFav ? $t('home.removeFromFavorites') : $t('home.addToFavorites')">
          <i :class="isFav ? 'pi pi-star-fill' : 'pi pi-star'" />
        </button>
        <button class="dc-delete" @click.stop="$emit('delete', dossier._id)" :title="$t('common.delete')">
          <i class="pi pi-trash" />
        </button>
      </div>
    </div>
    <div class="dc-title-row">
      <img v-if="logoUrl" :src="logoUrl" alt="" class="dc-logo" />
      <i v-else-if="dossier.icon && dossier.icon.startsWith('pi ')" :class="dossier.icon" class="dc-icon" style="font-size: 20px;" />
      <i v-else class="pi pi-folder dc-icon dc-icon-default" style="font-size: 20px;" />
      <h3 class="dc-title">{{ dossier.title }}</h3>
      <i v-if="dossier.isEmbargo" class="pi pi-shield dc-embargo" :title="$t('dossier.isEmbargo')" />
      <i v-else class="pi pi-lock dc-lock" :title="$t('home.e2eActive')" />
    </div>
    <div v-if="dossier.tags?.length" class="dc-tags">
      <span v-for="tag in dossier.tags.slice(0, 4)" :key="tag" class="dc-tag mono">{{ tag }}</span>
      <span v-if="dossier.tags.length > 4" class="dc-tag dc-tag--more mono">+{{ dossier.tags.length - 4 }}</span>
    </div>

    <div v-if="hasMetaStats" class="dc-stats">
      <span v-if="dossier.entityCount != null" class="dc-stat">
        <i class="pi pi-users dc-stat-icon" />
        <span class="mono">{{ dossier.entityCount }}</span>
      </span>
      <span v-if="dossier.noteCount != null" class="dc-stat">
        <i class="pi pi-file-edit dc-stat-icon" />
        <span class="mono">{{ dossier.noteCount }}</span>
      </span>
    </div>
    <p v-if="dossier.description" class="dc-desc">{{ stripHtml(dossier.description) }}</p>
    <div class="dc-footer mono">
      <span>{{ new Date(dossier.updatedAt).toLocaleDateString(locale) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Dossier } from '../../types';
import { SERVER_URL } from '../../services/api';
import { useDecryptedFile } from '../../composables/useDecryptedFile';

const { t, locale } = useI18n();
const { getDecryptedUrl } = useDecryptedFile();

const props = defineProps<{ dossier: Dossier; isFav?: boolean }>();

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}
defineEmits<{ open: [id: string]; delete: [id: string]; 'toggle-favorite': [id: string] }>();

// Optional aggregated counters from backend — render conditionally so the
// card stays clean when these fields aren't populated yet.
const hasMetaStats = computed(() => {
  return props.dossier.entityCount != null || props.dossier.noteCount != null;
});

const decryptedLogo = ref<string | null>(null);

watch(() => props.dossier.logoPath, async (logoPath) => {
  decryptedLogo.value = null;
  if (!logoPath) return;
  try {
    decryptedLogo.value = await getDecryptedUrl(props.dossier._id, logoPath, 'image/png');
  } catch {
    if (logoPath && !logoPath.includes('.enc')) {
      decryptedLogo.value = `${SERVER_URL}/${logoPath}`;
    }
  }
}, { immediate: true });

const logoUrl = computed(() => decryptedLogo.value);

const statusDot = computed(() => {
  switch (props.dossier.status) {
    case 'open': return 'open';
    case 'in_progress': return 'in-progress';
    case 'closed': return 'closed';
    default: return 'open';
  }
});

const statusLabel = computed(() => {
  switch (props.dossier.status) {
    case 'open': return t('dossier.statusOpen');
    case 'in_progress': return t('dossier.statusInProgress');
    case 'closed': return t('dossier.statusClosed');
    default: return props.dossier.status;
  }
});
</script>

<style scoped>
/* ─── v3.33 — Tokens locaux + ruban catégorie ─── */
.dossier-card {
  --v3-bg-2: var(--me-bg-surface);
  --v3-ink: var(--me-text-primary);
  --v3-line: var(--me-border);
  --v3-accent: var(--me-accent);
  --v3-cat: var(--me-accent);
}
:global([data-theme='light']) .dossier-card {
  --v3-bg-2: #FFFFFF;
  --v3-ink: #1C1B18;
  --v3-line: #E7E5DD;
  --v3-accent: #2E4FA8;
  --v3-cat: #2E4FA8;
}

.dossier-card {
  /* v3 tweak : ruban catégorie en bord gauche + radius discret 7px */
  position: relative;
  padding: 18px 20px 18px 22px;
  cursor: pointer;
  transition: transform var(--me-dur) var(--me-ease), border-color var(--me-dur-fast) var(--me-ease), box-shadow var(--me-dur) var(--me-ease);
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  min-width: 0;
  border-radius: 7px;
  background: var(--v3-bg-2);
}
.dossier-card::before {
  /* Ruban catégorie bord gauche (3 px d'accent encre) */
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  background: var(--v3-cat);
  border-radius: 0 2px 2px 0;
  opacity: 0.85;
}
.dossier-card:hover {
  transform: translateY(-1px);
  border-color: var(--v3-line);
  box-shadow: 0 1px 0 rgba(28, 27, 24, 0.04), 0 8px 24px rgba(28, 27, 24, 0.06);
}
.dossier-card:hover::before { opacity: 1; }
.dc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

/* Status pill (v3.30) — full pill background tinted with the status color,
   replaces the previous bare dot+label combo. Same widget for `open`,
   `in_progress`, `closed` and `continuous` — only colors change. */
.dc-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  font-weight: 700;
  background: var(--me-bg-elevated);
  color: var(--me-text-muted);
}
.dc-status-pill--open {
  background: rgba(129, 178, 154, 0.16);
  color: var(--me-accent-soft);
}
.dc-status-pill--in-progress {
  background: rgba(var(--me-accent-rgb), 0.16);
  color: var(--me-accent);
}
.dc-status-pill--closed {
  background: rgba(201, 123, 123, 0.16);
  color: #c97b7b;
}
.dc-status-pill--continuous {
  background: rgba(129, 140, 248, 0.16);
  color: var(--me-info);
}

/* Legacy classes kept for any consumer still rendering the old dot+label */
.dc-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dc-status-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  font-weight: 600;
  color: var(--me-text-muted);
}
.dc-status-label--continuous {
  color: var(--me-info);
}
.dc-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.dc-fav, .dc-delete {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.15s;
  font-size: 14px;
}
.dc-fav--active {
  opacity: 1 !important;
  color: var(--me-accent-warm);
}
.dossier-card:hover .dc-fav,
.dossier-card:hover .dc-delete {
  opacity: 1;
}
.dc-fav:hover {
  color: var(--me-accent);
  background: var(--me-accent-glow);
}
.dc-delete:hover {
  color: var(--me-error);
  background: rgba(248, 113, 113, 0.1);
}
.dc-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.dc-logo {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}
.dc-icon {
  color: var(--me-accent);
  flex-shrink: 0;
}
.dc-icon-default {
  color: var(--me-text-muted);
}
.dc-lock {
  color: var(--me-accent);
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0.7;
  font-size: 14px;
}
.dc-embargo {
  color: #f59e0b;
  margin-left: auto;
  flex-shrink: 0;
  font-size: 14px;
}
.dc-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--me-text-primary);
  line-height: 1.35;
  letter-spacing: -0.1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.dc-desc {
  font-size: 13px;
  color: var(--me-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.dc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.dc-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--me-accent-glow);
  color: var(--me-accent);
  text-transform: lowercase;
}
.dc-tag--more {
  background: var(--me-bg-elevated);
  color: var(--me-text-muted);
}
.dc-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 6px;
  border-top: 1px dashed var(--me-border);
}
.dc-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--me-text-muted);
}
.dc-stat-icon { font-size: 11px; opacity: 0.7; }
.dc-stat .mono { color: var(--me-text-secondary); font-weight: 600; }
.dc-footer {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: auto;
}
/* Status dot colors — tokenized so currentColor (used by pulseDot keyframe) gets the right hue */
.status-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.status-dot--open        { background: var(--me-accent-soft); box-shadow: 0 0 6px rgba(129, 178, 154, 0.5); color: var(--me-accent-soft); }
.status-dot--in-progress { background: var(--me-accent);      box-shadow: 0 0 6px rgba(var(--me-accent-rgb), 0.5); color: var(--me-accent); }
.status-dot--closed      { background: #c97b7b;                box-shadow: 0 0 6px rgba(201, 123, 123, 0.5); color: #c97b7b; }
</style>
