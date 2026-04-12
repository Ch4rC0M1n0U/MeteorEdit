<template>
  <div
    class="qi-card"
    :class="{ 'qi-card--child': depth > 0 }"
    :style="{ marginLeft: depth * 28 + 'px' }"
  >
    <!-- Card header -->
    <div class="qi-header">
      <Tag :value="'Q' + (index + 1)" severity="info" rounded class="qi-badge" />
      <Chip
        v-if="question.parentId"
        :label="t('questionBuilder.triggeredBy') + ': ' + question.parentAnswerValue"
        class="qi-trigger-chip"
      />
      <div class="qi-spacer" />
      <Button
        icon="pi pi-trash"
        severity="danger"
        text
        rounded
        size="small"
        @click="emit('delete', question.id)"
        :title="t('common.delete')"
      />
    </div>

    <!-- Question label -->
    <div class="qi-field">
      <label class="qi-label">{{ t('questionBuilder.questionLabel') }}</label>
      <InputText
        v-model="localLabel"
        :placeholder="t('questionBuilder.questionLabelPlaceholder')"
        variant="filled"
        class="qi-input-full"
        @blur="emitUpdate"
      />
    </div>

    <!-- Type selector -->
    <div class="qi-field">
      <label class="qi-label">{{ t('questionBuilder.type') }}</label>
      <SelectButton
        v-model="localType"
        :options="typeOptions"
        optionLabel="label"
        optionValue="value"
        :allowEmpty="false"
        class="qi-type-selector"
        @change="onTypeChange"
      />
    </div>

    <!-- Options (for select type) -->
    <div v-if="localType === 'radio' || localType === 'checkbox'" class="qi-field">
      <label class="qi-label">{{ t('questionBuilder.options') }}</label>
      <div class="qi-options-list">
        <div v-for="(opt, oi) in localOptions" :key="oi" class="qi-option-row">
          <Tag :value="String(oi + 1)" severity="secondary" class="qi-opt-num" />
          <InputText
            v-model="localOptions[oi]"
            :placeholder="t('questionBuilder.optionPlaceholder', { n: oi + 1 })"
            variant="filled"
            size="small"
            class="qi-input-full"
            @blur="emitUpdate"
          />
          <Button
            v-if="localOptions.length > 2"
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            size="small"
            @click="removeOption(oi)"
          />
        </div>
        <Button
          :label="t('questionBuilder.addOption')"
          icon="pi pi-plus"
          severity="secondary"
          text
          size="small"
          @click="addOption"
          class="qi-add-opt-btn"
        />
      </div>
    </div>

    <!-- Content blocks per answer -->
    <div class="qi-blocks">
      <label class="qi-label">{{ t('questionBuilder.contentForAnswer') }}</label>
      <div v-for="answerKey in answerKeys" :key="answerKey" class="qi-block">
        <div class="qi-block-header">
          <Chip :label="answerKey" class="qi-answer-chip" />
          <Button
            :label="t('questionBuilder.subQuestion')"
            icon="pi pi-plus-circle"
            severity="info"
            text
            size="small"
            @click="emit('add-child', question.id, answerKey)"
          />
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
import InputText from 'primevue/inputtext';
import SelectButton from 'primevue/selectbutton';
import Tag from 'primevue/tag';
import Chip from 'primevue/chip';
import Button from 'primevue/button';
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
  { value: 'radio' as const, label: t('questionBuilder.radio'), icon: 'pi pi-circle' },
  { value: 'checkbox' as const, label: t('questionBuilder.checkbox'), icon: 'pi pi-check-square' },
  { value: 'text' as const, label: t('questionBuilder.text'), icon: 'pi pi-pencil' },
]);

const answerKeys = computed<string[]>(() => {
  if (localType.value === 'boolean') return ['yes', 'no'];
  if (localType.value === 'radio' || localType.value === 'checkbox') return localOptions.value.filter(o => o.trim());
  if (localType.value === 'text') return ['__text__'];
  return [];
});

function onTypeChange() {
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
    options: (localType.value === 'radio' || localType.value === 'checkbox') ? [...localOptions.value] : undefined,
    contentBlocks: { ...localContentBlocks.value },
  });
}
</script>

<style scoped>
.qi-card {
  border: 1px solid var(--me-border);
  border-radius: 12px;
  padding: 18px 20px;
  background: var(--me-bg-surface);
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: all 0.2s ease;
  position: relative;
}
.qi-card:hover {
  border-color: color-mix(in srgb, var(--me-accent) 30%, var(--me-border));
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.qi-card--child {
  border-left: 3px solid var(--me-accent);
}
.qi-card--child::before {
  content: '';
  position: absolute;
  left: -16px;
  top: 20px;
  width: 12px;
  height: 2px;
  background: var(--me-border);
}

/* Header */
.qi-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.qi-badge {
  font-weight: 700;
}
.qi-trigger-chip {
  font-size: 11px !important;
}
.qi-spacer { flex: 1; }

/* Fields */
.qi-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.qi-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.qi-input-full {
  width: 100%;
}

/* Type selector */
.qi-type-selector {
  align-self: flex-start;
}

/* Options */
.qi-options-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.qi-option-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.qi-opt-num {
  flex-shrink: 0;
  font-weight: 700;
}
.qi-add-opt-btn {
  align-self: flex-start;
}

/* Content blocks */
.qi-blocks {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.qi-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.qi-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.qi-answer-chip {
  font-weight: 600;
  font-size: 12px !important;
}
</style>
