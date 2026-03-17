<template>
  <div class="profile-ai">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-robot-outline</v-icon>
        {{ t('profile.ai.title') }}
      </h2>
      <p class="admin-section-subtitle">{{ t('profile.ai.subtitle') }}</p>
    </div>

    <!-- Provider selector -->
    <div class="ai-card glass-card fade-in fade-in-delay-1">
      <div class="ai-card-header">
        <div class="ai-icon">
          <v-icon size="24">mdi-swap-horizontal</v-icon>
        </div>
        <div>
          <h3 class="ai-card-title mono">{{ t('profile.ai.providerTitle') }}</h3>
          <p class="ai-card-desc">{{ t('profile.ai.providerDesc') }}</p>
        </div>
      </div>

      <div class="ai-provider-selector">
        <button
          :class="['ai-provider-btn', { 'ai-provider-btn--active': form.aiProvider === 'ollama' }]"
          @click="form.aiProvider = 'ollama'; savePrefs()"
        >
          <v-icon size="20" class="mr-2">mdi-server-network</v-icon>
          <div class="ai-provider-btn-content">
            <span class="ai-provider-btn-title">Ollama</span>
            <span class="ai-provider-btn-desc">{{ t('profile.ai.ollamaDesc') }}</span>
          </div>
        </button>
        <button
          :class="['ai-provider-btn', { 'ai-provider-btn--active': form.aiProvider === 'claude' }]"
          @click="form.aiProvider = 'claude'; savePrefs()"
        >
          <v-icon size="20" class="mr-2">mdi-cloud-outline</v-icon>
          <div class="ai-provider-btn-content">
            <span class="ai-provider-btn-title">Claude API</span>
            <span class="ai-provider-btn-desc">{{ t('profile.ai.claudeDesc') }}</span>
          </div>
        </button>
        <button
          :class="['ai-provider-btn', { 'ai-provider-btn--active': form.aiProvider === 'openai' }]"
          @click="form.aiProvider = 'openai'; savePrefs()"
        >
          <v-icon size="20" class="mr-2">mdi-creation</v-icon>
          <div class="ai-provider-btn-content">
            <span class="ai-provider-btn-title">OpenAI / ChatGPT</span>
            <span class="ai-provider-btn-desc">{{ t('profile.ai.openaiDesc') }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Claude Privacy Warning + Config -->
    <div v-if="form.aiProvider === 'claude'" class="ai-card ai-privacy-card fade-in">
      <div class="ai-privacy-header">
        <v-icon size="22" color="#f59e0b">mdi-shield-alert-outline</v-icon>
        <h3 class="ai-card-title mono">{{ t('profile.ai.claudeConfig') }}</h3>
      </div>
      <div class="ai-privacy-content">
        <p>{{ t('profile.ai.commercialWarning') }}</p>
        <ul class="ai-privacy-list">
          <li><v-icon size="14" class="mr-1" color="#f59e0b">mdi-alert-outline</v-icon>{{ t('profile.ai.privacyItem1') }}</li>
          <li><v-icon size="14" class="mr-1" color="#f59e0b">mdi-alert-outline</v-icon>{{ t('profile.ai.privacyItem2') }}</li>
          <li><v-icon size="14" class="mr-1" color="#34d399">mdi-check-circle-outline</v-icon>{{ t('profile.ai.privacyItem3') }}</li>
        </ul>
        <p class="ai-privacy-footer">{{ t('profile.ai.privacyFooter') }}</p>
      </div>
    </div>

    <div v-if="form.aiProvider === 'claude'" class="ai-card fade-in">
      <div class="ai-fields">
        <div class="ai-field">
          <label class="ai-label mono">{{ t('profile.ai.apiKey') }}</label>
          <div class="ai-field-row">
            <v-text-field
              v-model="form.claudeApiKey"
              density="compact"
              hide-details
              :type="showClaudeKey ? 'text' : 'password'"
              placeholder="sk-ant-api03-..."
            />
            <button class="ai-test-btn" @click="showClaudeKey = !showClaudeKey">
              <v-icon size="14">{{ showClaudeKey ? 'mdi-eye-off-outline' : 'mdi-eye-outline' }}</v-icon>
            </button>
            <button class="ai-test-btn" @click="testClaude" :disabled="testingClaude">
              <v-icon size="14" class="mr-1">mdi-connection</v-icon>
              {{ testingClaude ? t('profile.ai.testing') : t('profile.ai.test') }}
            </button>
          </div>
          <p v-if="claudeHasKey" class="ai-field-hint ai-field-hint--ok">
            <v-icon size="12" class="mr-1" color="#34d399">mdi-key</v-icon>
            {{ t('profile.ai.keyConfigured') }}
          </p>
          <p class="ai-field-hint">
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" class="ai-link">
              <v-icon size="12" class="mr-1">mdi-open-in-new</v-icon>
              {{ t('profile.ai.getClaudeKey') }}
            </a>
          </p>
          <div v-if="claudeTestStatus" :class="['ai-status-msg', claudeTestStatus.ok ? 'ai-status-msg--ok' : 'ai-status-msg--error']">
            <v-icon size="14" class="mr-1">{{ claudeTestStatus.ok ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline' }}</v-icon>
            {{ claudeTestStatus.message }}
          </div>
        </div>

        <div class="ai-field">
          <label class="ai-label mono">{{ t('profile.ai.model') }}</label>
          <v-select
            v-model="form.claudeModel"
            :items="claudeModels"
            item-title="label"
            item-value="value"
            density="compact"
            hide-details
          />
        </div>
      </div>

      <div class="ai-actions">
        <button class="me-btn-primary" @click="saveApiKeys" :disabled="savingKeys">
          <v-icon size="14" class="mr-1">mdi-content-save-outline</v-icon>
          {{ savingKeys ? t('profile.ai.saving') : t('profile.ai.save') }}
        </button>
        <div v-if="saveStatus" :class="['ai-status-msg', saveStatus.ok ? 'ai-status-msg--ok' : 'ai-status-msg--error']">
          <v-icon size="14" class="mr-1">{{ saveStatus.ok ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline' }}</v-icon>
          {{ saveStatus.message }}
        </div>
      </div>
    </div>

    <!-- OpenAI Privacy Warning + Config -->
    <div v-if="form.aiProvider === 'openai'" class="ai-card ai-privacy-card fade-in">
      <div class="ai-privacy-header">
        <v-icon size="22" color="#f59e0b">mdi-shield-alert-outline</v-icon>
        <h3 class="ai-card-title mono">{{ t('profile.ai.openaiConfig') }}</h3>
      </div>
      <div class="ai-privacy-content">
        <p>{{ t('profile.ai.commercialWarning') }}</p>
        <ul class="ai-privacy-list">
          <li><v-icon size="14" class="mr-1" color="#f59e0b">mdi-alert-outline</v-icon>{{ t('profile.ai.privacyItem1') }}</li>
          <li><v-icon size="14" class="mr-1" color="#f59e0b">mdi-alert-outline</v-icon>{{ t('profile.ai.privacyItem2') }}</li>
          <li><v-icon size="14" class="mr-1" color="#34d399">mdi-check-circle-outline</v-icon>{{ t('profile.ai.privacyItem3') }}</li>
        </ul>
        <p class="ai-privacy-footer">{{ t('profile.ai.privacyFooter') }}</p>
      </div>
    </div>

    <div v-if="form.aiProvider === 'openai'" class="ai-card fade-in">
      <div class="ai-fields">
        <div class="ai-field">
          <label class="ai-label mono">{{ t('profile.ai.apiKey') }}</label>
          <div class="ai-field-row">
            <v-text-field
              v-model="form.openaiApiKey"
              density="compact"
              hide-details
              :type="showOpenaiKey ? 'text' : 'password'"
              placeholder="sk-proj-..."
            />
            <button class="ai-test-btn" @click="showOpenaiKey = !showOpenaiKey">
              <v-icon size="14">{{ showOpenaiKey ? 'mdi-eye-off-outline' : 'mdi-eye-outline' }}</v-icon>
            </button>
            <button class="ai-test-btn" @click="testOpenai" :disabled="testingOpenai">
              <v-icon size="14" class="mr-1">mdi-connection</v-icon>
              {{ testingOpenai ? t('profile.ai.testing') : t('profile.ai.test') }}
            </button>
          </div>
          <p v-if="openaiHasKey" class="ai-field-hint ai-field-hint--ok">
            <v-icon size="12" class="mr-1" color="#34d399">mdi-key</v-icon>
            {{ t('profile.ai.keyConfigured') }}
          </p>
          <p class="ai-field-hint">
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" class="ai-link">
              <v-icon size="12" class="mr-1">mdi-open-in-new</v-icon>
              {{ t('profile.ai.getOpenaiKey') }}
            </a>
          </p>
          <div v-if="openaiTestStatus" :class="['ai-status-msg', openaiTestStatus.ok ? 'ai-status-msg--ok' : 'ai-status-msg--error']">
            <v-icon size="14" class="mr-1">{{ openaiTestStatus.ok ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline' }}</v-icon>
            {{ openaiTestStatus.message }}
          </div>
        </div>

        <div class="ai-field">
          <label class="ai-label mono">{{ t('profile.ai.model') }}</label>
          <v-select
            v-model="form.openaiModel"
            :items="openaiModels"
            item-title="label"
            item-value="value"
            density="compact"
            hide-details
          />
        </div>
      </div>

      <div class="ai-actions">
        <button class="me-btn-primary" @click="saveApiKeys" :disabled="savingKeys">
          <v-icon size="14" class="mr-1">mdi-content-save-outline</v-icon>
          {{ savingKeys ? t('profile.ai.saving') : t('profile.ai.save') }}
        </button>
        <div v-if="saveStatus" :class="['ai-status-msg', saveStatus.ok ? 'ai-status-msg--ok' : 'ai-status-msg--error']">
          <v-icon size="14" class="mr-1">{{ saveStatus.ok ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline' }}</v-icon>
          {{ saveStatus.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../../services/api';

const { t } = useI18n();

const form = reactive({
  aiProvider: 'ollama',
  claudeApiKey: '',
  claudeModel: 'claude-sonnet-4-20250514',
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
});

const showClaudeKey = ref(false);
const showOpenaiKey = ref(false);
const claudeHasKey = ref(false);
const openaiHasKey = ref(false);
const testingClaude = ref(false);
const testingOpenai = ref(false);
const savingKeys = ref(false);
const claudeTestStatus = ref<{ ok: boolean; message: string } | null>(null);
const openaiTestStatus = ref<{ ok: boolean; message: string } | null>(null);
const saveStatus = ref<{ ok: boolean; message: string } | null>(null);

const claudeModels = [
  { label: 'Claude Sonnet 4 (recommande)', value: 'claude-sonnet-4-20250514' },
  { label: 'Claude Haiku 3.5', value: 'claude-3-5-haiku-20241022' },
  { label: 'Claude Opus 4', value: 'claude-opus-4-20250514' },
];

const openaiModels = [
  { label: 'GPT-4o (recommande)', value: 'gpt-4o' },
  { label: 'GPT-4o mini', value: 'gpt-4o-mini' },
  { label: 'GPT-4.1', value: 'gpt-4.1' },
  { label: 'GPT-4.1 mini', value: 'gpt-4.1-mini' },
  { label: 'o3-mini', value: 'o3-mini' },
];

async function loadPrefs() {
  try {
    const { data } = await api.get('/auth/preferences');
    form.aiProvider = data.aiProvider || 'ollama';
    form.claudeModel = data.claudeModel || 'claude-sonnet-4-20250514';
    form.openaiModel = data.openaiModel || 'gpt-4o';
    form.claudeApiKey = '';
    form.openaiApiKey = '';
    claudeHasKey.value = !!data.claudeHasKey;
    openaiHasKey.value = !!data.openaiHasKey;
  } catch { /* ignore */ }
}

async function savePrefs() {
  try {
    await api.put('/auth/preferences', {
      aiProvider: form.aiProvider,
      claudeModel: form.claudeModel,
      openaiModel: form.openaiModel,
    });
  } catch { /* ignore */ }
}

async function saveApiKeys() {
  savingKeys.value = true;
  saveStatus.value = null;
  try {
    const payload: Record<string, any> = {
      aiProvider: form.aiProvider,
      claudeModel: form.claudeModel,
      openaiModel: form.openaiModel,
    };
    if (form.claudeApiKey && !form.claudeApiKey.startsWith('•')) {
      payload.claudeApiKey = form.claudeApiKey;
    }
    if (form.openaiApiKey && !form.openaiApiKey.startsWith('•')) {
      payload.openaiApiKey = form.openaiApiKey;
    }
    const { data } = await api.put('/auth/preferences', payload);
    claudeHasKey.value = !!data.claudeHasKey;
    openaiHasKey.value = !!data.openaiHasKey;
    form.claudeApiKey = '';
    form.openaiApiKey = '';
    saveStatus.value = { ok: true, message: t('profile.ai.saved') };
    setTimeout(() => (saveStatus.value = null), 3000);
  } catch {
    saveStatus.value = { ok: false, message: t('profile.ai.saveError') };
    setTimeout(() => (saveStatus.value = null), 5000);
  } finally {
    savingKeys.value = false;
  }
}

async function testClaude() {
  testingClaude.value = true;
  claudeTestStatus.value = null;
  try {
    const payload: Record<string, any> = {};
    if (form.claudeApiKey && !form.claudeApiKey.startsWith('•')) {
      payload.apiKey = form.claudeApiKey;
    }
    const { data } = await api.post('/ai/test/claude', payload);
    claudeTestStatus.value = { ok: data.ok, message: data.message };
  } catch (err: any) {
    claudeTestStatus.value = { ok: false, message: err.response?.data?.message || 'Erreur de connexion' };
  } finally {
    testingClaude.value = false;
    setTimeout(() => (claudeTestStatus.value = null), 5000);
  }
}

async function testOpenai() {
  testingOpenai.value = true;
  openaiTestStatus.value = null;
  try {
    const payload: Record<string, any> = {};
    if (form.openaiApiKey && !form.openaiApiKey.startsWith('•')) {
      payload.apiKey = form.openaiApiKey;
    }
    const { data } = await api.post('/ai/test/openai', payload);
    openaiTestStatus.value = { ok: data.ok, message: data.message };
  } catch (err: any) {
    openaiTestStatus.value = { ok: false, message: err.response?.data?.message || 'Erreur de connexion' };
  } finally {
    testingOpenai.value = false;
    setTimeout(() => (openaiTestStatus.value = null), 5000);
  }
}

onMounted(loadPrefs);
</script>

<style scoped>
.profile-ai { max-width: 800px; }
.ai-card { background: var(--me-bg-surface); border: 1px solid var(--me-border); border-radius: var(--me-radius-md); padding: 20px; margin-bottom: 16px; }
.ai-card-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
.ai-icon { width: 40px; height: 40px; border-radius: var(--me-radius-xs); background: var(--me-accent-glow); display: flex; align-items: center; justify-content: center; color: var(--me-accent); flex-shrink: 0; }
.ai-card-title { font-size: 15px; font-weight: 700; color: var(--me-text-primary); }
.ai-card-desc { font-size: 13px; color: var(--me-text-muted); margin-top: 2px; }
.ai-fields { display: flex; flex-direction: column; gap: 16px; }
.ai-field { display: flex; flex-direction: column; gap: 6px; }
.ai-label { font-size: 12px; font-weight: 600; color: var(--me-text-secondary); text-transform: uppercase; letter-spacing: 0.03em; }
.ai-field-row { display: flex; gap: 8px; align-items: center; }
.ai-field-hint { font-size: 12px; color: var(--me-text-muted); }
.ai-field-hint--ok { color: #34d399; }
.ai-link { color: var(--me-accent); text-decoration: none; font-size: 12px; display: inline-flex; align-items: center; }
.ai-link:hover { text-decoration: underline; }
.ai-test-btn { padding: 6px 12px; border-radius: var(--me-radius-xs); background: var(--me-bg-elevated); border: 1px solid var(--me-border); color: var(--me-text-secondary); font-size: 12px; cursor: pointer; display: flex; align-items: center; white-space: nowrap; transition: all 0.15s; }
.ai-test-btn:hover { background: var(--me-accent-glow); color: var(--me-accent); border-color: var(--me-accent); }
.ai-test-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.ai-actions { margin-top: 16px; display: flex; align-items: center; gap: 12px; }
.ai-status-msg { font-size: 13px; display: flex; align-items: center; padding: 6px 12px; border-radius: var(--me-radius-xs); }
.ai-status-msg--ok { color: #34d399; background: rgba(52, 211, 153, 0.1); }
.ai-status-msg--error { color: #f87171; background: rgba(248, 113, 113, 0.1); }
.ai-provider-selector { display: flex; gap: 8px; flex-wrap: wrap; }
.ai-provider-btn { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: var(--me-radius-xs); background: var(--me-bg-elevated); border: 1px solid var(--me-border); color: var(--me-text-secondary); cursor: pointer; transition: all 0.15s; flex: 1; min-width: 160px; text-align: left; }
.ai-provider-btn:hover { background: var(--me-accent-glow); color: var(--me-text-primary); border-color: var(--me-accent); }
.ai-provider-btn--active { background: var(--me-accent-glow); color: var(--me-accent); border-color: var(--me-accent); }
.ai-provider-btn-content { display: flex; flex-direction: column; }
.ai-provider-btn-title { font-weight: 600; font-size: 14px; }
.ai-provider-btn-desc { font-size: 11px; opacity: 0.7; }
.ai-privacy-card { background: rgba(245, 158, 11, 0.05) !important; border-color: rgba(245, 158, 11, 0.3) !important; }
.ai-privacy-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.ai-privacy-content { font-size: 13px; color: var(--me-text-secondary); }
.ai-privacy-content p { margin-bottom: 8px; }
.ai-privacy-list { list-style: none; padding: 0; margin: 8px 0; display: flex; flex-direction: column; gap: 6px; }
.ai-privacy-list li { display: flex; align-items: center; font-size: 13px; }
.ai-privacy-footer { font-size: 11px; color: var(--me-text-muted); margin-top: 8px; font-style: italic; }
</style>
