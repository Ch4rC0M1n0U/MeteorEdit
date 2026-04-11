<template>
  <div class="fp-wrapper" ref="wrapperRef">
    <button type="button" class="fp-trigger" @click="toggle">
      <i class="pi pi-folder fp-trigger-icon" style="font-size: 14px;"></i>
      <span class="fp-trigger-text">{{ selectedLabel }}</span>
      <i :class="open ? 'pi pi-chevron-up' : 'pi pi-chevron-down'" class="fp-trigger-chevron" style="font-size: 14px;"></i>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="fp-dropdown glass-card"
        ref="dropdownRef"
        :style="dropdownStyle"
      >
        <button
          type="button"
          class="fp-option"
          :class="{ 'fp-option--active': !modelValue }"
          @click="select('')"
        >
          <i class="pi pi-home" style="font-size: 14px;"></i>
          <span>{{ $t('common.rootFolder') }}</span>
        </button>
        <button
          v-for="item in treeItems"
          :key="item.id"
          type="button"
          class="fp-option"
          :class="{ 'fp-option--active': modelValue === item.id }"
          :style="{ paddingLeft: (12 + item.depth * 16) + 'px' }"
          @click="select(item.id)"
        >
          <i class="pi pi-folder" style="font-size: 14px;"></i>
          <span>{{ item.title }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount, type CSSProperties } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDossierStore } from '../../stores/dossier';

const { t } = useI18n();
const modelValue = defineModel<string>({ default: '' });
const dossierStore = useDossierStore();

const open = ref(false);
const wrapperRef = ref<HTMLElement>();
const dropdownRef = ref<HTMLElement>();
const dropdownStyle = ref<CSSProperties>({});

interface TreeItem {
  id: string;
  title: string;
  depth: number;
}

const treeItems = computed<TreeItem[]>(() => {
  const folders = dossierStore.nodes.filter(n => n.type === 'folder' && !n.deletedAt);
  const byParent = new Map<string | null, typeof folders>();

  for (const f of folders) {
    const key = f.parentId || null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(f);
  }

  for (const [, children] of byParent) {
    children.sort((a, b) => a.order - b.order);
  }

  const result: TreeItem[] = [];

  function walk(parentId: string | null, depth: number) {
    const children = byParent.get(parentId) || [];
    for (const child of children) {
      result.push({ id: child._id, title: child.title, depth });
      walk(child._id, depth + 1);
    }
  }

  walk(null, 0);
  return result;
});

const selectedLabel = computed(() => {
  if (!modelValue.value) return t('common.rootFolder');
  const folder = dossierStore.nodes.find(n => n._id === modelValue.value);
  return folder?.title || t('common.rootFolder');
});

function updatePosition() {
  if (!wrapperRef.value) return;
  const rect = wrapperRef.value.getBoundingClientRect();
  // Max 10 items visible (each ~33px + 8px padding)
  const itemCount = 1 + treeItems.value.length; // +1 for root
  const maxVisible = 10;
  const maxHeight = Math.min(itemCount, maxVisible) * 33 + 8;

  // Check if dropdown fits below, otherwise show above
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const showAbove = spaceBelow < maxHeight && rect.top > spaceBelow;

  dropdownStyle.value = {
    position: 'fixed',
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxHeight: `${maxVisible * 33 + 8}px`,
    zIndex: 9999,
    ...(showAbove
      ? { bottom: `${window.innerHeight - rect.top + 4}px` }
      : { top: `${rect.bottom + 4}px` }
    ),
  };
}

function toggle() {
  open.value = !open.value;
  if (open.value) {
    nextTick(updatePosition);
  }
}

function select(id: string) {
  modelValue.value = id;
  open.value = false;
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (
    wrapperRef.value && !wrapperRef.value.contains(target) &&
    dropdownRef.value && !dropdownRef.value.contains(target)
  ) {
    open.value = false;
  }
}

function onScroll() {
  if (open.value) updatePosition();
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside);
  window.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', onScroll);
});
</script>

<style scoped>
.fp-wrapper {
  position: relative;
}
.fp-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--me-border);
  background: var(--me-bg-deep);
  color: var(--me-text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s;
  font-family: inherit;
  text-align: left;
}
.fp-trigger:hover,
.fp-trigger:focus {
  border-color: var(--me-accent);
}
.fp-trigger-icon {
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.fp-trigger-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fp-trigger-chevron {
  color: var(--me-text-muted);
  flex-shrink: 0;
}
</style>

<style>
/* Unscoped — dropdown is teleported to body */
.fp-dropdown {
  overflow-y: auto;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}
.fp-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  border-radius: 6px;
  border: none;
  background: none;
  color: var(--me-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.12s;
  text-align: left;
  font-family: inherit;
}
.fp-option:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.fp-option--active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  font-weight: 600;
}
</style>
