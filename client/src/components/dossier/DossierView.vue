<!--
  DossierView.vue — shell 3 colonnes v3
  Important : sous-composants existants (NodeTree, TaskPanel, DossierInfo, NoteEditor,
  ExcalidrawWrapper, MapEditor, DatasetEditor, MediaEditor) sont consommés tels quels.
  Logique TS héritée de la version actuelle — focusMode, activeCollaborators, watchers,
  popovers (new/tools/export/import) restent gérés ICI. Ce livrable plaque le NOUVEAU layout.
-->
<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import ButtonGroup from 'primevue/buttongroup';
import Popover from 'primevue/popover';
import Menu from 'primevue/menu';
import SelectButton from 'primevue/selectbutton';

import NodeTree from '@/components/tree/NodeTree.vue';
import TaskPanel from '@/components/dossier/TaskPanel.vue';
import DossierInfo from '@/components/dossier/DossierInfo.vue';
import NoteEditor from '@/components/editor/NoteEditor.vue';
import ExcalidrawWrapper from '@/components/excalidraw/ExcalidrawWrapper.vue';
import MapEditor from '@/components/map/MapEditor.vue';
import DatasetEditor from '@/components/dataset/DatasetEditor.vue';
import MediaEditor from '@/components/media/MediaEditor.vue';

import CollabAvatarStack, { type Collaborator } from '../shared/CollabAvatarStack.vue';
import StatusBadge from '../shared/StatusBadge.vue';
import EmptyState from '../shared/EmptyState.vue';

import { useDossierStore } from '@/stores/dossier';
import { useThemeStore } from '@/stores/theme';

const { t } = useI18n();
const router = useRouter();
const dossierStore = useDossierStore();
const themeStore = useThemeStore();

// === État de l'écran ===
const sidebarTab = ref<'tree' | 'tasks'>('tree');
const sidebarTabOptions = computed(() => [
  { label: t('dossier.tree.title'), value: 'tree' },
  { label: t('dossier.tree.tasks'), value: 'tasks' },
]);

const infoPanelOpen = ref(localStorage.getItem('me.dossier.infoPanelOpen') !== '0');
watch(infoPanelOpen, (v) => localStorage.setItem('me.dossier.infoPanelOpen', v ? '1' : '0'));

const focusMode = ref(false);

// Popovers (logique inchangée — ports depuis l'existant)
const newMenuRef = ref<InstanceType<typeof Popover> | null>(null);
const toolsMenuRef = ref<InstanceType<typeof Popover> | null>(null);
const moreMenuRef = ref<InstanceType<typeof Menu> | null>(null);

const moreItems = computed(() => [
  { label: t('dossier.toolbar.exportPdf'), icon: 'pi pi-file-pdf', command: () => exportPdf() },
  { label: t('dossier.toolbar.exportJson'), icon: 'pi pi-code', command: () => exportJson() },
  { separator: true },
  { label: t('dossier.toolbar.duplicate'), icon: 'pi pi-copy', command: () => duplicate() },
  { label: t('dossier.toolbar.archive'), icon: 'pi pi-inbox', command: () => archive() },
  { separator: true },
  { label: t('dossier.toolbar.delete'), icon: 'pi pi-trash', command: () => destroy(), class: 'menu-item--danger' },
]);

// === Données ===
const dossier = computed(() => dossierStore.currentDossier);
const selectedNode = computed(() => dossierStore.selectedNode);
const collaborators = computed<Collaborator[]>(() => dossierStore.activeCollaborators);

// === Actions toolbar (logique à reprendre depuis l'existant) ===
function openSnapshots() { /* … */ }
function handleShare() { /* … */ }
function exportPdf() { /* … */ }
function exportJson() { /* … */ }
function duplicate() { /* … */ }
function archive() { /* … */ }
function destroy() { /* … */ }
function closeDossier() {
  dossierStore.closeDossier();
  router.push('/');
}

// Editor switch
const currentEditor = computed(() => {
  if (!selectedNode.value) return null;
  return selectedNode.value.type; // 'note' | 'mindmap' | 'map' | 'dataset' | 'media' | …
});
</script>

<template>
  <div
    v-if="dossier"
    class="dossier-view dossier"
    :data-focus-mode="focusMode || null"
    :data-info-open="infoPanelOpen"
  >
    <!-- ===================================================
         TOOLBAR HAUTE (sous AppTopbar global)
         =================================================== -->
    <header class="dossier__toolbar">
      <div class="dossier__breadcrumb">
        <button class="dossier__crumb-link" @click="closeDossier">
          <i class="pi pi-chevron-left" />
          {{ t('dossier.breadcrumb.all') }}
        </button>
        <span class="dossier__crumb-sep">›</span>
        <span class="dossier__crumb-current">{{ dossier.title }}</span>
        <template v-if="selectedNode">
          <span class="dossier__crumb-sep">›</span>
          <span class="dossier__crumb-node">{{ selectedNode.title }}</span>
        </template>
      </div>

      <div class="dossier__indicators">
        <i class="pi pi-lock" :title="t('dossier.indicators.e2e')" style="color: var(--ok)" />
        <i v-if="dossier.embargo" class="pi pi-shield" :title="t('dossier.indicators.embargo', { date: dossier.embargoDate })" style="color: var(--warn)" />
        <StatusBadge v-if="dossier.continuous" status="continuous" />
      </div>

      <div class="dossier__spacer" />

      <CollabAvatarStack v-if="collaborators.length" :collaborators="collaborators" :max="4" />

      <div class="dossier__actions">
        <Button text rounded size="small" icon="pi pi-history" :aria-label="t('dossier.toolbar.snapshots')" @click="openSnapshots" />
        <Button text rounded size="small" icon="pi pi-share-alt" :aria-label="t('dossier.toolbar.share')" @click="handleShare" />
        <Button text rounded size="small" icon="pi pi-ellipsis-v" :aria-label="t('dossier.toolbar.more')" @click="(e) => moreMenuRef?.toggle(e)" />
        <Menu ref="moreMenuRef" :model="moreItems" popup />

        <span class="dossier__sep" />

        <Button
          text rounded size="small"
          :icon="infoPanelOpen ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'"
          :aria-label="t('dossier.toolbar.toggleInfo')"
          @click="infoPanelOpen = !infoPanelOpen"
        />
      </div>
    </header>

    <!-- ===================================================
         GRID 3 COLONNES
         =================================================== -->
    <div class="dossier__grid">
      <!-- TREE PANEL (gauche, 280 px) -->
      <aside v-show="!focusMode" class="dossier__tree-panel">
        <div class="dossier__tree-panel__head">
          <SelectButton v-model="sidebarTab" :options="sidebarTabOptions" optionLabel="label" optionValue="value" size="small" />
        </div>
        <div class="dossier__tree-panel__content">
          <NodeTree v-show="sidebarTab === 'tree'" />
          <TaskPanel v-if="sidebarTab === 'tasks'" />
        </div>
      </aside>

      <!-- EDITOR (centre, 1fr) -->
      <main class="dossier__editor">
        <NoteEditor      v-if="currentEditor === 'note'" />
        <ExcalidrawWrapper v-else-if="currentEditor === 'mindmap'" />
        <MapEditor       v-else-if="currentEditor === 'map'" />
        <DatasetEditor   v-else-if="currentEditor === 'dataset'" />
        <MediaEditor     v-else-if="currentEditor === 'media'" />
        <EmptyState
          v-else
          icon="pi-folder-open"
          :title="t('dossier.editor.empty.title')"
          :message="t('dossier.editor.empty.sub')"
        />
      </main>

      <!-- INFO PANEL (droite, 340 px, rétractable) -->
      <aside v-show="infoPanelOpen && !focusMode" class="dossier__info-panel">
        <DossierInfo />
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* ============================================================
   SHELL — 3 colonnes + toolbar haute
   ============================================================ */
.dossier-view {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100%;
  min-height: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font);
}

/* ============================================================
   TOOLBAR HAUTE
   ============================================================ */
.dossier__toolbar {
  display: flex; align-items: center; gap: 10px;
  height: 44px;
  padding: 0 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
}

.dossier__breadcrumb {
  display: flex; align-items: center; gap: 8px;
  font-size: 12.5px;
  color: var(--ink-3);
  min-width: 0;
}
.dossier__crumb-link {
  display: inline-flex; align-items: center; gap: 4px;
  background: transparent; border: 0;
  color: var(--ink-3);
  font-size: 12.5px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--r-sm);
  font-family: inherit;
  letter-spacing: -0.005em;
}
.dossier__crumb-link:hover { background: var(--bg-3); color: var(--ink); }
.dossier__crumb-link .pi { font-size: 11px; }
.dossier__crumb-sep { color: var(--ink-4); }
.dossier__crumb-current {
  color: var(--ink);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}
.dossier__crumb-node {
  color: var(--ink);
  font-weight: 600;
  letter-spacing: -0.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.dossier__indicators {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px;
  padding: 0 4px 0 4px;
  border-left: 1px solid var(--line);
  margin-left: 4px;
  padding-left: 12px;
}
.dossier__indicators .pi { font-size: 13px; }

.dossier__spacer { flex: 1; }

.dossier__actions {
  display: flex; align-items: center; gap: 2px;
}
.dossier__actions :deep(.p-button) {
  width: 30px; height: 30px;
  padding: 0; color: var(--ink-3);
  background: transparent !important;
}
.dossier__actions :deep(.p-button:hover) { background: var(--bg-3) !important; color: var(--ink); }

.dossier__sep {
  width: 1px; height: 20px;
  background: var(--line);
  margin: 0 4px;
}

/* ============================================================
   GRID
   ============================================================ */
.dossier__grid {
  display: grid;
  grid-template-columns: 280px 1fr 340px;
  min-height: 0;
  height: 100%;
  transition: grid-template-columns 180ms cubic-bezier(.4,0,.2,1);
}
.dossier-view[data-info-open="false"] .dossier__grid {
  grid-template-columns: 280px 1fr 0;
}
.dossier-view[data-focus-mode] .dossier__grid {
  grid-template-columns: 0 1fr 0;
}

/* ============================================================
   TREE PANEL
   ============================================================ */
.dossier__tree-panel {
  display: flex; flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--line);
  min-height: 0;
  overflow: hidden;
}
.dossier__tree-panel__head {
  padding: 12px 12px 8px;
  border-bottom: 1px solid var(--line);
}
.dossier__tree-panel__head :deep(.p-selectbutton) {
  display: flex;
  background: var(--bg-2);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 2px;
}
.dossier__tree-panel__head :deep(.p-togglebutton) {
  flex: 1;
  padding: 4px 10px !important;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-3);
  background: transparent !important;
  border: 0 !important;
  border-radius: var(--r-sm) !important;
  box-shadow: none !important;
  height: auto !important;
}
.dossier__tree-panel__head :deep(.p-togglebutton.p-togglebutton-checked) {
  background: var(--surface) !important;
  color: var(--ink) !important;
  box-shadow: var(--shadow-1) !important;
}
.dossier__tree-panel__content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

/* ============================================================
   EDITOR (centre)
   ============================================================ */
.dossier__editor {
  background: var(--bg);
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

/* ============================================================
   INFO PANEL (droite)
   ============================================================ */
.dossier__info-panel {
  background: var(--bg-2);
  border-left: 1px solid var(--line);
  overflow-y: auto;
  min-height: 0;
}

/* ============================================================
   DARK MODE — overrides explicites
   ============================================================ */
[data-theme="dark"] .dossier-view { background: var(--bg); }
[data-theme="dark"] .dossier__toolbar { background: var(--surface); border-bottom-color: var(--line); }
[data-theme="dark"] .dossier__tree-panel { background: var(--surface); }
[data-theme="dark"] .dossier__info-panel { background: var(--bg-2); }
</style>
