<template>
  <div class="shodan-panel" :class="{ open: modelValue }">
    <div class="shodan-panel-header">
      <h3 class="mono">
        <span class="mdi mdi-radar" style="font-size: 16px; margin-right: 6px; color: #ef4444;"></span>
        Shodan
      </h3>
      <button class="shodan-close-btn" @click="$emit('update:modelValue', false)">
        <i class="pi pi-times" style="font-size: 16px"></i>
      </button>
    </div>

    <!-- Status -->
    <div v-if="!available" class="shodan-unavailable">
      <span class="mdi mdi-alert-circle-outline" style="font-size: 20px; color: #f97316;"></span>
      <span>{{ $t('map.shodanUnavailable') }}</span>
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="shodan-filters">
        <div class="shodan-filters-title mono">{{ $t('map.shodanFilters') }}</div>
        <div class="shodan-filter-chips">
          <button
            v-for="f in filters"
            :key="f.key"
            class="shodan-chip"
            :class="{ active: activeFilter === f.key }"
            :style="activeFilter === f.key ? { background: f.color + '22', borderColor: f.color, color: f.color } : {}"
            @click="selectFilter(f)"
          >
            <span :class="['mdi', f.icon]" style="font-size: 14px;"></span>
            <span>{{ f.label }}</span>
          </button>
        </div>

        <div class="shodan-custom-filter">
          <InputText
            v-model="customQuery"
            :placeholder="$t('map.shodanCustomFilter')"
            size="small"
            fluid
          />
        </div>

        <div class="shodan-radius-row">
          <label class="shodan-label mono">{{ $t('map.shodanRadius') }}: {{ radius }} km</label>
          <input type="range" v-model.number="radius" min="1" max="100" step="1" class="shodan-slider" />
        </div>

        <Button
          :label="searching ? $t('map.shodanSearching') : $t('map.shodanSearch')"
          icon="pi pi-search"
          :loading="searching"
          :disabled="searching"
          size="small"
          severity="danger"
          @click="search"
          style="width: 100%;"
        />
      </div>

      <!-- Results -->
      <div class="shodan-results-header" v-if="totalResults !== null">
        <span class="mono">{{ totalResults }} {{ $t('map.shodanResults') }}</span>
        <button v-if="results.length" class="shodan-clear-btn" @click="clearResults">
          <span class="mdi mdi-close-circle-outline" style="font-size: 14px;"></span>
          {{ $t('map.shodanClear') }}
        </button>
      </div>

      <div class="shodan-results-list">
        <div
          v-for="r in results"
          :key="r.ip + ':' + r.port"
          class="shodan-result-item"
          @click="$emit('fly-to', r)"
        >
          <div class="shodan-result-head">
            <span class="shodan-result-ip mono">{{ r.ip }}</span>
            <span class="shodan-result-port mono">:{{ r.port }}</span>
          </div>
          <div class="shodan-result-meta">
            <span v-if="r.product" class="shodan-tag">{{ r.product }} {{ r.version || '' }}</span>
            <span v-if="r.org" class="shodan-tag">{{ r.org }}</span>
            <span v-if="r.os" class="shodan-tag">{{ r.os }}</span>
          </div>
          <div v-if="r.location.city || r.location.country" class="shodan-result-loc">
            <span class="mdi mdi-map-marker-outline" style="font-size: 12px;"></span>
            {{ [r.location.city, r.location.country].filter(Boolean).join(', ') }}
          </div>
          <div v-if="r.vulns.length" class="shodan-result-vulns">
            <span v-for="v in r.vulns.slice(0, 3)" :key="v" class="shodan-vuln-tag">{{ v }}</span>
            <span v-if="r.vulns.length > 3" class="shodan-vuln-more">+{{ r.vulns.length - 3 }}</span>
          </div>
          <div class="shodan-result-actions">
            <a
              :href="'https://www.shodan.io/host/' + r.ip"
              target="_blank"
              rel="noopener"
              class="shodan-action-btn"
              :title="$t('map.shodanOpenShodan')"
              @click.stop
            >
              <span class="mdi mdi-open-in-new" style="font-size: 14px;"></span>
            </a>
            <button class="shodan-action-btn" @click.stop="$emit('add-marker', r)" :title="$t('map.shodanAddMarker')">
              <span class="mdi mdi-map-marker-plus-outline" style="font-size: 14px;"></span>
            </button>
            <button class="shodan-action-btn" @click.stop="$emit('host-detail', r.ip)" :title="$t('map.shodanHostDetail')">
              <span class="mdi mdi-information-outline" style="font-size: 14px;"></span>
            </button>
          </div>
        </div>

        <div v-if="results.length && totalResults && totalResults > results.length" class="shodan-load-more">
          <Button
            :label="$t('map.shodanLoadMore')"
            text
            size="small"
            :loading="searching"
            @click="loadMore"
          />
        </div>
      </div>
    </template>
  </div>

  <!-- Host Detail Dialog -->
  <Dialog
    :visible="!!hostDetail"
    modal
    :header="hostDetail?.ip || ''"
    :style="{ width: '560px' }"
    @update:visible="!$event && (hostDetail = null)"
  >
    <div v-if="hostDetail" class="shodan-host-detail">
      <div class="shodan-host-row">
        <span class="shodan-host-label mono">Organisation</span>
        <span>{{ hostDetail.org || '-' }}</span>
      </div>
      <div class="shodan-host-row">
        <span class="shodan-host-label mono">ISP</span>
        <span>{{ hostDetail.isp || '-' }}</span>
      </div>
      <div class="shodan-host-row">
        <span class="shodan-host-label mono">OS</span>
        <span>{{ hostDetail.os || '-' }}</span>
      </div>
      <div class="shodan-host-row">
        <span class="shodan-host-label mono">{{ $t('map.shodanLocation') }}</span>
        <span>{{ [hostDetail.location?.city, hostDetail.location?.country].filter(Boolean).join(', ') || '-' }}</span>
      </div>
      <div class="shodan-host-row">
        <span class="shodan-host-label mono">Hostnames</span>
        <span>{{ hostDetail.hostnames?.join(', ') || '-' }}</span>
      </div>
      <div class="shodan-host-row">
        <span class="shodan-host-label mono">Ports</span>
        <span class="mono">{{ hostDetail.ports?.join(', ') || '-' }}</span>
      </div>
      <div v-if="hostDetail.vulns?.length" class="shodan-host-vulns">
        <span class="shodan-host-label mono">Vulns</span>
        <div class="shodan-host-vuln-list">
          <span v-for="v in hostDetail.vulns" :key="v" class="shodan-vuln-tag">{{ v }}</span>
        </div>
      </div>
      <div v-if="hostDetail.services?.length" class="shodan-host-services">
        <div class="shodan-host-label mono" style="margin-bottom: 8px;">Services</div>
        <div v-for="(s, i) in hostDetail.services" :key="i" class="shodan-service-item">
          <div class="shodan-service-head">
            <span class="mono">{{ s.port }}/{{ s.transport }}</span>
            <span v-if="s.product" class="shodan-tag">{{ s.product }} {{ s.version || '' }}</span>
            <span v-if="s.module" class="shodan-tag">{{ s.module }}</span>
          </div>
          <pre v-if="s.banner" class="shodan-service-banner">{{ s.banner }}</pre>
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../../services/api';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';

export interface ShodanResult {
  ip: string;
  port: number;
  transport: string;
  product: string | null;
  version: string | null;
  os: string | null;
  org: string | null;
  isp: string | null;
  hostnames: string[];
  domains: string[];
  location: {
    lat: number;
    lng: number;
    city: string;
    country: string;
    countryCode: string;
  };
  banner: string;
  timestamp: string;
  hasScreenshot: boolean;
  screenshotUrl: string | null;
  vulns: string[];
  tags: string[];
}

interface ShodanFilter {
  key: string;
  label: string;
  query: string;
  icon: string;
  color: string;
}

interface HostDetail {
  ip: string;
  hostnames: string[];
  org: string;
  os: string;
  isp: string;
  ports: number[];
  vulns: string[];
  location: { lat: number; lng: number; city: string; country: string };
  lastUpdate: string;
  services: Array<{
    port: number;
    transport: string;
    product: string;
    version: string;
    banner: string;
    module: string;
    hasScreenshot: boolean;
  }>;
}

const props = defineProps<{
  modelValue: boolean;
  mapCenter: [number, number];
}>();

const emit = defineEmits<{
  'update:modelValue': [val: boolean];
  'results': [results: ShodanResult[]];
  'fly-to': [result: ShodanResult];
  'host-detail': [ip: string];
  'add-marker': [result: ShodanResult];
  'clear': [];
}>();

const available = ref(false);
const filters = ref<ShodanFilter[]>([]);
const activeFilter = ref('all');
const customQuery = ref('');
const radius = ref(10);
const searching = ref(false);
const results = ref<ShodanResult[]>([]);
const totalResults = ref<number | null>(null);
const currentPage = ref(1);
const hostDetail = ref<HostDetail | null>(null);

async function checkStatus() {
  try {
    const { data } = await api.get('/shodan/status');
    available.value = data.available;
  } catch {
    available.value = false;
  }
}

async function loadFilters() {
  try {
    const { data } = await api.get('/shodan/filters');
    filters.value = data;
  } catch {
    filters.value = [];
  }
}

function selectFilter(f: ShodanFilter) {
  activeFilter.value = f.key;
  customQuery.value = f.query;
}

async function search() {
  if (searching.value) return;
  searching.value = true;
  currentPage.value = 1;
  try {
    const [lng, lat] = props.mapCenter;
    const { data } = await api.post('/shodan/search', {
      lat,
      lng,
      radius: radius.value,
      filters: customQuery.value,
      page: 1,
    });
    results.value = data.matches || [];
    totalResults.value = data.total || 0;
    emit('results', results.value);
  } catch (err: any) {
    console.error('Shodan search failed:', err);
    results.value = [];
    totalResults.value = 0;
  } finally {
    searching.value = false;
  }
}

async function loadMore() {
  if (searching.value) return;
  searching.value = true;
  currentPage.value++;
  try {
    const [lng, lat] = props.mapCenter;
    const { data } = await api.post('/shodan/search', {
      lat,
      lng,
      radius: radius.value,
      filters: customQuery.value,
      page: currentPage.value,
    });
    const newMatches = data.matches || [];
    results.value = [...results.value, ...newMatches];
    emit('results', results.value);
  } catch (err: any) {
    console.error('Shodan load more failed:', err);
    currentPage.value--;
  } finally {
    searching.value = false;
  }
}

function clearResults() {
  results.value = [];
  totalResults.value = null;
  currentPage.value = 1;
  emit('clear');
}

async function fetchHostDetail(ip: string) {
  try {
    const { data } = await api.get(`/shodan/host/${encodeURIComponent(ip)}`);
    hostDetail.value = data;
  } catch (err: any) {
    console.error('Shodan host detail failed:', err);
  }
}

// Expose fetchHostDetail for parent
defineExpose({ fetchHostDetail });

onMounted(async () => {
  await Promise.all([checkStatus(), loadFilters()]);
});
</script>

<style scoped>
.shodan-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 360px;
  height: 100%;
  background: var(--me-bg-surface);
  border-left: 1px solid var(--me-border);
  transform: translateX(100%);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  z-index: 30;
  overflow: hidden;
}
.shodan-panel.open {
  transform: translateX(0);
}
.shodan-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
}
.shodan-panel-header h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
}
.shodan-close-btn {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.shodan-close-btn:hover {
  color: var(--me-text-primary);
  background: var(--me-bg-hover);
}
.shodan-unavailable {
  padding: 20px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--me-text-muted);
}
.shodan-filters {
  padding: 12px 16px;
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
}
.shodan-filters-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--me-text-muted);
  margin-bottom: 8px;
}
.shodan-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.shodan-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  background: var(--me-bg-deep);
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.shodan-chip:hover {
  border-color: var(--me-text-muted);
}
.shodan-chip.active {
  font-weight: 700;
}
.shodan-custom-filter {
  margin-bottom: 10px;
}
.shodan-radius-row {
  margin-bottom: 10px;
}
.shodan-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-muted);
  display: block;
  margin-bottom: 4px;
}
.shodan-slider {
  width: 100%;
  accent-color: #ef4444;
}
.shodan-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--me-border);
  font-size: 12px;
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.shodan-clear-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  font-size: 11px;
}
.shodan-clear-btn:hover {
  color: #ef4444;
}
.shodan-results-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.shodan-result-item {
  padding: 10px 16px;
  border-bottom: 1px solid var(--me-border);
  cursor: pointer;
  transition: background 0.12s ease;
  position: relative;
}
.shodan-result-item:hover {
  background: var(--me-bg-hover);
}
.shodan-result-head {
  display: flex;
  align-items: baseline;
  gap: 0;
  margin-bottom: 4px;
}
.shodan-result-ip {
  font-size: 13px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.shodan-result-port {
  font-size: 12px;
  color: #ef4444;
  font-weight: 600;
}
.shodan-result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}
.shodan-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--me-bg-deep);
  color: var(--me-text-secondary);
  font-family: var(--me-font-mono);
}
.shodan-result-loc {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--me-text-muted);
}
.shodan-result-vulns {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.shodan-vuln-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  font-family: var(--me-font-mono);
  font-weight: 600;
}
.shodan-vuln-more {
  font-size: 10px;
  color: var(--me-text-muted);
}
.shodan-result-actions {
  position: absolute;
  top: 8px;
  right: 10px;
  display: flex;
  gap: 2px;
}
.shodan-action-btn {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 3px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}
.shodan-action-btn:hover {
  color: var(--me-accent);
  background: var(--me-bg-hover);
}
.shodan-load-more {
  padding: 8px 16px;
  text-align: center;
}

/* Host detail dialog */
.shodan-host-detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.shodan-host-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.shodan-host-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.shodan-host-vulns {
  margin-top: 4px;
}
.shodan-host-vuln-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.shodan-host-services {
  margin-top: 8px;
  border-top: 1px solid var(--me-border);
  padding-top: 10px;
}
.shodan-service-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--me-border);
}
.shodan-service-item:last-child {
  border-bottom: none;
}
.shodan-service-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin-bottom: 4px;
}
.shodan-service-banner {
  font-size: 11px;
  color: var(--me-text-muted);
  background: var(--me-bg-deep);
  border-radius: 4px;
  padding: 8px;
  overflow-x: auto;
  max-height: 120px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
