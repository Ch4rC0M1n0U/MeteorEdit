<template>
  <Dialog
    :visible="true"
    modal
    :header="template.title"
    :closable="true"
    @update:visible="(v: boolean) => { if (!v) emit('cancel') }"
    class="tw-dialog"
    :style="{ width: '580px' }"
    :breakpoints="{ '640px': '95vw' }"
  >
    <template #header>
      <div class="tw-header">
        <div class="tw-header-left">
          <div class="tw-icon-wrap">
            <i class="pi pi-file-edit" />
          </div>
          <div>
            <h3 class="tw-title">{{ template.title }}</h3>
            <Tag :value="t('templateWizard.stepOf', { current: currentStepIndex + 1, total: activeQuestions.length })" severity="info" rounded class="tw-step-tag" />
          </div>
        </div>
      </div>
    </template>

    <!-- Progress bar -->
    <div class="tw-progress">
      <div class="tw-progress-fill" :style="{ width: progressPercent + '%' }" />
    </div>

    <!-- Question content -->
    <div class="tw-body" v-if="currentQuestion">
      <p class="tw-question-label">{{ currentQuestion.label }}</p>

      <!-- Boolean -->
      <div v-if="currentQuestion.type === 'boolean'" class="tw-boolean-row">
        <button
          class="tw-choice-btn tw-choice-yes"
          :class="{ active: answers[currentQuestion.id] === 'yes' }"
          @click="setAnswer('yes')"
          type="button"
        >
          <i class="pi pi-check" style="font-size: 18px;" />
          {{ t('templateWizard.yes') }}
        </button>
        <button
          class="tw-choice-btn tw-choice-no"
          :class="{ active: answers[currentQuestion.id] === 'no' }"
          @click="setAnswer('no')"
          type="button"
        >
          <i class="pi pi-times" style="font-size: 18px;" />
          {{ t('templateWizard.no') }}
        </button>
      </div>

      <!-- Radio (single choice) -->
      <div v-if="currentQuestion.type === 'radio'" class="tw-options-list">
        <button
          v-for="opt in currentQuestion.options"
          :key="opt"
          class="tw-option-btn"
          :class="{ active: answers[currentQuestion.id] === opt }"
          @click="setAnswer(opt)"
          type="button"
        >
          <i class="pi" :class="answers[currentQuestion.id] === opt ? 'pi-circle-fill' : 'pi-circle'" style="font-size: 16px;" />
          {{ opt }}
        </button>
      </div>

      <!-- Checkbox (multiple choice) -->
      <div v-if="currentQuestion.type === 'checkbox'" class="tw-options-list">
        <button
          v-for="opt in currentQuestion.options"
          :key="opt"
          class="tw-option-btn"
          :class="{ active: getCheckboxValues(currentQuestion.id).includes(opt) }"
          @click="toggleCheckbox(currentQuestion.id, opt)"
          type="button"
        >
          <i class="pi" :class="getCheckboxValues(currentQuestion.id).includes(opt) ? 'pi-check-square' : 'pi-stop'" style="font-size: 16px;" />
          {{ opt }}
        </button>
      </div>

      <!-- Text -->
      <div v-if="currentQuestion.type === 'text'" class="tw-text-field">
        <Textarea
          v-model="answers[currentQuestion.id]"
          :placeholder="t('templateWizard.textPlaceholder')"
          rows="4"
          autoResize
          class="tw-textarea"
        />
      </div>
    </div>

    <template #footer>
      <div class="tw-footer">
        <Button
          v-if="currentStepIndex > 0"
          :label="t('templateWizard.back')"
          icon="pi pi-arrow-left"
          severity="secondary"
          outlined
          @click="goBack"
        />
        <div class="tw-spacer" />
        <Button
          v-if="currentStepIndex < activeQuestions.length - 1"
          :label="t('templateWizard.next')"
          icon="pi pi-arrow-right"
          iconPos="right"
          :disabled="!hasCurrentAnswer"
          @click="goNext"
        />
        <Button
          v-else
          :label="generating ? t('templateWizard.generating') : t('templateWizard.finish')"
          :icon="generating ? 'pi pi-spin pi-spinner' : 'pi pi-check'"
          :disabled="!hasCurrentAnswer || generating"
          severity="success"
          @click="handleFinish"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import type { NoteTemplate, TemplateQuestion } from '../../types';
import { useTemplateStore } from '../../stores/template';

const { t } = useI18n();
const templateStore = useTemplateStore();

const props = defineProps<{
  template: NoteTemplate;
  dossierId: string;
}>();

const emit = defineEmits<{
  complete: [result: { content: any; title: string }];
  cancel: [];
}>();

const questions = computed(() => props.template.interactiveQuestions || []);
const answers = reactive<Record<string, string>>({});
const currentStepIndex = ref(0);
const generating = ref(false);

// Checkbox helpers: store as "val1||val2||val3"
function getCheckboxValues(questionId: string): string[] {
  const raw = answers[questionId];
  if (!raw) return [];
  return raw.split('||').filter(Boolean);
}

function toggleCheckbox(questionId: string, opt: string) {
  const current = getCheckboxValues(questionId);
  const idx = current.indexOf(opt);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(opt);
  }
  answers[questionId] = current.join('||');
}

// Compute which questions are active based on answers so far
const activeQuestions = computed(() => {
  const result: TemplateQuestion[] = [];
  const sorted = [...questions.value].sort((a, b) => a.order - b.order);

  function addWithChildren(q: TemplateQuestion) {
    result.push(q);
    const answer = answers[q.id];
    if (answer) {
      // For checkbox, children trigger on any matched answer value
      const answerValues = q.type === 'checkbox' ? answer.split('||').filter(Boolean) : [answer];
      for (const av of answerValues) {
        const children = sorted.filter(c => c.parentId === q.id && c.parentAnswerValue === av);
        for (const child of children) {
          addWithChildren(child);
        }
      }
    }
  }

  const roots = sorted.filter(q => !q.parentId);
  for (const root of roots) {
    addWithChildren(root);
  }
  return result;
});

const currentQuestion = computed(() => activeQuestions.value[currentStepIndex.value] || null);

const hasCurrentAnswer = computed(() => {
  if (!currentQuestion.value) return false;
  const answer = answers[currentQuestion.value.id];
  return answer !== undefined && answer !== '';
});

const progressPercent = computed(() => {
  if (!activeQuestions.value.length) return 0;
  return ((currentStepIndex.value + 1) / activeQuestions.value.length) * 100;
});

function setAnswer(value: string) {
  if (!currentQuestion.value) return;
  answers[currentQuestion.value.id] = value;
}

function goNext() {
  if (currentStepIndex.value < activeQuestions.value.length - 1) {
    currentStepIndex.value++;
  }
}

function goBack() {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--;
  }
}

async function handleFinish() {
  generating.value = true;
  try {
    const result = await templateStore.compileTemplate(props.template._id, props.dossierId, { ...answers });
    emit('complete', result);
  } catch {
    generating.value = false;
  }
}
</script>

<style scoped>
.tw-header {
  display: flex;
  align-items: center;
  width: 100%;
}
.tw-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.tw-icon-wrap {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--me-accent-glow), transparent);
  border: 1px solid var(--me-accent);
  color: var(--me-accent);
  font-size: 18px;
  flex-shrink: 0;
}
.tw-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin: 0;
}
.tw-step-tag {
  margin-top: 4px;
}

/* Progress */
.tw-progress {
  height: 3px;
  background: var(--me-bg-elevated);
  margin: 0 -1.25rem;
}
.tw-progress-fill {
  height: 100%;
  background: var(--me-accent);
  transition: width 0.3s ease;
  border-radius: 0 2px 2px 0;
}

/* Body */
.tw-body {
  padding: 20px 0;
}
.tw-question-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin-bottom: 20px;
  line-height: 1.4;
}

/* Boolean */
.tw-boolean-row {
  display: flex;
  gap: 12px;
}
.tw-choice-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border: 2px solid var(--me-border);
  border-radius: 12px;
  background: var(--me-bg-elevated);
  color: var(--me-text-secondary);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.tw-choice-btn:hover { border-color: var(--me-accent); color: var(--me-accent); }
.tw-choice-yes.active { border-color: var(--me-accent); background: var(--me-accent-glow); color: var(--me-accent); }
.tw-choice-no.active { border-color: var(--me-error); background: rgba(248, 113, 113, 0.1); color: var(--me-error); }

/* Radio & Checkbox options */
.tw-options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tw-option-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 2px solid var(--me-border);
  border-radius: 12px;
  background: var(--me-bg-elevated);
  color: var(--me-text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}
.tw-option-btn:hover { border-color: var(--me-accent); }
.tw-option-btn.active { border-color: var(--me-accent); background: var(--me-accent-glow); color: var(--me-accent); font-weight: 600; }

/* Text */
.tw-text-field { width: 100%; }
.tw-textarea { width: 100%; }

/* Footer */
.tw-footer {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
}
.tw-spacer { flex: 1; }
</style>
