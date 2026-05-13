<!--
  DossierCard.vue — Carte dossier v3 (.dcard)
  ============================================================
  Variantes : data-cat = note | mindmap | map | clipper | dataset | image | entity
  Ruban couleur catégorie à gauche (3 px), icône carrée tinted, titre + pill priorité,
  ID monospace mid-weight, description 2 lignes clamp, avatars overlap + status dot + temps relatif.
  Hover : transform -1 px + shadow-2 + bordure renforcée.
  PrimeVue : Tag (pill priorité), AvatarGroup + Avatar, Button (menu kebab si besoin).
  ============================================================
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Tag from 'primevue/tag';
import Avatar from 'primevue/avatar';
import AvatarGroup from 'primevue/avatargroup';
import StatusDot from '@/components/shared/StatusDot.vue';

export type DossierCategory = 'note' | 'mindmap' | 'map' | 'clipper' | 'dataset' | 'image' | 'entity';
export type DossierPriority = 'P1' | 'P2' | 'P3';
export type DossierStatus = 'open' | 'in_progress' | 'paused' | 'closed' | 'continuous';

export interface DossierLike {
  _id: string;
  code?: string;          // ex: 'D-2026-1142'
  title: string;
  description?: string;
  category?: DossierCategory;
  priority?: DossierPriority;
  status?: DossierStatus;
  members?: { _id: string; name: string; avatarUrl?: string }[];
  updatedAt?: string;     // ISO
}

const props = defineProps<{ dossier: DossierLike; }>();
const emit = defineEmits<{ (e: 'open', id: string): void }>();

const { t, locale } = useI18n();

const cat = computed<DossierCategory>(() => props.dossier.category || 'entity');
const status = computed<DossierStatus>(() => props.dossier.status || 'open');

// v3.37.1 — Strip HTML tags from description (TipTap stores rich HTML, but card affiche du texte brut).
const plainDescription = computed(() => (props.dossier.description || '').replace(/<[^>]*>/g, '').trim());

const catIcon = computed(() => ({
  note:     'pi-file-edit',
  mindmap:  'pi-sitemap',
  map:      'pi-map-marker',
  clipper:  'pi-paperclip',
  dataset:  'pi-table',
  image:    'pi-image',
  entity:   'pi-id-card',
}[cat.value]));

const initials = (n: string) => n.split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();

const visibleMembers = computed(() => (props.dossier.members || []).slice(0, 3));
const overflowMembers = computed(() => Math.max(0, (props.dossier.members?.length || 0) - 3));

const relTime = computed(() => {
  if (!props.dossier.updatedAt) return '';
  const diff = (Date.now() - new Date(props.dossier.updatedAt).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto', style: 'short' });
  if (diff < 60) return rtf.format(-Math.floor(diff), 'second');
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  if (diff < 2592000) return rtf.format(-Math.floor(diff / 86400), 'day');
  return rtf.format(-Math.floor(diff / 2592000), 'month');
});
</script>

<template>
  <button
    type="button"
    class="dcard"
    :data-cat="cat"
    @click="emit('open', dossier._id)"
  >
    <!-- HEAD : icône + titre + pill priorité + ID -->
    <div class="dcard__head">
      <div class="dcard__icon">
        <i class="pi" :class="catIcon" />
      </div>
      <div class="dcard__body">
        <div class="dcard__title-row">
          <span class="dcard__title">{{ dossier.title }}</span>
          <Tag
            v-if="dossier.priority"
            :value="dossier.priority"
            class="dcard__pri"
            :class="`dcard__pri--${dossier.priority.toLowerCase()}`"
          />
        </div>
        <div v-if="dossier.code" class="dcard__id num">{{ dossier.code }}</div>
      </div>
    </div>

    <!-- BODY : description 2 lignes clamp (HTML strippé pour afficher du texte brut) -->
    <p v-if="dossier.description" class="dcard__sub">{{ plainDescription }}</p>

    <!-- FOOT : avatars + status + temps -->
    <div class="dcard__foot">
      <AvatarGroup v-if="visibleMembers.length" class="dcard__avatars">
        <Avatar
          v-for="m in visibleMembers"
          :key="m._id"
          :label="initials(m.name)"
          :image="m.avatarUrl"
          shape="circle"
          size="normal"
        />
        <Avatar
          v-if="overflowMembers > 0"
          :label="`+${overflowMembers}`"
          shape="circle"
          size="normal"
          class="dcard__avatars-overflow"
        />
      </AvatarGroup>
      <div class="dcard__meta">
        <StatusDot :status="status" :title="t(`dossier.status.${status}`)" />
        <span v-if="relTime" class="num">{{ relTime }}</span>
      </div>
    </div>
  </button>
</template>

<style scoped>
/* ============================================================
   CARD — surface, radius, ruban couleur catégorie à gauche
   ============================================================ */
.dcard {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--r-lg);
  cursor: pointer;
  transition: border-color 100ms ease, box-shadow 100ms ease, transform 100ms ease;
  text-align: left;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  font-family: var(--font);
  width: 100%;
  min-height: 132px;
}
.dcard:hover {
  border-color: var(--line-2);
  box-shadow: var(--shadow-2);
  transform: translateY(-1px);
}
.dcard:focus-visible {
  outline: 0;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* Ruban gauche 3 px coloré par catégorie */
.dcard::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--cat-entity);
  opacity: 0.7;
}
.dcard[data-cat="note"]::before    { background: var(--cat-note); }
.dcard[data-cat="mindmap"]::before { background: var(--cat-mindmap); }
.dcard[data-cat="map"]::before     { background: var(--cat-map); }
.dcard[data-cat="clipper"]::before { background: var(--cat-clipper); }
.dcard[data-cat="dataset"]::before { background: var(--cat-dataset); }
.dcard[data-cat="image"]::before   { background: var(--cat-image); }
.dcard[data-cat="entity"]::before  { background: var(--cat-entity); }

/* ============================================================
   HEAD
   ============================================================ */
.dcard__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.dcard__icon {
  width: 36px; height: 36px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: var(--r-md);
  background: var(--bg-2);
  border: 1px solid var(--line);
  color: var(--ink-2);
}
.dcard__icon .pi { font-size: 16px; }
/* Icône tintée par catégorie */
.dcard[data-cat="note"]    .dcard__icon { background: var(--cat-note-soft);    border-color: var(--cat-note-line);    color: var(--cat-note); }
.dcard[data-cat="mindmap"] .dcard__icon { background: var(--cat-mindmap-soft); border-color: var(--cat-mindmap-line); color: var(--cat-mindmap); }
.dcard[data-cat="map"]     .dcard__icon { background: var(--cat-map-soft);     border-color: var(--cat-map-line);     color: var(--cat-map); }
.dcard[data-cat="clipper"] .dcard__icon { background: var(--cat-clipper-soft); border-color: var(--cat-clipper-line); color: var(--cat-clipper); }
.dcard[data-cat="dataset"] .dcard__icon { background: var(--cat-dataset-soft); border-color: var(--cat-dataset-line); color: var(--cat-dataset); }
.dcard[data-cat="image"]   .dcard__icon { background: var(--cat-image-soft);   border-color: var(--cat-image-line);   color: var(--cat-image); }
.dcard[data-cat="entity"]  .dcard__icon { background: var(--cat-entity-soft);  border-color: var(--cat-entity-line);  color: var(--cat-entity); }

.dcard__body { flex: 1; min-width: 0; }
.dcard__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dcard__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.dcard__id {
  font-size: 10.5px;
  color: var(--ink-3);
  letter-spacing: 0.04em;
  margin-top: 2px;
  font-feature-settings: "tnum";
}

/* ============================================================
   PILL PRIORITÉ — override Tag PrimeVue
   ============================================================ */
.dcard__pri :deep(.p-tag),
.dcard__pri.p-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0;
  background: var(--bg-3);
  color: var(--ink-3);
  flex-shrink: 0;
  line-height: 1.4;
}
.dcard__pri--p1 :deep(.p-tag), .dcard__pri--p1.p-tag { background: var(--err-soft);  color: var(--err); }
.dcard__pri--p2 :deep(.p-tag), .dcard__pri--p2.p-tag { background: var(--warn-soft); color: var(--warn); }
.dcard__pri--p3 :deep(.p-tag), .dcard__pri--p3.p-tag { background: var(--bg-3);     color: var(--ink-3); }

/* ============================================================
   BODY — description clamp 2 lignes
   ============================================================ */
.dcard__sub {
  font-size: 12px;
  color: var(--ink-2);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

/* ============================================================
   FOOT — avatars + status + temps
   ============================================================ */
.dcard__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--line);
  margin-top: auto;
}

/* AvatarGroup PrimeVue → look v3 (24 px circle, overlap -6 px, border surface) */
.dcard__avatars :deep(.p-avatar) {
  width: 24px;
  height: 24px;
  font-size: 10px;
  font-weight: 600;
  background: var(--accent-soft);
  color: var(--accent);
  border: 2px solid var(--surface);
  margin-left: -6px;
}
.dcard__avatars :deep(.p-avatar:first-child) { margin-left: 0; }
.dcard__avatars-overflow :deep(.p-avatar),
.dcard__avatars-overflow.p-avatar {
  background: var(--bg-3);
  color: var(--ink-3);
}

.dcard__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--ink-3);
  flex-shrink: 0;
}

/* ============================================================
   DARK MODE
   ============================================================ */
[data-theme="dark"] .dcard {
  background: var(--surface);
  border-color: var(--line);
}
[data-theme="dark"] .dcard:hover {
  border-color: var(--line-2);
  box-shadow: var(--shadow-2);
}
[data-theme="dark"] .dcard__avatars :deep(.p-avatar) {
  border-color: var(--surface);
}
</style>
