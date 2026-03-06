<template>
  <div class="dossier-info">
    <div class="di-header fade-in">
      <h2 class="di-title mono">Informations du dossier</h2>
      <button v-if="!editing" class="me-btn-primary" @click="startEdit">
        <v-icon size="16" class="mr-1">mdi-pencil-outline</v-icon>
        Modifier
      </button>
    </div>

    <!-- MODE LECTURE -->
    <div v-if="!editing" class="di-form fade-in fade-in-delay-1">
      <div class="di-section">
        <div class="di-row">
          <div class="di-field">
            <span class="di-label mono">Titre</span>
            <span class="di-value">{{ form.title || '—' }}</span>
          </div>
          <div class="di-field" style="max-width: 200px;">
            <span class="di-label mono">Statut</span>
            <span class="di-status-badge" :class="`di-status-${form.status}`">{{ statusLabel }}</span>
          </div>
        </div>
        <div class="di-field" v-if="form.objectives">
          <span class="di-label mono">Objectifs de la recherche</span>
          <span class="di-value di-value-block">{{ form.objectives }}</span>
        </div>
        <div class="di-field" v-if="form.judicialFacts">
          <span class="di-label mono">Faits judiciaires</span>
          <span class="di-value di-value-block">{{ form.judicialFacts }}</span>
        </div>
        <div class="di-field" v-if="form.description">
          <span class="di-label mono">Description / Synthese</span>
          <span class="di-value di-value-block">{{ form.description }}</span>
        </div>
        <div class="di-field di-tags-field">
          <span class="di-label mono">Tags</span>
          <v-combobox
            v-model="localTags"
            :items="availableTags"
            label="Tags"
            multiple
            chips
            closable-chips
            density="compact"
            hide-details
            variant="outlined"
            @update:model-value="saveTags"
          />
        </div>
      </div>

      <div class="di-section">
        <h3 class="di-section-title mono">
          <v-icon size="16" class="mr-2">mdi-account-outline</v-icon>
          Enqueteur
        </h3>
        <div class="di-row">
          <div class="di-field"><span class="di-label mono">Nom</span><span class="di-value">{{ form.investigator.name || '—' }}</span></div>
          <div class="di-field"><span class="di-label mono">Service</span><span class="di-value">{{ form.investigator.service || '—' }}</span></div>
        </div>
        <div class="di-row-3">
          <div class="di-field"><span class="di-label mono">Unite</span><span class="di-value">{{ form.investigator.unit || '—' }}</span></div>
          <div class="di-field"><span class="di-label mono">Telephone</span><span class="di-value">{{ form.investigator.phone || '—' }}</span></div>
          <div class="di-field"><span class="di-label mono">Email</span><span class="di-value">{{ form.investigator.email || '—' }}</span></div>
        </div>
      </div>

      <!-- ENTITES -->
      <div class="di-section">
        <div class="di-section-header">
          <h3 class="di-section-title mono">
            <v-icon size="16" class="mr-2">mdi-account-group-outline</v-icon>
            Entites
            <span v-if="form.entities.length" class="di-count">{{ form.entities.length }}</span>
          </h3>
          <button class="me-btn-small" @click="openEntityDialog()">
            <v-icon size="14" class="mr-1">mdi-plus</v-icon>
            Ajouter
          </button>
        </div>
        <div v-if="form.entities.length" class="di-entity-list">
          <div class="di-entity-list-header mono">
            <span class="di-el-col-type">Type</span>
            <span class="di-el-col-name">Nom</span>
            <span class="di-el-col-desc">Description</span>
            <span class="di-el-col-actions">Actions</span>
          </div>
          <div v-for="(entity, i) in form.entities" :key="i" class="di-entity-row">
            <span class="di-el-col-type">
              <v-icon size="16" :title="entity.type" class="di-el-type-icon">{{ entityIcon(entity.type) }}</v-icon>
              <span class="di-el-type-label mono">{{ entity.type }}</span>
            </span>
            <span class="di-el-col-name">{{ entity.name }}</span>
            <span class="di-el-col-desc" :title="entity.description">{{ entity.description || '—' }}</span>
            <span class="di-el-col-actions">
              <button class="di-el-btn" @click="copyEntity(entity.name, i)" :title="'Copier ' + entity.name">
                <v-icon size="15">{{ copiedIndex === i ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
              </button>
              <button class="di-el-btn" @click="openEditEntity(i)" title="Modifier">
                <v-icon size="15">mdi-pencil-outline</v-icon>
              </button>
              <button class="di-el-btn di-el-btn-danger" @click="removeEntity(i)" title="Supprimer">
                <v-icon size="15">mdi-trash-can-outline</v-icon>
              </button>
            </span>
          </div>
        </div>
        <div v-else class="di-empty mono">Aucune entite</div>
      </div>

      <!-- COLLABORATEURS -->
      <div class="di-section" v-if="dossierStore.currentDossier">
        <div class="di-section-title mono">
          <v-icon size="16" class="mr-2">mdi-account-multiple-outline</v-icon>
          Collaborateurs
          <span v-if="collaboratorDetails.length" class="di-count">{{ collaboratorDetails.length }}</span>
        </div>

        <div v-for="collab in collaboratorDetails" :key="collab._id" class="collab-row">
          <span class="collab-avatar">{{ (collab.firstName[0] + collab.lastName[0]).toUpperCase() }}</span>
          <div class="collab-info">
            <span class="collab-name">{{ collab.firstName }} {{ collab.lastName }}</span>
            <span class="collab-email mono">{{ collab.email }}</span>
          </div>
          <button v-if="isOwner" class="collab-remove" @click="removeCollaborator(collab._id)" title="Retirer">
            <v-icon size="14">mdi-close</v-icon>
          </button>
        </div>

        <div v-if="!collaboratorDetails.length" class="di-empty mono">Aucun collaborateur</div>

        <div v-if="isOwner" class="collab-add">
          <div class="collab-search-wrapper">
            <v-text-field
              v-model="userSearchQuery"
              label="Ajouter un collaborateur..."
              density="compact"
              variant="outlined"
              hide-details
              prepend-inner-icon="mdi-magnify"
              :loading="searchingUsers"
              @input="onUserSearch(userSearchQuery)"
            />
            <div v-if="userSearchResults.length > 0" class="collab-search-results glass-card">
              <div
                v-for="u in userSearchResults"
                :key="u._id"
                class="collab-search-item"
                @click="addCollaborator(u)"
              >
                <span class="collab-avatar">{{ (u.firstName[0] + u.lastName[0]).toUpperCase() }}</span>
                <div class="collab-info">
                  <span class="collab-name">{{ u.firstName }} {{ u.lastName }}</span>
                  <span class="collab-email mono">{{ u.email }}</span>
                </div>
              </div>
            </div>
            <div v-else-if="userSearchQuery.length >= 2 && !searchingUsers" class="collab-search-results glass-card">
              <div class="collab-search-empty">Aucun utilisateur trouvé</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODE EDITION -->
    <v-form v-else @submit.prevent="handleSave" class="di-form fade-in">
      <div class="di-section">
        <div class="di-row">
          <v-text-field v-model="form.title" label="Titre du dossier" />
          <v-select v-model="form.status" :items="statusOptions" label="Statut" style="max-width: 200px;" />
        </div>
        <v-textarea v-model="form.objectives" label="Objectifs de la recherche" rows="3" class="mb-1" />
        <v-textarea v-model="form.judicialFacts" label="Faits judiciaires" rows="3" class="mb-1" />
        <v-textarea v-model="form.description" label="Description / Synthese" rows="3" />
      </div>

      <div class="di-section">
        <h3 class="di-section-title mono">
          <v-icon size="16" class="mr-2">mdi-account-outline</v-icon>
          Enqueteur
        </h3>
        <div class="di-row">
          <v-text-field v-model="form.investigator.name" label="Nom" />
          <v-text-field v-model="form.investigator.service" label="Service" />
        </div>
        <div class="di-row-3">
          <v-text-field v-model="form.investigator.unit" label="Unite" />
          <v-text-field v-model="form.investigator.phone" label="Telephone" />
          <v-text-field v-model="form.investigator.email" label="Email" />
        </div>
      </div>

      <div class="di-actions">
        <button type="button" class="me-btn-ghost" @click="cancelEdit">Annuler</button>
        <button type="submit" class="me-btn-primary">
          <v-icon size="16" class="mr-1">mdi-content-save-outline</v-icon>
          Sauvegarder
        </button>
      </div>
    </v-form>

    <!-- DIALOG AJOUT / MODIFICATION ENTITE -->
    <v-dialog v-model="entityDialog" max-width="440">
      <div class="glass-card dialog-card">
        <div class="dialog-header">
          <h3 class="mono">{{ editingEntityIndex !== null ? 'Modifier l\'entite' : 'Ajouter une entite' }}</h3>
          <button class="me-close-btn" @click="entityDialog = false">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>
        <div class="dialog-body">
          <v-text-field v-model="newEntity.name" label="Nom de l'entite" autofocus class="mb-2" />
          <v-select
            v-model="newEntity.type"
            :items="entityTypes"
            label="Type"
            class="mb-2"
          />
          <v-text-field v-model="newEntity.description" label="Description (optionnel)" />
        </div>
        <div class="dialog-footer">
          <button class="me-btn-ghost" @click="entityDialog = false">Annuler</button>
          <button class="me-btn-primary" @click="saveEntity" :disabled="!newEntity.name.trim() || !newEntity.type">
            {{ editingEntityIndex !== null ? 'Enregistrer' : 'Ajouter' }}
          </button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, computed, onMounted } from 'vue';
import { useDossierStore } from '../../stores/dossier';
import { useAuthStore } from '../../stores/auth';
import api from '../../services/api';
import type { CollaboratorUser } from '../../types';

const dossierStore = useDossierStore();
const authStore = useAuthStore();

const editing = ref(false);
const entityDialog = ref(false);
const copiedIndex = ref<number | null>(null);
const editingEntityIndex = ref<number | null>(null);

const statusOptions = [
  { title: 'Ouvert', value: 'open' },
  { title: 'En cours', value: 'in_progress' },
  { title: 'Clos', value: 'closed' },
];

const entityTypes = [
  'Identite',
  'Telephone',
  'Email',
  'Snapchat',
  'Facebook',
  'Instagram',
  'Twitter / X',
  'TikTok',
  'Discord',
  'Telegram',
  'LinkedIn',
  'Adresse IP',
  'Adresse postale',
  'Vehicule',
  'IBAN / Compte',
  'Pseudo',
  'Autre',
];

const localTags = ref<string[]>([]);
const availableTags = ref<string[]>([]);

const form = reactive({
  title: '',
  description: '',
  status: 'open' as string,
  objectives: '',
  judicialFacts: '',
  investigator: { name: '', service: '', unit: '', phone: '', email: '' },
  entities: [] as { name: string; type: string; description: string }[],
});

const newEntity = reactive({ name: '', type: '', description: '' });

const statusLabel = computed(() => {
  switch (form.status) {
    case 'open': return 'Ouvert';
    case 'in_progress': return 'En cours';
    case 'closed': return 'Clos';
    default: return form.status;
  }
});

function loadFromDossier() {
  const d = dossierStore.currentDossier;
  if (d) {
    form.title = d.title;
    form.description = d.description;
    form.status = d.status;
    form.objectives = d.objectives;
    form.judicialFacts = d.judicialFacts;
    form.investigator = { ...d.investigator };
    form.entities = (d.entities || []).map((e: any) => ({ ...e }));
  }
}

watch(() => dossierStore.currentDossier, loadFromDossier, { immediate: true });

watch(() => dossierStore.currentDossier?.tags, (tags) => {
  localTags.value = tags || [];
}, { immediate: true });

onMounted(async () => {
  try {
    const { data } = await api.get('/dossiers/tags');
    availableTags.value = data;
  } catch (e) {
    console.error('Failed to load tags:', e);
  }
});

async function saveTags(tags: string[]) {
  const cleaned = tags.map(t => t.toLowerCase().trim()).filter(Boolean);
  localTags.value = cleaned;
  if (dossierStore.currentDossier) {
    await dossierStore.updateDossier(dossierStore.currentDossier._id, { tags: cleaned });
  }
}

function startEdit() {
  loadFromDossier();
  editing.value = true;
}

function cancelEdit() {
  loadFromDossier();
  editing.value = false;
}

async function handleSave() {
  if (dossierStore.currentDossier) {
    await dossierStore.updateDossier(dossierStore.currentDossier._id, form);
    editing.value = false;
  }
}

const entityIconMap: Record<string, string> = {
  'Identite': 'mdi-card-account-details-outline',
  'Telephone': 'mdi-phone-outline',
  'Email': 'mdi-email-outline',
  'Snapchat': 'mdi-snapchat',
  'Facebook': 'mdi-facebook',
  'Instagram': 'mdi-instagram',
  'Twitter / X': 'mdi-twitter',
  'TikTok': 'mdi-music-note-outline',
  'Discord': 'mdi-message-outline',
  'Telegram': 'mdi-send-outline',
  'LinkedIn': 'mdi-linkedin',
  'Adresse IP': 'mdi-ip-network-outline',
  'Adresse postale': 'mdi-map-marker-outline',
  'Vehicule': 'mdi-car-outline',
  'IBAN / Compte': 'mdi-bank-outline',
  'Pseudo': 'mdi-at',
  'Autre': 'mdi-dots-horizontal',
};

function entityIcon(type: string): string {
  return entityIconMap[type] || 'mdi-tag-outline';
}

function openEntityDialog() {
  editingEntityIndex.value = null;
  newEntity.name = '';
  newEntity.type = '';
  newEntity.description = '';
  entityDialog.value = true;
}

function openEditEntity(index: number) {
  editingEntityIndex.value = index;
  const e = form.entities[index];
  newEntity.name = e.name;
  newEntity.type = e.type;
  newEntity.description = e.description;
  entityDialog.value = true;
}

async function saveEntity() {
  if (editingEntityIndex.value !== null) {
    form.entities[editingEntityIndex.value] = { ...newEntity };
  } else {
    form.entities.push({ ...newEntity });
  }
  entityDialog.value = false;
  editingEntityIndex.value = null;
  if (dossierStore.currentDossier) {
    await dossierStore.updateDossier(dossierStore.currentDossier._id, form);
  }
}

function copyEntity(name: string, index: number) {
  navigator.clipboard.writeText(name);
  copiedIndex.value = index;
  setTimeout(() => { copiedIndex.value = null; }, 1500);
}

async function removeEntity(index: number) {
  form.entities.splice(index, 1);
  if (dossierStore.currentDossier) {
    await dossierStore.updateDossier(dossierStore.currentDossier._id, form);
  }
}

// --- Collaborateurs ---
const collaboratorDetails = ref<CollaboratorUser[]>([]);
const userSearchResults = ref<CollaboratorUser[]>([]);
const selectedUser = ref<CollaboratorUser | null>(null);
const searchingUsers = ref(false);
const userSearchQuery = ref('');
let userSearchTimeout: ReturnType<typeof setTimeout> | null = null;

function formatUserTitle(item: CollaboratorUser) {
  return `${item.firstName} ${item.lastName} (${item.email})`;
}

const isOwner = computed(() => {
  const dossier = dossierStore.currentDossier;
  return dossier && dossier.owner === authStore.user?.id;
});

watch(() => dossierStore.currentDossier?.collaborators, (collabs) => {
  if (!collabs?.length) { collaboratorDetails.value = []; return; }
  // Collaborators are now populated objects from the backend
  collaboratorDetails.value = collabs
    .filter((c): c is CollaboratorUser => typeof c === 'object' && c !== null && '_id' in c)
    .map(c => ({ _id: c._id, firstName: c.firstName, lastName: c.lastName, email: c.email }));
}, { immediate: true, deep: true });

function onUserSearch(q: string) {
  userSearchQuery.value = q || '';
  if (userSearchTimeout) clearTimeout(userSearchTimeout);
  if (!q || q.length < 2) { userSearchResults.value = []; return; }
  userSearchTimeout = setTimeout(async () => {
    searchingUsers.value = true;
    try {
      const { data } = await api.get<CollaboratorUser[]>('/auth/users/search', { params: { q } });
      // Filter out users already in collaborators
      const existingIds = collaboratorDetails.value.map(c => c._id);
      userSearchResults.value = data.filter(u => !existingIds.includes(u._id));
    } catch {
      userSearchResults.value = [];
    } finally {
      searchingUsers.value = false;
    }
  }, 300);
}

async function addCollaborator(user: CollaboratorUser | null) {
  if (!user || !dossierStore.currentDossier) return;
  const currentIds = collaboratorDetails.value.map(c => c._id);
  if (currentIds.includes(user._id)) return;
  const newCollabIds = [...currentIds, user._id];
  try {
    const { data } = await api.patch(`/dossiers/${dossierStore.currentDossier._id}/collaborators`, { collaborators: newCollabIds });
    dossierStore.currentDossier = data;
  } catch (e) {
    console.error('Failed to add collaborator:', e);
  }
  selectedUser.value = null;
  userSearchQuery.value = '';
  userSearchResults.value = [];
}

async function removeCollaborator(userId: string) {
  if (!dossierStore.currentDossier) return;
  const newCollabIds = collaboratorDetails.value.filter(c => c._id !== userId).map(c => c._id);
  try {
    const { data } = await api.patch(`/dossiers/${dossierStore.currentDossier._id}/collaborators`, { collaborators: newCollabIds });
    dossierStore.currentDossier = data;
  } catch (e) {
    console.error('Failed to remove collaborator:', e);
  }
}
</script>

<style scoped>
.dossier-info {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 24px;
}
.di-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}
.di-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.di-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.di-section {
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius);
  padding: 20px;
}
.di-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.di-section-header .di-section-title {
  margin-bottom: 0;
}
.di-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--me-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
}
.di-row {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}
.di-row-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

/* Champs en lecture */
.di-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.di-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
}
.di-value {
  font-size: 14px;
  color: var(--me-text-primary);
}
.di-value-block {
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--me-text-secondary);
  font-size: 13px;
}
.di-status-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  width: fit-content;
}
.di-status-open {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.di-status-in_progress {
  background: rgba(251, 191, 36, 0.15);
  color: var(--me-warning);
}
.di-status-closed {
  background: rgba(52, 211, 153, 0.15);
  color: var(--me-success);
}

/* Entites - Liste */
.di-count {
  font-size: 11px;
  background: var(--me-bg-elevated);
  color: var(--me-text-muted);
  padding: 1px 7px;
  border-radius: 10px;
  margin-left: 8px;
  font-weight: 600;
}
.di-entity-list {
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  overflow: hidden;
}
.di-entity-list-header {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  background: var(--me-bg-elevated);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
  font-weight: 600;
  border-bottom: 1px solid var(--me-border);
}
.di-entity-row {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--me-border);
  transition: background 0.12s;
}
.di-entity-row:last-child {
  border-bottom: none;
}
.di-entity-row:hover {
  background: var(--me-accent-glow);
}
.di-el-col-type {
  width: 140px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.di-el-type-icon {
  color: var(--me-accent);
}
.di-el-type-label {
  font-size: 11px;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.di-el-col-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--me-text-primary);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.di-el-col-desc {
  flex: 1;
  font-size: 12px;
  color: var(--me-text-muted);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 12px;
}
.di-el-col-actions {
  width: 100px;
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}
.di-el-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  border-radius: var(--me-radius-xs);
  transition: all 0.15s;
  opacity: 0;
}
.di-entity-row:hover .di-el-btn {
  opacity: 1;
}
.di-el-btn:hover {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.di-el-btn-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  color: var(--me-error);
}
.di-tags-field {
  margin-top: 8px;
}
.di-empty {
  font-size: 12px;
  color: var(--me-text-muted);
  text-align: center;
  padding: 16px;
}

/* Actions */
.di-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.me-btn-primary {
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  border-radius: var(--me-radius-sm);
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}
.me-btn-primary:hover {
  box-shadow: 0 0 20px var(--me-accent-glow), 0 4px 12px rgba(0,0,0,0.3);
  transform: translateY(-1px);
}
.me-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
.me-btn-ghost {
  padding: 10px 20px;
  border-radius: var(--me-radius-sm);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
}
.me-btn-ghost:hover {
  border-color: var(--me-border-hover);
  color: var(--me-text-primary);
}
.me-btn-small {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px dashed var(--me-border);
  color: var(--me-text-muted);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.me-btn-small:hover {
  border-color: var(--me-accent);
  color: var(--me-accent);
  background: var(--me-accent-glow);
}

/* Dialog */
.dialog-card {
  overflow: hidden;
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--me-border);
}
.dialog-header h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.me-close-btn {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}
.me-close-btn:hover {
  color: var(--me-text-primary);
}
.dialog-body {
  padding: 20px 24px;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid var(--me-border);
}

/* Collaborateurs */
.collab-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--me-border);
}
.collab-row:last-child { border-bottom: none; }
.collab-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  font-size: 10px;
  font-weight: 700;
  font-family: var(--me-font-mono);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.collab-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.collab-name { font-size: 13px; font-weight: 500; color: var(--me-text-primary); }
.collab-email { font-size: 11px; color: var(--me-text-muted); }
.collab-remove {
  width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%; background: none; border: none;
  color: var(--me-text-muted); cursor: pointer;
  transition: all 0.15s;
}
.collab-remove:hover { background: rgba(248,113,113,0.1); color: var(--me-error); }
.collab-add { margin-top: 12px; }
.collab-search-wrapper { position: relative; }
.collab-search-results {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 100;
  margin-top: 4px; padding: 4px 0; max-height: 200px; overflow-y: auto;
}
.collab-search-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; cursor: pointer; transition: background 0.15s;
}
.collab-search-item:hover { background: var(--me-accent-glow); }
.collab-search-empty {
  padding: 12px; text-align: center; color: var(--me-text-muted); font-size: 13px;
}
</style>
