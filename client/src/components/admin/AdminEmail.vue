<template>
  <div class="admin-email">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <i class="pi pi-envelope" style="font-size: 20px; margin-right: 8px;"></i>
        Email / SMTP
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.emailSubtitle') }}</p>
    </div>

    <ProgressBar v-if="loading" mode="indeterminate" style="margin-bottom: 16px;" />

    <!-- Configuration SMTP -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <i class="pi pi-envelope" style="font-size: 18px; color: var(--me-accent);"></i>
        <h3 class="sec-card-title mono">{{ $t('admin.smtpConfig') }}</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.smtpServerLabel') }}</p>
          <p class="sec-desc">{{ $t('admin.smtpServerDesc') }}</p>
        </div>
        <InputText v-model="form.smtpHost"
          placeholder="smtp.gmail.com"
          style="max-width: 280px;"
          @blur="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.smtpPort') }}</p>
          <p class="sec-desc">{{ $t('admin.smtpPortDesc') }}</p>
        </div>
        <InputText v-model.number="form.smtpPort"
          type="number"
          style="max-width: 120px;"
          :min="1"
          :max="65535"
          @blur="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.secureTlsLabel') }}</p>
          <p class="sec-desc">{{ $t('admin.secureTlsDesc') }}</p>
        </div>
        <ToggleSwitch v-model="form.smtpSecure" @update:model-value="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.smtpUserLabel') }}</p>
          <p class="sec-desc">{{ $t('admin.smtpUserDesc') }}</p>
        </div>
        <InputText v-model="form.smtpUser"
          style="max-width: 280px;"
          @blur="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.smtpPasswordLabel') }}</p>
          <p class="sec-desc">{{ $t('admin.smtpPasswordDesc') }}</p>
        </div>
        <InputText v-model="form.smtpPass"
          type="password"
          style="max-width: 280px;"
          @blur="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.senderFrom') }}</p>
          <p class="sec-desc">{{ $t('admin.senderFromDesc') }}</p>
        </div>
        <InputText v-model="form.smtpFrom"
          placeholder="noreply@monapp.fr"
          style="max-width: 280px;"
          @blur="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.testConfig') }}</p>
          <p class="sec-desc">{{ $t('admin.testConfigDesc') }}</p>
        </div>
        <button class="me-btn-ghost"
          :disabled="testing"
          @click="testEmail">
          <span class="mdi mdi-email-fast-outline" style="font-size: 16px; margin-right: 4px;"></span>
          Tester la connexion
        </button>
      </div>
    </div>

    <!-- snackbar removed during migration -->
    <!-- snackbar removed during migration -->
    <!-- snackbar removed during migration -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';
import ProgressBar from 'primevue/progressbar';
import InputText from 'primevue/inputtext';
import ToggleSwitch from 'primevue/toggleswitch';

const { t } = useI18n();

const loading = ref(true);
const saved = ref(false);
const testing = ref(false);
const testSuccess = ref(false);
const testError = ref(false);
const testErrorMessage = ref('');

const form = ref({
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
});

onMounted(async () => {
  try {
    const { data } = await api.get('/settings/branding');
    form.value.smtpHost = data.smtpHost || '';
    form.value.smtpPort = data.smtpPort || 587;
    form.value.smtpSecure = !!data.smtpSecure;
    form.value.smtpUser = data.smtpUser || '';
    form.value.smtpPass = data.smtpPass || '';
    form.value.smtpFrom = data.smtpFrom || '';
  } catch {} finally {
    loading.value = false;
  }
});

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await api.put('/admin/settings', form.value);
      saved.value = true;
    } catch {}
  }, 300);
}

async function testEmail() {
  testing.value = true;
  try {
    await api.post('/admin/settings/test-email');
    testSuccess.value = true;
  } catch (err: any) {
    testErrorMessage.value = err?.response?.data?.message || t('admin.testEmailError');
    testError.value = true;
  } finally {
    testing.value = false;
  }
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.admin-section-subtitle { font-size: 13px; color: var(--me-text-muted); margin-top: 4px; font-family: var(--me-font-mono); }

.sec-card { padding: 20px; margin-bottom: 16px; }
.sec-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--me-border); }
.sec-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); }

.sec-option { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 4px 0; }
.sec-label { font-size: 13px; font-weight: 600; color: var(--me-text-primary); }
.sec-desc { font-size: 12px; color: var(--me-text-muted); margin-top: 2px; }
.sec-divider { height: 1px; background: var(--me-border); margin: 10px 0; opacity: 0.5; }
</style>
