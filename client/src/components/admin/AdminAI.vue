<template>
  <div class="admin-ai">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-robot-outline</v-icon>
        Intelligence Artificielle
      </h2>
      <p class="admin-section-subtitle">{{ $t('admin.aiSubtitle') }}</p>
    </div>

    <!-- Connection settings -->
    <div class="ai-card glass-card fade-in fade-in-delay-1">
      <div class="ai-card-header">
        <div class="ai-icon">
          <v-icon size="24">mdi-cog-outline</v-icon>
        </div>
        <div>
          <h3 class="ai-card-title mono">{{ $t('admin.aiConfig') }}</h3>
          <p class="ai-card-desc">{{ $t('admin.aiConfigDesc') }}</p>
        </div>
        <span :class="['plugin-status', connectionOk ? 'plugin-status--active' : 'plugin-status--inactive']">
          {{ connectionOk ? $t('admin.connected') : $t('admin.notConnected') }}
        </span>
      </div>

      <div class="ai-fields">
        <div class="ai-field">
          <label class="ai-label mono">{{ $t('admin.ollamaUrl') }}</label>
          <div class="ai-field-row">
            <v-text-field
              v-model="form.baseUrl"
              density="compact"
              hide-details
              placeholder="http://localhost:11434"
            />
            <button class="ai-test-btn" @click="testConnection" :disabled="testing">
              <v-icon size="14" class="mr-1">mdi-connection</v-icon>
              {{ testing ? $t('admin.testing') : $t('admin.test') }}
            </button>
          </div>
        </div>

        <div class="ai-field">
          <label class="ai-label mono">{{ $t('admin.enableAI') }}</label>
          <div class="ai-toggle-row">
            <v-switch v-model="form.enabled" hide-details color="var(--me-accent)" density="compact" />
            <span class="ai-toggle-label">{{ form.enabled ? $t('admin.aiEnabled') : $t('admin.aiDisabled') }}</span>
          </div>
        </div>

        <div class="ai-field" v-if="installedModels.length > 0">
          <label class="ai-label mono">{{ $t('admin.selectedModel') }}</label>
          <v-select
            v-model="form.selectedModel"
            :items="installedModels"
            item-title="name"
            item-value="name"
            density="compact"
            hide-details
            :placeholder="$t('admin.selectModelPlaceholder')"
          />
        </div>
      </div>

      <div class="ai-actions">
        <button class="me-btn-primary" @click="saveSettings" :disabled="saving">
          <v-icon size="14" class="mr-1">mdi-content-save-outline</v-icon>
          {{ saving ? $t('admin.savingSettings') : $t('admin.saveSettings') }}
        </button>
      </div>
    </div>

    <!-- Prompt template -->
    <div class="ai-card glass-card fade-in fade-in-delay-2">
      <div class="ai-card-header">
        <div class="ai-icon">
          <v-icon size="24">mdi-text-box-edit-outline</v-icon>
        </div>
        <div>
          <h3 class="ai-card-title mono">{{ $t('admin.generationPrompt') }}</h3>
          <p class="ai-card-desc">{{ $t('admin.generationPromptDesc') }}</p>
        </div>
      </div>

      <div class="ai-fields">
        <div class="ai-field">
          <label class="ai-label mono">{{ $t('admin.availableVariables') }}</label>
          <div class="ai-prompt-vars">
            <span v-for="v in promptVariables" :key="v.key" class="ai-prompt-var-chip" :title="v.desc" @click="insertVariable(v.key)">
              {{ v.key }}
            </span>
          </div>
          <p class="ai-prompt-vars-hint">{{ $t('admin.clickToInsert') }}</p>
        </div>

        <div class="ai-field">
          <label class="ai-label mono">{{ $t('admin.prompt') }}</label>
          <textarea
            ref="promptTextarea"
            v-model="form.reportPrompt"
            class="ai-prompt-textarea"
            rows="16"
            :placeholder="$t('admin.promptPlaceholder')"
          />
        </div>

        <div class="ai-field">
          <button class="ai-reset-btn" @click="resetPrompt">
            <v-icon size="14" class="mr-1">mdi-refresh</v-icon>
            Reinitialiser le prompt par defaut
          </button>
        </div>
      </div>

      <div class="ai-actions">
        <button class="me-btn-primary" @click="saveSettings" :disabled="saving">
          <v-icon size="14" class="mr-1">mdi-content-save-outline</v-icon>
          {{ saving ? $t('admin.savingSettings') : $t('admin.saveSettings') }}
        </button>
      </div>
    </div>

    <!-- Report templates management -->
    <div class="ai-card glass-card fade-in fade-in-delay-2">
      <div class="ai-card-header">
        <div class="ai-icon">
          <v-icon size="24">mdi-file-document-multiple-outline</v-icon>
        </div>
        <div>
          <h3 class="ai-card-title mono">{{ $t('admin.reportTemplates') }}</h3>
          <p class="ai-card-desc">{{ $t('admin.reportTemplatesDesc') }}</p>
        </div>
        <button class="ai-test-btn" @click="openCreateTemplate">
          <v-icon size="14" class="mr-1">mdi-plus</v-icon>
          Nouveau template
        </button>
      </div>

      <!-- Template form (create/edit) -->
      <div v-if="tplFormOpen" class="ai-tpl-form">
        <div class="ai-field">
          <label class="ai-label mono">{{ $t('admin.templateTitleLabel') }}</label>
          <v-text-field
            v-model="tplForm.title"
            density="compact"
            hide-details
            :placeholder="$t('admin.templateTitle')"
          />
        </div>
        <div class="ai-field">
          <label class="ai-label mono">{{ $t('admin.templateDescription') }}</label>
          <v-text-field
            v-model="tplForm.description"
            density="compact"
            hide-details
            :placeholder="$t('admin.templateDescPlaceholder')"
          />
        </div>
        <div class="ai-field">
          <label class="ai-label mono">{{ $t('admin.availableVariables') }}</label>
          <div class="ai-prompt-vars">
            <span v-for="v in promptVariables" :key="v.key" class="ai-prompt-var-chip" :title="v.desc" @click="insertTplVariable(v.key)">
              {{ v.key }}
            </span>
          </div>
        </div>
        <div class="ai-field">
          <label class="ai-label mono">{{ $t('admin.templatePrompt') }}</label>
          <textarea
            ref="tplPromptTextarea"
            v-model="tplForm.prompt"
            class="ai-prompt-textarea"
            rows="12"
            :placeholder="$t('admin.templatePromptPlaceholder')"
          />
        </div>
        <div class="ai-field">
          <label class="ai-label mono">{{ $t('admin.templateSharing') }}</label>
          <div class="ai-toggle-row">
            <v-switch v-model="tplForm.isShared" hide-details color="var(--me-accent)" density="compact" />
            <span class="ai-toggle-label">{{ tplForm.isShared ? $t('admin.sharedAll') : $t('admin.privateOnly') }}</span>
          </div>
        </div>
        <div class="ai-tpl-form-actions">
          <button class="me-btn-ghost" @click="tplFormOpen = false">{{ $t('common.cancel') }}</button>
          <button class="me-btn-primary" @click="saveTemplate" :disabled="tplSaving || !tplForm.title.trim() || !tplForm.prompt.trim()">
            <v-icon size="14" class="mr-1">mdi-content-save-outline</v-icon>
            {{ tplSaving ? $t('admin.savingSettings') : (tplEditingId ? $t('admin.update') : $t('common.create')) }}
          </button>
        </div>
      </div>

      <!-- Templates list -->
      <div v-if="reportTemplates.length > 0 && !tplFormOpen" class="ai-tpl-list">
        <div class="ai-tpl-item" v-for="tpl in reportTemplates" :key="tpl._id">
          <div class="ai-tpl-info">
            <span class="ai-tpl-name mono">{{ tpl.title }}</span>
            <span class="ai-tpl-desc">{{ tpl.description || $t('admin.noDescription') }}</span>
            <div class="ai-tpl-badges">
              <span v-if="tpl.isShared" class="ai-tpl-badge ai-tpl-badge--shared">{{ $t('admin.shared') }}</span>
              <span v-else class="ai-tpl-badge ai-tpl-badge--private">{{ $t('admin.private') }}</span>
            </div>
          </div>
          <div class="ai-tpl-actions">
            <button class="ai-model-select-btn" @click="editTemplate(tpl)" :title="$t('common.edit')">
              <v-icon size="14">mdi-pencil-outline</v-icon>
            </button>
            <button class="ai-model-delete-btn" @click="deleteTemplate(tpl._id)" :title="$t('common.delete')">
              <v-icon size="14">mdi-delete-outline</v-icon>
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="!tplFormOpen && !loadingTemplates" class="ai-empty">
        <v-icon size="32" class="mb-2" color="var(--me-text-muted)">mdi-file-document-outline</v-icon>
        <p>{{ $t('admin.noCustomTemplates') }}</p>
        <p class="ai-empty-hint">{{ $t('admin.defaultTemplateUsed') }}</p>
      </div>

      <div class="ai-loading" v-if="loadingTemplates">
        <v-progress-circular indeterminate size="24" color="var(--me-accent)" />
        <span>{{ $t('admin.loadingTemplates') }}</span>
      </div>
    </div>

    <!-- Models management -->
    <div class="ai-card glass-card fade-in fade-in-delay-2">
      <div class="ai-card-header">
        <div class="ai-icon">
          <v-icon size="24">mdi-brain</v-icon>
        </div>
        <div>
          <h3 class="ai-card-title mono">{{ $t('admin.models') }}</h3>
          <p class="ai-card-desc">{{ $t('admin.modelsDesc') }}</p>
        </div>
      </div>

      <!-- Pull new model -->
      <div class="ai-pull-section">
        <label class="ai-label mono">{{ $t('admin.downloadModel') }}</label>
        <div class="ai-field-row">
          <v-text-field
            v-model="pullModelName"
            density="compact"
            hide-details
            :placeholder="$t('admin.modelPlaceholder')"
            :disabled="pulling"
          />
          <button class="me-btn-primary" @click="pullModel" :disabled="pulling || !pullModelName.trim()">
            <v-icon size="14" class="mr-1">mdi-download</v-icon>
            {{ $t('admin.download') }}
          </button>
        </div>
        <div class="ai-suggestions">
          <span class="ai-suggestion-label">{{ $t('admin.suggestionsLabel') }}</span>
          <button v-for="s in suggestedModels" :key="s.name" class="ai-suggestion-chip" @click="pullModelName = s.name" :disabled="pulling">
            {{ s.label }}
          </button>
        </div>
      </div>

      <!-- Download progress -->
      <div v-if="pulling" class="ai-progress-section">
        <div class="ai-progress-header">
          <div class="ai-progress-info">
            <v-icon size="16" class="mr-1 ai-progress-spin">mdi-loading</v-icon>
            <span class="ai-progress-label mono">{{ pullProgressLabel }}</span>
          </div>
          <button class="ai-cancel-btn" @click="cancelPull" :title="$t('admin.cancelDownload')">
            <v-icon size="14" class="mr-1">mdi-close-circle-outline</v-icon>
            Annuler
          </button>
        </div>
        <div class="ai-progress-bar-track">
          <div class="ai-progress-bar-fill" :style="{ width: pullPercent + '%' }" />
        </div>
        <div class="ai-progress-details">
          <span>{{ pullPercent }}%</span>
          <span v-if="pullDownloaded && pullTotal">{{ formatSize(pullDownloaded) }} / {{ formatSize(pullTotal) }}</span>
          <span v-else>{{ pullStatusText }}</span>
        </div>
      </div>

      <!-- Pull result status -->
      <div class="ai-pull-status" v-if="!pulling && pullStatus">
        <v-icon size="16" :color="pullStatusColor" class="mr-1">{{ pullStatusIcon }}</v-icon>
        {{ pullStatus }}
      </div>

      <!-- Installed models list -->
      <div class="ai-models-list" v-if="installedModels.length > 0">
        <div class="ai-model-item" v-for="model in installedModels" :key="model.name">
          <div class="ai-model-info">
            <span class="ai-model-name mono">{{ model.name }}</span>
            <span class="ai-model-size">{{ formatSize(model.size) }}</span>
          </div>
          <div class="ai-model-actions">
            <button
              class="ai-model-select-btn"
              v-if="form.selectedModel !== model.name"
              @click="form.selectedModel = model.name"
              :title="$t('admin.select')"
            >
              <v-icon size="14">mdi-check-circle-outline</v-icon>
            </button>
            <span v-else class="ai-model-selected">
              <v-icon size="14" color="var(--me-accent)">mdi-check-circle</v-icon>
              {{ $t('admin.activeModel') }}
            </span>
            <button class="ai-model-delete-btn" @click="removeModel(model.name)" :title="$t('common.delete')">
              <v-icon size="14">mdi-delete-outline</v-icon>
            </button>
          </div>
        </div>
      </div>

      <div class="ai-empty" v-else-if="!loadingModels && !pulling">
        <v-icon size="32" class="mb-2" color="var(--me-text-muted)">mdi-brain</v-icon>
        <p>{{ $t('admin.noModelsInstalled') }}</p>
        <p class="ai-empty-hint">{{ $t('admin.downloadToStart') }}</p>
      </div>

      <div class="ai-loading" v-if="loadingModels">
        <v-progress-circular indeterminate size="24" color="var(--me-accent)" />
        <span>{{ $t('admin.loadingModels') }}</span>
      </div>
    </div>

    <!-- Info card -->
    <div class="ai-card glass-card fade-in fade-in-delay-3">
      <div class="ai-card-header">
        <div class="ai-icon">
          <v-icon size="24">mdi-information-outline</v-icon>
        </div>
        <div>
          <h3 class="ai-card-title mono">{{ $t('admin.recommendations') }}</h3>
          <p class="ai-card-desc">{{ $t('admin.recommendationsDesc') }}</p>
        </div>
      </div>
      <div class="ai-info-content">
        <div class="ai-info-item">
          <strong class="mono">mistral:7b-instruct-v0.3-q4_K_M</strong>
          <p>{{ $t('admin.recMistralDesc') }}</p>
        </div>
        <div class="ai-info-item">
          <strong class="mono">phi3:mini</strong>
          <p>{{ $t('admin.recPhi3Desc') }}</p>
        </div>
        <div class="ai-info-item">
          <strong class="mono">gemma2:2b</strong>
          <p>{{ $t('admin.recGemma2Desc') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import api, { SERVER_URL } from '../../services/api';

const { t } = useI18n();

const saving = ref(false);
const testing = ref(false);
const pulling = ref(false);
const loadingModels = ref(false);
const connectionOk = ref(false);
const pullModelName = ref('');
const pullStatus = ref('');
const pullError = ref(false);
const pullPercent = ref(0);
const pullDownloaded = ref(0);
const pullTotal = ref(0);
const pullStatusText = ref('');
const pullProgressLabel = ref('');
let pullAbortController: AbortController | null = null;

const promptTextarea = ref<HTMLTextAreaElement | null>(null);
const tplPromptTextarea = ref<HTMLTextAreaElement | null>(null);

// Report templates
const loadingTemplates = ref(false);
const tplFormOpen = ref(false);
const tplSaving = ref(false);
const tplEditingId = ref<string | null>(null);
const reportTemplates = ref<Array<{ _id: string; title: string; description: string; prompt: string; isShared: boolean; owner?: any }>>([]);
const tplForm = reactive({
  title: '',
  description: '',
  prompt: '',
  isShared: false,
});

const defaultReportPrompt = `Tu es un analyste OSINT professionnel. Redige un rapport d'investigation structure en suivant EXACTEMENT le format ci-dessous. Utilise les donnees fournies pour remplir chaque section. Redige en francais, de maniere professionnelle et factuelle.

Donnees du dossier:
- Titre: {{title}}
- Description: {{description}}
- Statut: {{status}}
- Objectifs: {{objectives}}
- Faits judiciaires: {{judicialFacts}}
- Entites: {{entities}}
- Enqueteur: {{investigator}}
- Notes d'investigation: {{notes}}

FORMAT DU RAPPORT A SUIVRE STRICTEMENT:

# Rapport OSINT
## Dossier "{{title}}"

## Entites concernees
Les recherches demandees par l'enqueteur portent sur les entites suivantes:
[Liste detaillee des entites avec leurs types et descriptions]

## Objectifs de la recherche OSINT
Les objectifs sont definis comme suit:
[Objectifs detailles du dossier]

## Synthese des faits
[Resume des faits judiciaires et du contexte de l'enquete]

## Resume des recherches et des resultats
Les recherches en sources ouvertes ont ete menees sur Internet. Il convient de souligner que, compte tenu de l'immensite de ce reseau et de la multiplicite des ressources disponibles, certaines informations pertinentes pourraient ne pas avoir ete identifiees.
Note: toutes les recherches reprises dans ce rapport ont ete realisees en sources ouvertes uniquement.
[Resume global des resultats]

## Recherches en source ouverte
[Detail des recherches effectuees pour chaque entite]

## Exploration des ressources web et reseaux sociaux
[Resultats detailles des recherches web et reseaux sociaux par entite]

## Conclusion
[Synthese des resultats, recommandations pour la suite de l'enquete, et preconisations]

Ce rapport est clos le {{date}}.
{{signature}}`;

const promptVariables = computed(() => [
  { key: '{{title}}', desc: t('admin.varTitle') || 'Titre du dossier' },
  { key: '{{description}}', desc: t('admin.varDescription') || 'Description du dossier' },
  { key: '{{status}}', desc: t('admin.varStatus') || 'Statut du dossier' },
  { key: '{{objectives}}', desc: t('admin.varObjectives') || 'Objectifs du dossier' },
  { key: '{{judicialFacts}}', desc: t('admin.varJudicialFacts') || 'Faits judiciaires' },
  { key: '{{entities}}', desc: t('admin.varEntities') || 'Liste des entites' },
  { key: '{{investigator}}', desc: t('admin.varInvestigator') || 'Informations enqueteur du dossier' },
  { key: '{{notes}}', desc: t('admin.varNotes') || 'Contenu des notes' },
  { key: '{{date}}', desc: t('admin.varDate') || 'Date du jour (format FR)' },
  { key: '{{signature}}', desc: t('admin.varSignature') || 'Signature de l\'utilisateur (depuis le profil)' },
]);

const form = reactive({
  baseUrl: 'http://localhost:11434',
  selectedModel: '',
  enabled: false,
  reportPrompt: defaultReportPrompt,
});

const installedModels = ref<Array<{ name: string; size: number; modified_at: string }>>([]);

const suggestedModels = computed(() => [
  { name: 'mistral:7b-instruct-v0.3-q4_K_M', label: 'Mistral 7B (' + t('admin.recommended') + ')' },
  { name: 'phi3:mini', label: 'Phi-3 Mini' },
  { name: 'gemma2:2b', label: 'Gemma 2 2B' },
  { name: 'llama3.2:3b', label: 'Llama 3.2 3B' },
]);

const pullStatusColor = computed(() => pullError.value ? '#f87171' : '#34d399');
const pullStatusIcon = computed(() => pullError.value ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline');

function formatSize(bytes: number) {
  if (!bytes) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} Go`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} Mo`;
}

function insertVariable(variable: string) {
  const textarea = promptTextarea.value;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = form.reportPrompt.substring(0, start);
  const after = form.reportPrompt.substring(end);
  form.reportPrompt = before + variable + after;
  nextTick(() => {
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + variable.length;
  });
}

function resetPrompt() {
  form.reportPrompt = defaultReportPrompt;
}

async function loadSettings() {
  try {
    const { data } = await api.get('/admin/plugins');
    if (data.ollama) {
      form.baseUrl = data.ollama.baseUrl || 'http://localhost:11434';
      form.selectedModel = data.ollama.selectedModel || '';
      form.enabled = data.ollama.enabled || false;
      form.reportPrompt = data.ollama.reportPrompt || defaultReportPrompt;
    }
  } catch (err) {
    console.error('Failed to load AI settings:', err);
  }
}

async function loadModels() {
  loadingModels.value = true;
  try {
    const { data } = await api.get('/admin/ai/models');
    installedModels.value = data;
    connectionOk.value = true;
  } catch {
    connectionOk.value = false;
    installedModels.value = [];
  } finally {
    loadingModels.value = false;
  }
}

async function testConnection() {
  testing.value = true;
  try {
    const { data } = await api.get('/admin/ai/models');
    installedModels.value = data;
    connectionOk.value = true;
  } catch {
    connectionOk.value = false;
  } finally {
    testing.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    await api.put('/admin/ai/settings', form);
  } catch (err) {
    console.error('Failed to save AI settings:', err);
  } finally {
    saving.value = false;
  }
}

async function pullModel() {
  if (!pullModelName.value.trim() || pulling.value) return;
  pulling.value = true;
  pullStatus.value = '';
  pullError.value = false;
  pullPercent.value = 0;
  pullDownloaded.value = 0;
  pullTotal.value = 0;
  pullStatusText.value = t('admin.connecting');
  pullProgressLabel.value = t('admin.downloading', { model: pullModelName.value });

  pullAbortController = new AbortController();
  const token = localStorage.getItem('accessToken');

  try {
    const response = await fetch(`${SERVER_URL}/api/admin/ai/models/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ model: pullModelName.value }),
      signal: pullAbortController.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));

          if (event.type === 'progress') {
            pullPercent.value = event.percent;
            pullDownloaded.value = event.completed;
            pullTotal.value = event.total;
            pullStatusText.value = event.status || t('admin.downloadProgress');
          } else if (event.type === 'status') {
            pullStatusText.value = event.status || '';
            if (event.status?.includes('verifying') || event.status?.includes('writing')) {
              pullPercent.value = 100;
              pullStatusText.value = t('admin.finalizing');
            }
          } else if (event.type === 'done') {
            pullStatus.value = event.message;
            pullError.value = false;
            pullModelName.value = '';
            await loadModels();
          } else if (event.type === 'error') {
            pullStatus.value = event.message;
            pullError.value = true;
          } else if (event.type === 'cancelled') {
            pullStatus.value = event.message;
            pullError.value = true;
          }
        } catch {
          // skip malformed events
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      pullStatus.value = t('admin.downloadCancelled');
      pullError.value = true;
    } else {
      pullStatus.value = `Erreur: ${err.message}`;
      pullError.value = true;
    }
  } finally {
    pulling.value = false;
    pullAbortController = null;
  }
}

async function cancelPull() {
  if (pullAbortController) {
    pullAbortController.abort();
  }
  try {
    await api.post('/admin/ai/models/pull/cancel', { model: pullModelName.value });
  } catch {
    // server-side cancel is best-effort
  }
}

async function removeModel(name: string) {
  try {
    await api.delete(`/admin/ai/models/${encodeURIComponent(name)}`);
    if (form.selectedModel === name) form.selectedModel = '';
    await loadModels();
  } catch (err: any) {
    console.error('Failed to delete model:', err);
  }
}

// Template management functions
function insertTplVariable(variable: string) {
  const textarea = tplPromptTextarea.value;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = tplForm.prompt.substring(0, start);
  const after = tplForm.prompt.substring(end);
  tplForm.prompt = before + variable + after;
  nextTick(() => {
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + variable.length;
  });
}

async function loadTemplates() {
  loadingTemplates.value = true;
  try {
    const { data } = await api.get('/report-templates');
    reportTemplates.value = data.templates || [];
  } catch (err) {
    console.error('Failed to load report templates:', err);
  } finally {
    loadingTemplates.value = false;
  }
}

function openCreateTemplate() {
  tplEditingId.value = null;
  tplForm.title = '';
  tplForm.description = '';
  tplForm.prompt = '';
  tplForm.isShared = false;
  tplFormOpen.value = true;
}

function editTemplate(tpl: { _id: string; title: string; description: string; prompt: string; isShared: boolean }) {
  tplEditingId.value = tpl._id;
  tplForm.title = tpl.title;
  tplForm.description = tpl.description;
  tplForm.prompt = tpl.prompt;
  tplForm.isShared = tpl.isShared;
  tplFormOpen.value = true;
}

async function saveTemplate() {
  if (!tplForm.title.trim() || !tplForm.prompt.trim()) return;
  tplSaving.value = true;
  try {
    if (tplEditingId.value) {
      await api.put(`/report-templates/${tplEditingId.value}`, tplForm);
    } else {
      await api.post('/report-templates', tplForm);
    }
    tplFormOpen.value = false;
    await loadTemplates();
  } catch (err) {
    console.error('Failed to save report template:', err);
  } finally {
    tplSaving.value = false;
  }
}

async function deleteTemplate(id: string) {
  try {
    await api.delete(`/report-templates/${id}`);
    await loadTemplates();
  } catch (err) {
    console.error('Failed to delete report template:', err);
  }
}

onMounted(() => {
  loadSettings();
  loadModels();
  loadTemplates();
});

onUnmounted(() => {
  if (pullAbortController) pullAbortController.abort();
});
</script>

<style scoped>
.admin-ai {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.admin-section-header {
  margin-bottom: 4px;
}
.admin-section-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
}
.admin-section-subtitle {
  font-size: 13px;
  color: var(--me-text-muted);
  margin-top: 4px;
}
.ai-card {
  padding: 20px;
}
.ai-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.ai-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent-glow);
  color: var(--me-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ai-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.ai-card-desc {
  font-size: 12px;
  color: var(--me-text-muted);
  margin-top: 2px;
}
.ai-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ai-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ai-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--me-text-secondary);
}
.ai-field-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.ai-field-row .v-text-field {
  flex: 1;
}
.ai-test-btn {
  padding: 6px 14px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  white-space: nowrap;
  transition: all 0.15s;
}
.ai-test-btn:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
}
.ai-test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.ai-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ai-toggle-label {
  font-size: 13px;
  color: var(--me-text-muted);
}
.ai-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.ai-pull-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}
.ai-suggestions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.ai-suggestion-label {
  font-size: 11px;
  color: var(--me-text-muted);
}
.ai-suggestion-chip {
  padding: 3px 10px;
  border-radius: 10px;
  background: var(--me-accent-glow);
  border: none;
  color: var(--me-accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--me-font-mono);
  transition: all 0.15s;
}
.ai-suggestion-chip:hover {
  background: var(--me-accent);
  color: var(--me-bg-deep);
}
.ai-models-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
}
.ai-model-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ai-model-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
}
.ai-model-size {
  font-size: 11px;
  color: var(--me-text-muted);
}
.ai-model-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ai-model-select-btn,
.ai-model-delete-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.ai-model-select-btn:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
}
.ai-model-delete-btn:hover {
  border-color: #f87171;
  color: #f87171;
}
.ai-model-selected {
  font-size: 11px;
  color: var(--me-accent);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}
.ai-empty {
  text-align: center;
  padding: 24px;
  color: var(--me-text-muted);
  font-size: 13px;
}
.ai-empty-hint {
  font-size: 12px;
  margin-top: 4px;
}
.ai-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  color: var(--me-text-muted);
  font-size: 13px;
}
.ai-progress-section {
  margin-bottom: 20px;
  padding: 16px;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
}
.ai-progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.ai-progress-info {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ai-progress-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
}
.ai-progress-spin {
  animation: spin 1s linear infinite;
  color: var(--me-accent);
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.ai-cancel-btn {
  padding: 4px 12px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid #f87171;
  color: #f87171;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  transition: all 0.15s;
}
.ai-cancel-btn:hover {
  background: rgba(248, 113, 113, 0.1);
}
.ai-progress-bar-track {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--me-bg-deep);
  overflow: hidden;
}
.ai-progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  background: var(--me-accent);
  transition: width 0.3s ease;
  min-width: 0;
}
.ai-progress-details {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: var(--me-text-muted);
  font-family: var(--me-font-mono);
}
.ai-pull-status {
  margin-bottom: 16px;
  padding: 8px 12px;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-elevated);
  font-size: 12px;
  color: var(--me-text-secondary);
  display: flex;
  align-items: center;
}
.ai-info-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ai-info-item {
  padding: 10px 14px;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
}
.ai-info-item strong {
  font-size: 13px;
  color: var(--me-accent);
}
.ai-info-item p {
  font-size: 12px;
  color: var(--me-text-muted);
  margin-top: 4px;
}
.plugin-status {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 10px;
  font-family: var(--me-font-mono);
}
.plugin-status--active {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}
.plugin-status--inactive {
  background: rgba(248, 113, 113, 0.1);
  color: #f87171;
}
.ai-prompt-textarea {
  width: 100%;
  padding: 12px;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  color: var(--me-text-primary);
  font-family: var(--me-font-mono);
  font-size: 12px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
}
.ai-prompt-textarea:focus {
  border-color: var(--me-accent);
}
.ai-prompt-vars {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ai-prompt-var-chip {
  padding: 3px 10px;
  border-radius: 10px;
  background: var(--me-accent-glow);
  border: none;
  color: var(--me-accent);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--me-font-mono);
  transition: all 0.15s;
}
.ai-prompt-var-chip:hover {
  background: var(--me-accent);
  color: var(--me-bg-deep);
}
.ai-prompt-vars-hint {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: 2px;
}
/* Report templates */
.ai-tpl-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  margin-bottom: 16px;
}
.ai-tpl-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.ai-tpl-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-tpl-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
}
.ai-tpl-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.ai-tpl-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
}
.ai-tpl-desc {
  font-size: 11px;
  color: var(--me-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ai-tpl-badges {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}
.ai-tpl-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 8px;
  font-family: var(--me-font-mono);
}
.ai-tpl-badge--shared {
  background: rgba(52, 211, 153, 0.15);
  color: #34d399;
}
.ai-tpl-badge--private {
  background: rgba(148, 163, 184, 0.15);
  color: var(--me-text-muted);
}
.ai-tpl-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.me-btn-ghost {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
}
.me-btn-ghost:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
}
.ai-reset-btn {
  padding: 6px 14px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  transition: all 0.15s;
}
.ai-reset-btn:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
}
.me-btn-primary {
  padding: 8px 20px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  white-space: nowrap;
}
.me-btn-primary:hover {
  box-shadow: 0 0 16px var(--me-accent-glow);
}
.me-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
