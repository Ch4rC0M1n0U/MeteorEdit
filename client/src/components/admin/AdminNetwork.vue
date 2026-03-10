<template>
  <div class="admin-network">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-lan</v-icon>
        Reseau & Annonces
      </h2>
      <p class="admin-section-subtitle">CORS, origines autorisees et banniere d'annonce</p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- CORS / Origines autorisees -->
    <div class="sec-card glass-card fade-in fade-in-delay-1">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-web</v-icon>
        <h3 class="sec-card-title mono">CORS / Origines autorisees</h3>
      </div>
      <div class="sec-option">
        <div style="flex: 1;">
          <p class="sec-label">Origines autorisees</p>
          <p class="sec-desc">Liste des domaines autorises, separes par des virgules. * = tout autoriser</p>
        </div>
      </div>
      <v-text-field
        v-model="form.allowedOrigins"
        label="Origines autorisees"
        density="compact"
        hide-details
        class="mt-3"
        @blur="save"
      />
    </div>

    <!-- Banniere d'annonce -->
    <div class="sec-card glass-card fade-in fade-in-delay-2">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-bullhorn-outline</v-icon>
        <h3 class="sec-card-title mono">Banniere d'annonce</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">Activer la banniere</p>
          <p class="sec-desc">Affiche un bandeau d'annonce visible par tous les utilisateurs</p>
        </div>
        <v-switch v-model="form.announcementEnabled" color="primary" hide-details @update:model-value="save" />
      </div>
      <template v-if="form.announcementEnabled">
        <div class="sec-divider" />
        <div class="sec-option">
          <div style="flex: 1;">
            <p class="sec-label">Message</p>
            <p class="sec-desc">Texte affiche dans la banniere</p>
          </div>
        </div>
        <v-text-field
          v-model="form.announcementMessage"
          label="Message"
          density="compact"
          hide-details
          class="mt-3"
          @blur="save"
        />
        <div class="sec-divider" />
        <div class="sec-option">
          <div>
            <p class="sec-label">Type</p>
            <p class="sec-desc">Apparence de la banniere</p>
          </div>
          <v-select
            v-model="form.announcementVariant"
            :items="['info', 'warning', 'error']"
            density="compact"
            hide-details
            style="max-width: 200px;"
            @update:model-value="save"
          />
        </div>
      </template>
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
  allowedOrigins: '*',
  announcementEnabled: false,
  announcementMessage: '',
  announcementVariant: 'info',
});

onMounted(async () => {
  try {
    const { data } = await api.get('/settings/branding');
    form.value.allowedOrigins = data.allowedOrigins || '*';
    form.value.announcementEnabled = !!data.announcementEnabled;
    form.value.announcementMessage = data.announcementMessage || '';
    form.value.announcementVariant = data.announcementVariant || 'info';
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
