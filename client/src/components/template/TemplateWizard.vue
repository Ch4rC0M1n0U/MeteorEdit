<template>
  <div class="tw-overlay" @click.self="emit('cancel')">
    <div class="tw-dialog glass-card">
      <!-- Header -->
      <div class="tw-header">
        <h3 class="tw-title mono">{{ template.title }}</h3>
        <span class="tw-step mono">{{ t('templateWizard.stepOf', { current: currentStepIndex + 1, total: activeQuestions.length }) }}</span>
        <button class="tw-close" @click="emit('cancel')" type="button">
          <i class="pi pi-times" style="font-size: 16px;" />
        </button>
      </div>

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
            class="tw-bool-btn"
            :class="{ active: answers[currentQuestion.id] === 'yes' }"
            @click="setAnswer('yes')"
            type="button"
          >
            <i class="pi pi-check" style="font-size: 18px;" />
            {{ t('templateWizard.yes') }}
          </button>
          <button
            class="tw-bool-btn tw-bool-no"
            :class="{ active: answers[currentQuestion.id] === 'no' }"
            @click="setAnswer('no')"
            type="button"
          >
            <i class="pi pi-times" style="font-size: 18px;" />
            {{ t('templateWizard.no') }}
          </button>
        </div>

        <!-- Select -->
        <div v-if="currentQuestion.type === 'select'" class="tw-select-list">
          <button
            v-for="opt in currentQuestion.options"
            :key="opt"
            class="tw-select-btn"
            :class="{ active: answers[currentQuestion.id] === opt }"
            @click="setAnswer(opt)"
            type="button"
          >
            <i class="pi" :class="answers[currentQuestion.id] === opt ? 'pi-check-circle' : 'pi-circle'" style="font-size: 16px;" />
            {{ opt }}
          </button>
        </div>

        <!-- Text -->
        <div v-if="currentQuestion.type === 'text'" class="tw-text-field">
          <textarea
            v-model="answers[currentQuestion.id]"
            class="tw-textarea"
            :placeholder="t('templateWizard.textPlaceholder')"
            rows="4"
          />
        </div>
      </div>

      <!-- Footer -->
      <div class="tw-footer">
        <button
          v-if="currentStepIndex > 0"
          class="tw-btn-ghost"
          @click="goBack"
          type="button"
        >
          <i class="pi pi-arrow-left" style="font-size: 13px;" />
          {{ t('templateWizard.back') }}
        </button>
        <div class="tw-spacer" />
        <button
          v-if="currentStepIndex < activeQuestions.length - 1"
          class="tw-btn-primary"
          @click="goNext"
          :disabled="!hasCurrentAnswer"
          type="button"
        >
          {{ t('templateWizard.next') }}
          <i class="pi pi-arrow-right" style="font-size: 13px;" />
        </button>
        <button
          v-else
          class="tw-btn-primary"
          @click="handleFinish"
          :disabled="!hasCurrentAnswer || generating"
          type="button"
        >
          <i v-if="generating" class="pi pi-spin pi-spinner" style="font-size: 14px;" />
          {{ generating ? t('templateWizard.generating') : t('templateWizard.finish') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
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

// Compute which questions are active based on answers so far
const activeQuestions = computed(() => {
  const result: TemplateQuestion[] = [];
  const sorted = [...questions.value].sort((a, b) => a.order - b.order);

  function addWithChildren(q: TemplateQuestion) {
    result.push(q);
    // Add children that match the current answer
    const answer = answers[q.id];
    if (answer) {
      const children = sorted.filter(c => c.parentId === q.id && c.parentAnswerValue === answer);
      for (const child of children) {
        addWithChildren(child);
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
.tw-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}
.tw-dialog {
  width: 560px;
  max-width: 95vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tw-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--me-border);
}
.tw-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--me-text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tw-step {
  font-size: 11px;
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.tw-close {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s;
}
.tw-close:hover { color: var(--me-text-primary); background: var(--me-accent-glow); }
.tw-progress {
  height: 3px;
  background: var(--me-bg-elevated);
}
.tw-progress-fill {
  height: 100%;
  background: var(--me-accent);
  transition: width 0.3s ease;
  border-radius: 0 2px 2px 0;
}
.tw-body {
  padding: 24px 20px;
  flex: 1;
  overflow-y: auto;
}
.tw-question-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin-bottom: 20px;
  line-height: 1.4;
}
/* Boolean buttons */
.tw-boolean-row {
  display: flex;
  gap: 12px;
}
.tw-bool-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border: 2px solid var(--me-border);
  border-radius: 10px;
  background: var(--me-bg-surface);
  color: var(--me-text-secondary);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.tw-bool-btn:hover { border-color: var(--me-accent); color: var(--me-accent); }
.tw-bool-btn.active { border-color: var(--me-accent); background: var(--me-accent-glow); color: var(--me-accent); }
.tw-bool-no.active { border-color: var(--me-error); background: rgba(248, 113, 113, 0.1); color: var(--me-error); }
/* Select buttons */
.tw-select-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tw-select-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border: 2px solid var(--me-border);
  border-radius: 10px;
  background: var(--me-bg-surface);
  color: var(--me-text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}
.tw-select-btn:hover { border-color: var(--me-accent); }
.tw-select-btn.active { border-color: var(--me-accent); background: var(--me-accent-glow); color: var(--me-accent); font-weight: 600; }
/* Text field */
.tw-text-field { width: 100%; }
.tw-textarea {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid var(--me-border);
  border-radius: 10px;
  background: var(--me-bg-surface);
  color: var(--me-text-primary);
  font-family: var(--me-font-body);
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
}
.tw-textarea:focus { border-color: var(--me-accent); }
.tw-textarea::placeholder { color: var(--me-text-muted); }
/* Footer */
.tw-footer {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid var(--me-border);
  gap: 8px;
}
.tw-spacer { flex: 1; }
.tw-btn-ghost {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border-radius: 8px;
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.tw-btn-ghost:hover { border-color: var(--me-border-hover); color: var(--me-text-primary); }
.tw-btn-primary {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 18px;
  border-radius: 8px;
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.tw-btn-primary:hover { box-shadow: 0 0 16px var(--me-accent-glow); }
.tw-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
