<template>
  <v-dialog v-model="confirmState.visible" max-width="420" persistent>
    <div class="glass-card confirm-dialog" :class="'confirm-' + confirmState.variant">
      <div class="cd-header">
        <div class="cd-icon-wrap" :class="'cd-icon-' + confirmState.variant">
          <v-icon size="22">{{ variantIcon }}</v-icon>
        </div>
        <h3 class="cd-title mono">{{ confirmState.title }}</h3>
        <button class="cd-close" @click="handleCancel">
          <v-icon size="16">mdi-close</v-icon>
        </button>
      </div>

      <div class="cd-body">
        <p class="cd-message">{{ confirmState.message }}</p>
        <div v-if="confirmState.prompt" class="cd-prompt">
          <label class="cd-prompt-label">{{ confirmState.promptLabel }}</label>
          <input
            ref="promptInput"
            v-model="confirmState.promptValue"
            class="cd-prompt-input"
            @keyup.enter="handleConfirm"
            autofocus
          />
        </div>
      </div>

      <div class="cd-footer">
        <button class="cd-btn cd-btn-cancel" @click="handleCancel">
          {{ confirmState.cancelText }}
        </button>
        <button
          class="cd-btn"
          :class="confirmBtnClass"
          @click="handleConfirm"
          :disabled="confirmState.prompt && !confirmState.promptValue.trim()"
        >
          {{ confirmState.confirmText }}
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick } from 'vue';
import { useConfirm } from '../../composables/useConfirm';

const { state: confirmState, handleConfirm, handleCancel } = useConfirm();
const promptInput = ref<HTMLInputElement | null>(null);

const variantIcon = computed(() => {
  switch (confirmState.variant) {
    case 'danger': return 'mdi-alert-circle-outline';
    case 'warning': return 'mdi-alert-outline';
    default: return 'mdi-help-circle-outline';
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
  border-radius: var(--me-radius-xs);
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
.cd-btn-cancel {
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
}
.cd-btn-cancel:hover {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
}
.cd-btn-primary {
  background: var(--me-accent);
  color: var(--me-bg-deep);
}
.cd-btn-primary:hover:not(:disabled) {
  box-shadow: 0 0 16px var(--me-accent-glow);
}
.cd-btn-danger {
  background: #ef4444;
  color: #fff;
}
.cd-btn-danger:hover:not(:disabled) {
  background: #dc2626;
  box-shadow: 0 0 16px rgba(239, 68, 68, 0.3);
}
.cd-btn-warning {
  background: #f59e0b;
  color: #fff;
}
.cd-btn-warning:hover:not(:disabled) {
  background: #d97706;
  box-shadow: 0 0 16px rgba(245, 158, 11, 0.3);
}
</style>
