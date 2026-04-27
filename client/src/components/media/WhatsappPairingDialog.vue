<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    modal
    :closable="!pairing"
    :style="{ width: '480px' }"
    :pt="{ content: { class: 'wpd-content' } }"
  >
    <template #header>
      <div class="wpd-header">
        <SocialIcon platform="whatsapp" :size="24" />
        <h2 class="wpd-title">{{ $t('whatsappPairing.title') }}</h2>
      </div>
    </template>

    <div class="wpd-body">
      <!-- State: loading -->
      <div v-if="state === 'loading'" class="wpd-loading">
        <ProgressSpinner style="width: 48px; height: 48px;" />
        <p class="wpd-text">{{ $t('whatsappPairing.initializing') }}</p>
      </div>

      <!-- State: awaiting QR scan -->
      <div v-else-if="state === 'awaiting_qr' && qrPng" class="wpd-qr-state">
        <p class="wpd-text">{{ $t('whatsappPairing.scanInstructions') }}</p>
        <div class="wpd-qr-wrap">
          <img :src="qrPng" alt="QR code" class="wpd-qr" />
        </div>
        <ol class="wpd-steps">
          <li>{{ $t('whatsappPairing.step1') }}</li>
          <li>{{ $t('whatsappPairing.step2') }}</li>
          <li>{{ $t('whatsappPairing.step3') }}</li>
        </ol>
        <p class="wpd-warning mono">⚠ {{ $t('whatsappPairing.dedicatedAccount') }}</p>
      </div>

      <!-- State: connecting after scan -->
      <div v-else-if="state === 'connecting'" class="wpd-loading">
        <ProgressSpinner style="width: 48px; height: 48px;" />
        <p class="wpd-text">{{ $t('whatsappPairing.connecting') }}</p>
      </div>

      <!-- State: ready -->
      <div v-else-if="state === 'ready'" class="wpd-success">
        <i class="pi pi-check-circle" style="font-size: 48px; color: #10b981;" />
        <p class="wpd-text">{{ $t('whatsappPairing.success') }}</p>
        <div v-if="accountInfo" class="wpd-account mono">
          <div v-if="accountInfo.name">{{ accountInfo.name }}</div>
          <div v-if="accountInfo.phone">+{{ accountInfo.phone }}</div>
        </div>
      </div>

      <!-- State: error -->
      <div v-else-if="state === 'error'" class="wpd-error">
        <i class="pi pi-times-circle" style="font-size: 48px; color: #ef4444;" />
        <p class="wpd-text">{{ errorMessage || $t('whatsappPairing.failed') }}</p>
        <Button
          :label="$t('whatsappPairing.retry')"
          icon="pi pi-refresh"
          @click="startPairing"
        />
      </div>
    </div>

    <template #footer>
      <Button
        v-if="state === 'ready'"
        :label="$t('common.close')"
        icon="pi pi-check"
        @click="$emit('update:visible', false)"
      />
      <Button
        v-else-if="state !== 'error'"
        :label="$t('common.cancel')"
        text
        :disabled="state === 'connecting'"
        @click="onCancel"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import QRCode from 'qrcode';
import api from '../../services/api';
import SocialIcon from '../common/SocialIcon.vue';

type PairingState = 'idle' | 'loading' | 'awaiting_qr' | 'connecting' | 'ready' | 'error';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{
  'update:visible': [value: boolean];
  'paired': [info: { phone?: string; name?: string }];
}>();

const state = ref<PairingState>('idle');
const qrPng = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const accountInfo = ref<{ phone?: string; name?: string } | null>(null);
const pairing = ref(false);
let eventSource: EventSource | null = null;

async function startPairing(): Promise<void> {
  state.value = 'loading';
  errorMessage.value = null;
  qrPng.value = null;
  pairing.value = true;

  try {
    await api.post('/social/whatsapp/pair');
    openQrStream();
  } catch (err: unknown) {
    state.value = 'error';
    errorMessage.value = err instanceof Error ? err.message : 'Failed to start pairing';
    pairing.value = false;
  }
}

function openQrStream(): void {
  closeStream();

  // Build URL with token for SSE auth (EventSource doesn't support custom headers)
  const token = localStorage.getItem('accessToken') || '';
  const baseUrl = api.defaults.baseURL || '';
  const url = `${baseUrl}/social/whatsapp/qr?_t=${Date.now()}`;

  // EventSource doesn't allow custom headers; we rely on cookie-based auth
  // OR pass token via querystring (less secure but works for short-lived stream)
  // Server middleware reads ?token= as fallback for SSE
  eventSource = new EventSource(`${url}&token=${encodeURIComponent(token)}`, {
    withCredentials: true,
  });

  eventSource.addEventListener('qr', async (event) => {
    const { qr } = JSON.parse((event as MessageEvent).data);
    try {
      qrPng.value = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
      state.value = 'awaiting_qr';
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  });

  eventSource.addEventListener('ready', (event) => {
    const info = JSON.parse((event as MessageEvent).data);
    accountInfo.value = info;
    state.value = 'ready';
    pairing.value = false;
    emit('paired', info);
    closeStream();
  });

  eventSource.addEventListener('auth_failure', (event) => {
    const { message } = JSON.parse((event as MessageEvent).data);
    state.value = 'error';
    errorMessage.value = message || 'Authentication failed';
    pairing.value = false;
    closeStream();
  });

  eventSource.addEventListener('disconnected', () => {
    if (state.value !== 'ready') {
      state.value = 'error';
      errorMessage.value = 'Disconnected before pairing completed';
    }
    pairing.value = false;
    closeStream();
  });

  eventSource.addEventListener('error', () => {
    if (state.value === 'awaiting_qr' || state.value === 'connecting') {
      // Could be transient, let EventSource retry
      return;
    }
    state.value = 'error';
    errorMessage.value = errorMessage.value || 'Stream error';
    pairing.value = false;
  });
}

function closeStream(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

async function onCancel(): Promise<void> {
  closeStream();
  if (state.value !== 'idle') {
    try {
      await api.delete('/social/whatsapp/session');
    } catch {
      // ignore
    }
  }
  state.value = 'idle';
  pairing.value = false;
  emit('update:visible', false);
}

watch(() => props.visible, (v) => {
  if (v && state.value === 'idle') {
    startPairing();
  } else if (!v) {
    closeStream();
    state.value = 'idle';
    qrPng.value = null;
    errorMessage.value = null;
    accountInfo.value = null;
    pairing.value = false;
  }
});

onUnmounted(() => closeStream());
</script>

<style scoped>
.wpd-header { display: flex; align-items: center; gap: 10px; }
.wpd-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); margin: 0; }

:deep(.wpd-content) { padding: 20px !important; }

.wpd-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-height: 320px;
  justify-content: center;
}

.wpd-loading, .wpd-success, .wpd-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
}

.wpd-text {
  text-align: center;
  font-size: 14px;
  color: var(--me-text-primary);
  margin: 0;
}

.wpd-qr-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.wpd-qr-wrap {
  background: #fff;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--me-border);
}
.wpd-qr {
  display: block;
  width: 256px;
  height: 256px;
}

.wpd-steps {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--me-text-secondary);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wpd-warning {
  font-size: 12px;
  color: #b45309;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid #f59e0b;
  border-radius: 6px;
  padding: 8px 10px;
  margin: 0;
}

.wpd-account {
  font-size: 13px;
  color: var(--me-text-secondary);
  text-align: center;
  background: var(--me-bg-surface);
  padding: 8px 12px;
  border-radius: 6px;
}
</style>
