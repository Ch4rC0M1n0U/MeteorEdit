<template>
  <div class="cs-root">
    <!-- Header -->
    <div class="cs-header">
      <div class="cs-header-title">
        <span class="mdi mdi-domain" style="font-size: 28px; color: var(--me-accent);"></span>
        <h1>{{ t('companies.title') }}</h1>
      </div>
      <p class="cs-header-sub">{{ t('companies.subtitle') }}</p>
    </div>

    <!-- Source tabs -->
    <div class="cs-source-tabs">
      <button
        v-for="src in sources"
        :key="src.id"
        :class="['cs-source-tab', { 'cs-source-tab--active': activeSource === src.id, 'cs-source-tab--disabled': src.disabled }]"
        :disabled="src.disabled"
        @click="!src.disabled && (activeSource = src.id)"
      >
        <span :class="['mdi', src.icon]" style="font-size: 18px;"></span>
        <span>{{ src.label }}</span>
        <Tag v-if="src.disabled" :value="t('common.comingSoon')" severity="secondary" class="ml-2" />
      </button>
    </div>

    <!-- Search panel: BCE -->
    <div v-if="activeSource === 'bce'" class="cs-panel glass-card">
      <div class="cs-mode-tabs">
        <button v-for="m in modes" :key="m.id" :class="['cs-mode-tab', { active: mode === m.id }]" @click="mode = m.id">
          <span :class="['mdi', m.icon]"></span>
          <span>{{ m.label }}</span>
        </button>
      </div>

      <!-- Mode: name -->
      <div v-if="mode === 'name'" class="cs-form">
        <div class="cs-field cs-field-grow">
          <label>{{ t('companies.fields.name') }}</label>
          <InputText v-model="form.name" :placeholder="t('companies.placeholders.name')" class="w-full" @keydown.enter="search" />
        </div>
        <div class="cs-field cs-field-narrow">
          <label>{{ t('companies.fields.postCode') }}</label>
          <InputText v-model="form.postCode" placeholder="1000" class="w-full" @keydown.enter="search" />
        </div>
      </div>

      <!-- Mode: address -->
      <div v-if="mode === 'address'" class="cs-form">
        <div class="cs-field cs-field-grow">
          <label>{{ t('companies.fields.street') }}</label>
          <InputText v-model="form.street" :placeholder="t('companies.placeholders.street')" class="w-full" @keydown.enter="search" />
        </div>
        <div class="cs-field cs-field-narrow">
          <label>{{ t('companies.fields.houseNumber') }}</label>
          <InputText v-model="form.houseNumber" placeholder="12" class="w-full" @keydown.enter="search" />
        </div>
        <div class="cs-field">
          <label>{{ t('companies.fields.city') }}</label>
          <InputText v-model="form.city" :placeholder="t('companies.placeholders.city')" class="w-full" @keydown.enter="search" />
        </div>
        <div class="cs-field cs-field-narrow">
          <label>{{ t('companies.fields.postCode') }}</label>
          <InputText v-model="form.postCode" placeholder="1000" class="w-full" @keydown.enter="search" />
        </div>
      </div>

      <!-- Mode: vat -->
      <div v-if="mode === 'vat'" class="cs-form">
        <div class="cs-field cs-field-grow">
          <label>{{ t('companies.fields.vat') }}</label>
          <InputText v-model="form.vat" placeholder="BE0123456789" class="w-full mono" @keydown.enter="search" />
        </div>
      </div>

      <div class="cs-actions">
        <Button :label="t('common.search')" icon="pi pi-search" :loading="loading" :disabled="!canSearch" @click="search" />
        <Button :label="t('common.reset')" outlined icon="pi pi-times" @click="resetForm" />
      </div>

      <div v-if="error" class="cs-error">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ error }}</span>
        <button v-if="error.toLowerCase().includes('token')" class="cs-error-cta" @click="goToTokenSettings">
          {{ t('companies.configureToken') }}
        </button>
      </div>
    </div>

    <!-- Results -->
    <div v-if="results.length > 0" class="cs-results">
      <div class="cs-results-toolbar">
        <span class="cs-results-count">{{ t('companies.resultsCount', { n: results.length }) }}</span>
        <div class="cs-results-actions">
          <Button v-if="selected.length > 0" :label="t('companies.exportSelection', { n: selected.length })" icon="pi pi-download" size="small" @click="openExport()" />
          <Button :label="t('common.clear')" icon="pi pi-times" size="small" outlined @click="clearResults" />
        </div>
      </div>

      <DataTable :value="results" v-model:selection="selected" dataKey="cbe_number" stripedRows class="cs-table">
        <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
        <Column :header="t('companies.cols.vat')" style="width: 160px">
          <template #body="{ data }">
            <code class="mono cs-vat">{{ formatVat(data.cbe_number) }}</code>
          </template>
        </Column>
        <Column :header="t('companies.cols.denomination')">
          <template #body="{ data }">
            <div class="cs-cell-name">{{ data.denomination || data.commercial_name || '—' }}</div>
            <div v-if="data.juridical_form_short" class="cs-cell-meta">{{ data.juridical_form_short }}</div>
          </template>
        </Column>
        <Column :header="t('companies.cols.address')">
          <template #body="{ data }">
            <span class="cs-cell-address">{{ data.address?.full_address || '—' }}</span>
          </template>
        </Column>
        <Column :header="t('companies.cols.status')" style="width: 140px">
          <template #body="{ data }">
            <Tag v-if="data.status" :value="data.status" :severity="data.status?.toLowerCase().includes('actif') || data.status?.toLowerCase().includes('active') ? 'success' : 'warning'" />
            <span v-else>—</span>
          </template>
        </Column>
        <Column :header="t('companies.cols.actions')" style="width: 140px">
          <template #body="{ data }">
            <Button icon="pi pi-eye" size="small" text rounded :title="t('companies.viewDetails')" @click="openDetails(data.cbe_number)" />
            <Button icon="pi pi-download" size="small" text rounded :title="t('companies.exportThis')" @click="openExport([data.cbe_number])" />
          </template>
        </Column>
      </DataTable>
    </div>

    <div v-else-if="hasSearched && !loading" class="cs-empty">
      <i class="mdi mdi-magnify-close" style="font-size: 48px;"></i>
      <p>{{ t('companies.noResults') }}</p>
    </div>

    <!-- Details dialog -->
    <Dialog v-model:visible="detailsOpen" :header="t('companies.detailsTitle')" modal :style="{ width: '720px' }">
      <div v-if="detailsLoading" class="cs-detail-loading">
        <ProgressSpinner style="width: 40px; height: 40px" strokeWidth="3" />
      </div>
      <div v-else-if="details" class="cs-detail">
        <h2 class="cs-detail-name">{{ details.denomination_with_legal_form || details.denomination || formatVat(details.cbe_number) }}</h2>
        <div class="cs-detail-grid">
          <div><strong>{{ t('companies.fields.vat') }}:</strong> <code class="mono">{{ formatVat(details.cbe_number) }}</code></div>
          <div v-if="details.cbe_number_formatted"><strong>{{ t('companies.fields.bce') }}:</strong> <code class="mono">{{ details.cbe_number_formatted }}</code></div>
          <div v-if="details.juridical_form"><strong>{{ t('companies.fields.juridicalForm') }}:</strong> {{ details.juridical_form }}</div>
          <div v-if="details.juridical_situation"><strong>{{ t('companies.fields.situation') }}:</strong> {{ details.juridical_situation }}</div>
          <div v-if="details.status"><strong>{{ t('companies.fields.status') }}:</strong> {{ details.status }}</div>
          <div v-if="details.start_date"><strong>{{ t('companies.fields.startDate') }}:</strong> {{ details.start_date }}</div>
          <div v-if="details.address?.full_address" class="span-2"><strong>{{ t('companies.fields.address') }}:</strong> {{ details.address.full_address }}</div>
        </div>
        <div v-if="details.contact_infos && (details.contact_infos.email || details.contact_infos.phone || details.contact_infos.web)" class="cs-detail-section">
          <h3>{{ t('companies.contact') }}</h3>
          <div v-if="details.contact_infos.email"><i class="pi pi-envelope"></i> <a :href="`mailto:${details.contact_infos.email}`">{{ details.contact_infos.email }}</a></div>
          <div v-if="details.contact_infos.phone"><i class="pi pi-phone"></i> {{ details.contact_infos.phone }}</div>
          <div v-if="details.contact_infos.web"><i class="pi pi-globe"></i> <a :href="details.contact_infos.web" target="_blank" rel="noopener">{{ details.contact_infos.web }}</a></div>
        </div>
        <div v-if="details.nace_activities && details.nace_activities.length > 0" class="cs-detail-section">
          <h3>{{ t('companies.naceActivities') }}</h3>
          <ul class="cs-nace">
            <li v-for="(n, i) in details.nace_activities" :key="i">
              <code class="mono">[{{ n.code }}]</code>
              <span v-if="n.classification === 'main'" class="cs-nace-main" :title="t('companies.mainActivity')">★</span>
              {{ n.description }}
              <span class="cs-nace-version">(NACE {{ n.nace_version }})</span>
            </li>
          </ul>
        </div>
      </div>
      <template #footer>
        <Button v-if="details" :label="t('companies.exportThis')" icon="pi pi-download" @click="openExport([details!.cbe_number]); detailsOpen = false" />
        <Button :label="t('common.close')" outlined @click="detailsOpen = false" />
      </template>
    </Dialog>

    <!-- Export dialog -->
    <Dialog v-model:visible="exportOpen" :header="t('companies.exportDialogTitle')" modal :style="{ width: '520px' }">
      <div class="cs-export-form">
        <div v-if="!lockedDossierId" class="cs-field">
          <label>{{ t('companies.exportTargetDossier') }}</label>
          <Select v-model="exportDossierId" :options="dossierOptions" optionLabel="label" optionValue="value" :placeholder="t('companies.selectDossier')" class="w-full" filter />
        </div>
        <div v-else class="cs-locked-dossier">
          <i class="pi pi-folder"></i>
          <span>{{ t('companies.exportTargetDossier') }} :</span>
          <strong>{{ dossierOptions.find(d => d.value === lockedDossierId)?.label || lockedDossierId }}</strong>
        </div>
        <p class="cs-export-info">
          <i class="pi pi-info-circle"></i>
          {{ t('companies.exportNoteCount', { n: pendingExportVats.length }) }}
        </p>
        <div v-if="exportResult" class="cs-export-result">
          <div class="cs-export-success">
            <i class="pi pi-check-circle"></i>
            {{ t('companies.exportCreated', { n: exportResult.created.length }) }}
          </div>
          <div v-if="exportResult.errors.length > 0" class="cs-export-errors">
            <i class="pi pi-exclamation-triangle"></i>
            {{ t('companies.exportErrors', { n: exportResult.errors.length }) }}
            <ul>
              <li v-for="(e, i) in exportResult.errors" :key="i"><code class="mono">{{ e.vat }}</code>: {{ e.message }}</li>
            </ul>
          </div>
        </div>
      </div>
      <template #footer>
        <Button :label="t('common.close')" outlined @click="exportOpen = false" />
        <Button :label="t('companies.doExport')" icon="pi pi-download" :loading="exportLoading" :disabled="!(lockedDossierId || exportDossierId) || pendingExportVats.length === 0" @click="doExport" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import api from '../services/api';
import { useDossierStore } from '../stores/dossier';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dialog from 'primevue/dialog';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Select from 'primevue/select';
import ProgressSpinner from 'primevue/progressspinner';

interface BceCompany {
  cbe_number: string;
  cbe_number_formatted?: string;
  denomination?: string;
  commercial_name?: string;
  abbreviation?: string;
  juridical_form?: string;
  juridical_form_short?: string;
  juridical_situation?: string;
  denomination_with_legal_form?: string;
  status?: string;
  start_date?: string;
  address?: { full_address?: string };
  contact_infos?: { email?: string; phone?: string; web?: string };
  nace_activities?: Array<{ code: string; description: string; classification: string; nace_version: string }>;
}
interface ExportResult {
  created: Array<{ vat: string; nodeId: string; title: string }>;
  errors: Array<{ vat: string; message: string }>;
  folderId: string;
}

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const dossierStore = useDossierStore();

const lockedDossierId = computed(() => {
  const q = route.query.dossierId;
  return typeof q === 'string' && q.length > 0 ? q : '';
});

type SourceId = 'bce' | 'eu';
const activeSource = ref<SourceId>('bce');
const sources = computed(() => [
  { id: 'bce' as SourceId, label: t('companies.sources.bce'), icon: 'mdi-flag', disabled: false },
  { id: 'eu' as SourceId, label: t('companies.sources.eu'), icon: 'mdi-earth', disabled: true },
]);

type Mode = 'name' | 'address' | 'vat';
const mode = ref<Mode>('name');
const modes = computed(() => [
  { id: 'name' as Mode, label: t('companies.modes.name'), icon: 'mdi-text-search' },
  { id: 'address' as Mode, label: t('companies.modes.address'), icon: 'mdi-map-marker' },
  { id: 'vat' as Mode, label: t('companies.modes.vat'), icon: 'mdi-numeric' },
]);

const form = ref({ name: '', street: '', houseNumber: '', city: '', postCode: '', vat: '' });
const loading = ref(false);
const error = ref('');
const hasSearched = ref(false);
const results = ref<BceCompany[]>([]);
const selected = ref<BceCompany[]>([]);

const detailsOpen = ref(false);
const detailsLoading = ref(false);
const details = ref<BceCompany | null>(null);

const exportOpen = ref(false);
const exportLoading = ref(false);
const exportDossierId = ref<string>('');
const pendingExportVats = ref<string[]>([]);
const exportResult = ref<ExportResult | null>(null);
const dossierOptions = computed(() => dossierStore.dossiers.map((d: any) => ({ label: d.title, value: d._id })));

const canSearch = computed(() => {
  if (mode.value === 'name') return !!form.value.name.trim();
  if (mode.value === 'vat') return !!form.value.vat.trim();
  if (mode.value === 'address') return !!(form.value.street.trim() || form.value.city.trim() || form.value.postCode.trim() || form.value.houseNumber.trim());
  return false;
});

function formatVat(cbe: string): string {
  const digits = String(cbe ?? '').replace(/\D/g, '').padStart(10, '0').slice(-10);
  return `BE${digits}`;
}

function resetForm(): void {
  form.value = { name: '', street: '', houseNumber: '', city: '', postCode: '', vat: '' };
  results.value = [];
  selected.value = [];
  hasSearched.value = false;
  error.value = '';
}
function clearResults(): void {
  results.value = [];
  selected.value = [];
  hasSearched.value = false;
}

async function search(): Promise<void> {
  if (!canSearch.value) return;
  loading.value = true;
  error.value = '';
  hasSearched.value = true;
  try {
    let url = '';
    const params: Record<string, string> = {};
    if (mode.value === 'name') {
      url = '/bce/search/name';
      params.name = form.value.name.trim();
      if (form.value.postCode.trim()) params.post_code = form.value.postCode.trim();
    } else if (mode.value === 'address') {
      url = '/bce/search/address';
      if (form.value.street.trim()) params.street = form.value.street.trim();
      if (form.value.houseNumber.trim()) params.house_number = form.value.houseNumber.trim();
      if (form.value.city.trim()) params.city = form.value.city.trim();
      if (form.value.postCode.trim()) params.post_code = form.value.postCode.trim();
    } else if (mode.value === 'vat') {
      const cbe = form.value.vat.replace(/\D/g, '');
      const { data } = await api.get<{ data: BceCompany }>(`/bce/company/${cbe}`);
      results.value = [data.data];
      return;
    }
    const { data } = await api.get<{ data: BceCompany[] }>(url, { params });
    results.value = Array.isArray(data?.data) ? data.data : [];
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || String(err);
    error.value = msg;
    results.value = [];
  } finally {
    loading.value = false;
  }
}

async function openDetails(cbe: string): Promise<void> {
  detailsOpen.value = true;
  detailsLoading.value = true;
  details.value = null;
  try {
    const { data } = await api.get<{ data: BceCompany }>(`/bce/company/${cbe.replace(/\D/g, '')}`);
    details.value = data.data;
  } catch (err: any) {
    toast.add({ severity: 'error', summary: t('common.error'), detail: err?.response?.data?.message || err?.message, life: 4000 });
    detailsOpen.value = false;
  } finally {
    detailsLoading.value = false;
  }
}

function openExport(vats?: string[]): void {
  pendingExportVats.value = vats ?? selected.value.map((c) => c.cbe_number);
  if (pendingExportVats.value.length === 0) return;
  exportResult.value = null;
  if (lockedDossierId.value) exportDossierId.value = lockedDossierId.value;
  exportOpen.value = true;
}

async function doExport(): Promise<void> {
  const targetId = lockedDossierId.value || exportDossierId.value;
  if (!targetId || pendingExportVats.value.length === 0) return;
  exportLoading.value = true;
  exportResult.value = null;
  try {
    const { data } = await api.post<ExportResult>('/bce/export', {
      dossierId: targetId,
      vatNumbers: pendingExportVats.value,
    });
    exportResult.value = data;
    if (data.created.length > 0) {
      toast.add({ severity: 'success', summary: t('companies.exportSuccess'), detail: t('companies.exportCreated', { n: data.created.length }), life: 3000 });
    }
  } catch (err: any) {
    toast.add({ severity: 'error', summary: t('common.error'), detail: err?.response?.data?.message || err?.message, life: 5000 });
  } finally {
    exportLoading.value = false;
  }
}

function goToTokenSettings(): void {
  router.push('/profile?section=external-tokens');
}

onMounted(async () => {
  if (dossierStore.dossiers.length === 0) {
    try { await dossierStore.fetchDossiers(); } catch { /* ignore */ }
  }
});
</script>

<style scoped>
.cs-root { padding: 24px 32px; max-width: 1280px; margin: 0 auto; }
.cs-header { margin-bottom: 16px; }
.cs-header-title { display: flex; align-items: center; gap: 12px; }
.cs-header-title h1 { font-size: 24px; font-weight: 700; margin: 0; color: var(--me-text-primary); }
.cs-header-sub { color: var(--me-text-muted); font-size: 14px; margin: 4px 0 0 40px; }

.cs-source-tabs { display: flex; gap: 8px; margin-bottom: 16px; border-bottom: 1px solid var(--me-border); padding-bottom: 0; }
.cs-source-tab { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: transparent; border: none; border-bottom: 2px solid transparent; color: var(--me-text-secondary); font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
.cs-source-tab:hover:not(:disabled) { color: var(--me-text-primary); }
.cs-source-tab--active { color: var(--me-accent); border-bottom-color: var(--me-accent); }
.cs-source-tab--disabled { opacity: 0.5; cursor: not-allowed; }

.cs-panel { padding: 20px; margin-bottom: 16px; }
.cs-mode-tabs { display: flex; gap: 4px; margin-bottom: 16px; background: var(--me-bg-elev1); padding: 4px; border-radius: var(--me-radius-xs); width: fit-content; }
.cs-mode-tab { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: transparent; border: none; border-radius: var(--me-radius-xs); color: var(--me-text-secondary); font-size: 13px; cursor: pointer; transition: all 0.15s; }
.cs-mode-tab:hover { color: var(--me-text-primary); }
.cs-mode-tab.active { background: var(--me-bg-surface); color: var(--me-accent); font-weight: 600; }

.cs-form { display: flex; gap: 12px; flex-wrap: wrap; align-items: end; margin-bottom: 16px; }
.cs-field { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
.cs-field-grow { flex: 1; min-width: 240px; }
.cs-field-narrow { width: 120px; min-width: 120px; }
.cs-field label { font-size: 12px; font-weight: 600; color: var(--me-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }

.cs-actions { display: flex; gap: 8px; }
.cs-error { display: flex; align-items: center; gap: 8px; padding: 12px 16px; margin-top: 12px; background: var(--me-error-bg, #fee); border: 1px solid var(--me-error-border, #fbb); border-radius: var(--me-radius-xs); color: var(--me-error, #c33); font-size: 13px; }
.cs-error-cta { margin-left: auto; padding: 4px 12px; background: var(--me-accent); color: #fff; border: none; border-radius: var(--me-radius-xs); cursor: pointer; font-size: 12px; }

.cs-results { margin-top: 16px; }
.cs-results-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.cs-results-count { font-size: 13px; color: var(--me-text-muted); }
.cs-results-actions { display: flex; gap: 8px; }
.cs-table { font-size: 13px; }
.cs-vat { font-size: 12px; color: var(--me-accent); }
.cs-cell-name { font-weight: 600; }
.cs-cell-meta { font-size: 12px; color: var(--me-text-muted); }
.cs-cell-address { font-size: 13px; }

.cs-empty { text-align: center; padding: 60px 20px; color: var(--me-text-muted); }
.cs-empty p { margin-top: 12px; font-size: 14px; }

.cs-detail-loading { display: flex; justify-content: center; padding: 40px; }
.cs-detail-name { font-size: 18px; margin: 0 0 16px; color: var(--me-text-primary); }
.cs-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; }
.cs-detail-grid .span-2 { grid-column: span 2; }
.cs-detail-section { margin-top: 20px; }
.cs-detail-section h3 { font-size: 14px; margin: 0 0 8px; color: var(--me-text-primary); }
.cs-detail-section div { margin-bottom: 4px; font-size: 13px; }
.cs-detail-section i { width: 16px; margin-right: 6px; color: var(--me-accent); }
.cs-detail-section a { color: var(--me-accent); text-decoration: none; }
.cs-detail-section a:hover { text-decoration: underline; }

.cs-nace { list-style: none; padding: 0; margin: 0; font-size: 13px; }
.cs-nace li { padding: 4px 0; border-bottom: 1px dashed var(--me-border); }
.cs-nace li:last-child { border-bottom: none; }
.cs-nace-main { color: var(--me-accent); margin: 0 4px; }
.cs-nace-version { color: var(--me-text-muted); font-size: 11px; margin-left: 6px; }

.cs-export-form { display: flex; flex-direction: column; gap: 12px; }
.cs-locked-dossier { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--me-bg-elev1); border-radius: var(--me-radius-xs); font-size: 13px; }
.cs-locked-dossier i { color: var(--me-accent); }
.cs-locked-dossier strong { color: var(--me-text-primary); }
.cs-export-info { font-size: 13px; color: var(--me-text-muted); margin: 0; }
.cs-export-result { margin-top: 12px; padding: 12px; background: var(--me-bg-elev1); border-radius: var(--me-radius-xs); font-size: 13px; }
.cs-export-success { color: var(--me-success, #2a7); display: flex; align-items: center; gap: 6px; }
.cs-export-errors { color: var(--me-error, #c33); margin-top: 8px; }
.cs-export-errors ul { margin: 4px 0 0 24px; padding: 0; font-size: 12px; }

.ml-2 { margin-left: 8px; }
.w-full { width: 100%; }
</style>
