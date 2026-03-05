<template>
  <div class="profile-security">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-shield-lock-outline</v-icon>
        Securite
      </h2>
    </div>

    <!-- Password change -->
    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <h3 class="branding-card-title mono">Changer le mot de passe</h3>
      <v-alert v-if="pwMessage" :type="pwSuccess ? 'success' : 'error'" variant="tonal" class="mb-4" closable @click:close="pwMessage = ''">
        {{ pwMessage }}
      </v-alert>
      <v-text-field v-model="pwForm.currentPassword" label="Mot de passe actuel" type="password" density="compact" hide-details class="mb-3" />
      <v-text-field v-model="pwForm.newPassword" label="Nouveau mot de passe (min. 8)" type="password" density="compact" hide-details class="mb-3" />
      <v-text-field v-model="pwForm.confirmPassword" label="Confirmer" type="password" density="compact" hide-details class="mb-4" />
      <div class="branding-actions">
        <button class="me-btn-primary" @click="changePassword" :disabled="pwSaving">Changer</button>
      </div>
    </div>

    <!-- 2FA -->
    <div class="branding-card glass-card fade-in fade-in-delay-2">
      <div class="tfa-header">
        <div>
          <h3 class="branding-card-title mono">Authentification a deux facteurs (2FA)</h3>
          <p class="branding-card-desc">
            {{ authStore.user?.twoFactorEnabled ? 'Active — votre compte est protege' : 'Desactive — activez pour plus de securite' }}
          </p>
          <p v-if="require2FAEnforced" class="tfa-enforced mono">
            <v-icon size="14" class="mr-1">mdi-alert-outline</v-icon>
            2FA obligatoire (politique administrateur)
          </p>
        </div>
        <span :class="['status-dot', authStore.user?.twoFactorEnabled ? 'status-dot--active' : 'status-dot--error']" />
      </div>

      <!-- Setup flow -->
      <div v-if="!authStore.user?.twoFactorEnabled && !setupData">
        <button class="me-btn-primary" @click="startSetup">
          <v-icon size="14" class="mr-1">mdi-qrcode</v-icon>
          Activer la 2FA
        </button>
      </div>

      <!-- QR Code display -->
      <div v-if="setupData" class="tfa-setup">
        <p class="tfa-step mono">1. Scannez le QR code avec Google Authenticator ou Authy</p>
        <img :src="setupData.qrCode" alt="QR Code" class="tfa-qr" />
        <p class="tfa-step mono">Ou entrez ce code manuellement :</p>
        <code class="tfa-secret">{{ setupData.secret }}</code>
        <p class="tfa-step mono mt-4">2. Entrez le code a 6 chiffres pour confirmer</p>
        <div class="tfa-verify-row">
          <v-text-field v-model="verifyCode" label="Code" density="compact" hide-details maxlength="6" class="tfa-code-input" />
          <button class="me-btn-primary" @click="verifySetup" :disabled="verifyCode.length < 6">Confirmer</button>
        </div>
        <v-alert v-if="tfaError" type="error" variant="tonal" class="mt-3" closable @click:close="tfaError = ''">{{ tfaError }}</v-alert>
      </div>

      <!-- Backup codes -->
      <div v-if="backupCodes.length" class="tfa-backup">
        <v-alert type="warning" variant="tonal" class="mb-3">
          Sauvegardez ces codes de recuperation. Ils ne seront plus affiches.
        </v-alert>
        <div class="tfa-backup-grid">
          <code v-for="code in backupCodes" :key="code" class="tfa-backup-code">{{ code }}</code>
        </div>
        <button class="me-btn-ghost mt-3" @click="backupCodes = []">J'ai sauvegarde mes codes</button>
      </div>

      <!-- Disable -->
      <div v-if="authStore.user?.twoFactorEnabled && !setupData && !backupCodes.length">
        <div v-if="!showDisable">
          <button class="me-btn-ghost" @click="showDisable = true" :disabled="require2FAEnforced">
            <v-icon size="14" class="mr-1">mdi-shield-off-outline</v-icon>
            Desactiver la 2FA
          </button>
        </div>
        <div v-else class="tfa-disable">
          <v-text-field v-model="disablePassword" label="Mot de passe pour confirmer" type="password" density="compact" hide-details class="mb-3" />
          <div class="branding-actions">
            <button class="me-btn-ghost" @click="showDisable = false">Annuler</button>
            <button class="me-btn-primary" style="background: var(--me-error);" @click="disable2FA">Desactiver</button>
          </div>
          <v-alert v-if="tfaError" type="error" variant="tonal" class="mt-3" closable @click:close="tfaError = ''">{{ tfaError }}</v-alert>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();

// Password
const pwForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const pwMessage = ref('');
const pwSuccess = ref(false);
const pwSaving = ref(false);

async function changePassword() {
  if (pwForm.newPassword !== pwForm.confirmPassword) {
    pwMessage.value = 'Les mots de passe ne correspondent pas';
    pwSuccess.value = false;
    return;
  }
  pwSaving.value = true;
  try {
    await api.put('/auth/password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
    pwMessage.value = 'Mot de passe modifie';
    pwSuccess.value = true;
    pwForm.currentPassword = '';
    pwForm.newPassword = '';
    pwForm.confirmPassword = '';
  } catch (e: any) {
    pwMessage.value = e.response?.data?.message || 'Erreur';
    pwSuccess.value = false;
  } finally {
    pwSaving.value = false;
  }
}

// 2FA
const setupData = ref<{ qrCode: string; secret: string } | null>(null);
const backupCodes = ref<string[]>([]);
const verifyCode = ref('');
const tfaError = ref('');
const showDisable = ref(false);
const disablePassword = ref('');
const require2FAEnforced = ref(false);

onMounted(async () => {
  try {
    const { data } = await api.get('/settings/branding');
    require2FAEnforced.value = !!data.require2FA;
  } catch {}
});

async function startSetup() {
  try {
    const { data } = await api.post('/auth/2fa/setup');
    setupData.value = { qrCode: data.qrCode, secret: data.secret };
    backupCodes.value = data.backupCodes;
  } catch (e: any) {
    tfaError.value = e.response?.data?.message || 'Erreur';
  }
}

async function verifySetup() {
  try {
    await api.post('/auth/2fa/verify', { code: verifyCode.value });
    setupData.value = null;
    verifyCode.value = '';
    await authStore.fetchMe();
  } catch (e: any) {
    tfaError.value = e.response?.data?.message || 'Code invalide';
  }
}

async function disable2FA() {
  try {
    await api.delete('/auth/2fa', { data: { password: disablePassword.value } });
    showDisable.value = false;
    disablePassword.value = '';
    tfaError.value = '';
    await authStore.fetchMe();
  } catch (e: any) {
    tfaError.value = e.response?.data?.message || 'Erreur';
  }
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.branding-card { padding: 20px; margin-bottom: 16px; }
.branding-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 4px; }
.branding-card-desc { font-size: 12px; color: var(--me-text-muted); margin-bottom: 12px; }
.branding-actions { display: flex; justify-content: flex-end; gap: 8px; }
.tfa-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
.tfa-enforced { font-size: 11px; color: var(--me-warning); margin-top: 4px; display: flex; align-items: center; }
.tfa-setup { margin-top: 16px; }
.tfa-step { font-size: 13px; color: var(--me-text-secondary); margin-bottom: 8px; }
.tfa-qr { display: block; margin: 12px 0; border-radius: var(--me-radius-sm); border: 1px solid var(--me-border); }
.tfa-secret { display: block; padding: 10px 14px; background: var(--me-bg-elevated); border: 1px solid var(--me-border); border-radius: var(--me-radius-xs); font-family: var(--me-font-mono); font-size: 14px; color: var(--me-accent); letter-spacing: 2px; word-break: break-all; }
.tfa-verify-row { display: flex; gap: 10px; align-items: flex-start; }
.tfa-code-input { max-width: 160px; }
.tfa-backup { margin-top: 16px; }
.tfa-backup-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.tfa-backup-code { padding: 6px 10px; background: var(--me-bg-elevated); border: 1px solid var(--me-border); border-radius: 4px; font-family: var(--me-font-mono); font-size: 13px; text-align: center; color: var(--me-text-primary); }
.tfa-disable { margin-top: 12px; }
.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 16px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.me-btn-primary { padding: 8px 16px; border-radius: var(--me-radius-xs); background: var(--me-accent); border: none; color: var(--me-bg-deep); cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; }
.me-btn-primary:hover { box-shadow: 0 0 16px var(--me-accent-glow); }
.me-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.me-btn-ghost { padding: 8px 16px; border-radius: var(--me-radius-xs); background: none; border: 1px solid var(--me-border); color: var(--me-text-secondary); cursor: pointer; font-size: 13px; display: flex; align-items: center; }
.me-btn-ghost:hover { border-color: var(--me-border-hover); color: var(--me-text-primary); }
.mr-1 { margin-right: 4px; }
</style>
