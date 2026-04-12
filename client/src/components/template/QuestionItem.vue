<template>
  <div class="qi-card" :style="{ marginLeft: depth * 24 + 'px' }">
    <div class="qi-header">
      <div class="qi-badge mono">Q{{ index + 1 }}</div>
      <span v-if="question.parentId" class="qi-trigger mono">
        {{ t('questionBuilder.triggeredBy') }}: "{{ question.parentAnswerValue }}"
      </span>
      <div class="qi-spacer" />
      <button class="qi-del-btn" @click="emit('delete', question.id)" type="button" :title="t('common.delete')">
        <i class="pi pi-trash" style="font-size: 13px;" />
      </button>
    </div>

    <!-- Question label -->
    <div class="qi-field">
      <label class="qi-label">{{ t('questionBuilder.questionLabel') }}</label>
      <input
        v-model="localLabel"
        class="qi-input"
        :placeholder="t('questionBuilder.questionLabelPlaceholder')"
        @blur="emitUpdate"
      />
    </div>

    <!-- Type selector -->
    <div class="qi-field">
      <label class="qi-label">{{ t('questionBuilder.type') }}</label>
      <div class="qi-type-row">
        <button
          v-for="tp in typeOptions"
          :key="tp.value"
          class="qi-type-btn"
          :class="{ active: localType === tp.value }"
          @click="changeType(tp.value)"
          type="button"
        >
          <i :class="tp.icon" style="font-size: 14px;" />
          {{ tp.label }}
        </button>
      </div>
    </div>

    <!-- Options (for select type) -->
    <div v-if="localType === 'select'" class="qi-field">
      <label class="qi-label">{{ t('questionBuilder.options') }}</label>
      <div class="qi-options-list">
        <div v-for="(opt, oi) in localOptions" :key="oi" class="qi-option-row">
          <input
            v-model="localOptions[oi]"
            class="qi-input qi-option-input"
            :placeholder="t('questionBuilder.optionPlaceholder', { n: oi + 1 })"
            @blur="emitUpdate"
          />
          <button v-if="localOptions.length > 2" class="qi-del-btn" @click="removeOption(oi)" type="button">
            <i class="pi pi-times" style="font-size: 12px;" />
          </button>
        </div>
        <button class="qi-add-btn" @click="addOption" type="button">
          <i class="pi pi-plus" style="font-size: 12px;" />
          {{ t('questionBuilder.addOption') }}
        </button>
      </div>
    </div>

    <!-- Content blocks per answer -->
    <div class="qi-blocks">
      <label class="qi-label">{{ t('questionBuilder.contentForAnswer') }}</label>
      <div v-for="answerKey in answerKeys" :key="answerKey" class="qi-block">
        <div class="qi-block-header">
          <span class="qi-block-key mono">{{ answerKey }}</span>
          <button
            class="qi-add-child-btn"
            @click="emit('add-child', question.id, answerKey)"
            type="button"
            :title="t('questionBuilder.addChildQuestion')"
          >
            <i class="pi pi-plus-circle" style="font-size: 13px;" />
            {{ t('questionBuilder.subQuestion') }}
          </button>
        </div>
        <ContentBlockEditor
          :modelValue="localContentBlocks[answerKey] || null"
          @update:modelValue="(val: any) => updateBlock(answerKey, val)"
          :placeholder="t('questionBuilder.blockPlaceholder', { answer: answerKey })"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ContentBlockEditor from './ContentBlockEditor.vue';
import type { TemplateQuestion } from '../../types';

const { t } = useI18n();

const props = defineProps<{
  question: TemplateQuestion;
  index: number;
  depth: number;
}>();

const emit = defineEmits<{
  update: [question: TemplateQuestion];
  delete: [id: string];
  'add-child': [parentId: string, answerValue: string];
}>();

const localLabel = ref(props.question.label);
const localType = ref(props.question.type);
const localOptions = ref<string[]>([...(props.question.options || ['Option 1', 'Option 2'])]);
const localContentBlocks = ref<Record<string, any>>({ ...props.question.contentBlocks });

watch(() => props.question, (q) => {
  localLabel.value = q.label;
  localType.value = q.type;
  localOptions.value = [...(q.options || ['Option 1', 'Option 2'])];
  localContentBlocks.value = { ...q.contentBlocks };
}, { deep: true });

const typeOptions = computed(() => [
  { value: 'boolean' as const, label: t('questionBuilder.boolean'), icon: 'pi pi-check-circle' },
  { value: 'select' as const, label: t('questionBuilder.select'), icon: 'pi pi-list' },
  { value: 'text' as const, label: t('questionBuilder.text'), icon: 'pi pi-pencil' },
]);

const answerKeys = computed<string[]>(() => {
  if (localType.value === 'boolean') return ['yes', 'no'];
  if (localType.value === 'select') return localOptions.value.filter(o => o.trim());
  if (localType.value === 'text') return ['__text__'];
  return [];
});

function changeType(newType: 'boolean' | 'select' | 'text') {
  localType.value = newType;
  emitUpdate();
}

function addOption() {
  localOptions.value.push('');
}

function removeOption(idx: number) {
  localOptions.value.splice(idx, 1);
  emitUpdate();
}

function updateBlock(key: string, val: any) {
  localContentBlocks.value[key] = val;
  emitUpdate();
}

function emitUpdate() {
  emit('update', {
    ...props.question,
    label: localLabel.value,
    type: localType.value,
    options: localType.value === 'select' ? [...localOptions.value] : undefined,
    contentBlocks: { ...localContentBlocks.value },
  });
}
</script>

<style scoped>
.qi-card {
  border: 1px solid var(--me-border);
  border-radius: 8px;
  padding: 14px 16px;
  background: var(--me-bg-elevated);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.qi-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.qi-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--me-accent);
  background: var(--me-accent-glow);
  padding: 2px 8px;
  border-radius: 10px;
}
.qi-trigger {
  font-size: 11px;
  color: var(--me-text-muted);
}
.qi-spacer { flex: 1; }
.qi-del-btn {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s;
}
.qi-del-btn:hover { color: var(--me-error); background: rgba(248, 113, 113, 0.1); }
.qi-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.qi-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.qi-input {
  padding: 6px 10px;
  border: 1px solid var(--me-border);
  border-radius: 6px;
  background: var(--me-bg-surface);
  color: var(--me-text-primary);
  font-size: 13px;
  font-family: var(--me-font-body);
  outline: none;
  transition: border-color 0.15s;
}
.qi-input:focus { border-color: var(--me-accent); }
.qi-type-row {
  display: flex;
  gap: 4px;
}
.qi-type-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--me-border);
  border-radius: 6px;
  background: var(--me-bg-surface);
  color: var(--me-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.qi-type-btn:hover { border-color: var(--me-accent); color: var(--me-accent); }
.qi-type-btn.active { border-color: var(--me-accent); background: var(--me-accent-glow); color: var(--me-accent); font-weight: 600; }
.qi-options-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.qi-option-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.qi-option-input { flex: 1; }
.qi-add-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px dashed var(--me-border);
  border-radius: 6px;
  background: none;
  color: var(--me-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  align-self: flex-start;
}
.qi-add-btn:hover { border-color: var(--me-accent); color: var(--me-accent); }
.qi-blocks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.qi-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.qi-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.qi-block-key {
  font-size: 11px;
  color: var(--me-text-secondary);
  background: var(--me-bg-surface);
  padding: 2px 8px;
  border-radius: 8px;
  border: 1px solid var(--me-border);
}
.qi-add-child-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: none;
  border: none;
  color: var(--me-text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.qi-add-child-btn:hover { color: var(--me-accent); }
</style>
