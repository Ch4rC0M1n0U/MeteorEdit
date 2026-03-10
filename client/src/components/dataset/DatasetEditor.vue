<template>
  <div class="ds-editor">
    <div class="ds-toolbar">
      <div class="ds-toolbar-left">
        <v-icon size="18" class="ds-toolbar-icon">mdi-table</v-icon>
        <span class="ds-toolbar-title mono">{{ title }}</span>
        <span class="ds-toolbar-count mono">{{ rows.length }} ligne{{ rows.length > 1 ? 's' : '' }}</span>
      </div>
      <div class="ds-toolbar-actions">
        <button class="ds-tb-btn" @click="addColumn" title="Ajouter une colonne">
          <v-icon size="14">mdi-table-column-plus-after</v-icon>
        </button>
        <button class="ds-tb-btn" @click="addRow" title="Ajouter une ligne">
          <v-icon size="14">mdi-table-row-plus-after</v-icon>
        </button>
        <button class="ds-tb-btn" @click="exportCSV" title="Exporter CSV">
          <v-icon size="14">mdi-download-outline</v-icon>
        </button>
        <button class="ds-tb-btn" @click="importDialog = true" title="Importer CSV">
          <v-icon size="14">mdi-upload-outline</v-icon>
        </button>
      </div>
    </div>

    <div class="ds-table-wrap">
      <table class="ds-table">
        <thead>
          <tr>
            <th class="ds-th-index">#</th>
            <th v-for="(col, ci) in columns" :key="ci" class="ds-th">
              <input
                :value="col"
                @input="updateColumnName(ci, ($event.target as HTMLInputElement).value)"
                class="ds-th-input mono"
                placeholder="Colonne"
              />
              <button class="ds-col-remove" @click="removeColumn(ci)" title="Supprimer la colonne" v-if="columns.length > 1">
                <v-icon size="12">mdi-close</v-icon>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in rows" :key="ri" class="ds-row">
            <td class="ds-td-index mono">{{ ri + 1 }}</td>
            <td v-for="(cell, ci) in row" :key="ci" class="ds-td">
              <input
                :value="cell"
                @input="updateCell(ri, ci, ($event.target as HTMLInputElement).value)"
                class="ds-cell-input"
                @keydown.tab="onTab($event, ri, ci)"
                @keydown.enter="onEnter(ri)"
              />
            </td>
            <td class="ds-td-actions">
              <button class="ds-row-remove" @click="removeRow(ri)" title="Supprimer la ligne">
                <v-icon size="12">mdi-close</v-icon>
              </button>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td :colspan="columns.length + 2" class="ds-empty">
              Aucune donnee. Cliquez sur "+" pour ajouter une ligne.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Import CSV dialog -->
    <v-dialog v-model="importDialog" max-width="480">
      <div class="glass-card ds-import-dialog">
        <div class="ds-import-header">
          <span>Importer CSV</span>
          <button class="ds-import-close" @click="importDialog = false">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>
        <div class="ds-import-body">
          <textarea v-model="importText" class="ds-import-textarea" rows="8" placeholder="Collez vos donnees CSV ici..." />
          <div class="ds-import-options">
            <label class="ds-import-label">
              Separateur :
              <select v-model="importSep" class="ds-import-select">
                <option value=",">Virgule (,)</option>
                <option value=";">Point-virgule (;)</option>
                <option value="\t">Tabulation</option>
              </select>
            </label>
            <label class="ds-import-label">
              <input type="checkbox" v-model="importHasHeader" /> Premiere ligne = en-tetes
            </label>
          </div>
        </div>
        <div class="ds-import-footer">
          <button class="ds-btn-cancel" @click="importDialog = false">Annuler</button>
          <button class="ds-btn-import" @click="doImport" :disabled="!importText.trim()">Importer</button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import api from '../../services/api';

interface DatasetContent {
  columns: string[];
  rows: string[][];
}

const props = defineProps<{
  modelValue: DatasetContent | null;
  nodeId: string;
  title?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: DatasetContent];
}>();

const columns = ref<string[]>(['Colonne 1', 'Colonne 2', 'Colonne 3']);
const rows = ref<string[][]>([]);

const importDialog = ref(false);
const importText = ref('');
const importSep = ref(',');
const importHasHeader = ref(true);

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

// Load data from modelValue
watch(() => props.modelValue, (val) => {
  if (val && val.columns) {
    columns.value = [...val.columns];
    rows.value = val.rows.map(r => [...r]);
  }
}, { immediate: true });

function getData(): DatasetContent {
  return { columns: [...columns.value], rows: rows.value.map(r => [...r]) };
}

function emitAndSave() {
  const data = getData();
  emit('update:modelValue', data);
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    api.put(`/nodes/${props.nodeId}`, {
      content: data,
      contentText: rows.value.map(r => r.join(' ')).join('\n'),
    }).catch(err => console.error('Dataset save error:', err));
  }, 800);
}

function updateColumnName(ci: number, val: string) {
  columns.value[ci] = val;
  emitAndSave();
}

function updateCell(ri: number, ci: number, val: string) {
  rows.value[ri][ci] = val;
  emitAndSave();
}

function addColumn() {
  columns.value.push(`Colonne ${columns.value.length + 1}`);
  rows.value.forEach(r => r.push(''));
  emitAndSave();
}

function removeColumn(ci: number) {
  columns.value.splice(ci, 1);
  rows.value.forEach(r => r.splice(ci, 1));
  emitAndSave();
}

function addRow() {
  rows.value.push(new Array(columns.value.length).fill(''));
  emitAndSave();
}

function removeRow(ri: number) {
  rows.value.splice(ri, 1);
  emitAndSave();
}

function onTab(e: KeyboardEvent, ri: number, ci: number) {
  if (!e.shiftKey && ci === columns.value.length - 1 && ri === rows.value.length - 1) {
    e.preventDefault();
    addRow();
  }
}

function onEnter(ri: number) {
  if (ri === rows.value.length - 1) {
    addRow();
  }
}

function exportCSV() {
  const sep = ';';
  const header = columns.value.map(c => `"${c.replace(/"/g, '""')}"`).join(sep);
  const body = rows.value.map(r =>
    r.map(c => `"${c.replace(/"/g, '""')}"`).join(sep)
  ).join('\n');
  const csv = header + '\n' + body;
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.title || 'dataset'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function doImport() {
  const sep = importSep.value === '\\t' ? '\t' : importSep.value;
  const lines = importText.value.trim().split('\n').map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"')));
  if (lines.length === 0) return;

  if (importHasHeader.value) {
    columns.value = lines[0];
    rows.value = lines.slice(1).map(r => {
      while (r.length < columns.value.length) r.push('');
      return r.slice(0, columns.value.length);
    });
  } else {
    columns.value = lines[0].map((_, i) => `Colonne ${i + 1}`);
    rows.value = lines.map(r => {
      while (r.length < columns.value.length) r.push('');
      return r.slice(0, columns.value.length);
    });
  }

  importDialog.value = false;
  importText.value = '';
  emitAndSave();
}
</script>

<style scoped>
.ds-editor { display: flex; flex-direction: column; height: 100%; background: var(--me-bg-deep); }
.ds-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
}
.ds-toolbar-left { display: flex; align-items: center; gap: 8px; }
.ds-toolbar-icon { color: var(--me-accent); }
.ds-toolbar-title { font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.ds-toolbar-count { font-size: 11px; color: var(--me-text-muted); }
.ds-toolbar-actions { display: flex; gap: 4px; }
.ds-tb-btn {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; background: none; border: 1px solid var(--me-border);
  color: var(--me-text-muted); cursor: pointer; transition: all 0.15s;
}
.ds-tb-btn:hover { border-color: var(--me-accent); color: var(--me-accent); background: var(--me-accent-glow); }

.ds-table-wrap { flex: 1; overflow: auto; padding: 16px; }
.ds-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ds-th-index { width: 40px; text-align: center; padding: 8px 4px; color: var(--me-text-muted); font-size: 11px; border-bottom: 2px solid var(--me-border); }
.ds-th {
  position: relative; padding: 4px; border-bottom: 2px solid var(--me-border);
  background: var(--me-bg-elevated);
}
.ds-th-input {
  width: 100%; padding: 6px 24px 6px 8px; border: none; background: transparent;
  color: var(--me-text-primary); font-size: 12px; font-weight: 600;
  outline: none; text-transform: uppercase; letter-spacing: 0.5px;
}
.ds-th-input:focus { background: var(--me-bg-deep); border-radius: 4px; }
.ds-col-remove {
  position: absolute; top: 4px; right: 4px;
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--me-text-muted); cursor: pointer;
  border-radius: 3px; opacity: 0; transition: all 0.15s;
}
.ds-th:hover .ds-col-remove { opacity: 1; }
.ds-col-remove:hover { background: rgba(248,113,113,0.15); color: #f87171; }

.ds-row:hover { background: var(--me-accent-glow); }
.ds-td-index { width: 40px; text-align: center; padding: 4px; color: var(--me-text-muted); font-size: 11px; border-bottom: 1px solid var(--me-border); }
.ds-td { padding: 2px; border-bottom: 1px solid var(--me-border); }
.ds-cell-input {
  width: 100%; padding: 6px 8px; border: 1px solid transparent; background: transparent;
  color: var(--me-text-primary); font-size: 13px; outline: none;
  border-radius: 4px; transition: border-color 0.15s;
}
.ds-cell-input:focus { border-color: var(--me-accent); background: var(--me-bg-surface); }
.ds-td-actions { width: 28px; border-bottom: 1px solid var(--me-border); }
.ds-row-remove {
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--me-text-muted); cursor: pointer;
  border-radius: 3px; opacity: 0; transition: all 0.15s;
}
.ds-row:hover .ds-row-remove { opacity: 1; }
.ds-row-remove:hover { background: rgba(248,113,113,0.15); color: #f87171; }

.ds-empty { text-align: center; padding: 32px; color: var(--me-text-muted); font-size: 13px; }

/* Import dialog */
.ds-import-dialog { padding: 0; border-radius: 12px; overflow: hidden; }
.ds-import-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--me-border);
  font-size: 14px; font-weight: 600; color: var(--me-text-primary);
}
.ds-import-close { background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; }
.ds-import-close:hover { color: var(--me-text-primary); }
.ds-import-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.ds-import-textarea {
  padding: 8px 12px; border-radius: 8px; border: 1px solid var(--me-border);
  background: var(--me-bg-deep); color: var(--me-text-primary); font-size: 12px;
  font-family: var(--me-font-mono); outline: none; resize: vertical; min-height: 100px;
}
.ds-import-textarea:focus { border-color: var(--me-accent); }
.ds-import-options { display: flex; gap: 16px; flex-wrap: wrap; }
.ds-import-label { font-size: 12px; color: var(--me-text-secondary); display: flex; align-items: center; gap: 6px; }
.ds-import-select {
  padding: 4px 8px; border-radius: 6px; border: 1px solid var(--me-border);
  background: var(--me-bg-deep); color: var(--me-text-primary); font-size: 12px; outline: none;
}
.ds-import-footer {
  display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px;
  border-top: 1px solid var(--me-border);
}
.ds-btn-cancel { padding: 7px 16px; border-radius: 8px; border: none; background: none; color: var(--me-text-muted); cursor: pointer; font-size: 13px; }
.ds-btn-cancel:hover { color: var(--me-text-primary); }
.ds-btn-import { padding: 7px 16px; border-radius: 8px; border: none; background: var(--me-accent); color: #fff; cursor: pointer; font-size: 13px; font-weight: 600; }
.ds-btn-import:hover { filter: brightness(1.15); }
.ds-btn-import:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
