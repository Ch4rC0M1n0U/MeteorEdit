<template>
  <div class="admin-defaults">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-cog-outline</v-icon>
        Parametres par defaut
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.defaultsSubtitle') }}</p>
    </div>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <!-- Retention des donnees -->
    <div class="sec-card glass-card fade-in fade-in-delay-2">
      <div class="sec-card-header">
        <v-icon size="18" color="var(--me-accent)">mdi-database-clock-outline</v-icon>
        <h3 class="sec-card-title mono">{{ $t('admin.dataRetention') }}</h3>
      </div>
      <div class="sec-option">
        <div>
          <p class="sec-label">{{ $t('admin.trashPurgeDays') }}</p>
          <p class="sec-desc">{{ $t('admin.trashPurgeDaysDesc') }}</p>
        </div>
        <v-text-field
          v-model.number="form.trashAutoDeleteDays"
          type="number"
          density="compact"
          hide-details
          style="max-width: 120px;"
          :min="0"
          :max="365"
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
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t } = useI18n();

const loading = ref(true);
const saved = ref(false);

const form = ref({
  trashAutoDeleteDays: 0,
});

onMounted(async () => {
  try {
    const { data } = await api.get('/settings/branding');
    form.value.trashAutoDeleteDays = data.trashAutoDeleteDays || 0;
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
