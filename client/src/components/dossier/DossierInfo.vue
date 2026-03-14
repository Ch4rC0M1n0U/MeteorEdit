<template>
  <div class="dossier-info">
    <div class="di-header fade-in">
      <h2 class="di-title mono">{{ $t('dossier.info') }}</h2>
      <button v-if="!editing" class="me-btn-primary" @click="startEdit">
        <v-icon size="16" class="mr-1">mdi-pencil-outline</v-icon>
        {{ $t('common.edit') }}
      </button>
    </div>

    <!-- MODE LECTURE -->
    <div v-if="!editing" class="di-form fade-in fade-in-delay-1">
      <!-- Icon / Logo -->
      <div class="di-section di-icon-section">
        <div class="di-icon-display">
          <div v-if="dossierLogoUrl" class="di-logo-wrap">
            <img :src="dossierLogoUrl" alt="Logo" class="di-logo-img" />
            <button v-if="isOwner" class="di-logo-remove" @click="removeLogo" :title="$t('dossier.deleteLogo')">
              <v-icon size="12">mdi-close</v-icon>
            </button>
          </div>
          <v-icon v-else-if="form.icon" size="32" class="di-icon-large">{{ form.icon }}</v-icon>
          <v-icon v-else size="32" class="di-icon-large di-icon-default">mdi-folder-outline</v-icon>
          <div class="di-icon-actions" v-if="isOwner">
            <button class="me-btn-small" @click="showIconPicker = !showIconPicker">
              <v-icon size="14" class="mr-1">mdi-palette-outline</v-icon>
              {{ $t('dossier.icon') }}
            </button>
            <button class="me-btn-small" @click="triggerLogoInput">
              <v-icon size="14" class="mr-1">mdi-image-outline</v-icon>
              {{ $t('dossier.logo') }}
            </button>
            <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden @change="handleLogoUpload" />
          </div>
        </div>
        <div v-if="showIconPicker" class="di-icon-picker">
          <div class="icon-picker-grid">
            <button
              v-for="ic in dossierIcons"
              :key="ic"
              :class="['icon-picker-item', { 'icon-picker-item--active': form.icon === ic }]"
              @click="selectIcon(ic)"
              type="button"
            >
              <v-icon size="20">{{ ic }}</v-icon>
            </button>
          </div>
          <button v-if="form.icon" class="di-icon-clear" @click="selectIcon(null)">
            <v-icon size="12" class="mr-1">mdi-close</v-icon>
            {{ $t('dossier.removeIcon') }}
          </button>
        </div>
      </div>

      <div class="di-section">
        <div class="di-row">
          <div class="di-field">
            <span class="di-label mono">{{ $t('common.title') }}</span>
            <span class="di-value">{{ form.title || '—' }}</span>
          </div>
          <div class="di-field" style="max-width: 200px;">
            <span class="di-label mono">{{ $t('common.status') }}</span>
            <span class="di-status-badge" :class="`di-status-${form.status}`">{{ statusLabel }}</span>
          </div>
        </div>
        <div class="di-field" v-if="form.objectives">
          <span class="di-label mono">{{ $t('dossier.objectives') }}</span>
          <span class="di-value di-value-block">{{ form.objectives }}</span>
        </div>
        <div class="di-field" v-if="form.judicialFacts">
          <span class="di-label mono">{{ $t('dossier.judicialFacts') }}</span>
          <span class="di-value di-value-block">{{ form.judicialFacts }}</span>
        </div>
        <div class="di-field" v-if="form.description">
          <span class="di-label mono">{{ $t('dossier.synthesis') }}</span>
          <span class="di-value di-value-block">{{ form.description }}</span>
        </div>
        <div class="di-field di-tags-field">
          <span class="di-label mono">{{ $t('dossier.tags') }}</span>
          <v-combobox
            v-model="localTags"
            :items="availableTags"
            :label="$t('dossier.tags')"
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

      <!-- CLASSIFICATION & MAGISTRAT -->
      <div class="di-section">
        <h3 class="di-section-title mono">
          <v-icon size="16" class="mr-2">mdi-gavel</v-icon>
          {{ $t('dossier.classification') }} & {{ $t('dossier.magistrate') }}
        </h3>
        <div class="di-row">
          <div class="di-field">
            <span class="di-label mono">{{ $t('dossier.classification') }}</span>
            <span class="di-classification-badge" :class="`di-class-${form.classification}`">{{ classificationLabel }}</span>
          </div>
          <div class="di-field">
            <span class="di-label mono">{{ $t('dossier.magistrate') }}</span>
            <span class="di-value">{{ form.magistrate || '—' }}</span>
          </div>
        </div>
        <div class="di-row di-flags-row">
          <span v-if="form.isUrgent" class="di-flag-badge di-flag-urgent">
            <v-icon size="14" class="mr-1">mdi-alert-circle-outline</v-icon>
            {{ $t('dossier.isUrgent') }}
          </span>
          <span v-if="form.isEmbargo" class="di-flag-badge di-flag-embargo">
            <v-icon size="14" class="mr-1">mdi-lock-clock</v-icon>
            {{ $t('dossier.isEmbargo') }}
          </span>
        </div>
        <div class="di-row-3">
          <div class="di-field">
            <span class="di-label mono">{{ $t('dossier.isFirstRequest') }}</span>
            <span class="di-value">{{ form.isFirstRequest ? $t('dossier.firstRequest') : $t('dossier.subsequentRequest') }}</span>
          </div>
          <div class="di-field">
            <span class="di-label mono">{{ $t('dossier.dossierLanguage') }}</span>
            <span class="di-value">{{ form.dossierLanguage === 'nl' ? $t('dossier.langNl') : $t('dossier.langFr') }}</span>
          </div>
          <div class="di-field"></div>
        </div>
      </div>

      <!-- DOCUMENTS LIES -->
      <div class="di-section">
        <div class="di-section-header">
          <h3 class="di-section-title mono">
            <v-icon size="16" class="mr-2">mdi-paperclip</v-icon>
            {{ $t('dossier.linkedDocuments') }}
            <span v-if="form.linkedDocuments.length" class="di-count">{{ form.linkedDocuments.length }}</span>
          </h3>
          <button class="me-btn-small" @click="triggerDocInput">
            <v-icon size="14" class="mr-1">mdi-plus</v-icon>
            {{ $t('dossier.addDocument') }}
          </button>
          <input ref="docInput" type="file" hidden multiple @change="handleDocUpload" />
        </div>
        <div v-if="form.linkedDocuments.length" class="di-doc-list">
          <div v-for="doc in form.linkedDocuments" :key="doc._id" class="di-doc-row">
            <v-icon size="16" class="di-doc-icon">{{ docIcon(doc.fileName) }}</v-icon>
            <div class="di-doc-info">
              <a :href="`${SERVER_URL}/${doc.filePath}`" target="_blank" class="di-doc-name">{{ doc.fileName }}</a>
              <span class="di-doc-meta mono">{{ formatFileSize(doc.fileSize) }}</span>
            </div>
            <button class="di-el-btn di-el-btn-danger" @click="handleDeleteDoc(doc)" :title="$t('common.delete')">
              <v-icon size="14">mdi-trash-can-outline</v-icon>
            </button>
          </div>
        </div>
        <div v-else class="di-empty mono">{{ $t('dossier.noLinkedDocuments') }}</div>
        <div v-if="uploadingDoc" class="di-uploading mono">
          <v-progress-circular indeterminate size="16" width="2" class="mr-2" />
          {{ $t('dossier.uploading') }}
        </div>
      </div>

      <div class="di-section">
        <h3 class="di-section-title mono">
          <v-icon size="16" class="mr-2">mdi-account-outline</v-icon>
          {{ $t('dossier.investigator') }}
        </h3>
        <div class="di-row">
          <div class="di-field"><span class="di-label mono">{{ $t('common.name') }}</span><span class="di-value">{{ form.investigator.name || '—' }}</span></div>
          <div class="di-field"><span class="di-label mono">{{ $t('dossier.service') }}</span><span class="di-value">{{ form.investigator.service || '—' }}</span></div>
        </div>
        <div class="di-row-3">
          <div class="di-field"><span class="di-label mono">{{ $t('dossier.unit') }}</span><span class="di-value">{{ form.investigator.unit || '—' }}</span></div>
          <div class="di-field"><span class="di-label mono">{{ $t('dossier.phone') }}</span><span class="di-value">{{ form.investigator.phone || '—' }}</span></div>
          <div class="di-field"><span class="di-label mono">{{ $t('common.email') }}</span><span class="di-value">{{ form.investigator.email || '—' }}</span></div>
        </div>
      </div>

      <!-- ENTITES -->
      <div class="di-section">
        <div class="di-section-header">
          <h3 class="di-section-title mono">
            <v-icon size="16" class="mr-2">mdi-account-group-outline</v-icon>
            {{ $t('dossier.entities') }}
            <span v-if="form.entities.length" class="di-count">{{ form.entities.length }}</span>
          </h3>
          <button class="me-btn-small" @click="openEntityDialog()">
            <v-icon size="14" class="mr-1">mdi-plus</v-icon>
            {{ $t('common.add') }}
          </button>
        </div>
        <div v-if="form.entities.length" class="di-entity-list">
          <div class="di-entity-list-header mono">
            <span class="di-el-col-type">{{ $t('common.type') }}</span>
            <span class="di-el-col-name">{{ $t('common.name') }}</span>
            <span class="di-el-col-desc">{{ $t('common.description') }}</span>
            <span class="di-el-col-actions">{{ $t('common.actions') }}</span>
          </div>
          <div v-for="(entity, i) in form.entities" :key="i" class="di-entity-row">
            <span class="di-el-col-type">
              <v-icon size="16" :title="entityTypeLabel(entity.type)" class="di-el-type-icon">{{ entityIcon(entity.type) }}</v-icon>
              <span class="di-el-type-label mono">{{ entityTypeLabel(entity.type) }}</span>
            </span>
            <span class="di-el-col-name">
              <span v-if="entity.photos?.length" class="di-el-thumbs">
                <img
                  v-for="(photo, pi) in entity.photos.slice(0, 2)"
                  :key="pi"
                  :src="`${SERVER_URL}/${photo}`"
                  class="di-el-thumb"
                />
                <span v-if="entity.photos.length > 2" class="di-el-thumb-more mono">+{{ entity.photos.length - 2 }}</span>
              </span>
              {{ entity.name }}
            </span>
            <span class="di-el-col-desc" :title="entity.description">{{ entity.description || '—' }}</span>
            <span class="di-el-col-actions">
              <button class="di-el-btn" @click="copyEntity(entity.name, i)" :title="$t('dossier.copyEntity') + ' ' + entity.name">
                <v-icon size="15">{{ copiedIndex === i ? 'mdi-check' : 'mdi-content-copy' }}</v-icon>
              </button>
              <button class="di-el-btn" @click="enrichEntityAI(i)" :title="$t('dossier.enrichAI')" :disabled="enrichingIndex === i">
                <v-icon size="15" :class="{ 'spin': enrichingIndex === i }">{{ enrichingIndex === i ? 'mdi-loading' : 'mdi-robot-outline' }}</v-icon>
              </button>
              <button class="di-el-btn" @click="openEditEntity(i)" :title="$t('common.edit')">
                <v-icon size="15">mdi-pencil-outline</v-icon>
              </button>
              <button class="di-el-btn di-el-btn-danger" @click="removeEntity(i)" :title="$t('common.delete')">
                <v-icon size="15">mdi-trash-can-outline</v-icon>
              </button>
            </span>
          </div>
        </div>
        <div v-else class="di-empty mono">{{ $t('dossier.noEntities') }}</div>
      </div>

      <!-- CHIFFREMENT E2E -->
      <div class="di-section" v-if="dossierStore.currentDossier && isOwner">
        <div class="di-section-header">
          <h3 class="di-section-title mono">
            <v-icon size="16" class="mr-2">mdi-lock-outline</v-icon>
            {{ $t('dossier.encryption') }}
          </h3>
          <div class="di-encryption-toggle">
            <v-switch
              v-model="encryptionEnabled"
              :loading="encryptionBusy"
              :disabled="encryptionBusy"
              color="primary"
              density="compact"
              hide-details
              @update:model-value="toggleEncryption"
            />
          </div>
        </div>
        <p v-if="encryptionEnabled" class="di-encryption-info mono">
          <v-icon size="14" class="mr-1" color="success">mdi-shield-check-outline</v-icon>
          {{ $t('dossier.encryptionActive') }}
        </p>
        <p v-else class="di-encryption-info mono">
          <v-icon size="14" class="mr-1" color="warning">mdi-shield-off-outline</v-icon>
          {{ $t('dossier.encryptionInactive') }}
        </p>
        <p v-if="!encryptionStore.isUnlocked && encryptionStore.hasKeys" class="di-encryption-warning mono">
          <v-icon size="14" class="mr-1" color="error">mdi-key-alert</v-icon>
          {{ $t('dossier.keysLocked') }}
        </p>
        <p v-if="!encryptionStore.hasKeys" class="di-encryption-warning mono">
          <v-icon size="14" class="mr-1" color="warning">mdi-key-plus</v-icon>
          {{ $t('dossier.noKeys') }}
          <button class="di-gen-keys-btn" @click="generateEncryptionKeys" :disabled="generatingKeys">
            {{ generatingKeys ? $t('dossier.generating') : $t('dossier.generateKeys') }}
          </button>
        </p>
      </div>

      <!-- COLLABORATEURS -->
      <div class="di-section" v-if="dossierStore.currentDossier">
        <div class="di-section-title mono">
          <v-icon size="16" class="mr-2">mdi-account-multiple-outline</v-icon>
          {{ $t('dossier.collaborators') }}
          <span v-if="collaboratorDetails.length" class="di-count">{{ collaboratorDetails.length }}</span>
        </div>

        <div v-for="collab in collaboratorDetails" :key="collab._id" class="collab-row">
          <span class="collab-avatar">{{ (collab.firstName[0] + collab.lastName[0]).toUpperCase() }}</span>
          <div class="collab-info">
            <span class="collab-name">{{ collab.firstName }} {{ collab.lastName }}</span>
            <span class="collab-email mono">{{ collab.email }}</span>
          </div>
          <button v-if="isOwner" class="collab-remove" @click="removeCollaborator(collab._id)" :title="$t('dossier.remove')">
            <v-icon size="14">mdi-close</v-icon>
          </button>
        </div>

        <div v-if="!collaboratorDetails.length" class="di-empty mono">{{ $t('dossier.noCollaborators') }}</div>

        <div v-if="isOwner" class="collab-add">
          <div class="collab-search-wrapper">
            <v-text-field
              v-model="userSearchQuery"
              :label="$t('dossier.addCollaborator')"
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
              <div class="collab-search-empty">{{ $t('dossier.noUserFound') }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODE EDITION -->
    <v-form v-else @submit.prevent="handleSave" class="di-form fade-in">
      <div class="di-section">
        <div class="di-row">
          <v-text-field v-model="form.title" :label="$t('dossier.dossierTitle')" />
          <v-select v-model="form.status" :items="statusOptions" :label="$t('common.status')" style="max-width: 200px;" />
        </div>
        <v-textarea v-model="form.objectives" :label="$t('dossier.objectives')" rows="3" class="mb-1" />
        <v-textarea v-model="form.judicialFacts" :label="$t('dossier.judicialFacts')" rows="3" class="mb-1" />
        <v-textarea v-model="form.description" :label="$t('dossier.synthesis')" rows="3" />
      </div>

      <div class="di-section">
        <h3 class="di-section-title mono">
          <v-icon size="16" class="mr-2">mdi-gavel</v-icon>
          {{ $t('dossier.classification') }} & {{ $t('dossier.magistrate') }}
        </h3>
        <div class="di-row">
          <v-select v-model="form.classification" :items="classificationOptions" :label="$t('dossier.classification')" />
          <v-text-field v-model="form.magistrate" :label="$t('dossier.magistrate')" />
        </div>
        <div class="di-row">
          <v-checkbox v-model="form.isUrgent" :label="$t('dossier.isUrgent')" color="error" density="compact" hide-details />
          <v-checkbox :model-value="form.isEmbargo" :label="$t('dossier.isEmbargo')" color="warning" density="compact" hide-details @update:model-value="toggleEmbargo" />
        </div>
        <div class="di-row">
          <v-select v-model="form.dossierLanguage" :items="dossierLanguageOptions" :label="$t('dossier.dossierLanguage')" style="max-width: 200px;" />
          <div class="di-switch-field">
            <v-switch
              v-model="form.isFirstRequest"
              :label="form.isFirstRequest ? $t('dossier.firstRequest') : $t('dossier.subsequentRequest')"
              color="primary"
              density="compact"
              hide-details
            />
          </div>
        </div>
      </div>

      <div class="di-section">
        <h3 class="di-section-title mono">
          <v-icon size="16" class="mr-2">mdi-account-outline</v-icon>
          {{ $t('dossier.investigator') }}
        </h3>
        <div class="di-row">
          <v-text-field v-model="form.investigator.name" :label="$t('common.name')" />
          <v-text-field v-model="form.investigator.service" :label="$t('dossier.service')" />
        </div>
        <div class="di-row-3">
          <v-text-field v-model="form.investigator.unit" :label="$t('dossier.unit')" />
          <v-text-field v-model="form.investigator.phone" :label="$t('dossier.phone')" />
          <v-text-field v-model="form.investigator.email" :label="$t('common.email')" />
        </div>
      </div>

      <div class="di-actions">
        <button type="button" class="me-btn-ghost" @click="cancelEdit">{{ $t('common.cancel') }}</button>
        <button type="submit" class="me-btn-primary">
          <v-icon size="16" class="mr-1">mdi-content-save-outline</v-icon>
          {{ $t('common.save') }}
        </button>
      </div>
    </v-form>

    <!-- DIALOG AJOUT / MODIFICATION ENTITE -->
    <v-dialog v-model="entityDialog" max-width="440">
      <div class="glass-card dialog-card">
        <div class="dialog-header">
          <h3 class="mono">{{ editingEntityIndex !== null ? $t('dossier.editEntity') : $t('dossier.addEntity') }}</h3>
          <button class="me-close-btn" @click="entityDialog = false">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>
        <div class="dialog-body">
          <v-text-field v-model="newEntity.name" :label="$t('dossier.entityName')" autofocus class="mb-2" />
          <v-select
            v-model="newEntity.type"
            :items="entityTypes"
            item-value="value"
            item-title="title"
            :label="$t('common.type')"
            class="mb-2"
          />
          <v-text-field v-model="newEntity.description" :label="$t('dossier.entityDescOptional')" />

          <!-- Photos d'identité (only when editing existing entity) -->
          <div v-if="editingEntityIndex !== null" class="di-entity-photos-section">
            <div class="di-entity-photos-header">
              <span class="mono" style="font-size: 12px; font-weight: 600;">
                <v-icon size="14" class="mr-1">mdi-camera-outline</v-icon>
                {{ $t('dossier.entityPhotos') }}
              </span>
              <button
                type="button"
                class="me-btn-small"
                @click="entityPhotoInput?.click()"
                :disabled="uploadingEntityPhoto"
              >
                <v-icon size="14" class="mr-1">{{ uploadingEntityPhoto ? 'mdi-loading' : 'mdi-plus' }}</v-icon>
                {{ $t('dossier.addPhoto') }}
              </button>
              <input
                ref="entityPhotoInput"
                type="file"
                accept="image/*"
                multiple
                style="display: none"
                @change="uploadEntityPhoto"
              />
            </div>
            <div v-if="newEntity.photos.length" class="di-entity-photos-grid">
              <div v-for="(photo, pi) in newEntity.photos" :key="pi" class="di-entity-photo-item">
                <img :src="`${SERVER_URL}/${photo}`" class="di-entity-photo-img" />
                <button
                  class="di-entity-photo-delete"
                  @click="deleteEntityPhoto(editingEntityIndex!, photo)"
                  :title="$t('dossier.deletePhoto')"
                >
                  <v-icon size="12">mdi-close</v-icon>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="me-btn-ghost" @click="entityDialog = false">{{ $t('common.cancel') }}</button>
          <button class="me-btn-primary" @click="saveEntity" :disabled="!newEntity.name.trim() || !newEntity.type">
            {{ editingEntityIndex !== null ? $t('common.save') : $t('common.add') }}
          </button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDossierStore } from '../../stores/dossier';
import { useAuthStore } from '../../stores/auth';
import { useEncryptionStore } from '../../stores/encryption';
import api, { SERVER_URL } from '../../services/api';
import type { CollaboratorUser } from '../../types';
import { DOSSIER_ICONS } from '../../constants/dossierIcons';
import { useConfirm } from '../../composables/useConfirm';

const { t } = useI18n();
const { prompt: customPrompt, confirm: customConfirm } = useConfirm();
const dossierStore = useDossierStore();
const authStore = useAuthStore();
const encryptionStore = useEncryptionStore();

const editing = ref(false);
const entityDialog = ref(false);
const copiedIndex = ref<number | null>(null);
const editingEntityIndex = ref<number | null>(null);
const showIconPicker = ref(false);
const logoInput = ref<HTMLInputElement | null>(null);
const dossierIcons = DOSSIER_ICONS;

const dossierLogoUrl = computed(() => {
  const d = dossierStore.currentDossier;
  return d?.logoPath ? `${SERVER_URL}/${d.logoPath}` : null;
});

const statusOptions = computed(() => [
  { title: t('dossier.statusOpen'), value: 'open' },
  { title: t('dossier.statusInProgress'), value: 'in_progress' },
  { title: t('dossier.statusClosed'), value: 'closed' },
]);

const ENTITY_TYPE_KEYS = [
  'identity', 'phone', 'email', 'snapchat', 'facebook', 'instagram',
  'twitter', 'tiktok', 'discord', 'telegram', 'linkedin',
  'ip', 'address', 'vehicle', 'iban', 'pseudo', 'other',
] as const;

const entityTypes = computed(() =>
  ENTITY_TYPE_KEYS.map(key => ({
    value: key,
    title: t(`dossier.entityTypes.${key}`),
  }))
);

function entityTypeLabel(type: string): string {
  const key = legacyTypeToKey[type] || type;
  if (ENTITY_TYPE_KEYS.includes(key as any)) {
    return t(`dossier.entityTypes.${key}`);
  }
  return type;
}

const localTags = ref<string[]>([]);
const availableTags = ref<string[]>([]);

const uploadingDoc = ref(false);
const docInput = ref<HTMLInputElement | null>(null);

const form = reactive({
  title: '',
  description: '',
  status: 'open' as 'open' | 'in_progress' | 'closed',
  icon: null as string | null,
  objectives: '',
  judicialFacts: '',
  investigator: { name: '', service: '', unit: '', phone: '', email: '' },
  entities: [] as { name: string; type: string; description: string; photos: string[] }[],
  classification: 'routine' as 'priority' | 'routine',
  isUrgent: false,
  isEmbargo: false,
  magistrate: '',
  isFirstRequest: true,
  dossierLanguage: 'fr' as 'fr' | 'nl',
  linkedDocuments: [] as { _id: string; fileName: string; filePath: string; fileSize: number; uploadedAt: string }[],
});

const newEntity = reactive({ name: '', type: '', description: '', photos: [] as string[] });
const entityPhotoInput = ref<HTMLInputElement | null>(null);
const uploadingEntityPhoto = ref(false);

const statusLabel = computed(() => {
  switch (form.status) {
    case 'open': return t('dossier.statusOpen');
    case 'in_progress': return t('dossier.statusInProgress');
    case 'closed': return t('dossier.statusClosed');
    default: return form.status;
  }
});

const classificationLabel = computed(() => {
  return form.classification === 'priority'
    ? t('dossier.classificationPriority')
    : t('dossier.classificationRoutine');
});

const classificationOptions = computed(() => [
  { title: t('dossier.classificationPriority'), value: 'priority' },
  { title: t('dossier.classificationRoutine'), value: 'routine' },
]);

const dossierLanguageOptions = computed(() => [
  { title: t('dossier.langFr'), value: 'fr' },
  { title: t('dossier.langNl'), value: 'nl' },
]);

function loadFromDossier() {
  const d = dossierStore.currentDossier;
  if (d) {
    form.title = d.title;
    form.description = d.description;
    form.status = d.status;
    form.icon = d.icon || null;
    form.objectives = d.objectives;
    form.judicialFacts = d.judicialFacts;
    form.investigator = { ...d.investigator };
    form.entities = (d.entities || []).map((e: any) => ({ ...e, photos: e.photos || [] }));
    form.classification = d.classification || 'routine';
    form.isUrgent = !!d.isUrgent;
    form.isEmbargo = !!d.isEmbargo;
    form.magistrate = d.magistrate || '';
    form.isFirstRequest = d.isFirstRequest !== undefined ? d.isFirstRequest : true;
    form.dossierLanguage = d.dossierLanguage || 'fr';
    form.linkedDocuments = (d.linkedDocuments || []).map((doc: any) => ({ ...doc }));
  }
}

async function selectIcon(icon: string | null) {
  form.icon = icon;
  if (dossierStore.currentDossier) {
    await dossierStore.updateDossier(dossierStore.currentDossier._id, { icon, logoPath: null });
  }
  showIconPicker.value = false;
}

function triggerLogoInput() { logoInput.value?.click(); }

function syncDossierInList(updated: any) {
  dossierStore.currentDossier = updated;
  const idx = dossierStore.dossiers.findIndex(d => d._id === updated._id);
  if (idx >= 0) dossierStore.dossiers[idx] = updated;
}

async function handleLogoUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !dossierStore.currentDossier) return;
  const fd = new FormData();
  fd.append('logo', file);
  try {
    const { data } = await api.post(`/dossiers/${dossierStore.currentDossier._id}/logo`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    syncDossierInList(data);
    form.icon = null;
  } catch (err) {
    console.error('Failed to upload logo:', err);
  }
}

async function removeLogo() {
  if (!dossierStore.currentDossier) return;
  try {
    const { data } = await api.delete(`/dossiers/${dossierStore.currentDossier._id}/logo`);
    syncDossierInList(data);
  } catch (err) {
    console.error('Failed to remove logo:', err);
  }
}

// --- Documents liés ---
function triggerDocInput() { docInput.value?.click(); }

async function handleDocUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files?.length || !dossierStore.currentDossier) return;
  uploadingDoc.value = true;
  try {
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append('document', file);
      const { data } = await api.post(`/dossiers/${dossierStore.currentDossier._id}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      syncDossierInList(data);
    }
    loadFromDossier();
  } catch (err) {
    console.error('Failed to upload document:', err);
  } finally {
    uploadingDoc.value = false;
    if (docInput.value) docInput.value.value = '';
  }
}

async function handleDeleteDoc(doc: { _id: string; fileName: string }) {
  if (!dossierStore.currentDossier) return;
  const confirmed = await customConfirm({
    title: t('dossier.deleteDocument'),
    message: t('dossier.deleteDocumentConfirm'),
    confirmText: t('common.delete'),
  });
  if (!confirmed) return;
  try {
    const { data } = await api.delete(`/dossiers/${dossierStore.currentDossier._id}/documents/${doc._id}`);
    syncDossierInList(data);
    loadFromDossier();
  } catch (err) {
    console.error('Failed to delete document:', err);
  }
}

function docIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: 'mdi-file-pdf-box',
    doc: 'mdi-file-word-box', docx: 'mdi-file-word-box',
    xls: 'mdi-file-excel-box', xlsx: 'mdi-file-excel-box',
    ppt: 'mdi-file-powerpoint-box', pptx: 'mdi-file-powerpoint-box',
    jpg: 'mdi-file-image', jpeg: 'mdi-file-image', png: 'mdi-file-image', gif: 'mdi-file-image', webp: 'mdi-file-image',
    zip: 'mdi-folder-zip', rar: 'mdi-folder-zip', '7z': 'mdi-folder-zip',
    txt: 'mdi-file-document-outline', csv: 'mdi-file-delimited',
  };
  return map[ext] || 'mdi-file-outline';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

async function toggleEmbargo(newValue: boolean | null) {
  if (!dossierStore.currentDossier) return;
  const dossierId = dossierStore.currentDossier._id;

  if (newValue) {
    // Activation de l'embargo : afficher la modal d'avertissement
    const confirmed = await customConfirm({
      title: t('dossier.embargoWarningTitle'),
      message: t('dossier.embargoWarningMessage'),
      confirmText: t('dossier.embargoConfirm'),
    });
    if (!confirmed) return;
    form.isEmbargo = true;

    // Sauvegarder isEmbargo immédiatement en base AVANT le chiffrement
    await dossierStore.updateDossier(dossierId, { isEmbargo: true });

    // Auto-activer le chiffrement si pas encore actif
    if (!encryptionEnabled.value) {
      if (encryptionStore.hasKeys && encryptionStore.isUnlocked) {
        await toggleEncryption(true);
      }
    }
  } else {
    // Désactivation de l'embargo
    const confirmed = await customConfirm({
      title: t('dossier.embargoDisableTitle'),
      message: t('dossier.embargoDisableMessage'),
      confirmText: t('dossier.embargoDisableConfirm'),
    });
    if (!confirmed) return;
    form.isEmbargo = false;

    // Sauvegarder immédiatement
    await dossierStore.updateDossier(dossierId, { isEmbargo: false });
  }
}

async function handleSave() {
  if (dossierStore.currentDossier) {
    await dossierStore.updateDossier(dossierStore.currentDossier._id, form);
    editing.value = false;
  }
}

const entityIconMap: Record<string, string> = {
  'identity': 'mdi-card-account-details-outline',
  'phone': 'mdi-phone-outline',
  'email': 'mdi-email-outline',
  'snapchat': 'mdi-snapchat',
  'facebook': 'mdi-facebook',
  'instagram': 'mdi-instagram',
  'twitter': 'mdi-twitter',
  'tiktok': 'mdi-music-note-outline',
  'discord': 'mdi-message-outline',
  'telegram': 'mdi-send-outline',
  'linkedin': 'mdi-linkedin',
  'ip': 'mdi-ip-network-outline',
  'address': 'mdi-map-marker-outline',
  'vehicle': 'mdi-car-outline',
  'iban': 'mdi-bank-outline',
  'pseudo': 'mdi-at',
  'other': 'mdi-dots-horizontal',
};

// Legacy French labels to key mapping (for entities stored before i18n fix)
const legacyTypeToKey: Record<string, string> = {
  'Identite': 'identity', 'Identité': 'identity', 'Identity': 'identity',
  'Telephone': 'phone', 'Téléphone': 'phone', 'Phone': 'phone',
  'Email': 'email',
  'Snapchat': 'snapchat', 'Facebook': 'facebook', 'Instagram': 'instagram',
  'Twitter / X': 'twitter', 'TikTok': 'tiktok', 'Discord': 'discord',
  'Telegram': 'telegram', 'LinkedIn': 'linkedin',
  'Adresse IP': 'ip', 'IP address': 'ip',
  'Adresse postale': 'address', 'Postal address': 'address',
  'Vehicule': 'vehicle', 'Véhicule': 'vehicle', 'Vehicle': 'vehicle',
  'IBAN / Compte': 'iban', 'IBAN / Account': 'iban',
  'Pseudo': 'pseudo', 'Username': 'pseudo',
  'Autre': 'other', 'Other': 'other',
};

function entityIcon(type: string): string {
  const key = legacyTypeToKey[type] || type;
  return entityIconMap[key] || 'mdi-tag-outline';
}

function openEntityDialog() {
  editingEntityIndex.value = null;
  newEntity.name = '';
  newEntity.type = '';
  newEntity.description = '';
  newEntity.photos = [];
  entityDialog.value = true;
}

function openEditEntity(index: number) {
  editingEntityIndex.value = index;
  const e = form.entities[index];
  newEntity.name = e.name;
  newEntity.type = e.type;
  newEntity.description = e.description;
  newEntity.photos = [...(e.photos || [])];
  entityDialog.value = true;
}

async function saveEntity() {
  if (editingEntityIndex.value !== null) {
    form.entities[editingEntityIndex.value] = { ...newEntity, photos: [...newEntity.photos] };
  } else {
    form.entities.push({ ...newEntity, photos: [...newEntity.photos] });
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

// --- Photos d'entité ---
async function uploadEntityPhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  if (!files?.length || !dossierStore.currentDossier) return;

  // Determine entity index: if editing, use that; otherwise it's the last one added
  const entityIndex = editingEntityIndex.value;
  if (entityIndex === null) return;

  uploadingEntityPhoto.value = true;
  try {
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('photo', file);
      const { data } = await api.post(
        `/dossiers/${dossierStore.currentDossier._id}/entities/${entityIndex}/photo`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      // Refresh entities from response
      form.entities = (data.entities || []).map((e: any) => ({ ...e, photos: e.photos || [] }));
      newEntity.photos = [...(form.entities[entityIndex]?.photos || [])];
    }
  } catch (err) {
    console.error('Entity photo upload error:', err);
  } finally {
    uploadingEntityPhoto.value = false;
    if (input) input.value = '';
  }
}

async function deleteEntityPhoto(entityIndex: number, photoPath: string) {
  if (!dossierStore.currentDossier) return;
  try {
    const { data } = await api.delete(
      `/dossiers/${dossierStore.currentDossier._id}/entities/${entityIndex}/photo`,
      { data: { photoPath } },
    );
    form.entities = (data.entities || []).map((e: any) => ({ ...e, photos: e.photos || [] }));
    // Update dialog state if open
    if (editingEntityIndex.value === entityIndex) {
      newEntity.photos = [...(form.entities[entityIndex]?.photos || [])];
    }
  } catch (err) {
    console.error('Entity photo delete error:', err);
  }
}

// --- Enrichissement AI ---
const enrichingIndex = ref<number | null>(null);

async function enrichEntityAI(index: number) {
  if (!dossierStore.currentDossier || enrichingIndex.value !== null) return;
  enrichingIndex.value = index;
  try {
    const { data } = await api.post('/ai/enrich-entity', {
      dossierId: dossierStore.currentDossier._id,
      entityIndex: index,
    });
    form.entities[index].description = data.description;
  } catch (err: any) {
    console.error('Enrich error:', err);
  } finally {
    enrichingIndex.value = null;
  }
}

// --- Chiffrement E2E ---
const encryptionEnabled = ref(false);
const encryptionBusy = ref(false);
const generatingKeys = ref(false);

watch(() => dossierStore.currentDossier?.isEncrypted, (val) => {
  encryptionEnabled.value = !!val;
}, { immediate: true });

async function generateEncryptionKeys() {
  generatingKeys.value = true;
  try {
    // Prompt user for password to protect the private key
    const password = await customPrompt({
      title: t('dossier.encryption'),
      message: t('dossier.encryptionPasswordPrompt'),
      promptLabel: t('dossier.encryptionPasswordLabel'),
      confirmText: t('dossier.encryptionConfirmGenerate'),
      promptType: 'password',
    });
    if (!password) return;
    await encryptionStore.initializeKeys(password);
  } catch (err) {
    console.error('Failed to generate encryption keys:', err);
  } finally {
    generatingKeys.value = false;
  }
}

async function toggleEncryption(newValue: boolean | null) {
  if (!dossierStore.currentDossier) return;
  const dossierId = dossierStore.currentDossier._id;
  encryptionBusy.value = true;

  try {
    if (newValue) {
      // Enable encryption
      if (!encryptionStore.hasKeys) {
        encryptionEnabled.value = false;
        await customConfirm({ title: t('dossier.encryption'), message: t('dossier.encryptionNeedKeys'), confirmText: t('common.ok'), cancelText: '' });
        return;
      }
      if (!encryptionStore.isUnlocked) {
        encryptionEnabled.value = false;
        await customConfirm({ title: t('dossier.encryption'), message: t('dossier.encryptionNeedUnlock'), confirmText: t('common.ok'), cancelText: '' });
        return;
      }

      // Setup dossier encryption (generates AES key)
      await encryptionStore.setupDossierEncryption(dossierId);

      // Re-save current dossier fields encrypted
      const dossier = dossierStore.currentDossier;
      // Mark dossier as encrypted in local state first
      dossier.isEncrypted = true;

      await dossierStore.updateDossier(dossierId, {
        objectives: dossier.objectives,
        judicialFacts: dossier.judicialFacts,
        description: dossier.description,
        entities: dossier.entities,
      });

      // Re-encrypt all existing node content
      const allNodes = [...dossierStore.nodes];
      for (const node of allNodes) {
        if (node.content || node.excalidrawData || node.mapData) {
          await dossierStore.updateNode(node._id, {
            content: node.content,
            excalidrawData: node.excalidrawData,
            mapData: node.mapData,
          });
        }
      }

      // Share key with collaborators
      const collabs = dossier.collaborators || [];
      for (const collab of collabs) {
        const collabId = typeof collab === 'string' ? collab : collab._id;
        try {
          await encryptionStore.shareDossierKey(dossierId, collabId);
        } catch {
          console.warn(`Could not share encryption key with collaborator ${collabId}`);
        }
      }

      encryptionEnabled.value = true;
    } else {
      // Disable encryption - decrypt all content first
      if (!encryptionStore.isUnlocked) {
        encryptionEnabled.value = true;
        await customConfirm({ title: t('dossier.encryption'), message: t('dossier.encryptionDisableNeedUnlock'), confirmText: t('common.ok'), cancelText: '' });
        return;
      }

      // The current data in memory is already decrypted.
      // We need to save it unencrypted, then disable encryption flag.
      const dossier = dossierStore.currentDossier;
      // Temporarily mark as not encrypted so updateDossier won't re-encrypt
      dossier.isEncrypted = false;

      await dossierStore.updateDossier(dossierId, {
        objectives: dossier.objectives,
        judicialFacts: dossier.judicialFacts,
        description: dossier.description,
        entities: dossier.entities,
      });

      // Re-save all node content unencrypted
      const allNodes = [...dossierStore.nodes];
      for (const node of allNodes) {
        if (node.content || node.excalidrawData || node.mapData) {
          await dossierStore.updateNode(node._id, {
            content: node.content,
            excalidrawData: node.excalidrawData,
            mapData: node.mapData,
          });
        }
      }

      // Remove encryption keys from dossier
      await encryptionStore.disableDossierEncryption(dossierId);
      encryptionEnabled.value = false;
    }
  } catch (err) {
    console.error('Encryption toggle error:', err);
    // Revert UI state
    encryptionEnabled.value = !newValue;
  } finally {
    encryptionBusy.value = false;
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

    // If dossier is encrypted, share the encryption key with the new collaborator
    if (dossierStore.currentDossier?.isEncrypted && encryptionStore.isUnlocked) {
      try {
        await encryptionStore.shareDossierKey(dossierStore.currentDossier._id, user._id);
      } catch (err) {
        console.warn('Could not share encryption key with collaborator:', err);
      }
    }
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
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 48px;
  height: 100%;
  overflow-y: auto;
}
/* Icon / Logo section */
.di-icon-section { padding: 16px 20px; }
.di-icon-display {
  display: flex;
  align-items: center;
  gap: 12px;
}
.di-logo-wrap { position: relative; }
.di-logo-img {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid var(--me-border);
}
.di-logo-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.di-logo-remove:hover {
  background: rgba(248, 113, 113, 0.1);
  border-color: var(--me-error);
  color: var(--me-error);
}
.di-icon-large { color: var(--me-accent); }
.di-icon-default { color: var(--me-text-muted); }
.di-icon-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}
.di-icon-picker {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--me-border);
}
.icon-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.icon-picker-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid transparent;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.icon-picker-item:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.icon-picker-item--active {
  background: var(--me-accent-glow);
  border-color: var(--me-accent);
  color: var(--me-accent);
}
.di-icon-clear {
  display: inline-flex;
  align-items: center;
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  font-size: 11px;
  transition: color 0.15s;
}
.di-icon-clear:hover { color: var(--me-error); }
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
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}
@media (min-width: 1200px) {
  .di-form {
    grid-template-columns: 1fr 1fr;
  }
  .di-form > .di-section:first-child {
    grid-column: 1 / -1;
  }
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
/* Entity photo thumbnails in list */
.di-el-thumbs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-right: 6px;
  vertical-align: middle;
}
.di-el-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--me-border);
}
.di-el-thumb-more {
  font-size: 10px;
  color: var(--me-text-muted);
  margin-left: 2px;
}
/* Entity photos section in dialog */
.di-entity-photos-section {
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--me-border);
}
.di-entity-photos-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.di-entity-photos-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.di-entity-photo-item {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--me-border);
}
.di-entity-photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.di-entity-photo-delete {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}
.di-entity-photo-item:hover .di-entity-photo-delete {
  opacity: 1;
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
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

/* Encryption */
.di-encryption-toggle {
  display: flex;
  align-items: center;
}
.di-encryption-info {
  font-size: 12px;
  color: var(--me-text-muted);
  line-height: 1.6;
  display: flex;
  align-items: center;
}
.di-encryption-warning {
  font-size: 12px;
  color: var(--me-text-muted);
  line-height: 1.6;
  margin-top: 8px;
  display: flex;
  align-items: center;
}
.di-gen-keys-btn {
  margin-left: 8px;
  padding: 3px 10px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent-glow);
  border: 1px solid var(--me-accent);
  color: var(--me-accent);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.15s;
}
.di-gen-keys-btn:hover {
  background: var(--me-accent);
  color: var(--me-bg-deep);
}
.di-gen-keys-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Classification badges */
.di-classification-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  width: fit-content;
}
.di-class-priority {
  background: rgba(96, 165, 250, 0.15);
  color: var(--me-info, #60a5fa);
}
.di-class-routine {
  background: rgba(52, 211, 153, 0.15);
  color: var(--me-success);
}

/* Flag badges (urgent, embargo) */
.di-flags-row {
  gap: 8px;
  margin-bottom: 8px;
}
.di-flag-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.di-flag-urgent {
  background: rgba(248, 113, 113, 0.15);
  color: var(--me-error);
}
.di-flag-embargo {
  background: rgba(251, 191, 36, 0.15);
  color: var(--me-warning);
}

/* Documents liés */
.di-doc-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.di-doc-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--me-radius-xs);
  transition: background 0.12s;
}
.di-doc-row:hover {
  background: var(--me-accent-glow);
}
.di-doc-row:hover .di-el-btn {
  opacity: 1;
}
.di-doc-icon {
  color: var(--me-accent);
  flex-shrink: 0;
}
.di-doc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.di-doc-name {
  font-size: 13px;
  color: var(--me-accent);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.di-doc-name:hover {
  text-decoration: underline;
}
.di-doc-meta {
  font-size: 10px;
  color: var(--me-text-muted);
}
.di-uploading {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--me-text-muted);
  padding: 8px 0;
}

/* Edit mode switch */
.di-switch-field {
  flex: 1;
  display: flex;
  align-items: center;
}
</style>
