<!--
  AppTopbar.vue — Topbar 48 px MeteorEdit v3
  ============================================================
  Hauteur fixe : 48 px. Surface : --surface. Bordure bas : --line.
  Composition :
    [icône page][titre page] ........ [recherche Ctrl K] ........ [theme | bell | gift] | [slot actions]
  Wiring :
    - title / icon via props (alimentés par la route via App.vue ou meta route)
    - <slot name="actions"> reçoit les <Button> contextuels (Importer, Nouveau dossier) téléportés depuis la vue
      (cf. id="topbar-actions" actuel — on bascule sur un <slot> propre)
  PrimeVue : Button, InputText + IconField + InputIcon, Badge.
  ============================================================
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useThemeStore } from '@/stores/theme';
import Button from 'primevue/button';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';
import OverlayBadge from 'primevue/overlaybadge';

const props = withDefaults(defineProps<{
  icon?: string;          // ex: 'pi-home'
  title: string;
  /** Nombre de notifs non lues — animé en badge sur la cloche */
  notifCount?: number;
  /** Affiche le bouton "What's new" */
  showWhatsNew?: boolean;
}>(), { icon: 'pi-home', notifCount: 0, showWhatsNew: true });

const emit = defineEmits<{
  (e: 'open-search'): void;
  (e: 'open-notifications'): void;
  (e: 'open-whats-new'): void;
}>();

const { t } = useI18n();
const theme = useThemeStore();

// Détection plateforme pour kbd hint
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const kbdHint = computed(() => isMac ? '⌘ K' : 'Ctrl K');
</script>

<template>
  <header class="topbar">
    <!-- LEFT — page icon + title -->
    <div class="topbar__left">
      <i class="topbar__page-icon pi" :class="props.icon" />
      <h1 class="topbar__title">{{ props.title }}</h1>
    </div>

    <!-- CENTER — search trigger (Ctrl K opens command palette) -->
    <div class="topbar__search-wrap">
      <button
        type="button"
        class="topbar__search-trigger"
        :aria-label="t('search.openPalette')"
        @click="emit('open-search')"
      >
        <i class="pi pi-search" />
        <span class="topbar__search-placeholder">{{ t('search.placeholder') }}</span>
        <kbd class="kbd">{{ kbdHint }}</kbd>
      </button>
    </div>

    <!-- RIGHT — system icons + separator + slot actions -->
    <div class="topbar__right">
      <Button
        :icon="theme.isDark ? 'pi pi-sun' : 'pi pi-moon'"
        text rounded size="small"
        class="topbar__icon-btn"
        :aria-label="t('theme.toggle')"
        @click="theme.toggle()"
      />

      <OverlayBadge
        v-if="props.notifCount > 0"
        :value="props.notifCount > 9 ? '9+' : String(props.notifCount)"
        severity="danger"
      >
        <Button
          icon="pi pi-bell"
          text rounded size="small"
          class="topbar__icon-btn"
          :aria-label="t('notifications.open')"
          @click="emit('open-notifications')"
        />
      </OverlayBadge>
      <Button
        v-else
        icon="pi pi-bell"
        text rounded size="small"
        class="topbar__icon-btn"
        :aria-label="t('notifications.open')"
        @click="emit('open-notifications')"
      />

      <Button
        v-if="props.showWhatsNew"
        icon="pi pi-gift"
        text rounded size="small"
        class="topbar__icon-btn"
        :aria-label="t('whatsNew.open')"
        @click="emit('open-whats-new')"
      />

      <div class="topbar__sep" />

      <div class="topbar__actions">
        <!-- HomeView.vue, DossierView.vue etc. injectent ici leurs <Button> contextuels -->
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<style scoped>
/* ============================================================
   STRUCTURE — 48 px de haut, fond surface, 1 trait
   ============================================================ */
.topbar {
  height: 48px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto minmax(220px, 1fr);
  align-items: center;
  padding: 0 16px;
  gap: 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  font-family: var(--font);
}

/* ============================================================
   LEFT — icône + titre
   ============================================================ */
.topbar__left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.topbar__page-icon {
  font-size: 16px;
  color: var(--ink-3);
  flex-shrink: 0;
}
.topbar__title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.005em;
  color: var(--ink);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================
   CENTER — search trigger 280 px
   ============================================================ */
.topbar__search-wrap {
  display: flex;
  justify-content: center;
}
.topbar__search-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 10px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  width: 280px;
  color: var(--ink-3);
  font-size: 12.5px;
  cursor: pointer;
  transition: border-color 80ms ease, color 80ms ease;
  font-family: inherit;
  letter-spacing: -0.005em;
}
.topbar__search-trigger:hover {
  border-color: var(--line-2);
  color: var(--ink-2);
}
.topbar__search-trigger:focus-visible {
  outline: 0;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.topbar__search-trigger .pi { font-size: 13px; }
.topbar__search-placeholder { flex: 1; text-align: left; }

.kbd {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 5px;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--ink-3);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  font-family: inherit;
}

/* ============================================================
   RIGHT — icons + sep + actions slot
   ============================================================ */
.topbar__right {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}

.topbar__icon-btn :deep(.p-button) {
  width: 30px;
  height: 30px;
  padding: 0;
  color: var(--ink-3);
  background: transparent !important;
}
.topbar__icon-btn :deep(.p-button:hover) {
  background: var(--bg-3) !important;
  color: var(--ink);
}
.topbar__icon-btn :deep(.p-button-icon) { font-size: 14px; }

/* Override OverlayBadge — petit point rouge institutionnel */
.topbar__right :deep(.p-overlaybadge .p-badge) {
  font-size: 9.5px;
  height: 14px;
  min-width: 14px;
  padding: 0 4px;
  background: var(--err);
  color: var(--on-accent);
  border: 1.5px solid var(--surface);
}

.topbar__sep {
  width: 1px;
  height: 20px;
  background: var(--line);
  margin: 0 4px;
}

.topbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ============================================================
   ACTIONS SLOT — style appliqué via :deep() pour les <Button>
   placés par les consommateurs (Importer outline, Nouveau dossier primary)
   ============================================================ */
.topbar__actions :deep(.p-button) {
  height: 30px;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: -0.005em;
  padding: 0 12px;
  border-radius: var(--r-md);
}
/* outline → look v3 .btn */
.topbar__actions :deep(.p-button.p-button-outlined) {
  color: var(--ink-2);
  background: var(--surface) !important;
  border: 1px solid var(--line) !important;
}
.topbar__actions :deep(.p-button.p-button-outlined:hover) {
  background: var(--bg) !important;
  border-color: var(--line-2) !important;
  color: var(--ink);
}
/* primary → bleu encre --accent */
.topbar__actions :deep(.p-button:not(.p-button-outlined):not(.p-button-text)) {
  background: var(--accent) !important;
  border: 1px solid var(--accent) !important;
  color: var(--on-accent) !important;
}
.topbar__actions :deep(.p-button:not(.p-button-outlined):not(.p-button-text):hover) {
  background: var(--accent-hover) !important;
  border-color: var(--accent-hover) !important;
}
.topbar__actions :deep(.p-button-icon) { font-size: 13px; }

/* ============================================================
   DARK MODE
   ============================================================ */
[data-theme="dark"] .topbar {
  background: var(--surface); /* #232218 */
  border-bottom-color: var(--line);
}
[data-theme="dark"] .topbar__search-trigger {
  background: var(--bg);
  border-color: var(--line);
}
[data-theme="dark"] .kbd {
  background: var(--bg-3);
  border-color: var(--line-2);
  color: var(--ink-3);
}
[data-theme="dark"] .topbar__right :deep(.p-overlaybadge .p-badge) {
  border-color: var(--surface);
}

/* ============================================================
   RESPONSIVE — masque le placeholder en dessous de 1100 px
   pour préserver la hauteur 48 px sur petits écrans
   ============================================================ */
@media (max-width: 1100px) {
  .topbar { grid-template-columns: auto auto 1fr; }
  .topbar__search-trigger { width: 200px; }
}
</style>
