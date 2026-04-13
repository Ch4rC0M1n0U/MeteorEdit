<template>
  <div class="onyphe-panel" :class="{ open: modelValue }">
    <div class="onyphe-panel-header">
      <h3 class="mono">
        <span class="mdi mdi-earth-plus" style="font-size: 16px; margin-right: 6px; color: #8b5cf6;"></span>
        Onyphe
      </h3>
      <button class="onyphe-close-btn" @click="$emit('update:modelValue', false)">
        <i class="pi pi-times" style="font-size: 16px"></i>
      </button>
    </div>

    <!-- Status -->
    <div v-if="!available" class="onyphe-unavailable">
      <span class="mdi mdi-alert-circle-outline" style="font-size: 20px; color: #f97316;"></span>
      <span>{{ $t('map.onypheUnavailable') }}</span>
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="onyphe-filters">
        <div class="onyphe-filters-title mono">{{ $t('map.onypheFilters') }}</div>
        <div class="onyphe-filter-chips">
          <button
            v-for="f in filterPresets"
            :key="f.key"
            class="onyphe-chip"
            :class="{ active: activeFilter === f.key }"
            :style="activeFilter === f.key ? { background: f.color + '22', borderColor: f.color, color: f.color } : {}"
            @click="selectFilter(f)"
          >
            <span :class="['mdi', f.icon]" style="font-size: 14px;"></span>
            <span>{{ f.label }}</span>
          </button>
        </div>

        <div class="onyphe-custom-filter">
          <InputText
            v-model="customQuery"
            :placeholder="$t('map.onypheCustomFilter')"
            size="small"
            fluid
          />
        </div>

        <div class="onyphe-radius-row">
          <label class="onyphe-label mono">{{ $t('map.onypheRadius') }}: {{ radius }} km</label>
          <input type="range" v-model.number="radius" min="1" max="100" step="1" class="onyphe-slider" />
        </div>

        <Button
          :label="searching ? $t('map.onypheSearching') : $t('map.onypheSearch')"
          icon="pi pi-search"
          :loading="searching"
          :disabled="searching"
          size="small"
          severity="help"
          @click="search"
          style="width: 100%;"
        />
      </div>

      <!-- Results -->
      <div class="onyphe-results-header" v-if="totalResults !== null">
        <span class="mono">{{ totalResults }} {{ $t('map.onypheResults') }}</span>
        <button v-if="results.length" class="onyphe-clear-btn" @click="clearResults">
          <span class="mdi mdi-close-circle-outline" style="font-size: 14px;"></span>
          {{ $t('map.onypheClear') }}
        </button>
      </div>

      <div class="onyphe-results-list">
        <div
          v-for="r in results"
          :key="r.ip + ':' + r.port"
          class="onyphe-result-item"
          @click="$emit('fly-to', r)"
        >
          <div class="onyphe-result-head">
            <span class="onyphe-result-ip mono">{{ r.ip }}</span>
            <span v-if="r.port" class="onyphe-result-port mono">:{{ r.port }}</span>
          </div>
          <div class="onyphe-result-meta">
            <span v-if="r.product" class="onyphe-tag">{{ r.product }} {{ r.version || '' }}</span>
            <span v-if="r.organization" class="onyphe-tag">{{ r.organization }}</span>
            <span v-if="r.os" class="onyphe-tag">{{ r.os }}</span>
            <span v-if="r.protocol" class="onyphe-tag protocol">{{ r.protocol }}</span>
          </div>
          <div v-if="r.location.city || r.location.country" class="onyphe-result-loc">
            <span class="mdi mdi-map-marker-outline" style="font-size: 12px;"></span>
            {{ [r.location.city, r.location.country].filter(Boolean).join(', ') }}
            <span class="onyphe-distance">{{ distanceLabel(r) }}</span>
          </div>
          <div v-if="r.tag.length" class="onyphe-result-tags">
            <span v-for="t in r.tag.slice(0, 4)" :key="t" class="onyphe-tag-badge">{{ t }}</span>
            <span v-if="r.tag.length > 4" class="onyphe-tag-more">+{{ r.tag.length - 4 }}</span>
          </div>
          <div class="onyphe-result-actions">
            <a
              :href="'https://www.onyphe.io/summary/ip/' + r.ip"
              target="_blank"
              rel="noopener"
              class="onyphe-action-btn"
              :title="$t('map.onypheOpenOnyphe')"
              @click.stop
            >
              <span class="mdi mdi-open-in-new" style="font-size: 14px;"></span>
            </a>
            <button class="onyphe-action-btn" @click.stop="$emit('add-marker', r)" :title="$t('map.onypheAddMarker')">
              <span class="mdi mdi-map-marker-plus-outline" style="font-size: 14px;"></span>
            </button>
            <button class="onyphe-action-btn" @click.stop="$emit('host-detail', r.ip)" :title="$t('map.onypheHostDetail')">
              <span class="mdi mdi-information-outline" style="font-size: 14px;"></span>
            </button>
          </div>
        </div>

        <div v-if="results.length && totalResults && totalResults > results.length && currentPage < maxPage" class="onyphe-load-more">
          <Button
            :label="$t('map.onypheLoadMore')"
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
    <div v-if="hostDetail" class="onyphe-host-detail">
      <div class="onyphe-host-row">
        <span class="onyphe-host-label mono">Organisation</span>
        <span>{{ hostDetail.organization || '-' }}</span>
      </div>
      <div class="onyphe-host-row">
        <span class="onyphe-host-label mono">ASN</span>
        <span class="mono">{{ hostDetail.asn || '-' }}</span>
      </div>
      <div class="onyphe-host-row">
        <span class="onyphe-host-label mono">OS</span>
        <span>{{ hostDetail.os || '-' }}</span>
      </div>
      <div class="onyphe-host-row">
        <span class="onyphe-host-label mono">{{ $t('map.onypheLocation') }}</span>
        <span>{{ [hostDetail.location?.city, hostDetail.location?.country].filter(Boolean).join(', ') || '-' }}</span>
      </div>
      <div class="onyphe-host-row">
        <span class="onyphe-host-label mono">Hostnames</span>
        <span>{{ hostDetail.hostnames?.join(', ') || '-' }}</span>
      </div>
      <div class="onyphe-host-row">
        <span class="onyphe-host-label mono">Domains</span>
        <span>{{ hostDetail.domains?.join(', ') || '-' }}</span>
      </div>
      <div v-if="hostDetail.services?.length" class="onyphe-host-services">
        <div class="onyphe-host-label mono" style="margin-bottom: 8px;">Services</div>
        <div v-for="(s, i) in hostDetail.services" :key="i" class="onyphe-service-item">
          <div class="onyphe-service-head">
            <span class="mono">{{ s.port }}/{{ s.transport }}</span>
            <span v-if="s.product" class="onyphe-tag">{{ s.product }} {{ s.version || '' }}</span>
            <span v-if="s.protocol" class="onyphe-tag protocol">{{ s.protocol }}</span>
          </div>
          <pre v-if="s.banner" class="onyphe-service-banner">{{ s.banner.slice(0, 500) }}</pre>
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

export interface OnypheResult {
  ip: string;
  port: number;
  transport: string;
  product: string | null;
  version: string | null;
  os: string | null;
  organization: string | null;
  asn: string;
  location: {
    lat: number;
    lng: number;
    city: string;
    country: string;
    countryCode: string;
  };
  hostname: string;
  domain: string;
  protocol: string;
  tag: string[];
  timestamp: string;
}

interface FilterPreset {
  key: string;
  label: string;
  query: string;
  icon: string;
  color: string;
}

interface HostDetail {
  ip: string;
  services: Array<{
    port: number;
    transport: string;
    product: string;
    version: string;
    protocol: string;
    banner: string;
  }>;
  location: { lat: number; lng: number; city: string; country: string };
  organization: string;
  asn: string;
  os: string | null;
  domains: string[];
  hostnames: string[];
}

const props = defineProps<{
  modelValue: boolean;
  mapCenter: [number, number];
}>();

const emit = defineEmits<{
  'update:modelValue': [val: boolean];
  'results': [results: OnypheResult[]];
  'fly-to': [result: OnypheResult];
  'host-detail': [ip: string];
  'add-marker': [result: OnypheResult];
  'clear': [];
}>();

const available = ref(false);
const activeFilter = ref('all');
const customQuery = ref('');
const radius = ref(10);
const searching = ref(false);
const results = ref<OnypheResult[]>([]);
const totalResults = ref<number | null>(null);
const currentPage = ref(1);
const maxPage = ref(1);
const hostDetail = ref<HostDetail | null>(null);

const filterPresets: FilterPreset[] = [
  { key: 'all', label: 'Tous', query: '', icon: 'mdi-earth', color: '#8b5cf6' },
  { key: 'http', label: 'HTTP', query: 'protocol:http', icon: 'mdi-web', color: '#3b82f6' },
  { key: 'ssh', label: 'SSH', query: 'protocol:ssh', icon: 'mdi-console', color: '#10b981' },
  { key: 'ftp', label: 'FTP', query: 'protocol:ftp', icon: 'mdi-folder-network', color: '#f59e0b' },
  { key: 'rdp', label: 'RDP', query: 'protocol:rdp', icon: 'mdi-remote-desktop', color: '#ef4444' },
  { key: 'smtp', label: 'SMTP', query: 'protocol:smtp', icon: 'mdi-email-outline', color: '#ec4899' },
  { key: 'dns', label: 'DNS', query: 'protocol:dns', icon: 'mdi-dns', color: '#6366f1' },
];

async function checkStatus() {
  try {
    const { data } = await api.get('/onyphe/status');
    available.value = data.available;
  } catch {
    available.value = false;
  }
}

function selectFilter(f: FilterPreset) {
  activeFilter.value = f.key;
  customQuery.value = f.query;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sortByDistance(items: OnypheResult[]): OnypheResult[] {
  const [cLng, cLat] = props.mapCenter;
  return [...items].sort((a, b) => {
    const dA = haversineKm(cLat, cLng, a.location.lat, a.location.lng);
    const dB = haversineKm(cLat, cLng, b.location.lat, b.location.lng);
    return dA - dB;
  });
}

function distanceLabel(r: OnypheResult): string {
  const [cLng, cLat] = props.mapCenter;
  const d = haversineKm(cLat, cLng, r.location.lat, r.location.lng);
  return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
}

async function search() {
  if (searching.value) return;
  searching.value = true;
  currentPage.value = 1;
  try {
    const [lng, lat] = props.mapCenter;
    const { data } = await api.post('/onyphe/search', {
      lat,
      lng,
      radius: radius.value,
      filters: customQuery.value,
      page: 1,
    });
    const matches = data.matches || [];
    results.value = sortByDistance(matches);
    totalResults.value = data.total || 0;
    maxPage.value = data.maxPage || 1;
    emit('results', results.value);
  } catch (err: any) {
    console.error('Onyphe search failed:', err);
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
    const { data } = await api.post('/onyphe/search', {
      lat,
      lng,
      radius: radius.value,
      filters: customQuery.value,
      page: currentPage.value,
    });
    const newMatches = data.matches || [];
    results.value = sortByDistance([...results.value, ...newMatches]);
    emit('results', results.value);
  } catch (err: any) {
    console.error('Onyphe load more failed:', err);
    currentPage.value--;
  } finally {
    searching.value = false;
  }
}

function clearResults() {
  results.value = [];
  totalResults.value = null;
  currentPage.value = 1;
  maxPage.value = 1;
  emit('clear');
}

async function fetchHostDetail(ip: string) {
  try {
    const { data } = await api.get(`/onyphe/host/${encodeURIComponent(ip)}`);
    hostDetail.value = data;
  } catch (err: any) {
    console.error('Onyphe host detail failed:', err);
  }
}

defineExpose({ fetchHostDetail });

onMounted(async () => {
  await checkStatus();
});
</script>

<style scoped>
.onyphe-panel {
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
.onyphe-panel.open {
  transform: translateX(0);
}
.onyphe-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
}
.onyphe-panel-header h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
}
.onyphe-close-btn {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.onyphe-close-btn:hover {
  color: var(--me-text-primary);
  background: var(--me-bg-hover);
}
.onyphe-unavailable {
  padding: 20px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--me-text-muted);
}
.onyphe-filters {
  padding: 12px 16px;
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
}
.onyphe-filters-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--me-text-muted);
  margin-bottom: 8px;
}
.onyphe-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.onyphe-chip {
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
.onyphe-chip:hover {
  border-color: var(--me-text-muted);
}
.onyphe-chip.active {
  font-weight: 700;
}
.onyphe-custom-filter {
  margin-bottom: 10px;
}
.onyphe-radius-row {
  margin-bottom: 10px;
}
.onyphe-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-muted);
  display: block;
  margin-bottom: 4px;
}
.onyphe-slider {
  width: 100%;
  accent-color: #8b5cf6;
}
.onyphe-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--me-border);
  font-size: 12px;
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.onyphe-clear-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  font-size: 11px;
}
.onyphe-clear-btn:hover {
  color: #8b5cf6;
}
.onyphe-results-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.onyphe-result-item {
  padding: 10px 16px;
  border-bottom: 1px solid var(--me-border);
  cursor: pointer;
  transition: background 0.12s ease;
  position: relative;
}
.onyphe-result-item:hover {
  background: var(--me-bg-hover);
}
.onyphe-result-head {
  display: flex;
  align-items: baseline;
  gap: 0;
  margin-bottom: 4px;
}
.onyphe-result-ip {
  font-size: 13px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.onyphe-result-port {
  font-size: 12px;
  color: #8b5cf6;
  font-weight: 600;
}
.onyphe-result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}
.onyphe-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--me-bg-deep);
  color: var(--me-text-secondary);
  font-family: var(--me-font-mono);
}
.onyphe-tag.protocol {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}
.onyphe-result-loc {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--me-text-muted);
}
.onyphe-distance {
  margin-left: auto;
  font-family: var(--me-font-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--me-accent);
}
.onyphe-result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.onyphe-tag-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
  font-family: var(--me-font-mono);
  font-weight: 600;
}
.onyphe-tag-more {
  font-size: 10px;
  color: var(--me-text-muted);
}
.onyphe-result-actions {
  position: absolute;
  top: 8px;
  right: 10px;
  display: flex;
  gap: 2px;
}
.onyphe-action-btn {
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
.onyphe-action-btn:hover {
  color: #8b5cf6;
  background: var(--me-bg-hover);
}
.onyphe-load-more {
  padding: 8px 16px;
  text-align: center;
}

/* Host detail dialog */
.onyphe-host-detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.onyphe-host-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.onyphe-host-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.onyphe-host-services {
  margin-top: 8px;
  border-top: 1px solid var(--me-border);
  padding-top: 10px;
}
.onyphe-service-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--me-border);
}
.onyphe-service-item:last-child {
  border-bottom: none;
}
.onyphe-service-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin-bottom: 4px;
}
.onyphe-service-banner {
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
