<template>
  <v-dialog v-model="model" max-width="700" persistent>
    <div class="od-dialog glass-card">
      <div class="od-header">
        <v-icon size="20" class="od-header-icon">mdi-search-web</v-icon>
        <span class="mono">OSINT Dorking</span>
        <button class="od-close" @click="model = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <div class="od-body">
        <!-- Entity selection -->
        <div class="od-section">
          <div class="od-section-title">{{ t('dossier.dorkSelectEntities') }}</div>
          <div class="od-select-bar">
            <button class="od-select-btn" @click="selectAll">{{ t('common.selectAll') }}</button>
            <button class="od-select-btn" @click="deselectAll">{{ t('common.deselectAll') }}</button>
            <span class="od-count mono">{{ selectedCount }} / {{ entities.length }}</span>
          </div>
          <div class="od-entities">
            <label
              v-for="(entity, i) in entities"
              :key="i"
              class="od-entity"
              :class="{ 'od-entity--selected': selectedEntities[i] }"
            >
              <input type="checkbox" v-model="selectedEntities[i]" class="od-check" />
              <v-icon size="14">{{ entityIcon(entity.type) }}</v-icon>
              <span class="od-entity-name">{{ entity.name }}</span>
              <span class="od-entity-type mono">{{ entityTypeLabel(entity.type) }}</span>
            </label>
          </div>
          <div v-if="entities.length === 0" class="od-empty mono">
            {{ t('dossier.noEntities') }}
          </div>
        </div>

        <!-- Custom query -->
        <div class="od-section">
          <div class="od-section-title">{{ t('dossier.dorkCustomQuery') }}</div>
          <v-text-field
            v-model="customQuery"
            :placeholder="t('dossier.dorkCustomPlaceholder')"
            density="compact"
            variant="outlined"
            hide-details
          />
        </div>

        <!-- Results -->
        <div v-if="dorkResults.length > 0" class="od-section">
          <div class="od-section-title">{{ t('dossier.dorkResults') }} ({{ dorkResults.length }})</div>
          <div class="od-results">
            <div v-for="(group, gi) in dorkResults" :key="gi" class="od-result-group">
              <div class="od-result-entity">
                <v-icon size="14">{{ entityIcon(group.type) }}</v-icon>
                {{ group.name }}
              </div>
              <div v-for="(dork, di) in group.queries" :key="di" class="od-result-item">
                <span class="od-result-label">{{ dork.label }}</span>
                <div class="od-result-links">
                  <a v-for="link in dork.links" :key="link.engine" :href="link.url" target="_blank" rel="noopener" class="od-link">
                    <img v-if="link.icon" :src="link.icon" width="12" height="12" :alt="link.engine" />
                    {{ link.engine }}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="od-footer">
        <button class="me-btn-ghost me-btn-sm" @click="model = false">{{ t('common.cancel') }}</button>
        <button v-if="dorkResults.length > 0" class="me-btn-ghost me-btn-sm" @click="copyAllResults">
          <v-icon size="14" class="mr-1">mdi-content-copy</v-icon>
          {{ t('dossier.copyAllDorks') }}
        </button>
        <button v-if="dorkResults.length > 0" class="me-btn-ghost me-btn-sm" @click="sendToNote">
          <v-icon size="14" class="mr-1">mdi-note-plus-outline</v-icon>
          {{ t('dossier.dorksToNote') }}
        </button>
        <button class="od-generate-btn" @click="generate" :disabled="selectedCount === 0 && !customQuery.trim()">
          <v-icon size="14" class="mr-1">mdi-magnify</v-icon>
          {{ t('dossier.dorkGenerate') }}
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDossierStore } from '../../stores/dossier';
import api from '../../services/api';

const { t } = useI18n();
const model = defineModel<boolean>({ default: false });
const dossierStore = useDossierStore();

const customQuery = ref('');
const selectedEntities = ref<boolean[]>([]);

interface DorkLink { engine: string; url: string; icon: string }
interface DorkQuery { label: string; query: string; links: DorkLink[] }
interface DorkGroup { name: string; type: string; queries: DorkQuery[] }

const dorkResults = ref<DorkGroup[]>([]);

const entities = computed(() => dossierStore.currentDossier?.entities || []);

const selectedCount = computed(() => selectedEntities.value.filter(Boolean).length);

// Initialize selection when entities change
import { watch } from 'vue';
watch(entities, (ents) => {
  selectedEntities.value = ents.map(() => true);
}, { immediate: true });

const ENTITY_ICON_MAP: Record<string, string> = {
  identity: 'mdi-card-account-details-outline',
  phone: 'mdi-phone-outline',
  email: 'mdi-email-outline',
  pseudo: 'mdi-at',
  ip: 'mdi-ip-network-outline',
  address: 'mdi-map-marker-outline',
  vehicle: 'mdi-car-outline',
  iban: 'mdi-bank-outline',
  facebook: 'mdi-facebook',
  instagram: 'mdi-instagram',
  twitter: 'mdi-twitter',
  tiktok: 'mdi-music-note-outline',
  snapchat: 'mdi-snapchat',
  telegram: 'mdi-send',
  discord: 'mdi-forum-outline',
  linkedin: 'mdi-linkedin',
  other: 'mdi-tag-outline',
};

function entityIcon(type: string): string {
  return ENTITY_ICON_MAP[type] || 'mdi-tag-outline';
}

function entityTypeLabel(type: string): string {
  const keys = Object.keys(ENTITY_ICON_MAP);
  if (keys.includes(type)) return t(`dossier.entityTypes.${type}`);
  return type;
}

function buildLinks(query: string): DorkLink[] {
  const q = encodeURIComponent(query);
  return [
    { engine: 'Google', url: `https://www.google.com/search?q=${q}`, icon: 'https://www.google.com/favicon.ico' },
    { engine: 'Bing', url: `https://www.bing.com/search?q=${q}`, icon: 'https://www.bing.com/favicon.ico' },
    { engine: 'Yandex', url: `https://yandex.com/search/?text=${q}`, icon: 'https://yandex.com/favicon.ico' },
    { engine: 'DDG', url: `https://duckduckgo.com/?q=${q}`, icon: 'https://duckduckgo.com/favicon.ico' },
  ];
}

function generateForEntity(name: string, type: string): DorkQuery[] {
  const queries: DorkQuery[] = [];
  const q = (query: string, label: string) =>
    queries.push({ label, query, links: buildLinks(query) });

  q(`"${name}"`, t('dossier.dorkExactMatch'));

  if (type === 'email') {
    q(`"${name}" site:linkedin.com`, 'LinkedIn');
    q(`"${name}" site:facebook.com`, 'Facebook');
    q(`"${name}" site:twitter.com OR site:x.com`, 'Twitter / X');
    q(`"${name}" site:github.com`, 'GitHub');
    q(`"${name}" filetype:pdf`, t('dossier.dorkPDF'));
    q(`"${name}" password OR leak OR breach`, t('dossier.dorkLeaks'));
  } else if (type === 'phone') {
    q(`"${name}" OR "${name.replace(/\\s/g, '')}"`, t('dossier.dorkPhoneVariants'));
    q(`"${name}" site:facebook.com`, 'Facebook');
    q(`"${name}" annuaire OR pages-blanches OR infobel`, t('dossier.dorkDirectories'));
    q(`"${name}" whatsapp OR telegram OR signal`, t('dossier.dorkMessengers'));
  } else if (type === 'identity') {
    q(`"${name}" site:linkedin.com`, 'LinkedIn');
    q(`"${name}" site:facebook.com`, 'Facebook');
    q(`"${name}" site:twitter.com OR site:x.com`, 'Twitter / X');
    q(`"${name}" filetype:pdf`, t('dossier.dorkPDF'));
    q(`"${name}" CV OR resume OR curriculum`, t('dossier.dorkCV'));
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      q(`"${parts[0]}" "${parts[parts.length - 1]}" site:linkedin.com`, t('dossier.dorkNameVariant'));
    }
  } else if (type === 'pseudo') {
    q(`"${name}" site:github.com`, 'GitHub');
    q(`"${name}" site:reddit.com`, 'Reddit');
    q(`"${name}" site:twitter.com OR site:x.com`, 'Twitter / X');
    q(`"${name}" site:instagram.com`, 'Instagram');
    q(`"${name}" site:tiktok.com`, 'TikTok');
    q(`"${name}" site:youtube.com`, 'YouTube');
    q(`"${name}" forum OR community`, t('dossier.dorkForums'));
  } else if (type === 'ip') {
    q(`"${name}" site:shodan.io`, 'Shodan');
    q(`"${name}" site:censys.io`, 'Censys');
    q(`"${name}" abuse OR malware OR spam`, t('dossier.dorkAbuse'));
    q(`"${name}" server OR hosting OR domain`, t('dossier.dorkHosting'));
  } else if (type === 'iban') {
    q(`"${name}" fraude OR arnaque OR scam`, t('dossier.dorkFraud'));
    q(`"${name}" entreprise OR societe OR company`, t('dossier.dorkCompany'));
  } else if (type === 'vehicle') {
    q(`"${name}" site:autoscout24.be OR site:autoscout24.fr`, 'AutoScout24');
    q(`"${name}" site:2ememain.be OR site:leboncoin.fr`, t('dossier.dorkClassifieds'));
    q(`"${name}" accident OR vol OR stolen`, t('dossier.dorkVehicleIncident'));
  } else if (type === 'address') {
    q(`"${name}" site:google.com/maps`, 'Google Maps');
    q(`"${name}" site:immoweb.be OR site:immobilier`, t('dossier.dorkRealEstate'));
    q(`"${name}" entreprise OR societe`, t('dossier.dorkCompany'));
  } else {
    q(`"${name}" site:facebook.com`, 'Facebook');
    q(`"${name}" site:instagram.com`, 'Instagram');
    q(`"${name}" site:linkedin.com`, 'LinkedIn');
    q(`"${name}" filetype:pdf`, t('dossier.dorkPDF'));
  }

  return queries;
}

function generate() {
  const results: DorkGroup[] = [];

  // Selected entities
  entities.value.forEach((entity, i) => {
    if (selectedEntities.value[i]) {
      results.push({
        name: entity.name,
        type: entity.type,
        queries: generateForEntity(entity.name, entity.type),
      });
    }
  });

  // Custom query
  if (customQuery.value.trim()) {
    results.push({
      name: customQuery.value.trim(),
      type: 'other',
      queries: generateForEntity(customQuery.value.trim(), 'other'),
    });
  }

  dorkResults.value = results;
}

function selectAll() { selectedEntities.value = entities.value.map(() => true); }
function deselectAll() { selectedEntities.value = entities.value.map(() => false); }

function copyAllResults() {
  const text = dorkResults.value.map(g =>
    `=== ${g.name} (${entityTypeLabel(g.type)}) ===\n` +
    g.queries.map(d => `${d.label}: ${d.query}\n${d.links[0]?.url || ''}`).join('\n\n')
  ).join('\n\n\n');
  navigator.clipboard.writeText(text);
}

async function sendToNote() {
  if (!dossierStore.currentDossier) return;

  const content: any[] = [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'OSINT Dorking — Rapport' }],
    },
    {
      type: 'paragraph',
      content: [{
        type: 'text',
        marks: [{ type: 'italic' }],
        text: `${dorkResults.value.length} entite(s) analysee(s) — ${new Date().toLocaleDateString('fr-FR')}`,
      }],
    },
    { type: 'horizontalRule' },
  ];

  for (const group of dorkResults.value) {
    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: `${group.name} (${entityTypeLabel(group.type)})` }],
    });

    for (const dork of group.queries) {
      content.push({
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: `${dork.label} : ` },
          { type: 'text', marks: [{ type: 'code' }], text: dork.query },
        ],
      });
      const linkContent: any[] = [];
      for (const link of dork.links) {
        if (linkContent.length > 0) linkContent.push({ type: 'text', text: '  |  ' });
        linkContent.push({
          type: 'text',
          marks: [{ type: 'link', attrs: { href: link.url, target: '_blank' } }],
          text: link.engine,
        });
      }
      content.push({ type: 'paragraph', content: linkContent });
    }
  }

  try {
    const { data } = await api.post('/nodes', {
      dossierId: dossierStore.currentDossier._id,
      parentId: null,
      type: 'note',
      title: `OSINT Dorking — ${new Date().toLocaleDateString('fr-FR')}`,
      content: { type: 'doc', content },
    });
    dossierStore.nodes.push(data);
    dossierStore.selectNode(data);
    model.value = false;
  } catch (err) {
    console.error('Failed to create dork note:', err);
  }
}
</script>

<style scoped>
.od-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.od-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.od-header-icon { color: var(--me-accent); }
.od-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; transition: all 0.15s; }
.od-close:hover { background: rgba(255,255,255,0.08); color: var(--me-text-primary); }
.od-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 16px; max-height: 500px; overflow-y: auto; }
.od-section-title { font-size: 12px; font-weight: 600; color: var(--me-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
.od-select-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.od-select-btn { font-size: 11px; color: var(--me-accent); background: none; border: none; cursor: pointer; text-decoration: underline; padding: 0; }
.od-count { font-size: 11px; color: var(--me-text-muted); margin-left: auto; }
.od-entities { display: flex; flex-direction: column; gap: 4px; max-height: 180px; overflow-y: auto; }
.od-entity { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--me-border); cursor: pointer; transition: all 0.15s; font-size: 13px; }
.od-entity:hover { border-color: var(--me-accent); }
.od-entity--selected { background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.08); border-color: var(--me-accent); }
.od-check { width: 14px; height: 14px; accent-color: var(--me-accent); }
.od-entity-name { flex: 1; color: var(--me-text-primary); font-weight: 500; }
.od-entity-type { font-size: 10px; color: var(--me-text-muted); }
.od-empty { font-size: 12px; color: var(--me-text-muted); text-align: center; padding: 16px; }

.od-results { display: flex; flex-direction: column; gap: 12px; }
.od-result-group { padding: 10px 12px; border-radius: 8px; border: 1px solid var(--me-border); background: var(--me-bg-deep); }
.od-result-entity { font-size: 13px; font-weight: 600; color: var(--me-text-primary); display: flex; align-items: center; gap: 6px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--me-border); }
.od-result-item { margin-bottom: 6px; }
.od-result-label { font-size: 11px; font-weight: 500; color: var(--me-text-secondary); margin-bottom: 3px; display: block; }
.od-result-links { display: flex; flex-wrap: wrap; gap: 4px; }
.od-link { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 8px; background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.1); color: var(--me-accent); font-size: 10px; font-weight: 500; text-decoration: none; transition: all 0.15s; }
.od-link:hover { background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.2); }
.od-link img { border-radius: 2px; }

.od-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--me-border); flex-wrap: wrap; }
.od-generate-btn { display: flex; align-items: center; gap: 4px; padding: 6px 16px; border-radius: 6px; border: none; background: var(--me-accent); color: white; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.od-generate-btn:hover:not(:disabled) { filter: brightness(1.1); }
.od-generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
