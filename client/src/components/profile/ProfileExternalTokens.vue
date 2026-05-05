<template>
  <div class="ext-sources">
    <header class="ext-header">
      <div class="ext-header-row">
        <div class="ext-header-icon">
          <i class="mdi mdi-transit-connection-variant"></i>
        </div>
        <div>
          <h1 class="ext-title">{{ t('profile.externalTokens.title') }}</h1>
          <p class="ext-subtitle">{{ t('profile.externalTokens.subtitle') }}</p>
        </div>
      </div>
    </header>

    <!-- Section: Registres d'entreprises -->
    <section class="ext-group">
      <header class="ext-group-head">
        <i class="mdi mdi-domain"></i>
        <h2>{{ t('profile.externalTokens.groups.companies') }}</h2>
        <span class="ext-group-count">{{ companiesProviders.length }}</span>
      </header>
      <div class="ext-cards">
        <article v-for="p in companiesProviders" :key="p.id" class="ext-card">
          <div class="ext-card-head">
            <div class="ext-card-id">
              <div class="ext-card-logo" :style="{ background: p.color }">
                <i :class="p.icon"></i>
              </div>
              <div class="ext-card-meta">
                <h3>{{ p.name }}</h3>
                <p class="ext-card-desc">{{ p.description }}</p>
              </div>
            </div>
            <span class="ext-status" :class="{ 'ext-status--ok': isConfigured(p.id), 'ext-status--off': !isConfigured(p.id) }">
              <i class="pi" :class="isConfigured(p.id) ? 'pi-check-circle' : 'pi-circle'"></i>
              {{ isConfigured(p.id) ? t('profile.externalTokens.configured') : t('profile.externalTokens.notConfigured') }}
            </span>
          </div>

          <div class="ext-card-body">
            <div class="ext-card-info">
              <span v-if="p.quota" class="ext-info-pill">
                <i class="pi pi-bolt"></i>
                {{ p.quota }}
              </span>
              <a :href="p.signupUrl" target="_blank" rel="noopener" class="ext-info-link">
                <i class="pi pi-external-link"></i>
                {{ t('profile.externalTokens.getKeyAt', { host: p.signupHost }) }}
              </a>
            </div>

            <div class="ext-card-input">
              <Password
                v-model="tokenInputs[p.id]"
                :placeholder="isConfigured(p.id) ? '••••••••••••••••' : t('profile.externalTokens.tokenPlaceholder')"
                :feedback="false"
                toggleMask
                inputClass="ext-token-input mono"
                :pt="{ pcInput: { root: { class: 'ext-pwd-root' } } }"
              />
              <div class="ext-card-actions">
                <Button
                  :label="isConfigured(p.id) ? t('common.update') : t('common.save')"
                  icon="pi pi-save"
                  :loading="savingId === p.id"
                  :disabled="!tokenInputs[p.id]?.trim()"
                  size="small"
                  @click="saveToken(p.id)"
                />
                <Button
                  v-if="isConfigured(p.id)"
                  severity="danger"
                  outlined
                  icon="pi pi-trash"
                  :title="t('common.remove')"
                  :loading="savingId === p.id"
                  size="small"
                  @click="removeToken(p.id)"
                />
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- Section: OSINT (placeholder for future) -->
    <section class="ext-group ext-group--soon">
      <header class="ext-group-head">
        <i class="mdi mdi-shield-search"></i>
        <h2>{{ t('profile.externalTokens.groups.osint') }}</h2>
        <span class="ext-group-soon">{{ t('common.comingSoon') }}</span>
      </header>
      <p class="ext-group-empty">{{ t('profile.externalTokens.osintEmpty') }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import Button from 'primevue/button';
import Password from 'primevue/password';
import api from '../../services/api';

type ProviderId = 'bce' | 'openCorporates';
interface Provider {
  id: ProviderId;
  name: string;
  description: string;
  icon: string;
  color: string;
  quota?: string;
  signupUrl: string;
  signupHost: string;
}
interface TokenStatus { configured: boolean }
interface StatusResponse { bce?: TokenStatus; openCorporates?: TokenStatus }

const { t } = useI18n();
const toast = useToast();

const status = ref<StatusResponse>({});
const tokenInputs = reactive<Record<ProviderId, string>>({ bce: '', openCorporates: '' });
const savingId = ref<ProviderId | ''>('');

const companiesProviders = computed<Provider[]>(() => [
  {
    id: 'bce',
    name: 'CBEAPI.be',
    description: t('profile.externalTokens.bce.description'),
    icon: 'mdi mdi-flag',
    color: 'linear-gradient(135deg, #1976d2 0%, #f59e0b 100%)',
    quota: '2 500 / jour',
    signupUrl: 'https://cbeapi.be',
    signupHost: 'cbeapi.be',
  },
  {
    id: 'openCorporates',
    name: 'OpenCorporates',
    description: t('profile.externalTokens.openCorporates.description'),
    icon: 'mdi mdi-earth',
    color: 'linear-gradient(135deg, #22c55e 0%, #0ea5e9 100%)',
    quota: '500 / mois (free)',
    signupUrl: 'https://opencorporates.com/api_accounts/new',
    signupHost: 'opencorporates.com',
  },
]);

function isConfigured(id: ProviderId): boolean {
  return !!status.value[id]?.configured;
}

async function load(): Promise<void> {
  try {
    const { data } = await api.get<StatusResponse>('/auth/external-tokens');
    status.value = data;
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: t('common.error'), detail: err instanceof Error ? err.message : String(err), life: 4000 });
  }
}

async function saveToken(id: ProviderId): Promise<void> {
  const value = tokenInputs[id]?.trim();
  if (!value) return;
  savingId.value = id;
  try {
    const { data } = await api.put<StatusResponse>('/auth/external-tokens', { [id]: value });
    status.value = data;
    tokenInputs[id] = '';
    toast.add({ severity: 'success', summary: t('profile.externalTokens.savedTitle'), detail: t('profile.externalTokens.savedDetail'), life: 2500 });
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: t('common.error'), detail: err instanceof Error ? err.message : String(err), life: 4000 });
  } finally {
    savingId.value = '';
  }
}

async function removeToken(id: ProviderId): Promise<void> {
  savingId.value = id;
  try {
    const { data } = await api.put<StatusResponse>('/auth/external-tokens', { [id]: null });
    status.value = data;
    toast.add({ severity: 'info', summary: t('profile.externalTokens.removedTitle'), detail: t('profile.externalTokens.removedDetail'), life: 2500 });
  } catch (err: unknown) {
    toast.add({ severity: 'error', summary: t('common.error'), detail: err instanceof Error ? err.message : String(err), life: 4000 });
  } finally {
    savingId.value = '';
  }
}

onMounted(load);
</script>

<style scoped>
.ext-sources { max-width: 880px; padding-bottom: 40px; }

/* Header */
.ext-header { margin-bottom: 28px; }
.ext-header-row { display: flex; align-items: center; gap: 16px; }
.ext-header-icon {
  width: 48px; height: 48px; border-radius: 12px;
  background: linear-gradient(135deg, var(--me-accent) 0%, var(--me-accent-light, #6366f1) 100%);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 24px; flex-shrink: 0;
}
.ext-title { font-size: 22px; font-weight: 700; color: var(--me-text-primary); margin: 0; }
.ext-subtitle { font-size: 13px; color: var(--me-text-muted); margin: 4px 0 0; max-width: 640px; line-height: 1.5; }

/* Group */
.ext-group { margin-bottom: 32px; }
.ext-group-head {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 14px; padding-bottom: 10px;
  border-bottom: 1px solid var(--me-border);
}
.ext-group-head i { font-size: 18px; color: var(--me-accent); }
.ext-group-head h2 {
  font-size: 13px; font-weight: 700; color: var(--me-text-primary);
  text-transform: uppercase; letter-spacing: 0.05em; margin: 0;
}
.ext-group-count {
  margin-left: auto; font-size: 11px; font-weight: 700;
  background: var(--me-accent-glow); color: var(--me-accent);
  padding: 2px 8px; border-radius: 10px;
}
.ext-group-soon {
  margin-left: auto; font-size: 10px; font-weight: 700;
  background: var(--me-bg-elev1); color: var(--me-text-muted);
  padding: 3px 10px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.05em;
}
.ext-group--soon .ext-group-head h2 { color: var(--me-text-muted); }
.ext-group-empty {
  font-size: 13px; color: var(--me-text-muted); font-style: italic;
  padding: 16px 0; margin: 0;
}

/* Cards grid */
.ext-cards { display: grid; gap: 12px; }

.ext-card {
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: 12px;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ext-card:hover { border-color: var(--me-accent); box-shadow: 0 4px 16px rgba(0,0,0,0.04); }

.ext-card-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; padding: 16px 20px;
  border-bottom: 1px solid var(--me-border);
}
.ext-card-id { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; }
.ext-card-logo {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 20px; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.ext-card-meta h3 { font-size: 15px; font-weight: 700; color: var(--me-text-primary); margin: 0; }
.ext-card-desc { font-size: 12px; color: var(--me-text-muted); margin: 2px 0 0; line-height: 1.4; }

.ext-status {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600;
  padding: 4px 10px; border-radius: 12px;
  white-space: nowrap; flex-shrink: 0;
}
.ext-status--ok { background: rgba(34, 197, 94, 0.12); color: rgb(22, 163, 74); }
.ext-status--off { background: var(--me-bg-elev1); color: var(--me-text-muted); }
.ext-status i { font-size: 11px; }

/* Card body */
.ext-card-body { padding: 14px 20px 18px; }
.ext-card-info {
  display: flex; align-items: center; gap: 12px;
  margin-bottom: 12px; flex-wrap: wrap;
}
.ext-info-pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600;
  background: var(--me-bg-elev1); color: var(--me-text-secondary);
  padding: 3px 10px; border-radius: 10px;
}
.ext-info-pill i { font-size: 11px; color: var(--me-accent); }
.ext-info-link {
  font-size: 12px; color: var(--me-accent); text-decoration: none;
  display: inline-flex; align-items: center; gap: 4px;
}
.ext-info-link:hover { text-decoration: underline; }
.ext-info-link i { font-size: 11px; }

.ext-card-input { display: flex; gap: 8px; align-items: stretch; }
.ext-card-input :deep(.p-password) { flex: 1; }
.ext-card-input :deep(.p-password-input),
.ext-card-input :deep(.ext-token-input) {
  width: 100%; font-family: ui-monospace, 'SF Mono', monospace; font-size: 13px;
}
.ext-card-actions { display: flex; gap: 6px; flex-shrink: 0; }
</style>
