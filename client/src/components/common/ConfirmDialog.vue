<!--
  ConfirmDialog.vue — global confirm v3 (compatible useConfirm() existant)
  Le composable useConfirm() expose : state.visible, .variant, .title, .message,
    .prompt, .promptLabel, .promptType, .promptValue, .confirmText, .cancelText
  + handleConfirm / handleCancel
  Ce composant garde EXACTEMENT la même API publique — aucun changement côté appelants.
-->
<script setup lang="ts">
import { computed, watch, ref, nextTick } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import DialogShell from './DialogShell.vue';
import { useConfirm } from '@/composables/useConfirm';

const { state, handleConfirm, handleCancel } = useConfirm();
const promptInput = ref<HTMLInputElement | null>(null);

const variant = computed<'default' | 'danger' | 'warning' | 'info'>(() => {
  if (state.variant === 'danger') return 'danger';
  if (state.variant === 'warning') return 'warning';
  if (state.variant === 'info') return 'info';
  return 'default';
});

const icon = computed(() => ({
  default: 'pi-question-circle',
  danger: 'pi-exclamation-circle',
  warning: 'pi-exclamation-triangle',
  info: 'pi-info-circle',
}[variant.value]));

watch(() => state.visible, async (v) => {
  if (v && state.prompt) {
    await nextTick();
    promptInput.value?.focus();
  }
});
</script>

<template>
  <DialogShell
    :modelValue="state.visible"
    @update:modelValue="(v) => !v && handleCancel()"
    :title="state.title"
    :icon="icon"
    :variant="variant"
    width="sm"
  >
    <p class="confirm__msg">{{ state.message }}</p>
    <div v-if="state.prompt" class="confirm__prompt">
      <label class="confirm__label">{{ state.promptLabel }}</label>
      <InputText
        ref="promptInput"
        v-model="state.promptValue"
        :type="state.promptType || 'text'"
        fluid
        @keyup.enter="handleConfirm"
      />
    </div>

    <template #footer="{ close }">
      <Button
        v-if="state.cancelText"
        :label="state.cancelText"
        severity="secondary"
        text
        @click="close()"
      />
      <Button
        :label="state.confirmText"
        :severity="variant === 'danger' ? 'danger' : variant === 'warning' ? 'warn' : 'primary'"
        :disabled="state.prompt && !state.promptValue?.trim()"
        @click="handleConfirm"
      />
    </template>
  </DialogShell>
</template>

<style scoped>
.confirm__msg {
  font-size: 13px;
  line-height: 1.55;
  color: var(--ink-2);
  margin: 0;
}
.confirm__prompt {
  margin-top: 14px;
  display: flex; flex-direction: column;
  gap: 6px;
}
.confirm__label {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-3);
}
</style>
