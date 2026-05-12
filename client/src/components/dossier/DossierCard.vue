<template>
  <article class="dossier-card glass-card" :data-cat="catKey" @click="$emit('open', dossier._id)">
    <!-- v3.36 — Header : icône + nom + ID + pill priorité + favoris -->
    <header class="dc-header">
      <div class="dc-icon-wrap">
        <img v-if="logoUrl" :src="logoUrl" alt="" class="dc-logo" />
        <i v-else-if="dossier.icon && dossier.icon.startsWith('pi ')" :class="dossier.icon" class="dc-icon" />
        <i v-else class="pi pi-folder dc-icon dc-icon-default" />
      </div>
      <div class="dc-title-block">
        <div class="dc-title-line">
          <h3 class="dc-title">{{ dossier.title }}</h3>
          <span class="dc-priority" :class="`dc-priority--p${priorityLevel}`">P{{ priorityLevel }}</span>
        </div>
        <div class="dc-id num">{{ idCode }}</div>
      </div>
      <div class="dc-actions">
        <button class="dc-fav" :class="{ 'dc-fav--active': isFav }" @click.stop="$emit('toggle-favorite', dossier._id)" :title="isFav ? $t('home.removeFromFavorites') : $t('home.addToFavorites')">
          <i :class="isFav ? 'pi pi-star-fill' : 'pi pi-star'" />
        </button>
        <button class="dc-delete" @click.stop="$emit('delete', dossier._id)" :title="$t('common.delete')">
          <i class="pi pi-trash" />
        </button>
      </div>
    </header>

    <!-- v3.36 — Statut + embargo/lock + tags optionnels -->
    <div class="dc-meta-row">
      <span v-if="dossier.isContinuous" class="dc-status-pill dc-status-pill--continuous">
        <i class="pi pi-replay" style="font-size: 11px;" />
        <span class="mono">{{ t('dossier.statusContinuous') }}</span>
      </span>
      <span v-else class="dc-status-pill" :class="`dc-status-pill--${statusDot}`">
        <span :class="['status-dot', `status-dot--${statusDot}`, statusDot === 'in-progress' ? 'status-dot--pulse' : '']" />
        <span class="mono">{{ statusLabel }}</span>
      </span>
      <i v-if="dossier.isEmbargo" class="pi pi-shield dc-embargo" :title="$t('dossier.isEmbargo')" />
      <i v-else class="pi pi-lock dc-lock" :title="$t('home.e2eActive')" />
    </div>

    <!-- v3.36 — Description courte (2 lignes max via ellipsis) -->
    <p v-if="dossier.description" class="dc-desc">{{ stripHtml(dossier.description) }}</p>

    <!-- v3.36 — Footer : avatars investigateurs + temps relatif -->
    <footer class="dc-footer-v3">
      <div v-if="collaboratorList.length" class="dc-avatars">
        <span
          v-for="c in collaboratorList.slice(0, 4)"
          :key="c.id"
          class="dc-avatar"
          :title="c.name"
        >{{ c.initials }}</span>
        <span v-if="collaboratorList.length > 4" class="dc-avatar dc-avatar--more">+{{ collaboratorList.length - 4 }}</span>
      </div>
      <span v-else class="dc-avatars-empty" />
      <div class="dc-foot-stats">
        <span v-if="dossier.entityCount != null" class="dc-stat-mini" :title="$t('dossier.entities')">
          <i class="pi pi-users" />
          <span class="num">{{ dossier.entityCount }}</span>
        </span>
        <span v-if="dossier.noteCount != null" class="dc-stat-mini" :title="$t('home.notes')">
          <i class="pi pi-file-edit" />
          <span class="num">{{ dossier.noteCount }}</span>
        </span>
        <span class="dc-time">{{ relativeTime }}</span>
      </div>
    </footer>
  </article>
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

/**
 * v3.36 — Niveau de priorité (P1/P2/P3) dérivé du couple
 * isUrgent + classification :
 * - P1 = urgent ET prioritaire
 * - P2 = prioritaire (non urgent)
 * - P3 = routine
 */
const priorityLevel = computed<1 | 2 | 3>(() => {
  const d = props.dossier;
  if (d.isUrgent && d.classification === 'priority') return 1;
  if (d.classification === 'priority') return 2;
  return 3;
});

/**
 * v3.36 — Code identifiant style « D-2026-XXXX ». On utilise le
 * referenceNumber si renseigné par l'admin, sinon on dérive du _id
 * (4 derniers caractères hex en majuscules) avec l'année courante.
 */
const idCode = computed(() => {
  const ref = props.dossier.referenceNumber?.trim();
  if (ref) return ref;
  const year = new Date(props.dossier.createdAt || props.dossier.updatedAt).getFullYear();
  const tail = props.dossier._id.slice(-4).toUpperCase();
  return `D-${year}-${tail}`;
});

/**
 * v3.36 — Clé catégorie pour le ruban coloré (data-cat).
 * Mapping basé sur l'icône principale du dossier (heuristique simple).
 */
const catKey = computed(() => {
  const icon = props.dossier.icon || '';
  if (icon.includes('user') || icon.includes('id-card')) return 'entity';
  if (icon.includes('search')) return 'clipper';
  if (icon.includes('map')) return 'map';
  if (icon.includes('chart') || icon.includes('table')) return 'dataset';
  if (icon.includes('image')) return 'image';
  if (icon.includes('share')) return 'mindmap';
  return 'note';
});

/**
 * v3.36 — Liste compactée des collaborateurs avec initiales.
 * Tolérant : tableau de strings ou d'objets selon ce que renvoie l'API.
 */
type CollabItem = { id: string; name: string; initials: string };
const collaboratorList = computed<CollabItem[]>(() => {
  const list = props.dossier.collaborators || [];
  return list.map((c) => {
    if (typeof c === 'string') {
      return { id: c, name: c, initials: c.slice(0, 2).toUpperCase() };
    }
    const first = c.firstName?.[0] || '';
    const last = c.lastName?.[0] || '';
    return {
      id: c._id,
      name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
      initials: (first + last).toUpperCase() || c.email.slice(0, 2).toUpperCase(),
    };
  });
});

/**
 * v3.36 — Temps relatif court (« il y a 4 min », « hier », « il y a 2 j »).
 * Format compact à la brief v3.
 */
const relativeTime = computed(() => {
  const updated = new Date(props.dossier.updatedAt).getTime();
  const diffMs = Date.now() - updated;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('home.justNow');
  if (diffMin < 60) return t('home.minutesAgo', { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('home.hoursAgo', { n: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return t('home.yesterday');
  if (diffD < 7) return t('home.daysAgo', { n: diffD });
  return new Date(props.dossier.updatedAt).toLocaleDateString(locale.value);
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
  --v3-bg-3: #F5F4EF;
  --v3-ink: #1C1B18;
  --v3-ink-2: #45433D;
  --v3-ink-3: #6F6C63;
  --v3-line: #E7E5DD;
  --v3-accent: #2E4FA8;
  --v3-cat: #2E4FA8;
}

/* v3.36 — Couleur ruban par catégorie via data-cat (7 valeurs brief) */
.dossier-card[data-cat="entity"]  { --v3-cat: #1C1B18; }
.dossier-card[data-cat="note"]    { --v3-cat: #5B7553; }
.dossier-card[data-cat="mindmap"] { --v3-cat: #7A5C8F; }
.dossier-card[data-cat="map"]     { --v3-cat: #2E6E7E; }
.dossier-card[data-cat="clipper"] { --v3-cat: #B4651E; }
.dossier-card[data-cat="dataset"] { --v3-cat: #4F4A8E; }
.dossier-card[data-cat="image"]   { --v3-cat: #8C5060; }

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
  /* v3.36 — Header reformaté : icône + bloc titre + actions */
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
}

/* Icône catégorie à gauche (style brief v3 dcard__icon) */
.dc-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 7px;
  background: var(--v3-bg-3);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
  color: var(--v3-cat);
  border: 1px solid var(--v3-line);
}
.dc-icon-wrap .dc-icon { font-size: 17px; color: var(--v3-cat); }
.dc-logo { width: 100%; height: 100%; object-fit: cover; }

.dc-title-block {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dc-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dc-id {
  font-size: 11px;
  color: var(--v3-ink-3);
  letter-spacing: 0.04em;
}

/* Pill priorité P1/P2/P3 — codes couleur brief v3 */
.dc-priority {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.dc-priority--p1 {
  background: rgba(168, 68, 60, 0.12);
  color: #A8443C;
  border: 1px solid rgba(168, 68, 60, 0.30);
}
.dc-priority--p2 {
  background: rgba(176, 122, 31, 0.12);
  color: #B07A1F;
  border: 1px solid rgba(176, 122, 31, 0.30);
}
.dc-priority--p3 {
  background: rgba(111, 108, 99, 0.10);
  color: var(--v3-ink-3);
  border: 1px solid var(--v3-line);
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
  /* v3.36 — titre institutionnel : weight 650, tracking serré */
  font-size: 15px;
  font-weight: 650;
  color: var(--v3-ink);
  line-height: 1.25;
  letter-spacing: -0.3px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
  margin: 0;
}

/* v3.36 — Meta row (status pill + embargo/lock) en dessous du header */
.dc-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.dc-meta-row .dc-embargo,
.dc-meta-row .dc-lock {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 13px;
}

/* v3.36 — Description courte (clamp 2 lignes) */
.dc-desc {
  font-size: 12.5px;
  color: var(--v3-ink-2);
  line-height: 1.5;
  margin: 0 0 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* v3.36 — Footer style brief : avatars investigateurs + stats + temps */
.dc-footer-v3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--v3-line);
}
.dc-avatars {
  display: flex;
  align-items: center;
}
.dc-avatars-empty { flex: 0; }
.dc-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--v3-bg-3);
  border: 1.5px solid var(--v3-bg-2);
  color: var(--v3-ink-2);
  display: inline-grid;
  place-items: center;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0;
  margin-left: -6px;
}
.dc-avatar:first-child { margin-left: 0; }
.dc-avatar--more {
  background: var(--v3-accent);
  color: var(--on-accent, #fff);
}
.dc-foot-stats {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--v3-ink-3);
}
.dc-stat-mini {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.dc-stat-mini i { font-size: 11px; }
.dc-time {
  color: var(--v3-ink-3);
  letter-spacing: 0.02em;
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
