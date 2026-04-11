<template>
  <div>
    <div
      class="nti-item"
      :class="{
        active: dossierStore.selectedNode?._id === node._id,
        'nti-drop-inside': dropPosition === 'inside',
        'nti-drop-before': dropPosition === 'before',
        'nti-drop-after': dropPosition === 'after',
      }"
      :style="{ paddingLeft: (depth * 20 + 8) + 'px' }"
      draggable="true"
      @dragstart="onDragStart"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @click="dossierStore.selectNode(node)"
      @contextmenu.prevent="openContextMenu"
    >
      <!-- Chevron pour tout nœud avec enfants ou liens -->
      <button
        v-if="hasChildren"
        class="nti-chevron"
        @click.stop="$emit('toggle-expand', node._id)"
      >
        <span :class="expanded ? 'mdi mdi-chevron-down' : 'mdi mdi-chevron-right'" style="font-size: 14px;"></span>
      </button>
      <span v-else class="nti-chevron-spacer" />

      <span :class="'mdi ' + icon" class="nti-icon" style="font-size: 16px;"></span>
      <input
        v-if="renaming"
        ref="renameInputRef"
        v-model="renameValue"
        class="nti-rename-input"
        @keyup.enter="confirmRename"
        @keyup.escape="cancelRename"
        @blur="confirmRename"
        @click.stop
      />
      <span v-else class="nti-title" @dblclick.stop="startRename">{{ node.title }}</span>

      <button class="nti-menu-btn" @click.stop="toggleMenu($event)">
        <span class="mdi mdi-dots-horizontal" style="font-size: 14px;"></span>
      </button>
      <Popover ref="menuRef">
        <div class="glass-card nti-context-menu">
          <!-- Nouveau → sous-menu en cascade -->
          <button class="nti-ctx-item nti-ctx-sub" @click.stop="toggleSubMenu($event)">
            <span class="mdi mdi-plus-circle-outline" style="font-size: 14px;"></span>
            <span class="nti-ctx-item-text">{{ $t('tree.newElement') }}</span>
            <span class="mdi mdi-chevron-right nti-ctx-chevron" style="font-size: 12px;"></span>
          </button>
          <Popover ref="subMenuRef">
            <div class="glass-card nti-context-menu">
              <button class="nti-ctx-item" @click="closeMenus(); $emit('create', 'folder', node._id)">
                <span class="mdi mdi-folder-plus-outline" style="font-size: 14px;"></span> {{ $t('tree.subfolder') }}
              </button>
              <button class="nti-ctx-item" @click="closeMenus(); $emit('create', 'note', node._id)">
                <span class="mdi mdi-note-plus-outline" style="font-size: 14px;"></span> {{ $t('tree.note') }}
              </button>
              <button class="nti-ctx-item" @click="closeMenus(); $emit('create', 'mindmap', node._id)">
                <span class="mdi mdi-vector-polyline" style="font-size: 14px;"></span> {{ $t('tree.mindmap') }}
              </button>
              <button class="nti-ctx-item" @click="closeMenus(); $emit('create', 'map', node._id)">
                <span class="mdi mdi-map-outline" style="font-size: 14px;"></span> {{ $t('tree.map') }}
              </button>
              <button class="nti-ctx-item" @click="closeMenus(); $emit('create', 'dataset', node._id)">
                <span class="mdi mdi-table" style="font-size: 14px;"></span> {{ $t('tree.dataset') }}
              </button>
              <button class="nti-ctx-item" @click="closeMenus(); $emit('create', 'media', node._id)">
                <span class="mdi mdi-play-circle-outline" style="font-size: 14px;"></span> {{ $t('tree.media') }}
              </button>
            </div>
          </Popover>
          <div class="nti-ctx-sep" />
          <!-- Actions -->
          <button class="nti-ctx-item" @click="closeMenus(); startRename()">
            <span class="mdi mdi-pencil-outline" style="font-size: 14px;"></span> {{ $t('tree.rename') }}
          </button>
          <button class="nti-ctx-item" @click="closeMenus(); $emit('duplicate', node._id)">
            <span class="mdi mdi-content-copy" style="font-size: 14px;"></span> {{ $t('tree.duplicate') }}
          </button>
          <div class="nti-ctx-sep" />
          <!-- Zone dangereuse -->
          <button class="nti-ctx-item nti-ctx-danger" @click="handleDelete">
            <span class="mdi mdi-trash-can-outline" style="font-size: 14px;"></span> {{ $t('common.delete') }}
          </button>
        </div>
      </Popover>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import Popover from 'primevue/popover';
import { useDossierStore } from '../../stores/dossier';
import { useConfirm } from '../../composables/useConfirm';
import api from '../../services/api';
import type { DossierNode } from '../../types';
const props = defineProps<{ node: DossierNode; allNodes: DossierNode[]; depth: number; expanded: boolean }>();
const emit = defineEmits<{ create: [type: string, parentId: string]; duplicate: [nodeId: string]; 'toggle-expand': [nodeId: string] }>();

const { t } = useI18n();
const dossierStore = useDossierStore();
const { confirm } = useConfirm();
const showMenu = ref(false);
const menuRef = ref();
const subMenuRef = ref();

function toggleMenu(event: Event) {
  document.dispatchEvent(new CustomEvent('nti:close-menus', { detail: props.node._id }));
  menuRef.value?.toggle(event);
  showMenu.value = !showMenu.value;
}

function toggleSubMenu(event: Event) {
  subMenuRef.value?.toggle(event);
}

function closeMenus() {
  menuRef.value?.hide();
  subMenuRef.value?.hide();
  showMenu.value = false;
}

// Close this menu when another node opens its menu
function onCloseAllMenus(e: Event) {
  const detail = (e as CustomEvent).detail;
  if (detail !== props.node._id) {
    showMenu.value = false;
    menuRef.value?.hide();
    subMenuRef.value?.hide();
  }
}

onMounted(() => {
  document.addEventListener('nti:close-menus', onCloseAllMenus);
});

onBeforeUnmount(() => {
  document.removeEventListener('nti:close-menus', onCloseAllMenus);
});

const dropPosition = ref<'before' | 'after' | 'inside' | null>(null);

function openContextMenu(e: MouseEvent) {
  document.dispatchEvent(new CustomEvent('nti:close-menus', { detail: props.node._id }));
  menuRef.value?.toggle(e);
  showMenu.value = true;
}

// Inline rename
const renaming = ref(false);
const renameValue = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);

function startRename() {
  renaming.value = true;
  renameValue.value = props.node.title;
  nextTick(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  });
}

async function confirmRename() {
  if (!renaming.value) return;
  renaming.value = false;
  const trimmed = renameValue.value.trim();
  if (!trimmed || trimmed === props.node.title) return;
  await dossierStore.updateNode(props.node._id, { title: trimmed });
}

function cancelRename() {
  renaming.value = false;
}

const hasChildren = computed(() => {
  return props.allNodes.some(n => n.parentId === props.node._id && !n.deletedAt);
});

const icon = computed(() => {
  if (props.node.type === 'folder') {
    return props.expanded ? 'mdi-folder-open-outline' : 'mdi-folder-outline';
  }
  switch (props.node.type) {
    case 'note': return 'mdi-note-text-outline';
    case 'mindmap': return 'mdi-vector-polyline';
    case 'map': return 'mdi-map-outline';
    case 'document': return 'mdi-file-document-outline';
    case 'dataset': return 'mdi-table';
    case 'media': return 'mdi-play-circle-outline';
    default: return 'mdi-file-outline';
  }
});

const children = computed(() =>
  props.allNodes.filter(n => n.parentId === props.node._id).sort((a, b) => a.order - b.order)
);

async function handleDelete() {
  const ok = await confirm({
    title: t('common.delete'),
    message: t('tree.moveToTrashConfirm', { title: props.node.title }),
    confirmText: t('common.delete'),
    variant: 'danger',
  });
  if (ok) dossierStore.deleteNode(props.node._id);
}

function onDragStart(e: DragEvent) {
  e.dataTransfer?.setData('text/plain', props.node._id);
}

function onDragOver(e: DragEvent) {
  const el = (e.currentTarget as HTMLElement);
  const rect = el.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const ratio = y / rect.height;

  if (ratio > 0.25 && ratio < 0.75) {
    dropPosition.value = 'inside';
  } else if (ratio <= 0.5) {
    dropPosition.value = 'before';
  } else {
    dropPosition.value = 'after';
  }
}

function onDragLeave(e: DragEvent) {
  const el = e.currentTarget as HTMLElement;
  const related = e.relatedTarget as HTMLElement | null;
  // Only reset if we're truly leaving the item, not moving to a child element
  if (!related || !el.contains(related)) {
    dropPosition.value = null;
  }
}

function getSiblings(parentId: string | null) {
  return dossierStore.nodes
    .filter(n => n.parentId === parentId && !n.deletedAt)
    .sort((a, b) => a.order - b.order);
}

function isDescendant(nodeId: string, potentialParentId: string): boolean {
  let current = potentialParentId;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) return false;
    visited.add(current);
    if (current === nodeId) return true;
    const parent = props.allNodes.find(n => n._id === current);
    current = parent?.parentId || '';
  }
  return false;
}

async function onDrop(e: DragEvent) {
  e.stopPropagation();
  const pos = dropPosition.value;
  dropPosition.value = null;
  const draggedId = e.dataTransfer?.getData('text/plain');
  if (!draggedId || draggedId === props.node._id || !pos) return;

  // Prevent dropping a folder into its own descendant
  if (pos === 'inside' && isDescendant(draggedId, props.node._id)) return;

  try {
    if (pos === 'inside') {
      await api.patch(`/nodes/${draggedId}/move`, {
        parentId: props.node._id,
        order: children.value.length,
      });
    } else {
      const targetParentId = props.node.parentId;
      const siblings = getSiblings(targetParentId);
      const targetIndex = siblings.findIndex(n => n._id === props.node._id);
      const insertIndex = pos === 'before' ? targetIndex : targetIndex + 1;

      await api.patch(`/nodes/${draggedId}/move`, {
        parentId: targetParentId,
        order: insertIndex,
      });
    }

    // Refetch all nodes to ensure consistent state
    if (dossierStore.currentDossier) {
      const { data } = await api.get(`/dossiers/${dossierStore.currentDossier._id}/nodes`);
      dossierStore.nodes = data;
    }
  } catch (err) {
    console.error('Move failed:', err);
  }
}
</script>

<style scoped>
.nti-item {
  display: flex;
  align-items: center;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  gap: 6px;
  position: relative;
}
.nti-item:hover {
  background: var(--me-accent-glow);
}
.nti-item.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.nti-item.active .nti-icon {
  color: var(--me-accent);
}
.nti-item.active .nti-title {
  color: var(--me-accent);
  font-weight: 600;
}
.nti-chevron {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  padding: 0;
  transition: all 0.15s;
}
.nti-chevron:hover {
  background: var(--me-bg-elevated);
  color: var(--me-text-primary);
}
.nti-chevron-spacer {
  width: 22px;
  flex-shrink: 0;
}
.nti-icon {
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.nti-title {
  flex: 1;
  font-size: 14px;
  color: var(--me-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nti-rename-input {
  flex: 1;
  font-size: 14px;
  color: var(--me-text-primary);
  background: var(--me-bg-surface);
  border: 1px solid var(--me-accent);
  border-radius: 4px;
  padding: 1px 6px;
  outline: none;
  min-width: 0;
  font-family: inherit;
}
.nti-item.active .nti-title {
  color: var(--me-accent);
}
.nti-item:hover .nti-title {
  color: var(--me-text-primary);
}
.nti-menu-btn {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.15s;
}
.nti-item:hover .nti-menu-btn {
  opacity: 1;
}
.nti-menu-btn:hover {
  background: var(--me-bg-elevated);
  color: var(--me-text-primary);
}
.nti-drop-inside {
  outline: 2px dashed var(--me-accent);
  outline-offset: -2px;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.06);
}
.nti-drop-before {
  box-shadow: inset 0 2px 0 0 var(--me-accent);
}
.nti-drop-after {
  box-shadow: inset 0 -2px 0 0 var(--me-accent);
}
.nti-context-menu {
  padding: 6px;
  min-width: 180px;
}
.nti-ctx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.nti-ctx-item:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.nti-ctx-sub {
  justify-content: flex-start;
}
.nti-ctx-item-text {
  flex: 1;
}
.nti-ctx-chevron {
  color: var(--me-text-muted);
  margin-left: auto;
}
.nti-ctx-sep {
  height: 1px;
  background: var(--me-border);
  margin: 4px 8px;
}
.nti-ctx-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  color: var(--me-error);
}
</style>
