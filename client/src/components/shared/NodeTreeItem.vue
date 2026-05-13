<!--
  NodeTreeItem.vue — ligne arbo dossier
  Affiche icône catégorie colorée, label, status, badge enfants, drag&drop.
  Sélection : data-active sur .nti. Drag : @dragstart / @dragover.prevent / @drop conservés.
  ATTENTION : la logique D&D doit rester compatible avec l'existant — ne pas changer les signatures d'events.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useDossierStore } from '@/stores/dossier';

export interface TreeNode {
  _id: string;
  type: 'folder' | 'note' | 'mindmap' | 'map' | 'dataset' | 'media' | 'image' | 'clipper' | 'entity' | 'timeline';
  title: string;
  hasChildren?: boolean;
  children?: TreeNode[];
  childCount?: number;
}

const props = defineProps<{
  node: TreeNode;
  depth?: number;
  expanded?: boolean;
  dropPosition?: 'inside' | 'before' | 'after' | null;
}>();

const emit = defineEmits<{
  (e: 'toggle-expand', id: string): void;
  (e: 'dragstart', node: TreeNode, event: DragEvent): void;
  (e: 'dragover', node: TreeNode, event: DragEvent): void;
  (e: 'dragleave', node: TreeNode): void;
  (e: 'drop', node: TreeNode, event: DragEvent): void;
  (e: 'context', node: TreeNode, event: MouseEvent): void;
}>();

const dossierStore = useDossierStore();

const ICONS: Record<string, string> = {
  folder: 'pi-folder',
  note: 'pi-file-edit',
  mindmap: 'pi-sitemap',
  map: 'pi-map-marker',
  dataset: 'pi-table',
  media: 'pi-play',
  image: 'pi-image',
  clipper: 'pi-paperclip',
  entity: 'pi-id-card',
  timeline: 'pi-clock',
};

const iconClass = computed(() => ICONS[props.node.type] || 'pi-file');
const catClass  = computed(() => `nti__icon--${props.node.type}`);
const isActive  = computed(() => dossierStore.selectedNode?._id === props.node._id);
const hasKids   = computed(() => !!(props.node.hasChildren || props.node.children?.length));
const indent    = computed(() => `${(props.depth || 0) * 16 + 8}px`);
</script>

<template>
  <div
    class="nti"
    :data-active="isActive"
    :data-drop="dropPosition || null"
    :style="{ paddingLeft: indent }"
    draggable="true"
    @click="dossierStore.selectNode(node)"
    @dragstart="(e) => emit('dragstart', node, e)"
    @dragover.prevent="(e) => emit('dragover', node, e)"
    @dragleave="emit('dragleave', node)"
    @drop="(e) => emit('drop', node, e)"
    @contextmenu.prevent="(e) => emit('context', node, e)"
  >
    <button
      v-if="hasKids"
      class="nti__chev"
      :aria-expanded="expanded"
      @click.stop="emit('toggle-expand', node._id)"
    >
      <i class="pi" :class="expanded ? 'pi-chevron-down' : 'pi-chevron-right'" />
    </button>
    <span v-else class="nti__chev-spacer" />

    <span class="nti__icon" :class="catClass"><i class="pi" :class="iconClass" /></span>

    <span class="nti__label">{{ node.title }}</span>

    <span v-if="hasKids && node.childCount" class="nti__count num">{{ node.childCount }}</span>
  </div>
</template>

<style scoped>
.nti {
  display: grid;
  grid-template-columns: 16px 18px 1fr auto;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding-right: 8px;
  border-radius: var(--r-sm);
  font-size: 12.5px;
  color: var(--ink-2);
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: background 80ms ease;
}
.nti:hover { background: var(--bg-3); color: var(--ink); }
.nti[data-active="true"] {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 550;
}
.nti[data-active="true"]::before {
  content: '';
  position: absolute; left: 0; top: 4px; bottom: 4px;
  width: 2px; background: var(--accent);
  border-radius: 1px;
}
.nti[data-drop="inside"] {
  background: var(--accent-soft);
  outline: 2px solid var(--accent-line);
  outline-offset: -2px;
}
.nti[data-drop="before"] { box-shadow: inset 0 2px 0 0 var(--accent); }
.nti[data-drop="after"]  { box-shadow: inset 0 -2px 0 0 var(--accent); }

.nti__chev {
  width: 16px; height: 18px;
  display: grid; place-items: center;
  border: 0; background: transparent;
  color: var(--ink-3); cursor: pointer;
  border-radius: 2px;
}
.nti__chev:hover { color: var(--ink); }
.nti__chev .pi { font-size: 10px; }
.nti__chev-spacer { width: 16px; height: 18px; }

.nti__icon {
  width: 18px; height: 18px;
  display: grid; place-items: center;
  color: var(--ink-3);
}
.nti__icon .pi { font-size: 14px; }
.nti__icon--note    { color: var(--cat-note); }
.nti__icon--mindmap { color: var(--cat-mindmap); }
.nti__icon--map     { color: var(--cat-map); }
.nti__icon--dataset { color: var(--cat-dataset); }
.nti__icon--media   { color: var(--cat-image); }
.nti__icon--image   { color: var(--cat-image); }
.nti__icon--clipper { color: var(--cat-clipper); }
.nti__icon--entity  { color: var(--cat-entity); }
.nti__icon--folder  { color: var(--ink-3); }
.nti__icon--timeline { color: var(--cat-mindmap); }

.nti__label {
  white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.005em;
}
.nti__count {
  font-size: 10.5px;
  color: var(--ink-3);
  background: var(--bg-3);
  padding: 0 5px;
  border-radius: 999px;
  line-height: 16px;
  min-width: 16px;
  text-align: center;
}
</style>
