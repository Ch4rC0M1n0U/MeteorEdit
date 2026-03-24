<template>
  <v-dialog v-model="model" max-width="680" persistent>
    <div class="od-dialog glass-card">
      <div class="od-header">
        <v-icon size="20" class="od-header-icon">mdi-search-web</v-icon>
        <span class="mono">OSINT Dorking</span>
        <button class="od-close" @click="model = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <!-- Step 1: Choose investigation type -->
      <div v-if="step === 'type'" class="od-body">
        <p class="od-intro">{{ t('dossier.dorkChooseType') }}</p>
        <div class="od-type-grid">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="od-type-card"
            @click="selectCategory(cat)"
          >
            <v-icon size="24">{{ cat.icon }}</v-icon>
            <span class="od-type-label">{{ cat.label }}</span>
            <span class="od-type-desc">{{ cat.desc }}</span>
          </button>
        </div>
      </div>

      <!-- Step 2: Input + context-aware dorks -->
      <div v-else-if="step === 'search'" class="od-body">
        <button class="od-back" @click="step = 'type'">
          <v-icon size="14">mdi-arrow-left</v-icon> {{ t('common.back') }}
        </button>

        <div class="od-search-header">
          <v-icon size="20">{{ activeCategory!.icon }}</v-icon>
          <span class="od-search-title">{{ activeCategory!.label }}</span>
        </div>

        <!-- Input fields based on category -->
        <div class="od-fields">
          <div v-for="field in activeCategory!.fields" :key="field.key" class="od-field">
            <label class="od-field-label">{{ field.label }}</label>
            <input
              v-model="fieldValues[field.key]"
              class="od-field-input"
              :placeholder="field.placeholder"
              @keyup.enter="generateDorks"
            />
            <span v-if="field.hint" class="od-field-hint">{{ field.hint }}</span>
          </div>
        </div>

        <!-- Tips -->
        <div v-if="activeCategory!.tips.length" class="od-tips">
          <div class="od-tips-title">
            <v-icon size="14">mdi-lightbulb-outline</v-icon>
            {{ t('dossier.dorkTips') }}
          </div>
          <ul class="od-tips-list">
            <li v-for="(tip, i) in activeCategory!.tips" :key="i">{{ tip }}</li>
          </ul>
        </div>

        <!-- Generate -->
        <button class="od-generate-btn" @click="generateDorks" :disabled="!hasInput">
          <v-icon size="14">mdi-magnify</v-icon>
          {{ t('dossier.dorkGenerate') }}
        </button>

        <!-- Results -->
        <div v-if="results.length > 0" class="od-results">
          <div class="od-results-header">
            <span class="od-section-title">{{ t('dossier.dorkResults') }} ({{ results.length }})</span>
            <div class="od-results-actions">
              <button class="od-action-btn" @click="copyAll" :title="t('dossier.copyAllDorks')">
                <v-icon size="14">mdi-content-copy</v-icon>
              </button>
              <button class="od-action-btn" @click="sendToNote" :title="t('dossier.dorksToNote')">
                <v-icon size="14">mdi-note-plus-outline</v-icon>
              </button>
            </div>
          </div>
          <div v-for="(dork, i) in results" :key="i" class="od-result-item">
            <div class="od-result-top">
              <span class="od-result-label">{{ dork.label }}</span>
              <span class="od-result-query mono">{{ dork.query }}</span>
            </div>
            <div class="od-result-links">
              <a v-for="link in dork.links" :key="link.engine" :href="link.url" target="_blank" rel="noopener" class="od-link">
                <img :src="link.icon" width="12" height="12" :alt="link.engine" />
                {{ link.engine }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDossierStore } from '../../stores/dossier';
import api from '../../services/api';

const { t } = useI18n();
const model = defineModel<boolean>({ default: false });
const dossierStore = useDossierStore();

const step = ref<'type' | 'search'>('type');
const fieldValues = reactive<Record<string, string>>({});

interface DorkField { key: string; label: string; placeholder: string; hint?: string }
interface DorkLink { engine: string; url: string; icon: string }
interface DorkResult { label: string; query: string; links: DorkLink[] }
interface DorkCategory {
  id: string; icon: string; label: string; desc: string;
  fields: DorkField[]; tips: string[];
  generate: (vals: Record<string, string>) => DorkResult[];
}

const activeCategory = ref<DorkCategory | null>(null);
const results = ref<DorkResult[]>([]);

const hasInput = computed(() => Object.values(fieldValues).some(v => v.trim()));

function links(query: string): DorkLink[] {
  const q = encodeURIComponent(query);
  return [
    { engine: 'Google', url: `https://www.google.com/search?q=${q}`, icon: 'https://www.google.com/favicon.ico' },
    { engine: 'Bing', url: `https://www.bing.com/search?q=${q}`, icon: 'https://www.bing.com/favicon.ico' },
    { engine: 'Yandex', url: `https://yandex.com/search/?text=${q}`, icon: 'https://yandex.com/favicon.ico' },
    { engine: 'DDG', url: `https://duckduckgo.com/?q=${q}`, icon: 'https://duckduckgo.com/favicon.ico' },
  ];
}

function d(query: string, label: string): DorkResult {
  return { label, query, links: links(query) };
}

const categories = computed<DorkCategory[]>(() => [
  {
    id: 'identity', icon: 'mdi-account-outline', label: t('dossier.dorkCatIdentity'),
    desc: t('dossier.dorkCatIdentityDesc'),
    fields: [
      { key: 'firstName', label: t('dossier.dorkFieldFirstName'), placeholder: 'Jean' },
      { key: 'lastName', label: t('dossier.dorkFieldLastName'), placeholder: 'Dupont' },
      { key: 'dob', label: t('dossier.dorkFieldDOB'), placeholder: '15/03/1985', hint: t('dossier.dorkFieldDOBHint') },
      { key: 'city', label: t('dossier.dorkFieldCity'), placeholder: 'Bruxelles', hint: t('dossier.dorkFieldCityHint') },
      { key: 'employer', label: t('dossier.dorkFieldEmployer'), placeholder: 'Entreprise SA', hint: t('dossier.dorkFieldEmployerHint') },
    ],
    tips: [
      t('dossier.dorkTipIdentity1'),
      t('dossier.dorkTipIdentity2'),
      t('dossier.dorkTipIdentity3'),
      t('dossier.dorkTipIdentity4'),
    ],
    generate(v) {
      const r: DorkResult[] = [];
      const fn = v.firstName?.trim(); const ln = v.lastName?.trim();
      const dob = v.dob?.trim(); const city = v.city?.trim(); const emp = v.employer?.trim();
      if (!fn && !ln) return r;
      const full = [fn, ln].filter(Boolean).join(' ');

      // --- Exact match ---
      r.push(d(`"${full}"`, t('dossier.dorkExactMatch')));

      // --- Date of birth combinations ---
      if (dob) {
        // Parse various date formats
        const parts = dob.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
        if (parts) {
          const day = parts[1].padStart(2, '0');
          const month = parts[2].padStart(2, '0');
          const year = parts[3].length === 2 ? `19${parts[3]}` : parts[3];
          r.push(d(`"${full}" "${day}/${month}/${year}" OR "${year}-${month}-${day}" OR "${day}-${month}-${year}"`, `${t('dossier.dorkExactMatch')} + ${t('dossier.dorkFieldDOB')}`));
          r.push(d(`"${full}" "${day}/${month}/${year}"`, `${t('dossier.dorkFieldDOB')} (DD/MM/YYYY)`));
          r.push(d(`"${full}" "${year}"`, `${t('dossier.dorkExactMatch')} + ${t('dossier.dorkBirthYear')}`));
        } else {
          r.push(d(`"${full}" "${dob}"`, `${t('dossier.dorkExactMatch')} + ${t('dossier.dorkFieldDOB')}`));
        }
      }

      // --- Social networks ---
      r.push(d(`"${full}" site:linkedin.com`, 'LinkedIn'));
      r.push(d(`"${full}" site:facebook.com`, 'Facebook'));
      r.push(d(`"${full}" site:twitter.com OR site:x.com`, 'Twitter / X'));
      r.push(d(`"${full}" site:instagram.com`, 'Instagram'));

      // --- File types ---
      r.push(d(`"${full}" filetype:pdf`, 'PDF'));
      r.push(d(`"${full}" filetype:doc OR filetype:docx`, 'Word (DOC/DOCX)'));
      r.push(d(`"${full}" filetype:xls OR filetype:xlsx`, 'Excel (XLS/XLSX)'));
      r.push(d(`"${full}" filetype:ppt OR filetype:pptx`, 'PowerPoint (PPT/PPTX)'));

      // --- Specific searches ---
      r.push(d(`"${full}" CV OR resume OR curriculum`, t('dossier.dorkCV')));
      r.push(d(`"${full}" jugement OR tribunal OR condamnation`, t('dossier.dorkJudicial')));
      r.push(d(`"${full}" site:societe.com OR site:pappers.fr OR site:kbo.be`, t('dossier.dorkCompanyRegistry')));
      if (fn && ln) r.push(d(`"${ln}" "${fn}" site:linkedin.com`, t('dossier.dorkNameVariant')));

      // --- City refinement ---
      if (city) {
        r.push(d(`"${full}" "${city}"`, `${t('dossier.dorkExactMatch')} + ${t('dossier.dorkFieldCity')}`));
        r.push(d(`"${full}" "${city}" site:facebook.com`, `Facebook + ${city}`));
        r.push(d(`"${full}" "${city}" filetype:pdf`, `PDF + ${city}`));
      }

      // --- Employer refinement ---
      if (emp) {
        r.push(d(`"${full}" "${emp}"`, `${t('dossier.dorkExactMatch')} + ${t('dossier.dorkFieldEmployer')}`));
        r.push(d(`"${full}" "${emp}" site:linkedin.com`, `LinkedIn + ${emp}`));
      }
      return r;
    },
  },
  {
    id: 'phone', icon: 'mdi-phone-outline', label: t('dossier.dorkCatPhone'),
    desc: t('dossier.dorkCatPhoneDesc'),
    fields: [
      { key: 'phone', label: t('dossier.dorkFieldPhone'), placeholder: '+32475123456' },
      { key: 'platform', label: t('dossier.dorkFieldPlatform'), placeholder: 'android / iphone', hint: t('dossier.dorkFieldPlatformHint') },
    ],
    tips: [
      t('dossier.dorkTipPhone1'),
      t('dossier.dorkTipPhone2'),
      t('dossier.dorkTipPhone3'),
    ],
    generate(v) {
      const r: DorkResult[] = [];
      const phone = v.phone?.trim();
      const platform = v.platform?.trim().toLowerCase();
      if (!phone) return r;
      const noSpace = phone.replace(/[\s.-]/g, '');
      r.push(d(`"${phone}" OR "${noSpace}"`, t('dossier.dorkPhoneVariants')));
      r.push(d(`"${noSpace}" site:facebook.com`, 'Facebook'));
      r.push(d(`"${noSpace}" site:linkedin.com`, 'LinkedIn'));
      r.push(d(`"${noSpace}" annuaire OR "pages blanches" OR infobel OR "pages jaunes"`, t('dossier.dorkDirectories')));
      r.push(d(`"${noSpace}" whatsapp OR telegram OR signal OR viber`, t('dossier.dorkMessengers')));
      r.push(d(`"${noSpace}" truecaller OR sync.me OR "caller id"`, t('dossier.dorkCallerID')));
      if (platform === 'android' || platform === 'samsung') {
        r.push(d(`"${noSpace}" site:play.google.com OR "google account"`, 'Google Play / Account'));
        r.push(d(`"${noSpace}" samsung OR "samsung account"`, 'Samsung'));
      } else if (platform === 'iphone' || platform === 'apple' || platform === 'ios') {
        r.push(d(`"${noSpace}" imessage OR facetime OR icloud`, 'Apple / iMessage'));
        r.push(d(`"${noSpace}" site:apple.com OR "apple id"`, 'Apple ID'));
      }
      r.push(d(`"${noSpace}" fraude OR arnaque OR scam OR spam`, t('dossier.dorkFraud')));
      return r;
    },
  },
  {
    id: 'email', icon: 'mdi-email-outline', label: t('dossier.dorkCatEmail'),
    desc: t('dossier.dorkCatEmailDesc'),
    fields: [
      { key: 'email', label: 'Email', placeholder: 'nom@exemple.com' },
    ],
    tips: [
      t('dossier.dorkTipEmail1'),
      t('dossier.dorkTipEmail2'),
      t('dossier.dorkTipEmail3'),
    ],
    generate(v) {
      const r: DorkResult[] = [];
      const email = v.email?.trim();
      if (!email) return r;
      r.push(d(`"${email}"`, t('dossier.dorkExactMatch')));
      r.push(d(`"${email}" site:linkedin.com`, 'LinkedIn'));
      r.push(d(`"${email}" site:facebook.com`, 'Facebook'));
      r.push(d(`"${email}" site:twitter.com OR site:x.com`, 'Twitter / X'));
      r.push(d(`"${email}" site:github.com`, 'GitHub'));
      r.push(d(`"${email}" site:instagram.com`, 'Instagram'));
      r.push(d(`"${email}" filetype:pdf`, t('dossier.dorkPDF')));
      r.push(d(`"${email}" password OR leak OR breach OR pastebin`, t('dossier.dorkLeaks')));
      r.push(d(`"${email}" forum OR community OR board`, t('dossier.dorkForums')));
      // Domain-specific
      const domain = email.split('@')[1];
      if (domain && !['gmail.com','hotmail.com','yahoo.com','outlook.com','icloud.com','live.com'].includes(domain)) {
        r.push(d(`site:${domain}`, `Site ${domain}`));
        r.push(d(`"${domain}" entreprise OR societe OR company`, `${t('dossier.dorkCompany')} (${domain})`));
      }
      if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') {
        r.push(d(`"${email}" imessage OR facetime`, 'Apple / iMessage'));
      }
      return r;
    },
  },
  {
    id: 'username', icon: 'mdi-at', label: t('dossier.dorkCatUsername'),
    desc: t('dossier.dorkCatUsernameDesc'),
    fields: [
      { key: 'username', label: t('dossier.dorkFieldUsername'), placeholder: 'john_doe42' },
    ],
    tips: [
      t('dossier.dorkTipUsername1'),
      t('dossier.dorkTipUsername2'),
    ],
    generate(v) {
      const r: DorkResult[] = [];
      const u = v.username?.trim();
      if (!u) return r;
      r.push(d(`"${u}"`, t('dossier.dorkExactMatch')));
      r.push(d(`"${u}" site:github.com`, 'GitHub'));
      r.push(d(`"${u}" site:reddit.com`, 'Reddit'));
      r.push(d(`"${u}" site:twitter.com OR site:x.com`, 'Twitter / X'));
      r.push(d(`"${u}" site:instagram.com`, 'Instagram'));
      r.push(d(`"${u}" site:tiktok.com`, 'TikTok'));
      r.push(d(`"${u}" site:youtube.com`, 'YouTube'));
      r.push(d(`"${u}" site:twitch.tv`, 'Twitch'));
      r.push(d(`"${u}" site:steam OR site:steamcommunity.com`, 'Steam'));
      r.push(d(`"${u}" site:discord.com OR site:discord.gg`, 'Discord'));
      r.push(d(`"${u}" site:telegram.me OR site:t.me`, 'Telegram'));
      r.push(d(`"${u}" forum OR community OR profil`, t('dossier.dorkForums')));
      r.push(d(`"${u}" site:keybase.io`, 'Keybase'));
      return r;
    },
  },
  {
    id: 'vehicle', icon: 'mdi-car-outline', label: t('dossier.dorkCatVehicle'),
    desc: t('dossier.dorkCatVehicleDesc'),
    fields: [
      { key: 'plate', label: t('dossier.dorkFieldPlate'), placeholder: '1-ABC-234' },
      { key: 'vin', label: t('dossier.dorkFieldVIN'), placeholder: 'WBA...', hint: t('dossier.dorkFieldVINHint') },
    ],
    tips: [
      t('dossier.dorkTipVehicle1'),
      t('dossier.dorkTipVehicle2'),
    ],
    generate(v) {
      const r: DorkResult[] = [];
      const plate = v.plate?.trim();
      const vin = v.vin?.trim();
      if (plate) {
        const noSep = plate.replace(/[\s-]/g, '');
        r.push(d(`"${plate}" OR "${noSep}"`, t('dossier.dorkExactMatch')));
        r.push(d(`"${plate}" site:autoscout24.be OR site:autoscout24.fr`, 'AutoScout24'));
        r.push(d(`"${plate}" site:2ememain.be OR site:leboncoin.fr`, t('dossier.dorkClassifieds')));
        r.push(d(`"${plate}" accident OR vol OR stolen OR police`, t('dossier.dorkVehicleIncident')));
        r.push(d(`"${plate}" assurance OR insurance OR sinistre`, t('dossier.dorkInsurance')));
      }
      if (vin) {
        r.push(d(`"${vin}"`, `VIN — ${t('dossier.dorkExactMatch')}`));
        r.push(d(`"${vin}" site:carfax.com OR site:autocheck.com`, 'Carfax / AutoCheck'));
        r.push(d(`"${vin}" recall OR rappel`, t('dossier.dorkRecall')));
      }
      return r;
    },
  },
  {
    id: 'financial', icon: 'mdi-bank-outline', label: t('dossier.dorkCatFinancial'),
    desc: t('dossier.dorkCatFinancialDesc'),
    fields: [
      { key: 'iban', label: 'IBAN', placeholder: 'BE68 5390 0754 7034' },
      { key: 'company', label: t('dossier.dorkFieldCompanyName'), placeholder: 'ACME SPRL', hint: t('dossier.dorkFieldCompanyHint') },
    ],
    tips: [
      t('dossier.dorkTipFinancial1'),
      t('dossier.dorkTipFinancial2'),
    ],
    generate(v) {
      const r: DorkResult[] = [];
      const iban = v.iban?.trim();
      const company = v.company?.trim();
      if (iban) {
        const noSpace = iban.replace(/\s/g, '');
        r.push(d(`"${iban}" OR "${noSpace}"`, t('dossier.dorkExactMatch')));
        r.push(d(`"${noSpace}" fraude OR arnaque OR scam`, t('dossier.dorkFraud')));
        r.push(d(`"${noSpace}" entreprise OR societe OR company`, t('dossier.dorkCompany')));
        r.push(d(`"${noSpace}" facture OR invoice OR paiement`, t('dossier.dorkInvoice')));
      }
      if (company) {
        r.push(d(`"${company}" site:societe.com OR site:pappers.fr`, 'Pappers / Societe.com'));
        r.push(d(`"${company}" site:kbo.be OR site:banque-carrefour-entreprises`, 'BCE (Belgique)'));
        r.push(d(`"${company}" gerant OR administrateur OR dirigeant`, t('dossier.dorkDirector')));
        r.push(d(`"${company}" bilan OR comptes annuels OR annual report`, t('dossier.dorkAccounts')));
        r.push(d(`"${company}" fraude OR arnaque OR scam OR escroquerie`, t('dossier.dorkFraud')));
      }
      return r;
    },
  },
  {
    id: 'ip', icon: 'mdi-ip-network-outline', label: t('dossier.dorkCatIP'),
    desc: t('dossier.dorkCatIPDesc'),
    fields: [
      { key: 'ip', label: t('dossier.dorkFieldIP'), placeholder: '185.220.101.42' },
      { key: 'domain', label: t('dossier.dorkFieldDomain'), placeholder: 'example.com', hint: t('dossier.dorkFieldDomainHint') },
    ],
    tips: [
      t('dossier.dorkTipIP1'),
      t('dossier.dorkTipIP2'),
    ],
    generate(v) {
      const r: DorkResult[] = [];
      const ip = v.ip?.trim();
      const domain = v.domain?.trim();
      if (ip) {
        r.push(d(`"${ip}"`, t('dossier.dorkExactMatch')));
        r.push(d(`"${ip}" site:shodan.io`, 'Shodan'));
        r.push(d(`"${ip}" site:censys.io`, 'Censys'));
        r.push(d(`"${ip}" site:virustotal.com`, 'VirusTotal'));
        r.push(d(`"${ip}" site:abuseipdb.com`, 'AbuseIPDB'));
        r.push(d(`"${ip}" abuse OR malware OR spam OR botnet`, t('dossier.dorkAbuse')));
        r.push(d(`"${ip}" whois OR hosting OR datacenter`, t('dossier.dorkHosting')));
      }
      if (domain) {
        r.push(d(`site:${domain}`, `${t('dossier.dorkGeneral')} site:${domain}`));
        r.push(d(`site:${domain} filetype:pdf OR filetype:doc OR filetype:xls`, t('dossier.dorkPDF')));
        r.push(d(`"${domain}" site:whois.com OR whois`, 'WHOIS'));
        r.push(d(`"${domain}" site:dnsdumpster.com OR dns`, 'DNS'));
        r.push(d(`"${domain}" site:web.archive.org`, 'Wayback Machine'));
      }
      return r;
    },
  },
]);

function selectCategory(cat: DorkCategory) {
  activeCategory.value = cat;
  Object.keys(fieldValues).forEach(k => delete fieldValues[k]);
  results.value = [];
  step.value = 'search';
}

function generateDorks() {
  if (!activeCategory.value) return;
  results.value = activeCategory.value.generate(fieldValues);
}

function copyAll() {
  const text = results.value.map(r => `${r.label}\n${r.query}\n${r.links[0]?.url || ''}`).join('\n\n');
  navigator.clipboard.writeText(text);
}

async function sendToNote() {
  if (!dossierStore.currentDossier || results.value.length === 0) return;
  const catLabel = activeCategory.value?.label || 'OSINT';
  const inputSummary = Object.entries(fieldValues).filter(([,v]) => v.trim()).map(([k,v]) => `${k}: ${v}`).join(', ');

  const content: any[] = [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: `OSINT Dorking — ${catLabel}` }] },
    { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'italic' }], text: `${inputSummary} — ${new Date().toLocaleDateString('fr-FR')}` }] },
    { type: 'horizontalRule' },
  ];

  for (const dork of results.value) {
    content.push({ type: 'paragraph', content: [
      { type: 'text', marks: [{ type: 'bold' }], text: `${dork.label} : ` },
      { type: 'text', marks: [{ type: 'code' }], text: dork.query },
    ]});
    const lc: any[] = [];
    for (const link of dork.links) {
      if (lc.length > 0) lc.push({ type: 'text', text: '  |  ' });
      lc.push({ type: 'text', marks: [{ type: 'link', attrs: { href: link.url, target: '_blank' } }], text: link.engine });
    }
    content.push({ type: 'paragraph', content: lc });
  }

  try {
    const { data } = await api.post('/nodes', {
      dossierId: dossierStore.currentDossier._id,
      parentId: null,
      type: 'note',
      title: `OSINT Dorking — ${catLabel} — ${new Date().toLocaleDateString('fr-FR')}`,
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
.od-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; }
.od-close:hover { color: var(--me-text-primary); }
.od-body { padding: 16px 18px; max-height: 520px; overflow-y: auto; }
.od-intro { font-size: 13px; color: var(--me-text-secondary); margin-bottom: 14px; }
.od-back { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--me-accent); background: none; border: none; cursor: pointer; padding: 0; margin-bottom: 12px; }

/* Type selection grid */
.od-type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
.od-type-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 12px; border-radius: 8px; border: 1px solid var(--me-border); background: var(--me-bg-deep); cursor: pointer; transition: all 0.15s; text-align: center; }
.od-type-card:hover { border-color: var(--me-accent); background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.06); }
.od-type-card .v-icon { color: var(--me-accent); }
.od-type-label { font-size: 13px; font-weight: 600; color: var(--me-text-primary); }
.od-type-desc { font-size: 10px; color: var(--me-text-muted); line-height: 1.3; }

/* Search step */
.od-search-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 15px; font-weight: 600; color: var(--me-text-primary); }
.od-search-header .v-icon { color: var(--me-accent); }

/* Fields */
.od-fields { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.od-field { display: flex; flex-direction: column; gap: 3px; }
.od-field-label { font-size: 12px; font-weight: 600; color: var(--me-text-secondary); }
.od-field-input { padding: 7px 10px; border-radius: 6px; border: 1px solid var(--me-border); background: var(--me-bg-deep); color: var(--me-text-primary); font-size: 13px; font-family: var(--me-font-mono); outline: none; }
.od-field-input:focus { border-color: var(--me-accent); }
.od-field-hint { font-size: 10px; color: var(--me-text-muted); font-style: italic; }

/* Tips */
.od-tips { padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(var(--me-accent-rgb, 59, 130, 246), 0.2); background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.05); margin-bottom: 14px; }
.od-tips-title { font-size: 12px; font-weight: 600; color: var(--me-accent); display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.od-tips-list { margin: 0; padding-left: 16px; font-size: 11px; color: var(--me-text-secondary); line-height: 1.6; }

/* Generate button */
.od-generate-btn { display: flex; align-items: center; gap: 4px; padding: 8px 18px; border-radius: 6px; border: none; background: var(--me-accent); color: white; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 14px; width: 100%; justify-content: center; }
.od-generate-btn:hover:not(:disabled) { filter: brightness(1.1); }
.od-generate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Results */
.od-results { border-top: 1px solid var(--me-border); padding-top: 12px; }
.od-results-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.od-section-title { font-size: 12px; font-weight: 600; color: var(--me-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.od-results-actions { display: flex; gap: 4px; }
.od-action-btn { background: none; border: 1px solid var(--me-border); border-radius: 6px; padding: 4px 8px; cursor: pointer; color: var(--me-text-muted); display: flex; align-items: center; }
.od-action-btn:hover { border-color: var(--me-accent); color: var(--me-accent); }

.od-result-item { margin-bottom: 10px; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--me-border); background: var(--me-bg-deep); }
.od-result-top { margin-bottom: 5px; }
.od-result-label { font-size: 11px; font-weight: 600; color: var(--me-text-secondary); display: block; }
.od-result-query { font-size: 11px; color: var(--me-text-muted); word-break: break-all; }
.od-result-links { display: flex; flex-wrap: wrap; gap: 4px; }
.od-link { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 8px; background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.1); color: var(--me-accent); font-size: 10px; font-weight: 500; text-decoration: none; }
.od-link:hover { background: rgba(var(--me-accent-rgb, 59, 130, 246), 0.2); }
.od-link img { border-radius: 2px; }
</style>
