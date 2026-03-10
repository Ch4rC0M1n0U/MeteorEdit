<template>
  <div v-if="items.length" class="mention-list">
    <button
      v-for="(item, index) in items"
      :key="item.id"
      class="mention-list-item"
      :class="{ 'mention-list-item--selected': index === selectedIndex }"
      @click="selectItem(index)"
    >
      <img v-if="item.avatarUrl" :src="item.avatarUrl" class="mention-avatar mention-avatar-img" />
      <span v-else class="mention-avatar">{{ item.initials }}</span>
      <span class="mention-name">{{ item.label }}</span>
      <span class="mention-email">{{ item.email }}</span>
    </button>
  </div>
  <div v-else-if="loading" class="mention-list mention-loading">
    <span>Recherche...</span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  items: Array<{ id: string; label: string; email: string; initials: string; avatarUrl: string | null }>;
  command: (item: { id: string; label: string }) => void;
  loading?: boolean;
}>();

const selectedIndex = ref(0);

watch(() => props.items, () => {
  selectedIndex.value = 0;
});

function onKeyDown({ event }: { event: KeyboardEvent }): boolean {
  if (event.key === 'ArrowUp') {
    selectedIndex.value = (selectedIndex.value + props.items.length - 1) % props.items.length;
    return true;
  }
  if (event.key === 'ArrowDown') {
    selectedIndex.value = (selectedIndex.value + 1) % props.items.length;
    return true;
  }
  if (event.key === 'Enter') {
    selectItem(selectedIndex.value);
    return true;
  }
  return false;
}

function selectItem(index: number) {
  const item = props.items[index];
  if (item) {
    props.command({ id: item.id, label: item.label });
  }
}

defineExpose({ onKeyDown });
</script>

<style scoped>
.mention-list {
  background: var(--me-bg-surface, #fff);
  border: 1px solid var(--me-border, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 4px;
  min-width: 220px;
  max-height: 240px;
  overflow-y: auto;
}
.mention-loading {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--me-text-muted, #9ca3af);
}
.mention-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  background: none;
  border: none;
  color: var(--me-text-secondary, #374151);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.1s;
  text-align: left;
}
.mention-list-item:hover,
.mention-list-item--selected {
  background: var(--me-accent-glow, rgba(59, 130, 246, 0.08));
}
.mention-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--me-accent, #3b82f6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--me-font-mono);
  flex-shrink: 0;
}
.mention-avatar-img {
  object-fit: cover;
}
.mention-name {
  font-weight: 500;
}
.mention-email {
  color: var(--me-text-muted, #9ca3af);
  font-size: 11px;
  margin-left: auto;
}
</style>
