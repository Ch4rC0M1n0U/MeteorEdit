<template>
  <v-dialog v-model="model" max-width="560" persistent>
    <div class="es-dialog glass-card">
      <div class="es-header">
        <v-icon size="20" class="es-header-icon">mdi-download-outline</v-icon>
        <span>{{ $t('dossier.exportDossier') }}</span>
        <button class="es-close" @click="model = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <div class="es-body">
        <div class="es-actions-top">
          <button class="es-link-btn" @click="selectAll">
            <v-icon size="14">mdi-checkbox-multiple-marked-outline</v-icon>
            {{ $t('dossier.selectAll') }}
          </button>
          <button class="es-link-btn" @click="deselectAll">
            <v-icon size="14">mdi-checkbox-multiple-blank-outline</v-icon>
            {{ $t('dossier.deselectAll') }}
          </button>
        </div>

        <div class="es-tree">
          <!-- Root nodes (no parent) -->
          <ExportNodeItem
            v-for="node in rootNodes"
            :key="node._id"
            :node="node"
            :children-map="childrenMap"
            :selected-ids="selectedIds"
            :depth="0"
            @toggle="toggleNode"
          />
          <div v-if="!allNodes.length" class="es-empty">{{ $t('dossier.noElements') }}</div>
        </div>
      </div>

      <div class="es-footer">
        <span class="es-count mono">{{ $t('dossier.selectedCount', { count: selectedIds.size, total: allNodes.length }) }}</span>
        <div class="es-footer-btns">
          <button class="es-btn es-btn--cancel" @click="model = false">{{ $t('common.cancel') }}</button>
          <button class="es-btn es-btn--print" @click="doExport('print')" :disabled="selectedIds.size === 0">
            <v-icon size="14">mdi-printer-outline</v-icon>
            {{ $t('common.print') }}
          </button>
          <button class="es-btn es-btn--pdf" @click="doExport('pdf')" :disabled="selectedIds.size === 0">
            <v-icon size="14">mdi-file-pdf-box</v-icon>
            PDF
          </button>
          <button class="es-btn es-btn--docx" @click="doExport('docx')" :disabled="selectedIds.size === 0">
            <v-icon size="14">mdi-file-word-box</v-icon>
            DOCX
          </button>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineComponent, h } from 'vue';
import type { DossierNode } from '../../types';

const model = defineModel<boolean>({ default: false });

const props = defineProps<{
  nodes: DossierNode[];
}>();

const emit = defineEmits<{
  export: [format: 'pdf' | 'docx' | 'print', selectedIds: string[]];
}>();

const NODE_ICONS: Record<string, string> = {
  folder: 'mdi-folder',
  note: 'mdi-note-text',
  mindmap: 'mdi-draw',
  document: 'mdi-file-document',
  map: 'mdi-map-marker',
  dataset: 'mdi-table',
};

const selectedIds = ref<Set<string>>(new Set());

const allNodes = computed(() => props.nodes.filter(n => !n.deletedAt));

const childrenMap = computed(() => {
  const map = new Map<string | null, DossierNode[]>();
  for (const node of allNodes.value) {
    const parentKey = node.parentId || null;
    if (!map.has(parentKey)) map.set(parentKey, []);
    map.get(parentKey)!.push(node);
  }
  // Sort children by order
  for (const children of map.values()) {
    children.sort((a, b) => a.order - b.order);
  }
  return map;
});

const rootNodes = computed(() => childrenMap.value.get(null) || []);

// When dialog opens, select all by default
watch(model, (open) => {
  if (open) {
    selectedIds.value = new Set(allNodes.value.map(n => n._id));
  }
});

function selectAll() {
  selectedIds.value = new Set(allNodes.value.map(n => n._id));
}

function deselectAll() {
  selectedIds.value = new Set();
}

function getDescendantIds(nodeId: string): string[] {
  const ids: string[] = [];
  const children = childrenMap.value.get(nodeId) || [];
  for (const child of children) {
    ids.push(child._id);
    ids.push(...getDescendantIds(child._id));
  }
  return ids;
}

function getAncestorIds(nodeId: string): string[] {
  const ids: string[] = [];
  const node = allNodes.value.find(n => n._id === nodeId);
  if (node?.parentId) {
    ids.push(node.parentId);
    ids.push(...getAncestorIds(node.parentId));
  }
  return ids;
}

function toggleNode(nodeId: string) {
  const newSet = new Set(selectedIds.value);
  if (newSet.has(nodeId)) {
    // Deselect node and all descendants
    newSet.delete(nodeId);
    for (const id of getDescendantIds(nodeId)) {
      newSet.delete(id);
    }
  } else {
    // Select node, all descendants, and all ancestors
    newSet.add(nodeId);
    for (const id of getDescendantIds(nodeId)) {
      newSet.add(id);
    }
    for (const id of getAncestorIds(nodeId)) {
      newSet.add(id);
    }
  }
  selectedIds.value = newSet;
}

function doExport(format: 'pdf' | 'docx' | 'print') {
  emit('export', format, Array.from(selectedIds.value));
  model.value = false;
}

// Recursive node item component
const ExportNodeItem = defineComponent({
  name: 'ExportNodeItem',
  props: {
    node: { type: Object as () => DossierNode, required: true },
    childrenMap: { type: Object as () => Map<string | null, DossierNode[]>, required: true },
    selectedIds: { type: Object as () => Set<string>, required: true },
    depth: { type: Number, default: 0 },
  },
  emits: ['toggle'],
  setup(props, { emit }) {
    const children = computed(() => props.childrenMap.get(props.node._id) || []);
    const isSelected = computed(() => props.selectedIds.has(props.node._id));
    const icon = computed(() => NODE_ICONS[props.node.type] || 'mdi-file');

    return () => {
      const nodeEl = h('div', {
        class: ['es-node', isSelected.value ? 'es-node--selected' : ''],
        style: { paddingLeft: `${props.depth * 20 + 8}px` },
        onClick: () => emit('toggle', props.node._id),
      }, [
        h('v-icon', { size: 16, class: isSelected.value ? 'es-node-check es-node-check--active' : 'es-node-check' },
          () => isSelected.value ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'
        ),
        h('v-icon', { size: 16, class: 'es-node-icon' }, () => icon.value),
        h('span', { class: 'es-node-title' }, props.node.title),
      ]);

      const childEls = children.value.map(child =>
        h(ExportNodeItem, {
          key: child._id,
          node: child,
          childrenMap: props.childrenMap,
          selectedIds: props.selectedIds,
          depth: props.depth + 1,
          onToggle: (id: string) => emit('toggle', id),
        })
      );

      return h('div', {}, [nodeEl, ...childEls]);
    };
  },
});
</script>

<style scoped>
.es-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.es-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.es-header-icon { color: var(--me-accent); }
.es-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; transition: all 0.15s; }
.es-close:hover { background: rgba(255,255,255,0.08); color: var(--me-text-primary); }

.es-body { padding: 12px 18px; }

.es-actions-top { display: flex; gap: 12px; margin-bottom: 10px; }
.es-link-btn {
  background: none; border: none; color: var(--me-text-secondary); cursor: pointer;
  font-size: 12px; display: flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-radius: 6px; transition: all 0.15s;
}
.es-link-btn:hover { background: rgba(255,255,255,0.06); color: var(--me-accent); }

.es-tree {
  max-height: 400px; overflow-y: auto;
  border: 1px solid var(--me-border); border-radius: 8px;
  background: var(--me-bg-deep);
}

.es-node {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; cursor: pointer; transition: background 0.12s;
  user-select: none;
}
.es-node:hover { background: rgba(255,255,255,0.06); }
.es-node--selected { background: rgba(var(--me-accent-rgb, 66,133,244), 0.15); border-left: 3px solid var(--me-accent); }
.es-node--selected:hover { background: rgba(var(--me-accent-rgb, 66,133,244), 0.22); }
.es-node-check { color: var(--me-text-muted); flex-shrink: 0; }
.es-node-check--active { color: var(--me-accent); }
.es-node-icon { color: var(--me-text-muted); flex-shrink: 0; }
.es-node--selected .es-node-icon { color: var(--me-accent); }
.es-node-title { font-size: 13px; color: var(--me-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.es-node--selected .es-node-title { color: var(--me-accent); font-weight: 600; }

.es-empty { padding: 24px; text-align: center; color: var(--me-text-muted); font-size: 13px; }

.es-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 18px; border-top: 1px solid var(--me-border);
}
.es-count { font-size: 12px; color: var(--me-text-muted); }
.es-footer-btns { display: flex; gap: 8px; }

.es-btn {
  padding: 7px 16px; border-radius: 8px; border: none;
  font-size: 13px; font-weight: 500; cursor: pointer;
  transition: all 0.15s; display: flex; align-items: center; gap: 6px;
}
.es-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.es-btn--cancel { background: none; color: var(--me-text-muted); }
.es-btn--cancel:hover { background: rgba(255,255,255,0.06); color: var(--me-text-primary); }
.es-btn--print { background: #27ae60; color: #fff; }
.es-btn--print:hover:not(:disabled) { filter: brightness(1.15); }
.es-btn--pdf { background: #c0392b; color: #fff; }
.es-btn--pdf:hover:not(:disabled) { filter: brightness(1.15); }
.es-btn--docx { background: #2980b9; color: #fff; }
.es-btn--docx:hover:not(:disabled) { filter: brightness(1.15); }
</style>
