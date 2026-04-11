<template>
  <Dialog v-model:visible="visible" modal :style="{ width: '520px' }" :closable="false">
    <template #container>
    <div class="disclaimer-card">
      <div class="disclaimer-header">
        <span class="mdi mdi-shield-alert-outline" style="font-size: 32px; color: #f59e0b"></span>
        <h3 class="disclaimer-title mono">{{ t('ai.disclaimer.title') }}</h3>
      </div>

      <div class="disclaimer-body">
        <p class="disclaimer-text">{{ message }}</p>
      </div>

      <div class="disclaimer-checkbox">
        <label class="disclaimer-check-label">
          <Checkbox v-model="dontShowAgain" :binary="true" />
          <span style="margin-left: 8px;">{{ t('ai.disclaimer.dontShowAgain') }}</span>
        </label>
      </div>

      <div class="disclaimer-actions">
        <button class="me-btn-secondary" @click="cancel">
          {{ t('ai.disclaimer.cancel') }}
        </button>
        <button class="me-btn-primary" @click="confirm">
          <span class="mdi mdi-robot-outline" style="font-size: 14px; margin-right: 4px;"></span>
          {{ t('ai.disclaimer.continue') }}
        </button>
      </div>
    </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Dialog from 'primevue/dialog';
import Checkbox from 'primevue/checkbox';
import api from '../services/api';

const { t } = useI18n();

const visible = ref(false);
const dontShowAgain = ref(false);
const message = ref('');
let resolvePromise: ((value: boolean) => void) | null = null;

async function checkAndShow(disclaimerMessage: string, isDismissed: boolean): Promise<boolean> {
  if (isDismissed) return true;

  message.value = disclaimerMessage;
  dontShowAgain.value = false;
  visible.value = true;

  return new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  });
}

function confirm() {
  visible.value = false;
  if (dontShowAgain.value) {
    api.put('/auth/preferences', { aiDisclaimerDismissed: true }).catch(() => {});
  }
  resolvePromise?.(true);
  resolvePromise = null;
}

function cancel() {
  visible.value = false;
  resolvePromise?.(false);
  resolvePromise = null;
}

defineExpose({ checkAndShow });
</script>

<style scoped>
.disclaimer-card { background: var(--me-bg-surface); border: 1px solid var(--me-border); padding: 24px; border-radius: 12px; }
.disclaimer-check-label { display: flex; align-items: center; cursor: pointer; font-size: 14px; color: var(--me-text-secondary); }
.disclaimer-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.disclaimer-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); }
.disclaimer-body { margin-bottom: 16px; }
.disclaimer-text { font-size: 14px; color: var(--me-text-secondary); line-height: 1.6; white-space: pre-line; }
.disclaimer-checkbox { margin-bottom: 16px; }
.disclaimer-actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
