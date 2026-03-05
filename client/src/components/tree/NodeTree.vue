<template>
  <div class="node-tree">
    <button
      class="nt-item"
      :class="{ active: !dossierStore.selectedNode }"
      @click="dossierStore.selectNode(null)"
    >
      <v-icon size="16" class="mr-2">mdi-information-outline</v-icon>
      <span>Info dossier</span>
    </button>

    <div class="nt-divider" />

    <NodeTreeItem
      v-for="node in rootNodes"
      :key="node._id"
      :node="node"
      :all-nodes="dossierStore.nodes"
      @create="(type, parentId) => $emit('create', type, parentId)"
    />

    <v-menu>
      <template #activator="{ props }">
        <button v-bind="props" class="nt-add-btn">
          <v-icon size="16" class="mr-1">mdi-plus</v-icon>
          <span class="mono">Ajouter</span>
        </button>
      </template>
      <div class="glass-card nt-add-menu">
        <button class="nt-add-option" @click="$emit('create', 'folder', null)">
          <v-icon size="16">mdi-folder-plus-outline</v-icon>
          <span>Dossier</span>
        </button>
        <button class="nt-add-option" @click="$emit('create', 'note', null)">
          <v-icon size="16">mdi-note-plus-outline</v-icon>
          <span>Note</span>
        </button>
        <button class="nt-add-option" @click="$emit('create', 'mindmap', null)">
          <v-icon size="16">mdi-vector-polyline</v-icon>
          <span>Mind Map</span>
        </button>
      </div>
    </v-menu>

    <!-- Corbeille -->
    <div class="nt-divider" style="margin-top: 12px;" />

    <button class="nt-trash-header" @click="trashOpen = !trashOpen">
      <v-icon size="16">mdi-delete-outline</v-icon>
      <span>Corbeille</span>
      <span v-if="trashRootNodes.length" class="nt-trash-badge">{{ trashRootNodes.length }}</span>
      <v-icon size="14" class="nt-trash-chevron">{{ trashOpen ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
    </button>

    <div v-if="trashOpen && trashRootNodes.length" class="nt-trash-list">
      <div v-for="node in trashRootNodes" :key="node._id" class="nt-trash-item">
        <v-icon size="14" class="nt-trash-item-icon">{{ trashIcon(node.type) }}</v-icon>
        <span class="nt-trash-item-title">{{ node.title }}</span>
        <button class="nt-trash-action" @click="handleRestore(node._id)" title="Restaurer">
          <v-icon size="14">mdi-restore</v-icon>
        </button>
        <button class="nt-trash-action nt-trash-action-danger" @click="handlePurge(node._id, node.title)" title="Supprimer definitivement">
          <v-icon size="14">mdi-delete-forever-outline</v-icon>
        </button>
      </div>
    </div>

    <div v-if="trashOpen && !trashRootNodes.length" class="nt-trash-empty">
      <span>Corbeille vide</span>
    </div>

    <button
      v-if="trashOpen && trashRootNodes.length"
      class="nt-empty-trash-btn"
      @click="handleEmptyTrash"
    >
      <v-icon size="14" class="mr-1">mdi-delete-sweep-outline</v-icon>
      <span class="mono">Vider la corbeille</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDossierStore } from '../../stores/dossier';
import { useConfirm } from '../../composables/useConfirm';
import NodeTreeItem from './NodeTreeItem.vue';

defineEmits<{ create: [type: string, parentId: string | null] }>();

const dossierStore = useDossierStore();
const { confirm } = useConfirm();
const trashOpen = ref(false);

const rootNodes = computed(() =>
  dossierStore.nodes.filter(n => n.parentId === null).sort((a, b) => a.order - b.order)
);

// Only show top-level trashed nodes (those whose parent is not also in trash)
const trashRootNodes = computed(() => {
  const trashIds = new Set(dossierStore.trashNodes.map(n => n._id));
  return dossierStore.trashNodes.filter(n => !n.parentId || !trashIds.has(n.parentId));
});

function trashIcon(type: string) {
  switch (type) {
    case 'folder': return 'mdi-folder-outline';
    case 'note': return 'mdi-note-text-outline';
    case 'mindmap': return 'mdi-vector-polyline';
    case 'document': return 'mdi-file-document-outline';
    default: return 'mdi-file-outline';
  }
}

async function handleRestore(nodeId: string) {
  await dossierStore.restoreNode(nodeId);
}

async function handlePurge(nodeId: string, title: string) {
  const ok = await confirm({
    title: 'Suppression definitive',
    message: `Supprimer definitivement "${title}" ? Cette action est irreversible.`,
    confirmText: 'Supprimer',
    variant: 'danger',
  });
  if (ok) await dossierStore.purgeNode(nodeId);
}

async function handleEmptyTrash() {
  const ok = await confirm({
    title: 'Vider la corbeille',
    message: 'Tous les elements seront supprimes definitivement. Cette action est irreversible.',
    confirmText: 'Vider',
    variant: 'danger',
  });
  if (ok) await dossierStore.emptyTrashAction();
}
</script>

<style scoped>
.node-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nt-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.nt-item:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.nt-item.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  border-left: 2px solid var(--me-accent);
  padding-left: 8px;
  font-weight: 600;
}
.nt-divider {
  height: 1px;
  background: var(--me-border);
  margin: 4px 0;
}
.nt-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px;
  margin-top: 8px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px dashed var(--me-border);
  color: var(--me-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.nt-add-btn:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
  background: var(--me-accent-glow);
}
.nt-add-menu {
  padding: 6px;
  min-width: 160px;
}
.nt-add-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.nt-add-option:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}

/* Trash section */
.nt-trash-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}
.nt-trash-header:hover {
  color: var(--me-text-secondary);
  background: rgba(248, 113, 113, 0.05);
}
.nt-trash-badge {
  background: rgba(248, 113, 113, 0.15);
  color: var(--me-error, #f87171);
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  font-family: var(--me-font-mono);
}
.nt-trash-chevron {
  margin-left: auto;
  color: var(--me-text-muted);
}
.nt-trash-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 4px;
}
.nt-trash-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--me-radius-xs);
  transition: all 0.15s;
}
.nt-trash-item:hover {
  background: rgba(248, 113, 113, 0.05);
}
.nt-trash-item-icon {
  color: var(--me-text-muted);
  opacity: 0.5;
  flex-shrink: 0;
}
.nt-trash-item-title {
  flex: 1;
  font-size: 12px;
  color: var(--me-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: line-through;
  opacity: 0.7;
}
.nt-trash-action {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}
.nt-trash-item:hover .nt-trash-action {
  opacity: 1;
}
.nt-trash-action:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.nt-trash-action-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  color: var(--me-error, #f87171);
}
.nt-trash-empty {
  padding: 8px 10px;
  font-size: 11px;
  color: var(--me-text-muted);
  opacity: 0.5;
  text-align: center;
  font-style: italic;
}
.nt-empty-trash-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 6px;
  margin-top: 4px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px dashed rgba(248, 113, 113, 0.3);
  color: var(--me-error, #f87171);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  opacity: 0.7;
}
.nt-empty-trash-btn:hover {
  opacity: 1;
  background: rgba(248, 113, 113, 0.08);
  border-color: var(--me-error, #f87171);
}
</style>
