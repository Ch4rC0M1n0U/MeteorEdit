<template>
  <div class="qb-panel">
    <div class="qb-header">
      <h3 class="qb-title mono">
        <i class="pi pi-question-circle" style="font-size: 16px;" />
        {{ t('questionBuilder.panelTitle') }}
      </h3>
      <span class="qb-count mono">{{ localQuestions.length }}</span>
    </div>

    <p v-if="!localQuestions.length" class="qb-empty">
      {{ t('questionBuilder.emptyHint') }}
    </p>

    <div class="qb-list">
      <QuestionItem
        v-for="(q, i) in sortedQuestions"
        :key="q.id"
        :question="q"
        :index="i"
        :depth="getDepth(q)"
        @update="handleUpdate"
        @delete="handleDelete"
        @add-child="handleAddChild"
      />
    </div>

    <button class="qb-add-btn" @click="addRootQuestion" type="button">
      <i class="pi pi-plus" style="font-size: 14px;" />
      {{ t('questionBuilder.addQuestion') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import QuestionItem from './QuestionItem.vue';
import type { TemplateQuestion } from '../../types';

const { t } = useI18n();

const props = defineProps<{
  modelValue: TemplateQuestion[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: TemplateQuestion[]];
}>();

const localQuestions = ref<TemplateQuestion[]>([...props.modelValue]);

watch(() => props.modelValue, (val) => {
  localQuestions.value = [...val];
}, { deep: true });

function generateId(): string {
  return crypto.randomUUID();
}

// Sort: root questions by order, then children after their parent
const sortedQuestions = computed(() => {
  const result: TemplateQuestion[] = [];
  const roots = localQuestions.value.filter(q => !q.parentId).sort((a, b) => a.order - b.order);

  function addWithChildren(q: TemplateQuestion) {
    result.push(q);
    const children = localQuestions.value
      .filter(c => c.parentId === q.id)
      .sort((a, b) => a.order - b.order);
    for (const child of children) {
      addWithChildren(child);
    }
  }

  for (const root of roots) {
    addWithChildren(root);
  }
  return result;
});

function getDepth(q: TemplateQuestion): number {
  let depth = 0;
  let current = q;
  while (current.parentId) {
    depth++;
    const parent = localQuestions.value.find(p => p.id === current.parentId);
    if (!parent) break;
    current = parent;
  }
  return depth;
}

function addRootQuestion() {
  const maxOrder = localQuestions.value
    .filter(q => !q.parentId)
    .reduce((max, q) => Math.max(max, q.order), -1);

  localQuestions.value.push({
    id: generateId(),
    parentId: null,
    parentAnswerValue: null,
    order: maxOrder + 1,
    type: 'boolean',
    label: '',
    contentBlocks: {},
  });
  emitAll();
}

function handleAddChild(parentId: string, answerValue: string) {
  const maxOrder = localQuestions.value
    .filter(q => q.parentId === parentId && q.parentAnswerValue === answerValue)
    .reduce((max, q) => Math.max(max, q.order), -1);

  localQuestions.value.push({
    id: generateId(),
    parentId,
    parentAnswerValue: answerValue,
    order: maxOrder + 1,
    type: 'boolean',
    label: '',
    contentBlocks: {},
  });
  emitAll();
}

function handleUpdate(updated: TemplateQuestion) {
  const idx = localQuestions.value.findIndex(q => q.id === updated.id);
  if (idx >= 0) {
    localQuestions.value[idx] = updated;
    emitAll();
  }
}

function handleDelete(id: string) {
  // Delete the question and all its descendants
  const toDelete = new Set<string>();
  function collectDescendants(parentId: string) {
    toDelete.add(parentId);
    for (const q of localQuestions.value) {
      if (q.parentId === parentId) collectDescendants(q.id);
    }
  }
  collectDescendants(id);
  localQuestions.value = localQuestions.value.filter(q => !toDelete.has(q.id));
  emitAll();
}

function emitAll() {
  emit('update:modelValue', [...localQuestions.value]);
}
</script>

<style scoped>
.qb-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.qb-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.qb-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.qb-count {
  font-size: 11px;
  color: var(--me-text-muted);
  background: var(--me-bg-elevated);
  padding: 1px 7px;
  border-radius: 8px;
  border: 1px solid var(--me-border);
}
.qb-empty {
  font-size: 13px;
  color: var(--me-text-muted);
  padding: 16px;
  text-align: center;
  border: 1px dashed var(--me-border);
  border-radius: 8px;
}
.qb-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.qb-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 1px dashed var(--me-border);
  border-radius: 8px;
  background: none;
  color: var(--me-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.qb-add-btn:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
  background: var(--me-accent-glow);
}
</style>
