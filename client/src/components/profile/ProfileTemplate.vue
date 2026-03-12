<template>
  <div class="profile-template">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-file-document-edit-outline</v-icon>
        Template rapport PDF
      </h2>
    </div>

    <!-- Presets -->
    <div class="tpl-card glass-card fade-in fade-in-delay-1">
      <h3 class="tpl-card-title mono">
        <v-icon size="16" class="mr-1">mdi-bookmark-multiple-outline</v-icon>
        Presets
      </h3>
      <div class="tpl-row tpl-row-preset">
        <div class="tpl-field" style="flex: 1;">
          <label class="tpl-label mono">Preset actif</label>
          <v-select
            v-model="activePresetName"
            :items="presetNames"
            density="compact"
            hide-details
            placeholder="Aucun preset"
            clearable
            @update:model-value="loadPreset"
          />
        </div>
        <div class="tpl-preset-actions">
          <button class="me-btn-ghost me-btn-sm" @click="showSavePresetDialog = true">
            <v-icon size="14" class="mr-1">mdi-content-save-plus-outline</v-icon>
            Sauver comme preset
          </button>
          <button class="me-btn-ghost me-btn-sm me-btn-danger" @click="deletePreset" :disabled="!activePresetName">
            <v-icon size="14" class="mr-1">mdi-delete-outline</v-icon>
            Supprimer
          </button>
        </div>
      </div>
    </div>

    <!-- Global settings -->
    <div class="tpl-card glass-card fade-in fade-in-delay-1">
      <h3 class="tpl-card-title mono">
        <v-icon size="16" class="mr-1">mdi-cog-outline</v-icon>
        Parametres generaux
      </h3>
      <div class="tpl-row tpl-row-3col">
        <div class="tpl-field">
          <label class="tpl-label mono">Police</label>
          <v-select
            v-model="tpl.fontFamily"
            :items="fontOptions"
            density="compact"
            hide-details
          />
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Marge horizontale (mm)</label>
          <v-slider v-model="tpl.page.marginH" :min="10" :max="35" :step="1" hide-details thumb-label color="primary" />
          <span class="tpl-value mono">{{ tpl.page.marginH }}mm</span>
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Marge verticale (mm)</label>
          <v-slider v-model="tpl.page.marginV" :min="10" :max="30" :step="1" hide-details thumb-label color="primary" />
          <span class="tpl-value mono">{{ tpl.page.marginV }}mm</span>
        </div>
      </div>
    </div>

    <!-- Header config -->
    <div class="tpl-card glass-card fade-in fade-in-delay-1">
      <h3 class="tpl-card-title mono">
        <v-icon size="16" class="mr-1">mdi-page-layout-header</v-icon>
        En-tete
      </h3>
      <div class="tpl-row">
        <div class="tpl-field">
          <label class="tpl-label mono">Texte central</label>
          <input v-model="tpl.header.text" class="tpl-input mono" placeholder="PJF Bruxelles - DR5 - ..." />
        </div>
      </div>
      <div class="tpl-row tpl-row-2col">
        <div class="tpl-field">
          <label class="tpl-label mono">Logo gauche</label>
          <div class="tpl-logo-slot">
            <img v-if="tpl.header.logoLeft" :src="logoLeftPreview" class="tpl-logo-preview" />
            <div v-else class="tpl-logo-empty">Aucun logo</div>
            <div class="tpl-logo-actions">
              <label class="tpl-upload-btn">
                <v-icon size="14">mdi-upload</v-icon>
                <input type="file" accept="image/*" hidden @change="e => uploadLogo('headerLeft', e)" />
              </label>
              <button v-if="tpl.header.logoLeft" class="tpl-remove-btn" @click="removeLogo('headerLeft')">
                <v-icon size="14">mdi-close</v-icon>
              </button>
            </div>
          </div>
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Logo droite</label>
          <div class="tpl-logo-slot">
            <img v-if="tpl.header.logoRight" :src="logoRightPreview" class="tpl-logo-preview" />
            <div v-else class="tpl-logo-empty">Aucun logo</div>
            <div class="tpl-logo-actions">
              <label class="tpl-upload-btn">
                <v-icon size="14">mdi-upload</v-icon>
                <input type="file" accept="image/*" hidden @change="e => uploadLogo('headerRight', e)" />
              </label>
              <button v-if="tpl.header.logoRight" class="tpl-remove-btn" @click="removeLogo('headerRight')">
                <v-icon size="14">mdi-close</v-icon>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="tpl-row">
        <div class="tpl-field">
          <label class="tpl-label mono">Couleur ligne</label>
          <div class="tpl-color-row">
            <input type="color" v-model="tpl.header.lineColor" class="tpl-color-input" />
            <span class="tpl-color-hex mono">{{ tpl.header.lineColor }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Cover page config -->
    <div class="tpl-card glass-card fade-in fade-in-delay-2">
      <h3 class="tpl-card-title mono">
        <v-icon size="16" class="mr-1">mdi-book-open-page-variant-outline</v-icon>
        Premiere page
      </h3>
      <div class="tpl-row">
        <div class="tpl-field">
          <label class="tpl-label mono">Titre principal</label>
          <input v-model="tpl.cover.title" class="tpl-input mono" placeholder="Rapport OSINT" />
        </div>
      </div>
      <div class="tpl-row tpl-row-2col">
        <div class="tpl-field">
          <label class="tpl-label mono">Taille titre (pt)</label>
          <v-slider v-model="tpl.cover.titleSize" :min="20" :max="48" :step="2" hide-details thumb-label color="primary" />
          <span class="tpl-value mono">{{ tpl.cover.titleSize }}pt</span>
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Couleur titre</label>
          <div class="tpl-color-row">
            <input type="color" v-model="tpl.cover.titleColor" class="tpl-color-input" />
            <span class="tpl-color-hex mono">{{ tpl.cover.titleColor }}</span>
          </div>
        </div>
      </div>
      <div class="tpl-row tpl-row-2col">
        <div class="tpl-field">
          <label class="tpl-label mono">Taille sous-titre (pt)</label>
          <v-slider v-model="tpl.cover.subtitleSize" :min="12" :max="30" :step="1" hide-details thumb-label color="primary" />
          <span class="tpl-value mono">{{ tpl.cover.subtitleSize }}pt</span>
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Texte pied de page</label>
          <input v-model="tpl.cover.footerText" class="tpl-input mono" placeholder="PJF Bruxelles - DR5..." />
        </div>
      </div>
    </div>

    <!-- Section styles -->
    <div class="tpl-card glass-card fade-in fade-in-delay-3">
      <h3 class="tpl-card-title mono">
        <v-icon size="16" class="mr-1">mdi-format-header-1</v-icon>
        Styles de sections
      </h3>

      <div v-for="h in headingKeys" :key="h.key" class="tpl-heading-block">
        <div class="tpl-heading-label mono">{{ h.label }}</div>
        <div class="tpl-row tpl-row-3col">
          <div class="tpl-field">
            <label class="tpl-label mono">Taille (pt)</label>
            <v-slider v-model="tpl.headings[h.key].fontSize" :min="h.minSize" :max="h.maxSize" :step="1" hide-details thumb-label color="primary" />
            <span class="tpl-value mono">{{ tpl.headings[h.key].fontSize }}pt</span>
          </div>
          <div class="tpl-field">
            <label class="tpl-label mono">Couleur texte</label>
            <div class="tpl-color-row">
              <input type="color" v-model="tpl.headings[h.key].color" class="tpl-color-input" />
              <span class="tpl-color-hex mono">{{ tpl.headings[h.key].color }}</span>
            </div>
          </div>
          <div class="tpl-field">
            <label class="tpl-label mono">Fond</label>
            <div class="tpl-color-row">
              <input type="color" v-model="tpl.headings[h.key].bgColor" class="tpl-color-input" />
              <span class="tpl-color-hex mono">{{ tpl.headings[h.key].bgColor }}</span>
              <button class="tpl-remove-btn" title="Sans fond" @click="tpl.headings[h.key].bgColor = ''">
                <v-icon size="12">mdi-close</v-icon>
              </button>
            </div>
          </div>
        </div>
        <div class="tpl-row tpl-row-toggles">
          <div class="tpl-toggle-item">
            <v-switch v-model="tpl.headings[h.key].bold" hide-details density="compact" color="primary" label="Gras" />
          </div>
          <div class="tpl-toggle-item">
            <v-switch v-model="tpl.headings[h.key].italic" hide-details density="compact" color="primary" label="Italique" />
          </div>
          <div class="tpl-toggle-item">
            <v-switch v-model="tpl.headings[h.key].uppercase" hide-details density="compact" color="primary" label="Majuscules" />
          </div>
        </div>
        <div class="tpl-row tpl-row-3col">
          <div class="tpl-field">
            <label class="tpl-label mono">Bordure</label>
            <v-select
              v-model="tpl.headings[h.key].borderStyle"
              :items="borderStyleOptions"
              density="compact"
              hide-details
            />
          </div>
          <div class="tpl-field">
            <label class="tpl-label mono">Couleur bordure</label>
            <div class="tpl-color-row">
              <input type="color" v-model="tpl.headings[h.key].borderColor" class="tpl-color-input" :disabled="tpl.headings[h.key].borderStyle === 'none'" />
              <span class="tpl-color-hex mono">{{ tpl.headings[h.key].borderColor }}</span>
            </div>
          </div>
          <div class="tpl-field">
            <label class="tpl-label mono">Epaisseur (pt)</label>
            <v-slider v-model="tpl.headings[h.key].borderWidth" :min="0.5" :max="4" :step="0.5" hide-details thumb-label color="primary" :disabled="tpl.headings[h.key].borderStyle === 'none'" />
            <span class="tpl-value mono">{{ tpl.headings[h.key].borderWidth }}pt</span>
          </div>
        </div>
        <!-- Preview -->
        <div class="tpl-heading-preview" :style="headingPreviewStyle(h.key)">
          {{ h.label }} - Exemple de titre
        </div>
      </div>
    </div>

    <!-- Body & disclaimer -->
    <div class="tpl-card glass-card fade-in fade-in-delay-4">
      <h3 class="tpl-card-title mono">
        <v-icon size="16" class="mr-1">mdi-text</v-icon>
        Corps de texte
      </h3>
      <div class="tpl-row tpl-row-3col">
        <div class="tpl-field">
          <label class="tpl-label mono">Taille police (pt)</label>
          <v-slider v-model="tpl.body.fontSize" :min="8" :max="14" :step="0.5" hide-details thumb-label color="primary" />
          <span class="tpl-value mono">{{ tpl.body.fontSize }}pt</span>
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Couleur texte</label>
          <div class="tpl-color-row">
            <input type="color" v-model="tpl.body.color" class="tpl-color-input" />
            <span class="tpl-color-hex mono">{{ tpl.body.color }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Spacing config -->
    <div class="tpl-card glass-card fade-in fade-in-delay-4">
      <h3 class="tpl-card-title mono">
        <v-icon size="16" class="mr-1">mdi-format-line-spacing</v-icon>
        Espacement
      </h3>
      <div class="tpl-row tpl-row-3col">
        <div class="tpl-field">
          <label class="tpl-label mono">Interligne</label>
          <v-slider v-model="tpl.spacing.lineHeight" :min="1" :max="2.5" :step="0.1" hide-details thumb-label color="primary" />
          <span class="tpl-value mono">{{ tpl.spacing.lineHeight }}x</span>
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Espacement paragraphes (mm)</label>
          <v-slider v-model="tpl.spacing.paragraphSpacing" :min="1" :max="10" :step="0.5" hide-details thumb-label color="primary" />
          <span class="tpl-value mono">{{ tpl.spacing.paragraphSpacing }}mm</span>
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Espacement sections (mm)</label>
          <v-slider v-model="tpl.spacing.sectionSpacing" :min="2" :max="15" :step="1" hide-details thumb-label color="primary" />
          <span class="tpl-value mono">{{ tpl.spacing.sectionSpacing }}mm</span>
        </div>
      </div>
    </div>

    <!-- Table styling -->
    <div class="tpl-card glass-card fade-in fade-in-delay-4">
      <h3 class="tpl-card-title mono">
        <v-icon size="16" class="mr-1">mdi-table</v-icon>
        Style des tableaux
      </h3>
      <div class="tpl-row tpl-row-3col">
        <div class="tpl-field">
          <label class="tpl-label mono">Fond en-tete</label>
          <div class="tpl-color-row">
            <input type="color" v-model="tpl.table.headerBgColor" class="tpl-color-input" />
            <span class="tpl-color-hex mono">{{ tpl.table.headerBgColor }}</span>
          </div>
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Texte en-tete</label>
          <div class="tpl-color-row">
            <input type="color" v-model="tpl.table.headerTextColor" class="tpl-color-input" />
            <span class="tpl-color-hex mono">{{ tpl.table.headerTextColor }}</span>
          </div>
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Couleur bordure</label>
          <div class="tpl-color-row">
            <input type="color" v-model="tpl.table.borderColor" class="tpl-color-input" />
            <span class="tpl-color-hex mono">{{ tpl.table.borderColor }}</span>
          </div>
        </div>
      </div>
      <div class="tpl-row tpl-row-2col">
        <div class="tpl-field">
          <label class="tpl-label mono">Epaisseur bordure (pt)</label>
          <v-slider v-model="tpl.table.borderWidth" :min="0.25" :max="2" :step="0.25" hide-details thumb-label color="primary" />
          <span class="tpl-value mono">{{ tpl.table.borderWidth }}pt</span>
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Ligne alternee</label>
          <div class="tpl-color-row">
            <input type="color" v-model="tpl.table.alternateRowColor" class="tpl-color-input" />
            <span class="tpl-color-hex mono">{{ tpl.table.alternateRowColor }}</span>
            <button class="tpl-remove-btn" title="Sans alternance" @click="tpl.table.alternateRowColor = ''">
              <v-icon size="12">mdi-close</v-icon>
            </button>
          </div>
        </div>
      </div>
      <!-- Table preview -->
      <div class="tpl-table-preview">
        <table :style="tablePreviewStyle">
          <thead>
            <tr :style="tableHeaderStyle">
              <th>Colonne A</th>
              <th>Colonne B</th>
              <th>Colonne C</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in 3" :key="r" :style="r % 2 === 0 && tpl.table.alternateRowColor ? { backgroundColor: tpl.table.alternateRowColor } : {}">
              <td>Donnee {{ r }}.1</td>
              <td>Donnee {{ r }}.2</td>
              <td>Donnee {{ r }}.3</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer config -->
    <div class="tpl-card glass-card fade-in fade-in-delay-5">
      <h3 class="tpl-card-title mono">
        <v-icon size="16" class="mr-1">mdi-page-layout-footer</v-icon>
        Pied de page
      </h3>
      <div class="tpl-row tpl-row-2col">
        <div class="tpl-field">
          <label class="tpl-label mono">Format pagination</label>
          <v-select
            v-model="tpl.footer.format"
            :items="paginationOptions"
            density="compact"
            hide-details
          />
        </div>
        <div class="tpl-field">
          <label class="tpl-label mono">Couleur ligne</label>
          <div class="tpl-color-row">
            <input type="color" v-model="tpl.footer.lineColor" class="tpl-color-input" />
            <span class="tpl-color-hex mono">{{ tpl.footer.lineColor }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- PDF Preview -->
    <div class="tpl-card glass-card fade-in fade-in-delay-6">
      <h3 class="tpl-card-title mono">
        <v-icon size="16" class="mr-1">mdi-eye-outline</v-icon>
        Apercu PDF
        <button class="tpl-refresh-btn" @click="generatePdfPreview" :disabled="previewLoading" title="Rafraichir">
          <v-icon size="14" :class="{ 'tpl-spin': previewLoading }">mdi-refresh</v-icon>
        </button>
      </h3>
      <div class="tpl-preview-container">
        <div v-if="previewLoading" class="tpl-preview-loading">
          <v-progress-circular indeterminate size="32" color="primary" />
          <span class="mono">Generation...</span>
        </div>
        <iframe
          v-else-if="pdfPreviewUrl"
          :src="pdfPreviewUrl"
          class="tpl-pdf-iframe"
        ></iframe>
        <div v-else class="tpl-preview-empty mono">
          Cliquez sur le bouton pour generer l'apercu PDF
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="tpl-actions fade-in">
      <div class="tpl-actions-left">
        <label class="me-btn-ghost">
          <v-icon size="14" class="mr-1">mdi-import</v-icon>
          Importer
          <input type="file" accept=".json" hidden @change="importTemplate" />
        </label>
        <button class="me-btn-ghost" @click="exportTemplate">
          <v-icon size="14" class="mr-1">mdi-export</v-icon>
          Exporter
        </button>
      </div>
      <div class="tpl-actions-right">
        <button class="me-btn-ghost" @click="resetToDefaults">
          <v-icon size="14" class="mr-1">mdi-refresh</v-icon>
          Reinitialiser
        </button>
        <button class="me-btn-primary" @click="save" :disabled="saving">
          <v-icon size="14" class="mr-1">mdi-content-save-outline</v-icon>
          Sauvegarder
        </button>
      </div>
    </div>

    <!-- Save preset dialog -->
    <v-dialog v-model="showSavePresetDialog" max-width="400">
      <v-card class="glass-card">
        <v-card-title class="mono">Sauvegarder comme preset</v-card-title>
        <v-card-text>
          <input v-model="newPresetName" class="tpl-input mono" style="width: 100%;" placeholder="Nom du preset..." @keyup.enter="savePreset" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <button class="me-btn-ghost" @click="showSavePresetDialog = false">Annuler</button>
          <button class="me-btn-primary" @click="savePreset" :disabled="!newPresetName.trim()">Sauvegarder</button>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :timeout="2500" color="success" location="bottom right">
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import api, { SERVER_URL } from '../../services/api';
import { type PdfTemplateConfig, defaultPdfTemplate, mergePdfTemplate, createPdfBuilder, loadTemplateLogos } from '../../utils/pdfTemplate';

const saving = ref(false);
const snackbar = ref(false);
const snackbarText = ref('');

function showSnack(text: string) {
  snackbarText.value = text;
  snackbar.value = true;
}

const tpl = reactive<PdfTemplateConfig>(defaultPdfTemplate());

const fontOptions = ['Calibri', 'Arial', 'Aptos', 'Times New Roman', 'Georgia', 'Helvetica'];

const headingKeys = [
  { key: 'h1' as const, label: 'H1 - Titre principal', minSize: 12, maxSize: 24 },
  { key: 'h2' as const, label: 'H2 - Sous-titre', minSize: 10, maxSize: 18 },
  { key: 'h3' as const, label: 'H3 - Sous-sous-titre', minSize: 8, maxSize: 14 },
];

const borderStyleOptions = [
  { title: 'Aucune', value: 'none' },
  { title: 'Bas uniquement', value: 'bottom' },
  { title: 'Encadre', value: 'box' },
];

const paginationOptions = [
  { title: 'Page 1 | 5', value: 'Page {n} | {total}' },
  { title: 'Page 1 / 5', value: 'Page {n} / {total}' },
  { title: '1 / 5', value: '{n} / {total}' },
  { title: 'Page 1', value: 'Page {n}' },
];

// === Presets ===
interface TemplatePreset {
  name: string;
  config: PdfTemplateConfig;
}

const presets = ref<TemplatePreset[]>([]);
const activePresetName = ref<string | null>(null);
const showSavePresetDialog = ref(false);
const newPresetName = ref('');

const presetNames = computed(() => presets.value.map(p => p.name));

function loadPresetsFromStorage() {
  try {
    const saved = localStorage.getItem('pdfTemplatePresets');
    if (saved) presets.value = JSON.parse(saved);
  } catch { /* ignore */ }
}

function savePresetsToStorage() {
  localStorage.setItem('pdfTemplatePresets', JSON.stringify(presets.value));
}

function loadPreset(name: string | null) {
  if (!name) return;
  const preset = presets.value.find(p => p.name === name);
  if (preset) {
    const fresh = defaultPdfTemplate();
    mergePdfTemplate(fresh, preset.config as any);
    Object.assign(tpl, fresh);
  }
}

function savePreset() {
  const name = newPresetName.value.trim();
  if (!name) return;
  const existing = presets.value.findIndex(p => p.name === name);
  const config = JSON.parse(JSON.stringify(tpl)) as PdfTemplateConfig;
  if (existing >= 0) {
    presets.value[existing].config = config;
  } else {
    presets.value.push({ name, config });
  }
  savePresetsToStorage();
  activePresetName.value = name;
  showSavePresetDialog.value = false;
  newPresetName.value = '';
  showSnack(`Preset "${name}" sauvegarde`);
}

function deletePreset() {
  if (!activePresetName.value) return;
  const name = activePresetName.value;
  presets.value = presets.value.filter(p => p.name !== name);
  savePresetsToStorage();
  activePresetName.value = null;
  showSnack(`Preset "${name}" supprime`);
}

// === PDF Preview ===
const pdfPreviewUrl = ref<string | null>(null);
const previewLoading = ref(false);
let previewDebounceTimer: ReturnType<typeof setTimeout> | null = null;

async function generatePdfPreview() {
  previewLoading.value = true;
  try {
    const { jsPDF } = await import('jspdf');
    const tplSnapshot = JSON.parse(JSON.stringify(tpl)) as PdfTemplateConfig;
    const logos = await loadTemplateLogos(tplSnapshot, SERVER_URL);
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const b = await createPdfBuilder(doc, tplSnapshot, logos);

    // Title + info
    b.drawReportHeader('Dossier Exemple', [
      new Date().toLocaleDateString('fr-FR'),
      'Statut: En cours',
      'Enqueteur: Jean Dupont',
    ]);

    // Content hierarchy example
    b.addHeading('Recherches en source ouverte', 'h1');
    b.addBody('Cette section illustre le style du corps de texte avec les parametres actuels du template.');
    b.addHeading('Compte Instagram', 'h2');
    b.addBody('Les recherches menees sur ce compte ont permis d\'identifier plusieurs publications pertinentes pour l\'enquete.');
    b.addHeading('Analyse des publications', 'h3');
    b.addBody('Les publications identifiees couvrent la periode du 1er janvier au 15 mars 2026.');

    // Bullet list demo
    await b.renderBlocks([
      { type: 'bulletList', items: [
        [{ type: 'paragraph', children: [{ type: 'text', text: 'Publication du 15 janvier 2026', marks: {} }] }],
        [{ type: 'paragraph', children: [{ type: 'text', text: 'Story archivee du 3 fevrier 2026', marks: {} }] }],
      ]},
    ]);

    // Blockquote demo
    await b.renderBlocks([
      { type: 'blockquote', children: [
        { type: 'paragraph', children: [{ type: 'text', text: 'Source: profil public identifie le 10 mars 2026.', marks: {} }] },
      ]},
    ]);

    // Table demo
    await b.renderBlocks([
      { type: 'table', rows: [
        [[{ type: 'text', text: 'Date', marks: {} }], [{ type: 'text', text: 'Evenement', marks: {} }]],
        [[{ type: 'text', text: '15/01/2026', marks: {} }], [{ type: 'text', text: 'Publication identifiee', marks: {} }]],
        [[{ type: 'text', text: '03/02/2026', marks: {} }], [{ type: 'text', text: 'Story archivee', marks: {} }]],
      ]},
    ]);

    const blob = b.finalize();

    // Revoke previous URL
    if (pdfPreviewUrl.value) URL.revokeObjectURL(pdfPreviewUrl.value);
    pdfPreviewUrl.value = URL.createObjectURL(blob);
  } catch (err) {
    console.error('PDF preview failed:', err);
    showSnack('Erreur lors de la generation');
  } finally {
    previewLoading.value = false;
  }
}

function debouncedPreview() {
  if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
  previewDebounceTimer = setTimeout(() => {
    if (pdfPreviewUrl.value) generatePdfPreview();
  }, 1500);
}

watch(() => JSON.stringify(tpl), debouncedPreview);

onBeforeUnmount(() => {
  if (pdfPreviewUrl.value) URL.revokeObjectURL(pdfPreviewUrl.value);
  if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
});

// === Logo previews ===
const logoLeftPreview = computed(() => {
  if (!tpl.header.logoLeft) return '';
  if (tpl.header.logoLeft.startsWith('data:') || tpl.header.logoLeft.startsWith('blob:')) return tpl.header.logoLeft;
  return `${SERVER_URL}/${tpl.header.logoLeft}`;
});

const logoRightPreview = computed(() => {
  if (!tpl.header.logoRight) return '';
  if (tpl.header.logoRight.startsWith('data:') || tpl.header.logoRight.startsWith('blob:')) return tpl.header.logoRight;
  return `${SERVER_URL}/${tpl.header.logoRight}`;
});

// === Table preview styles ===
const tablePreviewStyle = computed(() => ({
  borderCollapse: 'collapse' as const,
  width: '100%',
  fontSize: '11px',
  fontFamily: tpl.fontFamily,
  border: `${tpl.table.borderWidth}px solid ${tpl.table.borderColor}`,
}));

const tableHeaderStyle = computed(() => ({
  backgroundColor: tpl.table.headerBgColor,
  color: tpl.table.headerTextColor,
}));

// === Heading preview ===
function headingPreviewStyle(key: 'h1' | 'h2' | 'h3') {
  const h = tpl.headings[key];
  const bs = h.borderStyle || 'none';
  const bw = h.borderWidth || 1;
  const bc = h.borderColor || '#000';
  const style: Record<string, string> = {
    fontSize: (h.fontSize * 0.75) + 'px',
    fontFamily: tpl.fontFamily || 'Calibri',
    color: h.color,
    backgroundColor: h.bgColor || 'transparent',
    fontWeight: h.bold ? '700' : '400',
    fontStyle: h.italic ? 'italic' : 'normal',
    textTransform: h.uppercase ? 'uppercase' : 'none',
    padding: (h.bgColor || bs !== 'none') ? '4px 8px' : '2px 0',
  };
  if (bs === 'box') {
    style.border = `${bw}px solid ${bc}`;
  } else if (bs === 'bottom') {
    style.borderBottom = `${bw}px solid ${bc}`;
  }
  return style;
}

// === Actions ===
async function uploadLogo(slot: 'headerLeft' | 'headerRight', event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append('templateLogo', file);
  formData.append('slot', slot);
  try {
    const { data } = await api.post('/auth/template-logo', formData);
    if (slot === 'headerLeft') tpl.header.logoLeft = data.path;
    else tpl.header.logoRight = data.path;
  } catch {
    const reader = new FileReader();
    reader.onload = () => {
      if (slot === 'headerLeft') tpl.header.logoLeft = reader.result as string;
      else tpl.header.logoRight = reader.result as string;
    };
    reader.readAsDataURL(file);
  }
  input.value = '';
}

function removeLogo(slot: 'headerLeft' | 'headerRight') {
  if (slot === 'headerLeft') tpl.header.logoLeft = '';
  else tpl.header.logoRight = '';
}

function resetToDefaults() {
  Object.assign(tpl, defaultPdfTemplate());
  activePresetName.value = null;
}

async function save() {
  saving.value = true;
  try {
    await api.put('/auth/preferences', { pdfTemplate: JSON.parse(JSON.stringify(tpl)) });
    localStorage.setItem('pdfTemplate', JSON.stringify(tpl));
    showSnack('Template sauvegarde');
  } finally {
    saving.value = false;
  }
}

function exportTemplate() {
  const json = JSON.stringify(tpl, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template-rapport.json';
  a.click();
  URL.revokeObjectURL(url);
  showSnack('Template exporte');
}

function importTemplate(event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result as string);
      const fresh = defaultPdfTemplate();
      mergePdfTemplate(fresh, imported);
      Object.assign(tpl, fresh);
      activePresetName.value = null;
      showSnack('Template importe');
    } catch {
      showSnack('Fichier invalide');
    }
  };
  reader.readAsText(input.files[0]);
  input.value = '';
}

onMounted(async () => {
  loadPresetsFromStorage();
  try {
    const { data } = await api.get('/auth/preferences');
    if (data?.pdfTemplate) {
      mergePdfTemplate(tpl, data.pdfTemplate);
      localStorage.setItem('pdfTemplate', JSON.stringify(tpl));
    }
    if (data?.pdfTemplatePresets) {
      presets.value = data.pdfTemplatePresets;
      savePresetsToStorage();
    }
  } catch { /* use defaults */ }
});
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }

.tpl-card { padding: 20px; margin-bottom: 16px; }
.tpl-card-title { font-size: 13px; font-weight: 600; color: var(--me-text-primary); display: flex; align-items: center; margin-bottom: 16px; gap: 8px; }

.tpl-row { margin-bottom: 14px; }
.tpl-row-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.tpl-row-3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; align-items: end; margin-top: 8px; }
.tpl-row-4col { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 12px; align-items: end; }
@media (max-width: 700px) {
  .tpl-row-2col, .tpl-row-3col, .tpl-row-4col { grid-template-columns: 1fr; }
}

.tpl-row-preset { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
.tpl-preset-actions { display: flex; gap: 8px; align-items: center; }

.tpl-field { display: flex; flex-direction: column; gap: 4px; }
.tpl-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--me-text-muted); }
.tpl-input {
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  padding: 8px 10px;
  color: var(--me-text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}
.tpl-input:focus { border-color: var(--me-accent); }
.tpl-value { font-size: 11px; color: var(--me-accent); text-align: right; }

/* Color picker */
.tpl-color-row { display: flex; align-items: center; gap: 8px; }
.tpl-color-input { width: 32px; height: 32px; border: 1px solid var(--me-border); border-radius: var(--me-radius-xs); cursor: pointer; padding: 0; background: none; }
.tpl-color-hex { font-size: 11px; color: var(--me-text-muted); }

/* Logo slots */
.tpl-logo-slot { display: flex; align-items: center; gap: 10px; }
.tpl-logo-preview { width: 48px; height: 48px; object-fit: contain; border-radius: var(--me-radius-xs); background: var(--me-bg-elevated); border: 1px solid var(--me-border); }
.tpl-logo-empty { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; font-size: 9px; color: var(--me-text-muted); border: 1px dashed var(--me-border); border-radius: var(--me-radius-xs); text-align: center; }
.tpl-logo-actions { display: flex; gap: 4px; }
.tpl-upload-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: var(--me-bg-elevated); border: 1px solid var(--me-border); border-radius: var(--me-radius-xs);
  color: var(--me-text-muted); cursor: pointer; transition: all 0.15s;
}
.tpl-upload-btn:hover { border-color: var(--me-accent); color: var(--me-accent); }
.tpl-remove-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: none; border: 1px solid var(--me-border); border-radius: var(--me-radius-xs);
  color: var(--me-text-muted); cursor: pointer; transition: all 0.15s;
}
.tpl-remove-btn:hover { border-color: #f87171; color: #f87171; }

/* Heading blocks */
.tpl-heading-block { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--me-border); }
.tpl-heading-block:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.tpl-heading-label { font-size: 12px; font-weight: 600; color: var(--me-text-secondary); margin-bottom: 10px; }
.tpl-heading-preview { margin-top: 8px; border: 1px solid var(--me-border); border-radius: var(--me-radius-xs); display: inline-block; }

/* Table preview */
.tpl-table-preview { margin-top: 12px; overflow-x: auto; }
.tpl-table-preview table { border-collapse: collapse; width: 100%; }
.tpl-table-preview th, .tpl-table-preview td {
  padding: 6px 10px;
  border: 1px solid var(--me-border);
  text-align: left;
  font-size: 11px;
}
.tpl-table-preview th { font-weight: 600; }

/* PDF Preview */
.tpl-preview-container { display: flex; justify-content: center; min-height: 500px; }
.tpl-pdf-iframe {
  width: 100%;
  height: 600px;
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  background: #fff;
}
.tpl-preview-loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; width: 100%; color: var(--me-text-muted);
}
.tpl-preview-empty {
  display: flex; align-items: center; justify-content: center;
  width: 100%; color: var(--me-text-muted); font-size: 13px;
}
.tpl-refresh-btn {
  margin-left: auto;
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: none; border: 1px solid var(--me-border); border-radius: var(--me-radius-xs);
  color: var(--me-text-muted); cursor: pointer; transition: all 0.15s;
}
.tpl-refresh-btn:hover { border-color: var(--me-accent); color: var(--me-accent); }
.tpl-refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tpl-spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* Toggle row */
.tpl-row-toggles { display: flex; gap: 16px; margin-top: 4px; flex-wrap: wrap; }
.tpl-toggle-item { min-width: 100px; }

/* Actions */
.tpl-actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
.tpl-actions-left, .tpl-actions-right { display: flex; gap: 8px; }
.me-btn-primary { padding: 8px 16px; border-radius: var(--me-radius-xs); background: var(--me-accent); border: none; color: var(--me-bg-deep); cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; }
.me-btn-primary:hover { box-shadow: 0 0 16px var(--me-accent-glow); }
.me-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.me-btn-ghost { padding: 8px 16px; border-radius: var(--me-radius-xs); background: none; border: 1px solid var(--me-border); color: var(--me-text-muted); cursor: pointer; font-size: 13px; display: flex; align-items: center; transition: all 0.15s; }
.me-btn-ghost:hover { border-color: var(--me-accent); color: var(--me-accent); }
.me-btn-sm { padding: 6px 12px; font-size: 12px; }
.me-btn-danger:hover { border-color: #f87171; color: #f87171; }
</style>
