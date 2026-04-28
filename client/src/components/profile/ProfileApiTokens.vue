<template>
  <div class="pat">
    <header class="pat-header">
      <h1 class="pat-title">
        <i class="mdi mdi-key-chain-variant" />
        {{ $t('profile.apiTokens.title') }}
      </h1>
      <p class="pat-subtitle">{{ $t('profile.apiTokens.subtitle') }}</p>
    </header>

    <section class="pat-card">
      <div class="pat-card-head">
        <h2 class="pat-card-title">{{ $t('profile.apiTokens.activeTokens') }}</h2>
        <Button
          icon="pi pi-plus"
          :label="$t('profile.apiTokens.create')"
          size="small"
          @click="createOpen = true"
        />
      </div>

      <div v-if="loading" class="pat-empty">
        <i class="pi pi-spin pi-spinner" /> {{ $t('common.loading') }}
      </div>

      <div v-else-if="tokens.length === 0" class="pat-empty">
        <i class="mdi mdi-key-outline" />
        <span>{{ $t('profile.apiTokens.empty') }}</span>
      </div>

      <ul v-else class="pat-list">
        <li v-for="token in tokens" :key="token._id" class="pat-item">
          <div class="pat-item-main">
            <div class="pat-item-name">{{ token.name }}</div>
            <div class="pat-item-meta">
              <code class="pat-prefix mono">{{ token.prefix }}…</code>
              <span class="pat-dot">·</span>
              <span>{{ $t('profile.apiTokens.created') }} {{ formatDate(token.createdAt) }}</span>
              <span v-if="token.lastUsedAt" class="pat-dot">·</span>
              <span v-if="token.lastUsedAt">
                {{ $t('profile.apiTokens.lastUsed') }} {{ formatDate(token.lastUsedAt) }}
              </span>
              <span v-else class="pat-unused">{{ $t('profile.apiTokens.neverUsed') }}</span>
            </div>
          </div>
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            :title="$t('profile.apiTokens.revoke')"
            @click="confirmRevoke(token)"
          />
        </li>
      </ul>
    </section>

    <!-- Creation dialog -->
    <Dialog
      v-model:visible="createOpen"
      modal
      dismissable-mask
      :header="$t('profile.apiTokens.createTitle')"
      :style="{ width: 'min(90vw, 480px)' }"
      @hide="onCreateClose"
    >
      <div v-if="!justCreated" class="pat-create">
        <label class="pat-label">{{ $t('profile.apiTokens.nameLabel') }}</label>
        <InputText
          v-model="newTokenName"
          :placeholder="$t('profile.apiTokens.namePlaceholder')"
          @keyup.enter="onCreate"
        />
        <p class="pat-hint">{{ $t('profile.apiTokens.nameHint') }}</p>

        <div class="pat-actions">
          <Button :label="$t('common.cancel')" text @click="createOpen = false" />
          <Button
            :label="$t('profile.apiTokens.create')"
            icon="pi pi-check"
            :loading="creating"
            :disabled="newTokenName.trim().length < 2"
            @click="onCreate"
          />
        </div>
      </div>

      <div v-else class="pat-created">
        <div class="pat-warn">
          <i class="pi pi-exclamation-triangle" />
          <span>{{ $t('profile.apiTokens.copyWarn') }}</span>
        </div>
        <div class="pat-token-display">
          <code class="mono">{{ justCreated.token }}</code>
          <Button
            :icon="copied ? 'pi pi-check' : 'pi pi-copy'"
            text
            rounded
            :title="$t('common.copy')"
            @click="copyToken(justCreated.token)"
          />
        </div>
        <div class="pat-actions">
          <Button
            :label="$t('common.done')"
            icon="pi pi-check"
            @click="createOpen = false"
          />
        </div>
      </div>
    </Dialog>

    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import ConfirmDialog from 'primevue/confirmdialog';
import api from '../../services/api';

interface ApiToken {
  _id: string;
  name: string;
  prefix: string;
  scope: string;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
}

const { t, locale } = useI18n();
const toast = useToast();
const confirm = useConfirm();

const tokens = ref<ApiToken[]>([]);
const loading = ref(false);
const createOpen = ref(false);
const newTokenName = ref('');
const creating = ref(false);
const justCreated = ref<{ token: string; name: string } | null>(null);
const copied = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const { data } = await api.get<{ tokens: ApiToken[] }>('/auth/api-tokens');
    tokens.value = data.tokens;
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: err.response?.data?.message ?? err.message,
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
}

async function onCreate(): Promise<void> {
  const name = newTokenName.value.trim();
  if (name.length < 2) return;
  creating.value = true;
  try {
    const { data } = await api.post<{ token: string; name: string }>('/auth/api-tokens', { name });
    justCreated.value = { token: data.token, name: data.name };
    await load();
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: t('profile.apiTokens.createFailed'),
      detail: err.response?.data?.message ?? err.message,
      life: 5000,
    });
  } finally {
    creating.value = false;
  }
}

function onCreateClose(): void {
  newTokenName.value = '';
  justCreated.value = null;
  copied.value = false;
}

async function copyToken(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    copied.value = true;
    toast.add({
      severity: 'success',
      summary: t('profile.apiTokens.copied'),
      life: 2000,
    });
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: t('profile.apiTokens.copyFailed'),
      life: 3000,
    });
  }
}

function confirmRevoke(token: ApiToken): void {
  confirm.require({
    message: t('profile.apiTokens.revokeConfirm', { name: token.name }),
    header: t('profile.apiTokens.revoke'),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('profile.apiTokens.revoke'),
    rejectLabel: t('common.cancel'),
    accept: async () => {
      try {
        await api.delete(`/auth/api-tokens/${token._id}`);
        await load();
        toast.add({
          severity: 'success',
          summary: t('profile.apiTokens.revoked'),
          life: 3000,
        });
      } catch (err: any) {
        toast.add({
          severity: 'error',
          summary: t('common.error'),
          detail: err.response?.data?.message ?? err.message,
          life: 5000,
        });
      }
    },
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

onMounted(load);
</script>

<style scoped>
.pat { max-width: 880px; }
.pat-header { margin-bottom: 24px; }
.pat-title { font-size: 22px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; gap: 10px; margin: 0 0 6px; }
.pat-title i { font-size: 26px; color: var(--me-accent); }
.pat-subtitle { font-size: 14px; color: var(--me-text-muted); margin: 0; max-width: 600px; }

.pat-card { background: var(--me-bg-elevated); border: 1px solid var(--me-border); border-radius: var(--me-radius-md); padding: 20px; }
.pat-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.pat-card-title { font-size: 16px; font-weight: 600; margin: 0; color: var(--me-text-primary); }

.pat-empty { display: flex; align-items: center; gap: 12px; justify-content: center; padding: 32px; color: var(--me-text-muted); font-size: 14px; }
.pat-empty i { font-size: 28px; }

.pat-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.pat-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: var(--me-radius-sm); background: var(--me-bg-surface); border: 1px solid var(--me-border); transition: border-color 0.15s; }
.pat-item:hover { border-color: var(--me-accent); }
.pat-item-main { flex: 1; min-width: 0; }
.pat-item-name { font-size: 14px; font-weight: 600; color: var(--me-text-primary); margin-bottom: 4px; }
.pat-item-meta { font-size: 12px; color: var(--me-text-muted); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pat-prefix { background: var(--me-bg-elevated); padding: 2px 6px; border-radius: 4px; font-size: 11px; }
.pat-dot { color: var(--me-text-muted); }
.pat-unused { color: var(--me-warn, #b45309); font-style: italic; }

.pat-create { display: flex; flex-direction: column; gap: 10px; padding: 8px 0; }
.pat-label { font-size: 13px; font-weight: 600; color: var(--me-text-secondary); }
.pat-hint { font-size: 12px; color: var(--me-text-muted); margin: 0; }
.pat-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }

.pat-created { display: flex; flex-direction: column; gap: 14px; padding: 8px 0; }
.pat-warn { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: var(--me-radius-sm); background: rgba(245, 158, 11, 0.12); color: #b45309; font-size: 13px; }
.pat-warn i { font-size: 18px; flex-shrink: 0; }
.pat-token-display { display: flex; align-items: center; gap: 8px; padding: 12px; background: var(--me-bg-surface); border: 1px solid var(--me-border); border-radius: var(--me-radius-sm); }
.pat-token-display code { flex: 1; font-size: 13px; word-break: break-all; color: var(--me-text-primary); }
</style>
