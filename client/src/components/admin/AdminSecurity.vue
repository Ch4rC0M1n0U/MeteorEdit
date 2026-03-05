<template>
  <div class="admin-security">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-shield-lock-outline</v-icon>
        Securite
      </h2>
      <p class="admin-section-subtitle">Politiques de securite globales</p>
    </div>

    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <div class="security-option">
        <div>
          <h3 class="branding-card-title mono">2FA obligatoire</h3>
          <p class="branding-card-desc">Tous les utilisateurs devront activer l'authentification a deux facteurs</p>
        </div>
        <v-switch v-model="require2FA" color="primary" hide-details @update:model-value="saveRequire2FA" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../../services/api';

const require2FA = ref(false);

onMounted(async () => {
  try {
    const { data } = await api.get('/settings/branding');
    require2FA.value = !!data.require2FA;
  } catch {}
});

async function saveRequire2FA(value: boolean) {
  try {
    await api.put('/admin/settings', { require2FA: value });
  } catch {
    require2FA.value = !value;
  }
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.admin-section-subtitle { font-size: 13px; color: var(--me-text-muted); margin-top: 4px; font-family: var(--me-font-mono); }
.branding-card { padding: 20px; }
.branding-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 4px; }
.branding-card-desc { font-size: 12px; color: var(--me-text-muted); }
.security-option { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
</style>
