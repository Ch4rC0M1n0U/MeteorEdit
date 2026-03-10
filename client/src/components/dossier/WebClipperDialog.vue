<template>
  <v-dialog v-model="model" max-width="500" persistent>
    <div class="wc-dialog glass-card">
      <div class="wc-header">
        <v-icon size="20" class="wc-header-icon">mdi-web</v-icon>
        <span>Web Clipper</span>
        <button class="wc-close" @click="model = false">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </div>

      <div class="wc-body">
        <div class="wc-field">
          <label class="wc-label">URL *</label>
          <input v-model="url" class="wc-input" placeholder="https://example.com/article" />
        </div>
        <div class="wc-field">
          <label class="wc-label">Titre *</label>
          <input v-model="title" class="wc-input" placeholder="Titre de la capture" />
        </div>
        <div class="wc-field">
          <label class="wc-label">Contenu</label>
          <textarea v-model="content" class="wc-input wc-textarea" rows="6" placeholder="Collez le texte ou HTML ici..." />
        </div>
        <div class="wc-field">
          <label class="wc-label">Dossier parent (optionnel)</label>
          <select v-model="parentId" class="wc-input">
            <option value="">Racine du dossier</option>
            <option v-for="folder in folders" :key="folder._id" :value="folder._id">
              {{ folder.title }}
            </option>
          </select>
        </div>

        <!-- Bookmarklet section -->
        <div class="wc-bookmarklet">
          <div class="wc-bookmarklet-label">
            <v-icon size="14">mdi-bookmark-outline</v-icon>
            Bookmarklet
          </div>
          <p class="wc-bookmarklet-hint">
            Glissez ce lien dans votre barre de favoris pour capturer depuis n'importe quelle page :
          </p>
          <a
            class="wc-bookmarklet-link"
            :href="bookmarkletCode"
            @click.prevent
            draggable="true"
          >
            <v-icon size="14">mdi-lightning-bolt</v-icon>
            Clipper MeteorEdit
          </a>
        </div>
      </div>

      <div class="wc-footer">
        <button class="wc-btn wc-btn--cancel" @click="model = false">Annuler</button>
        <button class="wc-btn wc-btn--clip" @click="clip" :disabled="!url.trim() || !title.trim() || clipping">
          <v-icon v-if="clipping" size="14" class="spin">mdi-loading</v-icon>
          <v-icon v-else size="14">mdi-content-cut</v-icon>
          {{ clipping ? 'Capture...' : 'Capturer' }}
        </button>
      </div>
    </div>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import api from '../../services/api';
import { useDossierStore } from '../../stores/dossier';

const model = defineModel<boolean>({ default: false });

const dossierStore = useDossierStore();

const url = ref('');
const title = ref('');
const content = ref('');
const parentId = ref('');
const clipping = ref(false);

const folders = computed(() =>
  dossierStore.nodes.filter(n => n.type === 'folder' && !n.deletedAt)
);

const bookmarkletCode = computed(() => {
  const baseUrl = window.location.origin;
  const dossierId = dossierStore.currentDossier?._id || '';
  const token = localStorage.getItem('accessToken') || '';
  // Bookmarklet captures page title, url, selected text or body text
  return `javascript:void((function(){var d=document,s=d.getSelection().toString()||d.body.innerText.substring(0,10000),t=d.title,u=d.location.href;fetch('${baseUrl}/api/clip',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer ${token}'},body:JSON.stringify({dossierId:'${dossierId}',title:t,url:u,content:'<p>'+s+'</p>',textContent:s})}).then(function(r){if(r.ok)alert('Capture reussie !');else alert('Erreur de capture');}).catch(function(){alert('Erreur de connexion');})})())`;
});

watch(model, (open) => {
  if (open) {
    url.value = '';
    title.value = '';
    content.value = '';
    parentId.value = '';
  }
});

async function clip() {
  if (!dossierStore.currentDossier || !url.value.trim() || !title.value.trim()) return;
  clipping.value = true;
  try {
    const { data } = await api.post('/clip', {
      dossierId: dossierStore.currentDossier._id,
      parentId: parentId.value || null,
      title: title.value.trim(),
      url: url.value.trim(),
      content: content.value || `<p>Contenu capturé depuis ${url.value}</p>`,
      textContent: content.value.replace(/<[^>]+>/g, ' ').substring(0, 50000),
    });
    // Add node to store
    dossierStore.nodes.push(data);
    model.value = false;
  } catch (err) {
    console.error('Clip error:', err);
  } finally {
    clipping.value = false;
  }
}
</script>

<style scoped>
.wc-dialog { padding: 0; border-radius: 12px; overflow: hidden; background: var(--me-bg-surface); border: 1px solid var(--me-border); }
.wc-header { display: flex; align-items: center; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--me-border); font-size: 14px; font-weight: 600; color: var(--me-text-primary); }
.wc-header-icon { color: var(--me-accent); }
.wc-close { margin-left: auto; background: none; border: none; color: var(--me-text-muted); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; transition: all 0.15s; }
.wc-close:hover { background: rgba(255,255,255,0.08); color: var(--me-text-primary); }
.wc-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.wc-field { display: flex; flex-direction: column; gap: 4px; }
.wc-label { font-size: 12px; color: var(--me-text-secondary); font-weight: 500; }
.wc-input { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--me-border); background: var(--me-bg-deep); color: var(--me-text-primary); font-size: 13px; outline: none; transition: border-color 0.15s; font-family: inherit; }
.wc-input:focus { border-color: var(--me-accent); }
.wc-textarea { resize: vertical; min-height: 80px; }
.wc-bookmarklet { padding: 12px; border-radius: 8px; background: var(--me-bg-elevated); border: 1px dashed var(--me-border); }
.wc-bookmarklet-label { font-size: 12px; font-weight: 600; color: var(--me-text-primary); display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.wc-bookmarklet-hint { font-size: 11px; color: var(--me-text-muted); margin-bottom: 8px; }
.wc-bookmarklet-link {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 12px; border-radius: 6px;
  background: var(--me-accent); color: #fff;
  font-size: 12px; font-weight: 600; text-decoration: none;
  cursor: grab; transition: filter 0.15s;
}
.wc-bookmarklet-link:hover { filter: brightness(1.15); }
.wc-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--me-border); }
.wc-btn { padding: 7px 16px; border-radius: 8px; border: none; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
.wc-btn--cancel { background: none; color: var(--me-text-muted); }
.wc-btn--cancel:hover { background: rgba(255,255,255,0.06); color: var(--me-text-primary); }
.wc-btn--clip { background: var(--me-accent); color: #fff; }
.wc-btn--clip:hover { filter: brightness(1.15); }
.wc-btn--clip:disabled { opacity: 0.5; cursor: not-allowed; }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }
</style>
