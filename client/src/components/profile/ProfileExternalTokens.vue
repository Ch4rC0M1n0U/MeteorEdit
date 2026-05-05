<template>
  <div class="profile-ext-tokens">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <i class="mdi mdi-key-link" style="font-size: 20px; margin-right: 8px;"></i>
        {{ $t('profile.externalTokens.title') }}
      </h2>
      <p class="admin-section-subtitle">{{ $t('profile.externalTokens.subtitle') }}</p>
    </div>

    <!-- CBEAPI -->
    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <h3 class="section-title mono">
        <span class="mdi mdi-domain" style="font-size: 16px; margin-right: 4px;"></span>
        {{ $t('profile.externalTokens.bce.title') }}
        <Tag v-if="status.bce" :severity="status.bce.configured ? 'success' : 'secondary'" :value="status.bce.configured ? $t('profile.externalTokens.configured') : $t('profile.externalTokens.notConfigured')" class="ml-2" />
      </h3>
      <p class="card-help">
        {{ $t('profile.externalTokens.bce.help') }}
        <a href="https://cbeapi.be" target="_blank" rel="noopener">cbeapi.be</a>
        — {{ $t('profile.externalTokens.bce.quota') }}
      </p>

      <div class="settings-group mt-3">
        <label class="settings-label mono">{{ $t('profile.externalTokens.tokenLabel') }}</label>
        <div class="token-row">
          <Password
            v-model="bceToken"
            :placeholder="status.bce?.configured ? '••••••••••••' : $t('profile.externalTokens.tokenPlaceholder')"
            :feedback="false"
            toggleMask
            class="w-full"
            inputClass="w-full mono"
          />
          <Button :label="$t('common.save')" icon="pi pi-save" :loading="savingBce" :disabled="!bceToken.trim()" @click="saveToken('bce')" />
          <Button v-if="status.bce?.configured" severity="danger" outlined :label="$t('common.remove')" icon="pi pi-trash" :loading="savingBce" @click="removeToken('bce')" />
        </div>
      </div>
    </div>

    <!-- OpenCorporates (placeholder, future) -->
    <div class="branding-card glass-card fade-in fade-in-delay-2 mt-4">
      <h3 class="section-title mono">
        <span class="mdi mdi-earth" style="font-size: 16px; margin-right: 4px;"></span>
        {{ $t('profile.externalTokens.openCorporates.title') }}
        <Tag v-if="status.openCorporates" :severity="status.openCorporates.configured ? 'success' : 'secondary'" :value="status.openCorporates.configured ? $t('profile.externalTokens.configured') : $t('profile.externalTokens.notConfigured')" class="ml-2" />
      </h3>
      <p class="card-help">
        {{ $t('profile.externalTokens.openCorporates.help') }}
        <a href="https://opencorporates.com/api_accounts/new" target="_blank" rel="noopener">opencorporates.com</a>
      </p>

      <div class="settings-group mt-3">
        <label class="settings-label mono">{{ $t('profile.externalTokens.tokenLabel') }}</label>
        <div class="token-row">
          <Password
            v-model="ocToken"
            :placeholder="status.openCorporates?.configured ? '••••••••••••' : $t('profile.externalTokens.tokenPlaceholder')"
            :feedback="false"
            toggleMask
            class="w-full"
            inputClass="w-full mono"
          />
          <Button :label="$t('common.save')" icon="pi pi-save" :loading="savingOc" :disabled="!ocToken.trim()" @click="saveToken('openCorporates')" />
          <Button v-if="status.openCorporates?.configured" severity="danger" outlined :label="$t('common.remove')" icon="pi pi-trash" :loading="savingOc" @click="removeToken('openCorporates')" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Password from 'primevue/password';
import Tag from 'primevue/tag';
import api from '../../services/api';

interface TokenStatus { configured: boolean }
interface StatusResponse { bce?: TokenStatus; openCorporates?: TokenStatus }

const { t } = useI18n();
const toast = useToast();

const status = ref<StatusResponse>({});
const bceToken = ref('');
const ocToken = ref('');
const savingBce = ref(false);
const savingOc = ref(false);

async function load(): Promise<void> {
  try {
    const { data } = await api.get<StatusResponse>('/auth/external-tokens');
    status.value = data;
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: t('common.error'), detail: err instanceof Error ? err.message : String(err), life: 4000 });
  }
}

async function saveToken(which: 'bce' | 'openCorporates'): Promise<void> {
  const value = which === 'bce' ? bceToken.value.trim() : ocToken.value.trim();
  if (!value) return;
  const setSaving = which === 'bce' ? savingBce : savingOc;
  setSaving.value = true;
  try {
    const { data } = await api.put<StatusResponse>('/auth/external-tokens', { [which]: value });
    status.value = data;
    if (which === 'bce') bceToken.value = ''; else ocToken.value = '';
    toast.add({ severity: 'success', summary: t('profile.externalTokens.savedTitle'), detail: t('profile.externalTokens.savedDetail'), life: 2500 });
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: t('common.error'), detail: err instanceof Error ? err.message : String(err), life: 4000 });
  } finally {
    setSaving.value = false;
  }
}

async function removeToken(which: 'bce' | 'openCorporates'): Promise<void> {
  const setSaving = which === 'bce' ? savingBce : savingOc;
  setSaving.value = true;
  try {
    const { data } = await api.put<StatusResponse>('/auth/external-tokens', { [which]: null });
    status.value = data;
    toast.add({ severity: 'info', summary: t('profile.externalTokens.removedTitle'), detail: t('profile.externalTokens.removedDetail'), life: 2500 });
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: t('common.error'), detail: err instanceof Error ? err.message : String(err), life: 4000 });
  } finally {
    setSaving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.profile-ext-tokens { max-width: 900px; }
.section-title { display: flex; align-items: center; gap: 6px; font-size: 15px; margin-bottom: 6px; }
.card-help { font-size: 13px; color: var(--me-text-muted); margin: 4px 0 12px; }
.card-help a { color: var(--me-accent); text-decoration: none; }
.card-help a:hover { text-decoration: underline; }
.settings-label { font-size: 12px; font-weight: 600; color: var(--me-text-muted); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px; }
.token-row { display: flex; gap: 8px; align-items: center; }
.token-row :deep(.p-password) { flex: 1; }
.token-row :deep(.p-password input) { width: 100%; font-family: ui-monospace, 'SF Mono', monospace; }
.ml-2 { margin-left: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.w-full { width: 100%; }
</style>
