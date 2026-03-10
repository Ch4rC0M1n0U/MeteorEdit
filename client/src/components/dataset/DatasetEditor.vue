<template>
  <div class="ds-editor">
    <div class="ds-toolbar">
      <div class="ds-toolbar-left">
        <v-icon size="18" class="ds-toolbar-icon">mdi-table</v-icon>
        <span class="ds-toolbar-title mono">{{ title }}</span>
        <span class="ds-toolbar-count mono">{{ filteredRows.length }}<template v-if="filteredRows.length !== rows.length"> / {{ rows.length }}</template> ligne{{ filteredRows.length > 1 ? 's' : '' }}</span>
      </div>
      <div class="ds-toolbar-actions">
        <div class="ds-search-wrap" v-if="showSearch">
          <v-icon size="14" class="ds-search-icon">mdi-magnify</v-icon>
          <input v-model="searchQuery" class="ds-search-input" placeholder="Rechercher..." ref="searchInput" @keydown.escape="toggleSearch" />
          <button class="ds-search-close" @click="toggleSearch"><v-icon size="14">mdi-close</v-icon></button>
        </div>
        <button class="ds-tb-btn" @click="toggleSearch" title="Rechercher (Ctrl+F)" v-if="!showSearch">
          <v-icon size="14">mdi-magnify</v-icon>
        </button>
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

    <div class="ds-table-wrap" ref="tableWrap">
      <table class="ds-table">
        <thead>
          <tr>
            <th class="ds-th-index ds-sticky-header">#</th>
            <th
              v-for="(col, ci) in columns"
              :key="ci"
              class="ds-th ds-sticky-header"
              :style="{ minWidth: colWidths[ci] + 'px', width: colWidths[ci] + 'px' }"
              :class="{ 'ds-th--sorted': sortCol === ci, 'ds-th--drag-over': dragOverCol === ci }"
              draggable="true"
              @dragstart="onColDragStart(ci, $event)"
              @dragover.prevent="onColDragOver(ci)"
              @dragleave="onColDragLeave"
              @drop="onColDrop(ci)"
              @dragend="onColDragEnd"
            >
              <div class="ds-th-content">
                <input
                  :value="col.name"
                  @input="updateColumnName(ci, inputVal($event))"
                  class="ds-th-input mono"
                  placeholder="Colonne"
                  @click.stop
                />
                <button class="ds-th-sort" @click.stop="toggleSort(ci)" :title="sortCol === ci ? (sortDir === 'asc' ? 'Tri croissant' : 'Tri decroissant') : 'Trier'">
                  <v-icon size="12">{{ sortCol === ci ? (sortDir === 'asc' ? 'mdi-sort-ascending' : 'mdi-sort-descending') : 'mdi-sort' }}</v-icon>
                </button>
                <button class="ds-col-remove" @click.stop="removeColumn(ci)" title="Supprimer la colonne" v-if="columns.length > 1">
                  <v-icon size="12">mdi-close</v-icon>
                </button>
              </div>
              <div class="ds-th-type" @click.stop>
                <select :value="col.type" @change="updateColumnType(ci, selectVal($event))" class="ds-type-select mono">
                  <option value="text">Texte</option>
                  <option value="number">Nombre</option>
                  <option value="date">Date</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>
              <div class="ds-col-filter" @click.stop v-if="col.type === 'text'">
                <input
                  :value="colFilters[ci] || ''"
                  @input="setColFilter(ci, inputVal($event))"
                  class="ds-filter-input mono"
                  placeholder="Filtrer..."
                />
              </div>
              <div
                class="ds-resize-handle"
                @mousedown.prevent="startResize(ci, $event)"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, fi) in filteredRows" :key="row._idx" class="ds-row">
            <td class="ds-td-index mono">{{ row._idx + 1 }}</td>
            <td
              v-for="(cell, ci) in row.cells"
              :key="ci"
              class="ds-td"
              :class="{ 'ds-td--highlight': isCellMatch(cell, ci) }"
              :style="{ minWidth: colWidths[ci] + 'px', width: colWidths[ci] + 'px' }"
            >
              <!-- Boolean -->
              <label v-if="columns[ci]?.type === 'boolean'" class="ds-bool-wrap">
                <input
                  type="checkbox"
                  :checked="cell === 'true' || cell === '1'"
                  @change="updateCell(row._idx, ci, checkVal($event))"
                  class="ds-bool-input"
                />
              </label>
              <!-- Number -->
              <input
                v-else-if="columns[ci]?.type === 'number'"
                :value="cell"
                @input="updateCell(row._idx, ci, inputVal($event))"
                class="ds-cell-input ds-cell-number mono"
                type="text"
                inputmode="decimal"
                @keydown.tab="onTab($event, fi, ci)"
                @keydown.enter="onEnter(fi)"
              />
              <!-- Date -->
              <input
                v-else-if="columns[ci]?.type === 'date'"
                :value="cell"
                @input="updateCell(row._idx, ci, inputVal($event))"
                class="ds-cell-input ds-cell-date mono"
                type="date"
                @keydown.tab="onTab($event, fi, ci)"
                @keydown.enter="onEnter(fi)"
              />
              <!-- Text (default) -->
              <input
                v-else
                :value="cell"
                @input="updateCell(row._idx, ci, inputVal($event))"
                class="ds-cell-input"
                @keydown.tab="onTab($event, fi, ci)"
                @keydown.enter="onEnter(fi)"
              />
            </td>
            <td class="ds-td-actions">
              <button class="ds-row-remove" @click="removeRow(row._idx)" title="Supprimer la ligne">
                <v-icon size="12">mdi-close</v-icon>
              </button>
            </td>
          </tr>
          <tr v-if="filteredRows.length === 0">
            <td :colspan="columns.length + 2" class="ds-empty">
              {{ rows.length === 0 ? 'Aucune donnee. Cliquez sur "+" pour ajouter une ligne.' : 'Aucun resultat pour ce filtre.' }}
            </td>
          </tr>
        </tbody>
        <tfoot v-if="hasNumericColumns && rows.length > 0">
          <tr class="ds-footer-row">
            <td class="ds-td-index ds-footer-label mono">Σ</td>
            <td v-for="(col, ci) in columns" :key="ci" class="ds-td ds-footer-cell mono">
              <template v-if="col.type === 'number'">
                <div class="ds-agg">
                  <span class="ds-agg-label">Σ</span><span class="ds-agg-val">{{ aggregate(ci, 'sum') }}</span>
                  <span class="ds-agg-sep">|</span>
                  <span class="ds-agg-label">μ</span><span class="ds-agg-val">{{ aggregate(ci, 'avg') }}</span>
                  <span class="ds-agg-sep">|</span>
                  <span class="ds-agg-label">n</span><span class="ds-agg-val">{{ aggregate(ci, 'count') }}</span>
                </div>
              </template>
            </td>
            <td class="ds-td-actions"></td>
          </tr>
        </tfoot>
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
          <div class="ds-import-file">
            <label class="ds-file-label">
              <v-icon size="16">mdi-file-upload</v-icon>
              {{ importFileName || 'Choisir un fichier CSV...' }}
              <input type="file" accept=".csv,.tsv,.txt" class="ds-file-input" @change="onFileImport" />
            </label>
          </div>
          <div class="ds-import-sep-line"><span>ou collez vos donnees</span></div>
          <textarea v-model="importText" class="ds-import-textarea" rows="6" placeholder="Collez vos donnees CSV ici..." />
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
import { ref, computed, watch, nextTick } from 'vue';
import api from '../../services/api';

type ColType = 'text' | 'number' | 'date' | 'boolean';

interface Column {
  name: string;
  type: ColType;
}

interface DatasetContent {
  columns: string[] | Column[];
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

const columns = ref<Column[]>([
  { name: 'Colonne 1', type: 'text' },
  { name: 'Colonne 2', type: 'text' },
  { name: 'Colonne 3', type: 'text' },
]);
const rows = ref<string[][]>([]);
const colWidths = ref<number[]>([150, 150, 150]);

// Search
const showSearch = ref(false);
const searchQuery = ref('');
const searchInput = ref<HTMLInputElement | null>(null);

// Sort
const sortCol = ref<number | null>(null);
const sortDir = ref<'asc' | 'desc'>('asc');

// Column filters
const colFilters = ref<Record<number, string>>({});

// Column drag & drop
const dragCol = ref<number | null>(null);
const dragOverCol = ref<number | null>(null);

// Column resize
const resizingCol = ref<number | null>(null);
const resizeStartX = ref(0);
const resizeStartW = ref(0);

// Import
const importDialog = ref(false);
const importText = ref('');
const importSep = ref(',');
const importHasHeader = ref(true);
const importFileName = ref('');
const tableWrap = ref<HTMLElement | null>(null);

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

// Template helpers to avoid `as` casts in template
function inputVal(e: Event): string { return (e.target as HTMLInputElement).value; }
function selectVal(e: Event): ColType { return (e.target as HTMLSelectElement).value as ColType; }
function checkVal(e: Event): string { return (e.target as HTMLInputElement).checked ? 'true' : 'false'; }

// Migrate old format (string[] columns) to new (Column[])
function migrateColumns(raw: string[] | Column[]): Column[] {
  if (!raw || raw.length === 0) return [{ name: 'Colonne 1', type: 'text' }];
  if (typeof raw[0] === 'string') {
    return (raw as string[]).map(name => ({ name, type: 'text' as ColType }));
  }
  return raw as Column[];
}

// Load data from modelValue
watch(() => props.modelValue, (val) => {
  if (val && val.columns) {
    columns.value = migrateColumns(val.columns);
    rows.value = val.rows.map(r => [...r]);
    // Init colWidths
    colWidths.value = columns.value.map((_, i) => colWidths.value[i] || 150);
  }
}, { immediate: true });

function getData(): DatasetContent {
  return { columns: columns.value.map(c => ({ ...c })), rows: rows.value.map(r => [...r]) };
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

// --- Filtered & sorted rows ---
interface DisplayRow {
  _idx: number;
  cells: string[];
}

const filteredRows = computed<DisplayRow[]>(() => {
  let result: DisplayRow[] = rows.value.map((cells, i) => ({ _idx: i, cells }));

  // Column filters
  for (const [ciStr, filterVal] of Object.entries(colFilters.value)) {
    const ci = Number(ciStr);
    const q = filterVal.toLowerCase().trim();
    if (!q) continue;
    result = result.filter(r => r.cells[ci]?.toLowerCase().includes(q));
  }

  // Global search
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    result = result.filter(r => r.cells.some(c => c?.toLowerCase().includes(q)));
  }

  // Sort
  if (sortCol.value !== null) {
    const ci = sortCol.value;
    const dir = sortDir.value === 'asc' ? 1 : -1;
    const colType = columns.value[ci]?.type || 'text';
    result = [...result].sort((a, b) => {
      const va = a.cells[ci] || '';
      const vb = b.cells[ci] || '';
      if (colType === 'number') {
        return (parseFloat(va) - parseFloat(vb)) * dir || 0;
      }
      if (colType === 'date') {
        return (new Date(va).getTime() - new Date(vb).getTime()) * dir || 0;
      }
      return va.localeCompare(vb, 'fr') * dir;
    });
  }

  return result;
});

const hasNumericColumns = computed(() => columns.value.some(c => c.type === 'number'));

function isCellMatch(cell: string, _ci: number): boolean {
  if (!searchQuery.value.trim()) return false;
  return cell?.toLowerCase().includes(searchQuery.value.toLowerCase().trim());
}

// --- Aggregation ---
function aggregate(ci: number, fn: 'sum' | 'avg' | 'count'): string {
  const nums = rows.value.map(r => parseFloat(r[ci])).filter(n => !isNaN(n));
  if (nums.length === 0) return '—';
  if (fn === 'count') return String(nums.length);
  const sum = nums.reduce((a, b) => a + b, 0);
  if (fn === 'sum') return Number.isInteger(sum) ? String(sum) : sum.toFixed(2);
  const avg = sum / nums.length;
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(2);
}

// --- Search ---
function toggleSearch() {
  showSearch.value = !showSearch.value;
  if (showSearch.value) {
    nextTick(() => searchInput.value?.focus());
  } else {
    searchQuery.value = '';
  }
}

// --- Sort ---
function toggleSort(ci: number) {
  if (sortCol.value === ci) {
    if (sortDir.value === 'asc') sortDir.value = 'desc';
    else { sortCol.value = null; sortDir.value = 'asc'; }
  } else {
    sortCol.value = ci;
    sortDir.value = 'asc';
  }
}

// --- Column filters ---
function setColFilter(ci: number, val: string) {
  if (val) colFilters.value[ci] = val;
  else delete colFilters.value[ci];
}

// --- Column type ---
function updateColumnType(ci: number, type: ColType) {
  columns.value[ci].type = type;
  emitAndSave();
}

// --- Column drag & drop reorder ---
function onColDragStart(ci: number, e: DragEvent) {
  dragCol.value = ci;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(ci));
  }
}

function onColDragOver(ci: number) {
  if (dragCol.value !== null && dragCol.value !== ci) {
    dragOverCol.value = ci;
  }
}

function onColDragLeave() {
  dragOverCol.value = null;
}

function onColDrop(ci: number) {
  if (dragCol.value === null || dragCol.value === ci) return;
  const from = dragCol.value;
  // Reorder columns
  const col = columns.value.splice(from, 1)[0];
  columns.value.splice(ci, 0, col);
  const w = colWidths.value.splice(from, 1)[0];
  colWidths.value.splice(ci, 0, w);
  // Reorder cells in each row
  rows.value.forEach(row => {
    const cell = row.splice(from, 1)[0];
    row.splice(ci, 0, cell);
  });
  dragOverCol.value = null;
  dragCol.value = null;
  emitAndSave();
}

function onColDragEnd() {
  dragCol.value = null;
  dragOverCol.value = null;
}

// --- Column resize ---
function startResize(ci: number, e: MouseEvent) {
  resizingCol.value = ci;
  resizeStartX.value = e.clientX;
  resizeStartW.value = colWidths.value[ci];
  document.addEventListener('mousemove', onResizeMove);
  document.addEventListener('mouseup', onResizeEnd);
}

function onResizeMove(e: MouseEvent) {
  if (resizingCol.value === null) return;
  const diff = e.clientX - resizeStartX.value;
  colWidths.value[resizingCol.value] = Math.max(60, resizeStartW.value + diff);
}

function onResizeEnd() {
  resizingCol.value = null;
  document.removeEventListener('mousemove', onResizeMove);
  document.removeEventListener('mouseup', onResizeEnd);
}

// --- Cell / column / row ops ---
function updateColumnName(ci: number, val: string) {
  columns.value[ci].name = val;
  emitAndSave();
}

function updateCell(ri: number, ci: number, val: string) {
  rows.value[ri][ci] = val;
  emitAndSave();
}

function addColumn() {
  columns.value.push({ name: `Colonne ${columns.value.length + 1}`, type: 'text' });
  colWidths.value.push(150);
  rows.value.forEach(r => r.push(''));
  emitAndSave();
}

function removeColumn(ci: number) {
  columns.value.splice(ci, 1);
  colWidths.value.splice(ci, 1);
  rows.value.forEach(r => r.splice(ci, 1));
  if (sortCol.value === ci) { sortCol.value = null; }
  else if (sortCol.value !== null && sortCol.value > ci) { sortCol.value--; }
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

function onTab(e: KeyboardEvent, fi: number, ci: number) {
  if (!e.shiftKey && ci === columns.value.length - 1 && fi === filteredRows.value.length - 1) {
    e.preventDefault();
    addRow();
  }
}

function onEnter(fi: number) {
  if (fi === filteredRows.value.length - 1) {
    addRow();
  }
}

function exportCSV() {
  const sep = ';';
  const header = columns.value.map(c => `"${c.name.replace(/"/g, '""')}"`).join(sep);
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

function onFileImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  importFileName.value = file.name;
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'tsv') importSep.value = '\\t';
  else if (ext === 'csv') importSep.value = ',';
  const reader = new FileReader();
  reader.onload = () => {
    importText.value = reader.result as string;
  };
  reader.readAsText(file);
  input.value = '';
}

function doImport() {
  const sep = importSep.value === '\\t' ? '\t' : importSep.value;
  const lines = importText.value.trim().split('\n').map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"')));
  if (lines.length === 0) return;

  if (importHasHeader.value) {
    columns.value = lines[0].map(name => ({ name, type: 'text' as ColType }));
    rows.value = lines.slice(1).map(r => {
      while (r.length < columns.value.length) r.push('');
      return r.slice(0, columns.value.length);
    });
  } else {
    columns.value = lines[0].map((_, i) => ({ name: `Colonne ${i + 1}`, type: 'text' as ColType }));
    rows.value = lines.map(r => {
      while (r.length < columns.value.length) r.push('');
      return r.slice(0, columns.value.length);
    });
  }
  colWidths.value = columns.value.map(() => 150);

  importDialog.value = false;
  importText.value = '';
  importFileName.value = '';
  emitAndSave();
}
</script>

<style scoped>
.ds-editor { display: flex; flex-direction: column; height: 100%; background: var(--me-bg-deep); }
.ds-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 16px; border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface); flex-shrink: 0;
}
.ds-toolbar-left { display: flex; align-items: center; gap: 8px; }
.ds-toolbar-icon { color: var(--me-accent); }
.ds-toolbar-title { font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.ds-toolbar-count { font-size: 11px; color: var(--me-text-muted); }
.ds-toolbar-actions { display: flex; gap: 4px; align-items: center; }
.ds-tb-btn {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; background: none; border: 1px solid var(--me-border);
  color: var(--me-text-muted); cursor: pointer; transition: all 0.15s;
}
.ds-tb-btn:hover { border-color: var(--me-accent); color: var(--me-accent); background: var(--me-accent-glow); }

/* Search */
.ds-search-wrap {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-radius: 6px; border: 1px solid var(--me-accent);
  background: var(--me-bg-deep);
}
.ds-search-icon { color: var(--me-accent); flex-shrink: 0; }
.ds-search-input {
  border: none; background: transparent; color: var(--me-text-primary);
  font-size: 12px; outline: none; width: 140px;
}
.ds-search-close { background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 2px; }

/* Table */
.ds-table-wrap { flex: 1; overflow: auto; position: relative; }
.ds-table { width: max-content; min-width: 100%; border-collapse: collapse; font-size: 13px; }

/* Sticky header */
.ds-sticky-header { position: sticky; top: 0; z-index: 2; }

.ds-th-index { width: 40px; text-align: center; padding: 8px 4px; color: var(--me-text-muted); font-size: 11px; border-bottom: 2px solid var(--me-border); background: var(--me-bg-surface); }
.ds-th {
  position: relative; padding: 0; border-bottom: 2px solid var(--me-border);
  background: var(--me-bg-elevated); user-select: none; vertical-align: top;
}
.ds-th--sorted { background: var(--me-accent-glow); }
.ds-th--drag-over { outline: 2px solid var(--me-accent); outline-offset: -2px; }

.ds-th-content {
  display: flex; align-items: center; padding: 4px 4px 0;
}
.ds-th-input {
  flex: 1; min-width: 0; padding: 6px 4px; border: none; background: transparent;
  color: var(--me-text-primary); font-size: 12px; font-weight: 600;
  outline: none; text-transform: uppercase; letter-spacing: 0.5px;
  cursor: grab;
}
.ds-th-input:focus { background: var(--me-bg-deep); border-radius: 4px; cursor: text; }

.ds-th-sort {
  width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--me-text-muted); cursor: pointer;
  border-radius: 3px; opacity: 0; transition: all 0.15s; flex-shrink: 0;
}
.ds-th:hover .ds-th-sort, .ds-th--sorted .ds-th-sort { opacity: 1; }
.ds-th--sorted .ds-th-sort { color: var(--me-accent); }
.ds-th-sort:hover { background: var(--me-accent-glow); color: var(--me-accent); }

.ds-col-remove {
  width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--me-text-muted); cursor: pointer;
  border-radius: 3px; opacity: 0; transition: all 0.15s; flex-shrink: 0;
}
.ds-th:hover .ds-col-remove { opacity: 1; }
.ds-col-remove:hover { background: rgba(248,113,113,0.15); color: #f87171; }

/* Column type selector */
.ds-th-type { padding: 2px 4px; }
.ds-type-select {
  width: 100%; padding: 2px 4px; border: none; border-radius: 3px;
  background: var(--me-bg-deep); color: var(--me-text-muted); font-size: 10px;
  outline: none; cursor: pointer;
}

/* Column filter */
.ds-col-filter { padding: 2px 4px 4px; }
.ds-filter-input {
  width: 100%; padding: 3px 6px; border: 1px solid var(--me-border); border-radius: 4px;
  background: var(--me-bg-deep); color: var(--me-text-secondary); font-size: 10px;
  outline: none;
}
.ds-filter-input:focus { border-color: var(--me-accent); }

/* Resize handle */
.ds-resize-handle {
  position: absolute; top: 0; right: -2px; width: 5px; height: 100%;
  cursor: col-resize; z-index: 3;
}
.ds-resize-handle:hover, .ds-resize-handle:active {
  background: var(--me-accent);
  opacity: 0.4;
}

/* Body */
.ds-row:hover { background: var(--me-accent-glow); }
.ds-td-index { width: 40px; text-align: center; padding: 4px; color: var(--me-text-muted); font-size: 11px; border-bottom: 1px solid var(--me-border); }
.ds-td { padding: 2px; border-bottom: 1px solid var(--me-border); }
.ds-td--highlight { background: rgba(var(--me-accent-rgb, 66,133,244), 0.15); }

.ds-cell-input {
  width: 100%; padding: 6px 8px; border: 1px solid transparent; background: transparent;
  color: var(--me-text-primary); font-size: 13px; outline: none;
  border-radius: 4px; transition: border-color 0.15s;
}
.ds-cell-input:focus { border-color: var(--me-accent); background: var(--me-bg-surface); }
.ds-cell-number { text-align: right; }
.ds-cell-date { font-size: 12px; }

.ds-bool-wrap { display: flex; align-items: center; justify-content: center; padding: 6px; }
.ds-bool-input { width: 16px; height: 16px; accent-color: var(--me-accent); cursor: pointer; }

.ds-td-actions { width: 28px; border-bottom: 1px solid var(--me-border); }
.ds-row-remove {
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  background: none; border: none; color: var(--me-text-muted); cursor: pointer;
  border-radius: 3px; opacity: 0; transition: all 0.15s;
}
.ds-row:hover .ds-row-remove { opacity: 1; }
.ds-row-remove:hover { background: rgba(248,113,113,0.15); color: #f87171; }

.ds-empty { text-align: center; padding: 32px; color: var(--me-text-muted); font-size: 13px; }

/* Footer aggregations */
.ds-footer-row { background: var(--me-bg-surface); border-top: 2px solid var(--me-border); }
.ds-footer-label { font-size: 12px; font-weight: 700; color: var(--me-accent); text-align: center; }
.ds-footer-cell { padding: 6px 8px; }
.ds-agg { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--me-text-muted); justify-content: flex-end; }
.ds-agg-label { font-weight: 700; color: var(--me-text-secondary); font-size: 10px; }
.ds-agg-val { color: var(--me-text-primary); font-weight: 600; }
.ds-agg-sep { color: var(--me-border); }

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
.ds-import-file { display: flex; }
.ds-file-label {
  display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 8px;
  border: 2px dashed var(--me-border); cursor: pointer; font-size: 13px; color: var(--me-text-secondary);
  width: 100%; transition: border-color 0.2s, color 0.2s;
}
.ds-file-label:hover { border-color: var(--me-accent); color: var(--me-accent); }
.ds-file-input { display: none; }
.ds-import-sep-line {
  display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--me-text-muted);
}
.ds-import-sep-line::before, .ds-import-sep-line::after {
  content: ''; flex: 1; height: 1px; background: var(--me-border);
}
</style>
