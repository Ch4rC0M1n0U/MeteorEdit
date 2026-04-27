<template>
  <div class="profile-social-sessions">
    <!-- WhatsApp Web pairing block (Phone Scanner) -->
    <div class="pss-wa-block">
      <div class="pss-wa-header">
        <SocialIcon platform="whatsapp" :size="28" />
        <div class="pss-wa-title">
          <h3 class="mono">{{ $t('whatsappPairing.sectionTitle') }}</h3>
          <p>{{ $t('whatsappPairing.sectionSubtitle') }}</p>
        </div>
        <span :class="['pss-wa-badge', waStatus.isActive ? 'pss-wa-badge--on' : 'pss-wa-badge--off']">
          {{ waStatus.isActive ? $t('whatsappPairing.paired') : $t('whatsappPairing.notPaired') }}
        </span>
      </div>

      <div v-if="waStatus.isActive" class="pss-wa-info">
        <div v-if="waStatus.accountInfo?.name" class="pss-wa-row">
          <span class="pss-wa-label">{{ $t('whatsappPairing.accountName') }}</span>
          <span class="pss-wa-value mono">{{ waStatus.accountInfo.name }}</span>
        </div>
        <div v-if="waStatus.accountInfo?.phone" class="pss-wa-row">
          <span class="pss-wa-label">{{ $t('whatsappPairing.accountPhone') }}</span>
          <span class="pss-wa-value mono">+{{ waStatus.accountInfo.phone }}</span>
        </div>
        <div v-if="waStatus.pairedAt" class="pss-wa-row">
          <span class="pss-wa-label">{{ $t('whatsappPairing.pairedAt') }}</span>
          <span class="pss-wa-value mono">{{ formatDate(waStatus.pairedAt) }}</span>
        </div>
        <div v-if="waStatus.lastUsedAt" class="pss-wa-row">
          <span class="pss-wa-label">{{ $t('whatsappPairing.lastUsedAt') }}</span>
          <span class="pss-wa-value mono">{{ formatDate(waStatus.lastUsedAt) }}</span>
        </div>
      </div>

      <div class="pss-wa-actions">
        <Button
          v-if="!waStatus.isActive"
          :label="$t('whatsappPairing.pairButton')"
          icon="pi pi-qrcode"
          @click="pairingOpen = true"
        />
        <Button
          v-else
          :label="$t('whatsappPairing.repairButton')"
          icon="pi pi-refresh"
          outlined
          @click="pairingOpen = true"
        />
        <Button
          v-if="waStatus.isActive"
          :label="$t('whatsappPairing.unpairButton')"
          icon="pi pi-sign-out"
          severity="danger"
          outlined
          :loading="unpairing"
          @click="onUnpair"
        />
      </div>

      <p class="pss-wa-help">
        {{ $t('whatsappPairing.helpText') }}
      </p>
    </div>

    <hr class="pss-divider" />

    <!-- Existing cookies-based session manager -->
    <SocialSessionManager embedded />

    <WhatsappPairingDialog
      v-model:visible="pairingOpen"
      @paired="onPaired"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import api from '../../services/api';
import SocialIcon from '../common/SocialIcon.vue';
import SocialSessionManager from '../media/SocialSessionManager.vue';
import WhatsappPairingDialog from '../media/WhatsappPairingDialog.vue';

interface WaStatus {
  isActive: boolean;
  pairedAt?: string;
  accountInfo?: { phone?: string; name?: string };
  lastUsedAt?: string;
  isClientReady: boolean;
}

const toast = useToast();
const pairingOpen = ref(false);
const unpairing = ref(false);
const waStatus = ref<WaStatus>({ isActive: false, isClientReady: false });

async function loadStatus(): Promise<void> {
  try {
    const { data } = await api.get<WaStatus>('/social/whatsapp/status');
    waStatus.value = data;
  } catch (err) {
    console.error('[ProfileSocialSessions] failed to load WA status:', err);
  }
}

function onPaired(info: { phone?: string; name?: string }): void {
  waStatus.value = {
    isActive: true,
    pairedAt: new Date().toISOString(),
    accountInfo: info,
    isClientReady: true,
  };
  toast.add({
    severity: 'success',
    summary: 'WhatsApp paired',
    detail: info.name || info.phone || '',
    life: 4000,
  });
}

async function onUnpair(): Promise<void> {
  unpairing.value = true;
  try {
    await api.delete('/social/whatsapp/session');
    waStatus.value = { isActive: false, isClientReady: false };
    toast.add({ severity: 'info', summary: 'WhatsApp unpaired', life: 3000 });
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Failed',
      detail: err.message,
      life: 4000,
    });
  } finally {
    unpairing.value = false;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

onMounted(loadStatus);
</script>

<style scoped>
.profile-social-sessions {
  padding: 24px;
}

.pss-wa-block {
  border: 1px solid var(--me-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  background: var(--me-bg-elevated);
}

.pss-wa-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.pss-wa-title {
  flex: 1;
}
.pss-wa-title h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--me-text-primary);
  margin: 0 0 2px 0;
}
.pss-wa-title p {
  font-size: 12px;
  color: var(--me-text-muted);
  margin: 0;
}

.pss-wa-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.pss-wa-badge--on {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
}
.pss-wa-badge--off {
  color: #6b7280;
  background: rgba(107, 114, 128, 0.12);
}

.pss-wa-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: var(--me-bg-surface);
  border-radius: 8px;
  margin-bottom: 16px;
}
.pss-wa-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.pss-wa-label {
  color: var(--me-text-secondary);
}
.pss-wa-value {
  color: var(--me-text-primary);
  font-weight: 500;
}

.pss-wa-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.pss-wa-help {
  font-size: 12px;
  color: var(--me-text-muted);
  margin: 0;
  line-height: 1.5;
}

.pss-divider {
  border: none;
  border-top: 1px solid var(--me-border);
  margin: 24px 0;
}
</style>
