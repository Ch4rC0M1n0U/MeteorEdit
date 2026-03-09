<template>
  <div class="admin-security">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-shield-lock-outline</v-icon>
        Securite
      </h2>
      <p class="admin-section-subtitle">Politiques de securite et controle d'acces</p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- Maintenance -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-wrench-outline</v-icon>
        <h3 class="sec-card-title mono">Mode maintenance</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">Activer le mode maintenance</p>
          <p class="sec-desc">Bloque l'acces au site pour tous les utilisateurs non-admin</p>
        </div>
        <v-switch v-model="form.maintenanceMode" color="warning" hide-details @update:model-value="save" />
      </div>
      <v-text-field
        v-if="form.maintenanceMode"
        v-model="form.maintenanceMessage"
        label="Message de maintenance"
        density="compact"
        hide-details
        class="mt-3"
        @blur="save"
      />
    </div>

    <!-- Access Control -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-account-lock-outline</v-icon>
        <h3 class="sec-card-title mono">Controle d'acces</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">Inscriptions ouvertes</p>
          <p class="sec-desc">Autoriser les nouveaux utilisateurs a s'inscrire</p>
        </div>
        <v-switch v-model="form.registrationEnabled" color="primary" hide-details @update:model-value="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">2FA obligatoire</p>
          <p class="sec-desc">Tous les utilisateurs doivent activer l'authentification a deux facteurs</p>
        </div>
        <v-switch v-model="form.require2FA" color="primary" hide-details @update:model-value="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">Duree de session (minutes)</p>
          <p class="sec-desc">Deconnexion automatique apres inactivite</p>
        </div>
        <v-text-field
          v-model.number="form.sessionTimeoutMinutes"
          type="number"
          density="compact"
          hide-details
          style="max-width: 120px;"
          :min="5"
          :max="43200"
          @blur="save"
        />
      </div>
    </div>

    <!-- Password Policy -->
    <div class="sec-card glass-card fade-in fade-in-delay-2">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-form-textbox-password</v-icon>
        <h3 class="sec-card-title mono">Politique de mot de passe</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">Longueur minimale</p>
          <p class="sec-desc">Nombre minimum de caracteres requis</p>
        </div>
        <v-text-field
          v-model.number="form.passwordMinLength"
          type="number"
          density="compact"
          hide-details
          style="max-width: 120px;"
          :min="4"
          :max="128"
          @blur="save"
        />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">Majuscule requise</p>
          <p class="sec-desc">Au moins une lettre majuscule (A-Z)</p>
        </div>
        <v-switch v-model="form.passwordRequireUppercase" color="primary" hide-details @update:model-value="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">Chiffre requis</p>
          <p class="sec-desc">Au moins un chiffre (0-9)</p>
        </div>
        <v-switch v-model="form.passwordRequireNumber" color="primary" hide-details @update:model-value="save" />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">Caractere special requis</p>
          <p class="sec-desc">Au moins un caractere special (!@#$...)</p>
        </div>
        <v-switch v-model="form.passwordRequireSpecial" color="primary" hide-details @update:model-value="save" />
      </div>
    </div>

    <!-- Brute Force Protection -->
    <div class="sec-card glass-card fade-in fade-in-delay-2">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-lock-alert-outline</v-icon>
        <h3 class="sec-card-title mono">Protection anti brute-force</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">Tentatives max avant verrouillage</p>
          <p class="sec-desc">0 = pas de limite</p>
        </div>
        <v-text-field
          v-model.number="form.maxLoginAttempts"
          type="number"
          density="compact"
          hide-details
          style="max-width: 120px;"
          :min="0"
          :max="100"
          @blur="save"
        />
      </div>
      <div class="sec-divider" />
      <div class="sec-option">
        <div>
          <p class="sec-label">Duree de verrouillage (minutes)</p>
          <p class="sec-desc">Temps d'attente apres trop de tentatives echouees</p>
        </div>
        <v-text-field
          v-model.number="form.lockoutDurationMinutes"
          type="number"
          density="compact"
          hide-details
          style="max-width: 120px;"
          :min="1"
          :max="1440"
          @blur="save"
        />
      </div>
    </div>

    <v-snackbar v-model="saved" :timeout="2000" color="success" location="bottom right">
      Parametres enregistres
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../../services/api';

const loading = ref(true);
const saved = ref(false);

const form = ref({
  require2FA: false,
  maintenanceMode: false,
  maintenanceMessage: '',
  registrationEnabled: true,
  sessionTimeoutMinutes: 480,
  passwordMinLength: 8,
  passwordRequireUppercase: false,
  passwordRequireNumber: false,
  passwordRequireSpecial: false,
  maxLoginAttempts: 0,
  lockoutDurationMinutes: 15,
});

onMounted(async () => {
  try {
    const { data } = await api.get('/settings/branding');
    form.value.require2FA = !!data.require2FA;
    form.value.maintenanceMode = !!data.maintenanceMode;
    form.value.maintenanceMessage = data.maintenanceMessage || '';
    form.value.registrationEnabled = data.registrationEnabled !== false;
    form.value.sessionTimeoutMinutes = data.sessionTimeoutMinutes || 480;
    form.value.passwordMinLength = data.passwordMinLength || 8;
    form.value.passwordRequireUppercase = !!data.passwordRequireUppercase;
    form.value.passwordRequireNumber = !!data.passwordRequireNumber;
    form.value.passwordRequireSpecial = !!data.passwordRequireSpecial;
    form.value.maxLoginAttempts = data.maxLoginAttempts || 0;
    form.value.lockoutDurationMinutes = data.lockoutDurationMinutes || 15;
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
