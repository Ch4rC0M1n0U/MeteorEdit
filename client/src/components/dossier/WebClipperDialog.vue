<template>
  <Dialog v-model:visible="model" modal :style="{ width: '520px' }" :closable="true">
    <template #container>
      <div class="wc-dialog glass-card">
        <div class="wc-header">
          <span class="mdi mdi-web wc-header-icon" style="font-size: 20px;"></span>
          <span>{{ $t('clipper.movedTitle') }}</span>
          <button class="wc-close" @click="model = false">
            <i class="pi pi-times" style="font-size: 18px;"></i>
          </button>
        </div>

        <div class="wc-body">
          <div class="wc-hero">
            <span class="mdi mdi-puzzle-outline" />
          </div>

          <p class="wc-lead">{{ $t('clipper.movedLead') }}</p>

          <ul class="wc-bullets">
            <li>
              <span class="mdi mdi-check-circle-outline"></span>
              <span>{{ $t('clipper.benefit1') }}</span>
            </li>
            <li>
              <span class="mdi mdi-check-circle-outline"></span>
              <span>{{ $t('clipper.benefit2') }}</span>
            </li>
            <li>
              <span class="mdi mdi-check-circle-outline"></span>
              <span>{{ $t('clipper.benefit3') }}</span>
            </li>
          </ul>

          <div class="wc-actions">
            <a :href="extensionDownloadUrl" class="me-btn me-btn-accent" target="_blank" rel="noopener">
              <i class="pi pi-download" style="font-size: 14px; margin-right: 6px;"></i>
              {{ $t('clipper.downloadExtension') }}
            </a>
            <button class="me-btn me-btn-ghost" @click="model = false">{{ $t('common.close') }}</button>
          </div>

          <p class="wc-note">{{ $t('clipper.howToUse') }}</p>
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Dialog from 'primevue/dialog';
import { SERVER_URL } from '../../services/api';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const model = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const extensionDownloadUrl = computed(() => `${SERVER_URL}/api/extension/download`);
</script>

<style scoped>
.wc-dialog { padding: 0; border-radius: 12px; overflow: hidden; }
.wc-header {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--me-border);
  font-weight: 700; font-size: 15px;
}
.wc-header-icon { color: var(--me-accent); }
.wc-close {
  margin-left: auto;
  background: transparent; border: none; cursor: pointer;
  color: var(--me-text-muted);
  padding: 4px 8px;
}
.wc-close:hover { color: var(--me-text-primary); }

.wc-body { padding: 24px; }
.wc-hero {
  width: 64px; height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, var(--me-accent) 0%, var(--me-accent-light, #6366f1) 100%);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 32px;
  margin: 0 auto 16px;
}
.wc-lead {
  font-size: 14px; color: var(--me-text-primary);
  text-align: center; margin: 0 0 18px; line-height: 1.5;
}
.wc-bullets {
  list-style: none; padding: 0; margin: 0 0 22px;
  display: flex; flex-direction: column; gap: 8px;
  font-size: 13px; color: var(--me-text-secondary);
}
.wc-bullets li { display: flex; align-items: flex-start; gap: 8px; }
.wc-bullets .mdi { color: var(--me-success, #22c55e); font-size: 16px; flex-shrink: 0; margin-top: 1px; }

.wc-actions {
  display: flex; gap: 8px; justify-content: center;
  margin-bottom: 14px;
}
.wc-note {
  text-align: center; font-size: 12px; color: var(--me-text-muted);
  margin: 0; padding-top: 12px; border-top: 1px dashed var(--me-border);
}
</style>
