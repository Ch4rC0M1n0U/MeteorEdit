<template>
  <Dialog
    v-model:visible="confirmState.visible"
    :style="{ width: '420px' }"
    modal
    :closable="false"
    :draggable="false"
    :pt="{
      root: { class: 'confirm-dialog-root' },
      mask: { class: 'confirm-dialog-mask' },
      content: { class: 'confirm-dialog-content' },
      header: { style: 'display: none' },
    }"
  >
    <div class="glass-card confirm-dialog" :class="'confirm-' + confirmState.variant">
      <div class="cd-header">
        <div class="cd-icon-wrap" :class="'cd-icon-' + confirmState.variant">
          <i :class="variantIcon" style="font-size: 20px"></i>
        </div>
        <h3 class="cd-title mono">{{ confirmState.title }}</h3>
        <button class="cd-close" @click="handleCancel">
          <i class="pi pi-times" style="font-size: 14px"></i>
        </button>
      </div>

      <div class="cd-body">
        <p class="cd-message">{{ confirmState.message }}</p>
        <div v-if="confirmState.prompt" class="cd-prompt">
          <label class="cd-prompt-label">{{ confirmState.promptLabel }}</label>
          <input
            ref="promptInput"
            v-model="confirmState.promptValue"
            :type="confirmState.promptType || 'text'"
            class="cd-prompt-input"
            @keyup.enter="handleConfirm"
            autofocus
          />
        </div>
      </div>

      <div class="cd-footer">
        <Button
          v-if="confirmState.cancelText"
          :label="confirmState.cancelText"
          severity="secondary"
          outlined
          class="cd-btn cd-btn-cancel"
          @click="handleCancel"
        />
        <Button
          :label="confirmState.confirmText"
          :class="['cd-btn', confirmBtnClass]"
          :disabled="confirmState.prompt && !confirmState.promptValue.trim()"
          @click="handleConfirm"
        />
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import { useConfirm } from '../../composables/useConfirm';

const { state: confirmState, handleConfirm, handleCancel } = useConfirm();
const promptInput = ref<HTMLInputElement | null>(null);

const variantIcon = computed(() => {
  switch (confirmState.variant) {
    case 'danger': return 'pi pi-exclamation-circle';
    case 'warning': return 'pi pi-exclamation-triangle';
    default: return 'pi pi-question-circle';
  }
});

const confirmBtnClass = computed(() => {
  switch (confirmState.variant) {
    case 'danger': return 'cd-btn-danger';
    case 'warning': return 'cd-btn-warning';
    default: return 'cd-btn-primary';
  }
});

watch(() => confirmState.visible, (val) => {
  if (val && confirmState.prompt) {
    nextTick(() => promptInput.value?.focus());
  }
});
</script>

<style>
/* Dialog root overrides — unscoped so PrimeVue passthrough classes apply */
.confirm-dialog-root.p-dialog {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  overflow: visible;
}
.confirm-dialog-content.p-dialog-content {
  background: transparent;
  padding: 0;
}
.confirm-dialog-mask {
  backdrop-filter: blur(4px);
}

.confirm-dialog {
  overflow: hidden;
}
.cd-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--me-border);
}
.cd-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cd-icon-default {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.cd-icon-danger {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
}
.cd-icon-warning {
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
}
.cd-title {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.cd-close {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s;
}
.cd-close:hover {
  color: var(--me-text-primary);
  background: var(--me-bg-elevated);
}
.cd-body {
  padding: 20px 24px;
}
.cd-message {
  font-size: 14px;
  line-height: 1.6;
  color: var(--me-text-secondary);
  white-space: pre-line;
}
.cd-prompt {
  margin-top: 16px;
}
.cd-prompt-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--me-text-muted);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.cd-prompt-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--me-radius-xs);
  border: 1px solid var(--me-border);
  background: var(--me-bg-deep);
  color: var(--me-text-primary);
  font-size: 14px;
  font-family: var(--me-font-body);
  outline: none;
  transition: border-color 0.15s;
}
.cd-prompt-input:focus {
  border-color: var(--me-accent);
  box-shadow: 0 0 0 2px var(--me-accent-glow);
}
.cd-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--me-border);
}
.cd-btn {
  padding: 8px 20px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.cd-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.cd-btn-cancel.p-button {
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
}
.cd-btn-cancel.p-button:hover {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
}
.cd-btn-primary.p-button {
  background: var(--me-accent);
  color: var(--me-bg-deep);
  border: none;
}
.cd-btn-primary.p-button:hover:not(:disabled) {
  box-shadow: 0 0 16px var(--me-accent-glow);
}
.cd-btn-danger.p-button {
  background: #ef4444;
  color: #fff;
  border: none;
}
.cd-btn-danger.p-button:hover:not(:disabled) {
  background: #dc2626;
  box-shadow: 0 0 16px rgba(239, 68, 68, 0.3);
}
.cd-btn-warning.p-button {
  background: #f59e0b;
  color: #fff;
  border: none;
}
.cd-btn-warning.p-button:hover:not(:disabled) {
  background: #d97706;
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.3);
}
</style>
