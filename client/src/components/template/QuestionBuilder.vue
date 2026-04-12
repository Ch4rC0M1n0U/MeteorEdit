<template>
  <div class="qb-panel">
    <!-- Header -->
    <div class="qb-header">
      <div class="qb-header-left">
        <div class="qb-icon-wrap">
          <i class="pi pi-question-circle" />
        </div>
        <div>
          <h3 class="qb-title">{{ t('questionBuilder.panelTitle') }}</h3>
          <p class="qb-subtitle">{{ t('questionBuilder.panelSubtitle') }}</p>
        </div>
      </div>
      <Tag :value="localQuestions.length + ' ' + t(localQuestions.length > 1 ? 'questionBuilder.questionsPlural' : 'questionBuilder.questionSingular')" severity="info" rounded />
    </div>

    <!-- Empty state -->
    <div v-if="!localQuestions.length" class="qb-empty">
      <div class="qb-empty-icon">
        <i class="pi pi-comment" />
      </div>
      <h4>{{ t('questionBuilder.emptyTitle') }}</h4>
      <p>{{ t('questionBuilder.emptyHint') }}</p>
      <Button
        :label="t('questionBuilder.addFirstQuestion')"
        icon="pi pi-plus"
        severity="info"
        outlined
        @click="addRootQuestion"
      />
    </div>

    <!-- Questions list -->
    <TransitionGroup v-else name="qb-list" tag="div" class="qb-list">
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
    </TransitionGroup>

    <!-- Add question button -->
    <div v-if="localQuestions.length" class="qb-footer">
      <Button
        :label="t('questionBuilder.addQuestion')"
        icon="pi pi-plus"
        severity="secondary"
        outlined
        @click="addRootQuestion"
        class="qb-add-btn"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
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
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100%;
  width: 100%;
}

/* Header */
.qb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: 12px;
}
.qb-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.qb-icon-wrap {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--me-accent-glow), transparent);
  border: 1px solid var(--me-accent);
  color: var(--me-accent);
  font-size: 20px;
}
.qb-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin: 0;
}
.qb-subtitle {
  font-size: 12px;
  color: var(--me-text-muted);
  margin: 2px 0 0;
}

/* Empty state */
.qb-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  flex: 1;
  min-height: 50vh;
  text-align: center;
  border: 2px dashed var(--me-border);
  border-radius: 16px;
  background: var(--me-bg-surface);
}
.qb-empty-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: var(--me-accent-glow);
  color: var(--me-accent);
  font-size: 24px;
}
.qb-empty h4 {
  font-size: 15px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin: 0;
}
.qb-empty p {
  font-size: 13px;
  color: var(--me-text-muted);
  margin: 0;
  max-width: 320px;
}

/* List */
.qb-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
}

/* TransitionGroup animations */
.qb-list-enter-active {
  transition: all 0.3s ease;
}
.qb-list-leave-active {
  transition: all 0.2s ease;
}
.qb-list-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.qb-list-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.qb-list-move {
  transition: transform 0.3s ease;
}

/* Footer */
.qb-footer {
  display: flex;
  justify-content: center;
}
.qb-add-btn {
  width: 100%;
}
</style>
