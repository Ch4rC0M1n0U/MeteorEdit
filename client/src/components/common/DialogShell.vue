<!--
  DialogShell.vue — wrapper PrimeVue Dialog standardisé v3
  Tous les modals héritent de ce shell pour avoir le même header/body/footer.
-->
<script setup lang="ts">
import { computed } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  title: string;
  icon?: string;
  variant?: 'default' | 'danger' | 'warning' | 'info' | 'success';
  width?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
  /** Hide footer slot rendering (footer becomes empty) */
  noFooter?: boolean;
}>(), {
  variant: 'default',
  width: 'md',
  closable: true,
  noFooter: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'close'): void;
}>();

const widthPx = computed(() => ({
  sm: '380px', md: '520px', lg: '720px', xl: '960px',
}[props.width]));

const iconColor = computed(() => ({
  default: 'var(--ink)',
  danger: 'var(--err)',
  warning: 'var(--warn)',
  info: 'var(--info)',
  success: 'var(--ok)',
}[props.variant]));

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}
</script>

<template>
  <Dialog
    :visible="modelValue"
    @update:visible="(v) => emit('update:modelValue', v)"
    modal
    :closable="false"
    :draggable="false"
    :style="{ width: widthPx }"
    :pt="{ root: { class: 'v3-dialog ds-' + variant } }"
  >
    <template #header>
      <div class="ds__header">
        <span v-if="icon" class="ds__icon" :style="{ color: iconColor }">
          <i class="pi" :class="icon" />
        </span>
        <h2 class="ds__title">{{ title }}</h2>
        <Button
          v-if="closable"
          icon="pi pi-times"
          text rounded size="small"
          class="ds__close"
          aria-label="Close"
          @click="handleClose"
        />
      </div>
    </template>

    <div class="ds__body">
      <slot />
    </div>

    <template v-if="!noFooter" #footer>
      <div class="ds__footer">
        <slot name="footer" :close="handleClose" />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.ds__header {
  display: flex; align-items: center; gap: 10px;
  flex: 1; min-width: 0;
}
.ds__icon {
  width: 28px; height: 28px;
  display: grid; place-items: center;
  border-radius: var(--r-sm);
  background: var(--bg-3);
  flex-shrink: 0;
}
.ds__icon .pi { font-size: 16px; }
.ds-danger  .ds__icon { background: var(--err-soft); }
.ds-warning .ds__icon { background: var(--warn-soft); }
.ds-info    .ds__icon { background: var(--info-soft); }
.ds-success .ds__icon { background: var(--ok-soft); }

.ds__title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.005em;
  color: var(--ink);
  margin: 0;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ds__close :deep(.p-button) {
  width: 28px; height: 28px;
  padding: 0;
  color: var(--ink-3);
}
.ds__close :deep(.p-button:hover) { background: var(--bg-3) !important; color: var(--ink); }

.ds__body { color: var(--ink-2); }
.ds__footer { display: contents; }
</style>
