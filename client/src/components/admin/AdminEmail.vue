<template>
  <div class="admin-email">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-email-outline</v-icon>
        Email / SMTP
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.emailSubtitle') }}</p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- Configuration SMTP -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-email-outline</v-icon>
        <h3 class="sec-card-title mono">{{ $t('admin.smtpConfig') }}</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.smtpServerLabel') }}</p>
          <p class="sec-desc">{{ $t('admin.smtpServerDesc') }}</p>
        </div>
        <v-text-field
          v-model="form.smtpHost"
          density="compact"
          hide-details
          placeholder="smtp.gmail.com"
          style="max-width: 280px;"
          @blur="save"
        />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.smtpPort') }}</p>
          <p class="sec-desc">{{ $t('admin.smtpPortDesc') }}</p>
        </div>
        <v-text-field
          v-model.number="form.smtpPort"
          type="number"
          density="compact"
          hide-details
          style="max-width: 120px;"
          :min="1"
          :max="65535"
          @blur="save"
        />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.secureTlsLabel') }}</p>
          <p class="sec-desc">{{ $t('admin.secureTlsDesc') }}</p>
        </div>
        <v-switch v-model="form.smtpSecure" color="primary" hide-details @update:model-value="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.smtpUserLabel') }}</p>
          <p class="sec-desc">{{ $t('admin.smtpUserDesc') }}</p>
        </div>
        <v-text-field
          v-model="form.smtpUser"
          density="compact"
          hide-details
          style="max-width: 280px;"
          @blur="save"
        />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.smtpPasswordLabel') }}</p>
          <p class="sec-desc">{{ $t('admin.smtpPasswordDesc') }}</p>
        </div>
        <v-text-field
          v-model="form.smtpPass"
          type="password"
          density="compact"
          hide-details
          style="max-width: 280px;"
          @blur="save"
        />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.senderFrom') }}</p>
          <p class="sec-desc">{{ $t('admin.senderFromDesc') }}</p>
        </div>
        <v-text-field
          v-model="form.smtpFrom"
          density="compact"
          hide-details
          placeholder="noreply@monapp.fr"
          style="max-width: 280px;"
          @blur="save"
        />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.testConfig') }}</p>
          <p class="sec-desc">{{ $t('admin.testConfigDesc') }}</p>
        </div>
        <v-btn
          class="me-btn-ghost"
          :loading="testing"
          @click="testEmail"
        >
          <v-icon start size="16">mdi-email-fast-outline</v-icon>
          Tester la connexion
        </v-btn>
      </div>
    </div>

    <v-snackbar v-model="saved" :timeout="2000" color="success" location="bottom right">
      Parametres enregistres
    </v-snackbar>
    <v-snackbar v-model="testSuccess" :timeout="3000" color="success" location="bottom right">
      Email de test envoye avec succes
    </v-snackbar>
    <v-snackbar v-model="testError" :timeout="4000" color="error" location="bottom right">
      {{ testErrorMessage }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

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
