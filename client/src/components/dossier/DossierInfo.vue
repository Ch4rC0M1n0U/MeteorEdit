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
      <!-- HEADER: Icon/Logo + Title + Status -->
      <div class="di-section di-icon-section di-full-width">
        <div class="di-icon-display">
          <div v-if="dossierLogoUrl" class="di-logo-wrap">
            <img :src="dossierLogoUrl" alt="Logo" class="di-logo-img" />
            <button v-if="isOwner" class="di-logo-remove" @click="removeLogo" :title="$t('dossier.deleteLogo')">
              <v-icon size="12">mdi-close</v-icon>
            </button>
          </div>
          <v-icon v-else-if="form.icon" size="32" class="di-icon-large">{{ form.icon }}</v-icon>
          <v-icon v-else size="32" class="di-icon-large di-icon-default">mdi-folder-outline</v-icon>
          <div class="di-header-meta">
            <span class="di-header-title">{{ form.title || '—' }}</span>
            <span class="di-status-badge" :class="`di-status-${form.status}`">{{ statusLabel }}</span>
          </div>
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

      <!-- FULL WIDTH: Dates, Reference & Tags -->
      <div class="di-section di-full-width-section">
        <h3 class="di-section-title mono">
          <v-icon size="16" class="mr-2">mdi-calendar-clock</v-icon>
          {{ $t('dossier.datesReferenceTags') }}
        </h3>
        <div class="di-grid-4">
          <div class="di-field">
            <span class="di-label mono">
              <v-icon size="14" class="mr-1">mdi-identifier</v-icon>
              {{ $t('dossier.referenceNumber') }}
            </span>
            <span class="di-value">{{ form.referenceNumber || '—' }}</span>
          </div>
          <div class="di-field">
            <span class="di-label mono">{{ $t('dossier.arrivalDate') }}</span>
            <span class="di-value">{{ form.arrivalDate ? new Date(form.arrivalDate).toLocaleDateString(locale) : $t('dossier.noDate') }}</span>
          </div>
          <div class="di-field">
            <span class="di-label mono">{{ $t('dossier.attributionDate') }}</span>
            <span class="di-value">{{ form.attributionDate ? new Date(form.attributionDate).toLocaleDateString(locale) : $t('dossier.noDate') }}</span>
          </div>
          <div class="di-field">
            <span class="di-label mono">{{ $t('dossier.closureDate') }}</span>
            <span class="di-value">{{ form.closureDate ? new Date(form.closureDate).toLocaleDateString(locale) : $t('dossier.noDate') }}</span>
            <span v-if="!form.closureDate" class="di-hint mono">{{ $t('dossier.autoClosureDate') }}</span>
          </div>
        </div>
        <div class="di-field" style="margin-top: 12px;">
          <span class="di-label mono">{{ $t('dossier.tags') }}</span>
          <div v-if="localTags.length" class="di-tags-display">
            <v-chip v-for="tag in localTags" :key="tag" size="small" variant="tonal" color="primary" class="di-tag-chip">
              {{ tag }}
            </v-chip>
          </div>
          <span v-else class="di-value" style="opacity: 0.5;">—</span>
        </div>

        <!-- Duration warning alert -->
        <v-alert
          v-if="durationWarning"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-3 mb-2"
          style="font-size: 13px;"
        >
          {{ durationWarning }}
        </v-alert>
      </div>

      <!-- LEFT COLUMN: Facts, Objectives, Description -->
      <div class="di-section" v-if="form.judicialFacts || form.objectives || form.description">
        <div class="di-field" v-if="form.judicialFacts">
          <span class="di-label mono">{{ $t('dossier.judicialFacts') }}</span>
          <span class="di-value di-value-block">{{ form.judicialFacts }}</span>
        </div>
        <div class="di-field" v-if="form.objectives">
          <span class="di-label mono">{{ $t('dossier.objectives') }}</span>
          <div class="di-value di-value-rich" v-html="form.objectives" />
        </div>
        <div class="di-field" v-if="form.description">
          <span class="di-label mono">{{ $t('dossier.synthesis') }}</span>
          <div class="di-value di-value-rich" v-html="form.description" />
        </div>
      </div>

      <!-- FULL WIDTH: Classification + Investigator -->
      <div class="di-section di-full-width-section">
        <!-- Classification & Magistrat -->
        <h3 class="di-section-title mono">
          <v-icon size="16" class="mr-2">mdi-gavel</v-icon>
          {{ $t('dossier.classification') }} & {{ $t('dossier.magistrate') }}
        </h3>
        <div class="di-grid-4">
          <div class="di-field">
            <span class="di-label mono">{{ $t('dossier.classification') }}</span>
            <span class="di-classification-badge" :class="`di-class-${form.classification}`">{{ classificationLabel }}</span>
          </div>
          <div class="di-field">
            <span class="di-label mono">{{ $t('dossier.magistrate') }}</span>
            <span class="di-value">{{ form.magistrate || '—' }}</span>
          </div>
          <div class="di-field">
            <span class="di-label mono">{{ $t('dossier.isFirstRequest') }}</span>
            <span class="di-value">{{ form.isFirstRequest ? $t('dossier.firstRequest') : $t('dossier.subsequentRequest') }}</span>
          </div>
          <div class="di-field">
            <span class="di-label mono">{{ $t('dossier.dossierLanguage') }}</span>
            <span class="di-value">{{ form.dossierLanguage === 'nl' ? $t('dossier.langNl') : $t('dossier.langFr') }}</span>
          </div>
        </div>
        <div class="di-row di-flags-row" style="margin-top: 12px;">
          <span v-if="form.isUrgent" class="di-flag-badge di-flag-urgent">
            <v-icon size="14" class="mr-1">mdi-alert-circle-outline</v-icon>
            {{ $t('dossier.isUrgent') }}
          </span>
          <span v-if="form.isEmbargo" class="di-flag-badge di-flag-embargo">
            <v-icon size="14" class="mr-1">mdi-lock-clock</v-icon>
            {{ $t('dossier.isEmbargo') }}
          </span>
          <span v-if="form.isContinuous" class="di-flag-badge di-flag-continuous">
            <v-icon size="14" class="mr-1">mdi-infinity</v-icon>
            {{ $t('dossier.isContinuous') }}
          </span>
        </div>

        <!-- Enquêteur -->
        <h3 class="di-section-title mono" style="margin-top: 16px;">
          <v-icon size="16" class="mr-2">mdi-account-outline</v-icon>
          {{ $t('dossier.investigator') }}
        </h3>
        <div class="di-grid-4" style="align-items: start;">
          <div class="di-field"><span class="di-label mono">{{ $t('common.name') }}</span><span class="di-value">{{ form.investigator.name || '—' }}</span></div>
          <div class="di-field"><span class="di-label mono">{{ $t('dossier.service') }}</span><span class="di-value">{{ form.investigator.service || '—' }}</span></div>
          <div class="di-field"><span class="di-label mono">{{ $t('dossier.unit') }}</span><span class="di-value">{{ form.investigator.unit || '—' }}</span></div>
          <div class="di-field"><span class="di-label mono">{{ $t('dossier.phone') }}</span><span class="di-value"><a v-if="form.investigator.phone" :href="`tel:${form.investigator.phone}`" class="di-link">{{ form.investigator.phone }}</a><template v-else>—</template></span></div>
        </div>
        <div class="di-field" style="margin-top: 8px;">
          <span class="di-label mono">{{ $t('common.email') }}</span><span class="di-value"><a v-if="form.investigator.email" :href="`sip:${form.investigator.email}`" class="di-link">{{ form.investigator.email }}</a><template v-else>—</template></span>
        </div>
      </div>

      <!-- ENTITES (priorité haute) -->
      <div class="di-section di-full-width">
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
                  :src="getEntityPhotoUrl(photo)"
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

      <!-- COLLABORATEURS -->
      <div class="di-section di-full-width" v-if="dossierStore.currentDossier">
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

      <!-- DOCUMENTS LIES -->
      <div class="di-section di-full-width">
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
              <a href="#" class="di-doc-name" @click.prevent="downloadDecryptedDoc(doc)">{{ doc.fileName.endsWith('.enc') ? doc.fileName.slice(0, -4) : doc.fileName }}</a>
              <span class="di-doc-meta mono">{{ formatFileSize(doc.fileSize) }}</span>
            </div>
            <button v-if="isPreviewable(doc.fileName, doc)" class="di-el-btn" @click="openDocViewer(doc)" :title="$t('dossier.preview')">
              <v-icon size="14">{{ isAudioFile(doc) ? 'mdi-volume-high' : 'mdi-eye-outline' }}</v-icon>
            </button>
            <button class="di-el-btn" @click="downloadDecryptedDoc(doc)" :title="$t('dossier.download')">
              <v-icon size="14">mdi-download</v-icon>
            </button>
            <button class="di-el-btn" @click="transferDoc(doc)" :title="getTransferTooltip(doc)" :disabled="transferringDocId === doc._id">
              <v-icon v-if="transferringDocId === doc._id" size="14" class="spin">mdi-loading</v-icon>
              <v-icon v-else size="14">mdi-file-move-outline</v-icon>
            </button>
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

      <!-- CHIFFREMENT E2E (toujours actif, en dernier) -->
      <div class="di-section di-full-width" v-if="dossierStore.currentDossier">
        <div class="di-section-header">
          <h3 class="di-section-title mono">
            <v-icon size="16" class="mr-2">mdi-lock-outline</v-icon>
            {{ $t('dossier.encryption') }}
          </h3>
        </div>
        <p class="di-encryption-info mono">
          <v-icon size="14" class="mr-1" color="success">mdi-shield-check-outline</v-icon>
          {{ $t('dossier.encryptionActive') }}
        </p>
      </div>
    </div>

    <!-- MODE EDITION -->
    <v-form v-else @submit.prevent="handleSave" class="di-edit-form fade-in">
      <!-- Header : Titre + Statut + Flags -->
      <div class="di-section">
        <div class="di-edit-header">
          <v-text-field v-model="form.title" :label="$t('dossier.dossierTitle')" density="compact" hide-details class="di-edit-title-field" />
          <div class="di-edit-meta">
            <div class="di-status-select-wrap">
              <div class="di-status-select" @click="showStatusDropdown = !showStatusDropdown" tabindex="0" @blur="showStatusDropdown = false">
                <span class="di-status-dot" :class="`di-dot-${form.status}`" />
                <span>{{ statusLabel }}</span>
                <v-icon size="14" class="di-status-chevron" :class="{ 'di-chevron-open': showStatusDropdown }">mdi-chevron-down</v-icon>
              </div>
              <div v-if="showStatusDropdown" class="di-status-dropdown">
                <div v-for="opt in statusOptions" :key="opt.value" class="di-status-option" :class="{ 'di-status-option-active': form.status === opt.value }" @mousedown.prevent="form.status = opt.value; showStatusDropdown = false">
                  <span class="di-status-dot" :class="`di-dot-${opt.value}`" />
                  {{ opt.title }}
                </div>
              </div>
            </div>
            <button type="button" class="di-flag-toggle" :class="{ 'di-flag-toggle-active di-flag-urgent-active': form.isUrgent }" @click="form.isUrgent = !form.isUrgent">
              <v-icon size="14">mdi-alert-circle-outline</v-icon>
              {{ $t('dossier.isUrgent') }}
            </button>
            <button type="button" class="di-flag-toggle" :class="{ 'di-flag-toggle-active di-flag-embargo-active': form.isEmbargo }" @click="toggleEmbargo(!form.isEmbargo)">
              <v-icon size="14">mdi-lock-clock</v-icon>
              {{ $t('dossier.isEmbargo') }}
            </button>
            <button type="button" class="di-flag-toggle" :class="{ 'di-flag-toggle-active di-flag-continuous-active': form.isContinuous }" @click="form.isContinuous = !form.isContinuous">
              <v-icon size="14">mdi-infinity</v-icon>
              {{ $t('dossier.isContinuous') }}
            </button>
          </div>
        </div>
        <v-textarea v-model="form.judicialFacts" :label="$t('dossier.judicialFacts')" rows="2" density="compact" class="mt-3" hide-details />
      </div>

      <!-- Objectifs + Description côte à côte -->
      <div class="di-edit-row">
        <MiniEditor v-model="form.objectives" :label="$t('dossier.objectives')" :placeholder="$t('dossier.objectives')" />
        <MiniEditor v-model="form.description" :label="$t('dossier.synthesis')" :placeholder="$t('dossier.synthesis')" />
      </div>

      <!-- Dates, Référence & Tags (edit mode) -->
      <div class="di-section di-full-width">
        <h3 class="di-section-title mono">
          <v-icon size="16" class="mr-2">mdi-calendar-clock</v-icon>
          {{ $t('dossier.datesReferenceTags') }}
        </h3>
        <div class="di-grid-4">
          <div class="di-date-field">
            <v-text-field
              v-model="form.referenceNumber"
              :label="$t('dossier.referenceNumber')"
              density="compact"
              prepend-inner-icon="mdi-identifier"
              hide-details
            />
          </div>
          <div class="di-date-field">
            <label class="di-date-label mono">{{ $t('dossier.arrivalDate') }}</label>
            <input type="date" v-model="form.arrivalDate" class="di-date-input" />
          </div>
          <div class="di-date-field">
            <label class="di-date-label mono">{{ $t('dossier.attributionDate') }}</label>
            <input type="date" v-model="form.attributionDate" class="di-date-input" />
          </div>
          <div class="di-date-field">
            <label class="di-date-label mono">{{ $t('dossier.closureDate') }}</label>
            <input type="date" v-model="form.closureDate" class="di-date-input" />
            <span class="di-hint mono">{{ $t('dossier.autoClosureDate') }}</span>
          </div>
        </div>
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
          class="mt-3"
          @update:model-value="saveTags"
        />
      </div>

      <!-- Classification + Enquêteur côte à côte -->
      <div class="di-edit-row">
        <div class="di-section">
          <h3 class="di-section-title mono">
            <v-icon size="16" class="mr-2">mdi-gavel</v-icon>
            {{ $t('dossier.classification') }}
          </h3>
          <div class="di-row">
            <v-select v-model="form.classification" :items="classificationOptions" :label="$t('dossier.classification')" density="compact" />
            <v-text-field v-model="form.magistrate" :label="$t('dossier.magistrate')" density="compact" />
          </div>
          <div class="di-edit-bottom-row">
            <div class="di-lang-options">
              <button type="button" class="di-lang-btn" :class="{ 'di-lang-btn-active': form.dossierLanguage === 'fr' }" @click="form.dossierLanguage = 'fr'">
                <svg viewBox="0 0 640 480" width="18" height="13"><path fill="#002395" d="M0 0h213.3v480H0z"/><path fill="#fff" d="M213.3 0h213.4v480H213.3z"/><path fill="#ed2939" d="M426.7 0H640v480H426.7z"/></svg>
                FR
              </button>
              <button type="button" class="di-lang-btn" :class="{ 'di-lang-btn-active': form.dossierLanguage === 'nl' }" @click="form.dossierLanguage = 'nl'">
                <svg viewBox="0 0 640 480" width="18" height="13"><path fill="#21468b" d="M0 320h640v160H0z"/><path fill="#fff" d="M0 160h640v160H0z"/><path fill="#ae1c28" d="M0 0h640v160H0z"/></svg>
                NL
              </button>
            </div>
            <v-switch v-model="form.isFirstRequest" :label="form.isFirstRequest ? $t('dossier.firstRequest') : $t('dossier.subsequentRequest')" color="primary" density="compact" hide-details />
          </div>
        </div>

        <div class="di-section">
          <h3 class="di-section-title mono">
            <v-icon size="16" class="mr-2">mdi-account-outline</v-icon>
            {{ $t('dossier.investigator') }}
          </h3>
          <div class="di-row">
            <v-text-field v-model="form.investigator.name" :label="$t('common.name')" density="compact" />
            <v-text-field v-model="form.investigator.service" :label="$t('dossier.service')" density="compact" />
          </div>
          <div class="di-row">
            <v-text-field v-model="form.investigator.unit" :label="$t('dossier.unit')" density="compact" />
            <v-text-field v-model="form.investigator.phone" :label="$t('dossier.phone')" density="compact" />
          </div>
          <v-text-field v-model="form.investigator.email" :label="$t('common.email')" density="compact" />
        </div>
      </div>

      <!-- Actions -->
      <div class="di-actions">
        <button type="button" class="me-btn-ghost" @click="cancelEdit">{{ $t('common.cancel') }}</button>
        <button type="button" class="me-btn-primary" @click="handleSave">
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
                <img :src="getEntityPhotoUrl(photo)" class="di-entity-photo-img" />
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

    <!-- Document Viewer Dialog -->
    <v-dialog v-model="docViewerOpen" max-width="900" content-class="di-viewer-dialog">
      <div class="glass-card di-viewer-card">
        <div class="di-viewer-header">
          <div class="di-viewer-title-row">
            <v-icon size="18" class="mr-2">{{ docViewerDoc ? docIcon(docViewerDoc.fileName) : 'mdi-file' }}</v-icon>
            <span class="di-viewer-title">{{ docViewerDoc?.fileName }}</span>
          </div>
          <div class="di-viewer-actions">
            <template v-if="docViewerType === 'image'">
              <button class="me-btn-ghost me-btn-sm me-btn-icon" @click="zoomOut" :title="$t('dossier.zoomOut')" :disabled="viewerZoom <= 0.25">
                <v-icon size="16">mdi-minus</v-icon>
              </button>
              <span class="di-viewer-zoom-label mono">{{ Math.round(viewerZoom * 100) }}%</span>
              <button class="me-btn-ghost me-btn-sm me-btn-icon" @click="zoomIn" :title="$t('dossier.zoomIn')" :disabled="viewerZoom >= 5">
                <v-icon size="16">mdi-plus</v-icon>
              </button>
              <button class="me-btn-ghost me-btn-sm me-btn-icon" @click="zoomReset" :title="$t('dossier.zoomReset')">
                <v-icon size="16">mdi-fit-to-screen-outline</v-icon>
              </button>
            </template>
            <button class="me-btn-ghost me-btn-sm" @click="downloadDecryptedDoc(docViewerDoc!)" :title="$t('dossier.download')">
              <v-icon size="16" class="mr-1">mdi-download</v-icon>
              {{ $t('dossier.download') }}
            </button>
            <button class="me-btn-ghost me-btn-sm me-btn-icon" @click="docViewerOpen = false">
              <v-icon size="16">mdi-close</v-icon>
            </button>
          </div>
        </div>
        <div class="di-viewer-body" ref="viewerBodyRef" @wheel.prevent="onViewerWheel">
          <div v-if="docViewerLoading" class="di-viewer-loading">
            <v-progress-circular indeterminate size="40" width="3" />
          </div>
          <template v-else-if="docViewerUrl">
            <div
              v-if="docViewerType === 'image'"
              class="di-viewer-image-wrapper"
              :style="viewerImgBaseW ? { width: `${viewerImgBaseW * viewerZoom}px`, height: `${viewerImgBaseH * viewerZoom}px` } : undefined"
            >
              <img
                :src="docViewerUrl"
                class="di-viewer-image"
                :style="viewerImgBaseW ? { width: `${viewerImgBaseW * viewerZoom}px`, height: `${viewerImgBaseH * viewerZoom}px`, cursor: viewerZoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default' } : { maxWidth: '100%', maxHeight: '75vh' }"
                draggable="false"
                @mousedown.prevent="onPanStart"
                @load="onViewerImgLoad"
              />
            </div>
            <iframe v-else-if="docViewerType === 'pdf'" :src="docViewerUrl" class="di-viewer-pdf" />
            <video v-else-if="docViewerType === 'video'" :src="docViewerUrl" controls class="di-viewer-video" />
            <audio v-else-if="docViewerType === 'audio'" :src="docViewerUrl" controls class="di-viewer-audio" />
          </template>
        </div>
      </div>
    </v-dialog>

    <!-- AI Enrichment streaming dialog -->
    <v-dialog v-model="enrichDialog" max-width="640" persistent>
      <div class="glass-card dialog-card">
        <div class="dialog-header">
          <h3 class="mono">
            <v-icon size="18" class="mr-1">mdi-robot-outline</v-icon>
            {{ $t('dossier.enrichAITitle') }}
          </h3>
          <button class="me-close-btn" @click="closeEnrichDialog" :disabled="enrichStreaming">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>

        <!-- Logs -->
        <div v-if="enrichLogs.length" class="enrich-logs-panel">
          <div class="enrich-logs-header" @click="enrichLogsExpanded = !enrichLogsExpanded">
            <v-icon size="14" class="mr-1" :class="{ 'spin': enrichStreaming }">{{ enrichStreaming ? 'mdi-loading' : 'mdi-console' }}</v-icon>
            <span class="mono">Logs</span>
            <span class="enrich-log-count mono">{{ enrichLogs.length }}</span>
            <v-icon size="14" class="ml-auto">{{ enrichLogsExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
          </div>
          <div v-if="enrichLogsExpanded" class="enrich-logs-content" ref="enrichLogsRef">
            <div v-for="(log, i) in enrichLogs" :key="i" class="enrich-log-line mono">
              <span class="enrich-log-time">{{ log.time }}</span>
              <span :class="['enrich-log-msg', log.type === 'error' ? 'enrich-log-error' : '']">{{ log.message }}</span>
            </div>
          </div>
        </div>

        <!-- Streaming content -->
        <div class="dialog-body enrich-body" ref="enrichBodyRef">
          <div v-if="enrichStreaming && !enrichContent" class="enrich-generating">
            <v-progress-circular indeterminate size="28" color="var(--me-accent)" />
            <p>{{ $t('dossier.enrichPreparing') }}</p>
          </div>

          <div v-if="enrichContent" class="enrich-content">
            <div class="enrich-meta mono">
              <span>{{ enrichEntityName }} ({{ enrichEntityType }})</span>
              <span v-if="enrichTokenCount" class="ml-auto">{{ enrichTokenCount }} tokens</span>
            </div>
            <pre class="enrich-text">{{ enrichContent }}<span v-if="enrichStreaming" class="enrich-cursor">|</span></pre>
          </div>

          <div v-if="enrichError" class="enrich-error">
            <v-icon size="20" color="#f87171" class="mr-2">mdi-alert-circle-outline</v-icon>
            {{ enrichError }}
          </div>
        </div>

        <div class="dialog-footer">
          <button v-if="enrichStreaming" class="enrich-cancel-btn" @click="cancelEnrich">
            <v-icon size="14" class="mr-1">mdi-stop-circle-outline</v-icon>
            {{ $t('dossier.stopEnrichment') }}
          </button>
          <div v-else class="enrich-footer-actions">
            <button class="me-btn-ghost" @click="closeEnrichDialog">{{ $t('common.close') }}</button>
            <button v-if="enrichContent && !enrichError" class="me-btn-primary" @click="applyEnrichResult">
              <v-icon size="14" class="mr-1">mdi-check</v-icon>
              {{ $t('dossier.applyEnrichment') }}
            </button>
          </div>
        </div>
      </div>
    </v-dialog>
    <AiDisclaimerModal ref="disclaimerModal" />
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDossierStore } from '../../stores/dossier';
import { useAuthStore } from '../../stores/auth';
import { useEncryptionStore } from '../../stores/encryption';
import api, { SERVER_URL } from '../../services/api';
import { getSocket } from '../../services/socket';
import AiDisclaimerModal from '../AiDisclaimerModal.vue';
import type { CollaboratorUser } from '../../types';
import { DOSSIER_ICONS } from '../../constants/dossierIcons';
import { useConfirm } from '../../composables/useConfirm';
import { useEncryptedUpload } from '../../composables/useEncryptedUpload';
import { useDecryptedFile } from '../../composables/useDecryptedFile';
import MiniEditor from '../editor/MiniEditor.vue';

const { t, locale } = useI18n();
const { confirm: customConfirm } = useConfirm();
const dossierStore = useDossierStore();
const authStore = useAuthStore();
const encryptionStore = useEncryptionStore();
const { uploadEncryptedFile } = useEncryptedUpload();
const { getDecryptedUrl } = useDecryptedFile();

const disclaimerModal = ref<InstanceType<typeof AiDisclaimerModal> | null>(null);
const aiConfig = ref<{ isCommercial: boolean; disclaimerMessage: string } | null>(null);
const disclaimerDismissed = ref(false);

const editing = ref(false);
const showStatusDropdown = ref(false);
const entityDialog = ref(false);
const copiedIndex = ref<number | null>(null);
const editingEntityIndex = ref<number | null>(null);
const showIconPicker = ref(false);
const logoInput = ref<HTMLInputElement | null>(null);
const dossierIcons = DOSSIER_ICONS;

const dossierLogoUrl = ref<string | null>(null);

watch(() => dossierStore.currentDossier?.logoPath, async (logoPath) => {
  if (!logoPath) {
    dossierLogoUrl.value = null;
    return;
  }
  const d = dossierStore.currentDossier;
  if (d && logoPath.includes('uploads/')) {
    try {
      dossierLogoUrl.value = await getDecryptedUrl(d._id, logoPath, 'image/png');
    } catch {
      // Only fall back to direct URL for non-encrypted files
      if (!logoPath.includes('.enc')) {
        dossierLogoUrl.value = `${SERVER_URL}/${logoPath}`;
      }
    }
  } else {
    dossierLogoUrl.value = `${SERVER_URL}/${logoPath}`;
  }
}, { immediate: true });

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
  isContinuous: false,
  magistrate: '',
  isFirstRequest: true,
  dossierLanguage: 'fr' as 'fr' | 'nl',
  referenceNumber: '',
  arrivalDate: '',
  attributionDate: '',
  closureDate: '',
  linkedDocuments: [] as { _id: string; fileName: string; filePath: string; fileSize: number; originalContentType?: string; uploadedAt: string }[],
});

const newEntity = reactive({ name: '', type: '', description: '', photos: [] as string[] });
const entityPhotoInput = ref<HTMLInputElement | null>(null);
const uploadingEntityPhoto = ref(false);

// Decrypted entity photo URLs cache
const decryptedPhotoUrls = ref<Record<string, string>>({});

function getEntityPhotoUrl(photo: string): string {
  const cached = decryptedPhotoUrls.value[photo];
  if (cached) return cached;
  // Trigger async decryption
  decryptEntityPhoto(photo);
  // Return 1x1 transparent pixel while decrypting (encrypted .enc files can't be served as images)
  return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
}

async function decryptEntityPhoto(photo: string) {
  if (decryptedPhotoUrls.value[photo]) return;
  const d = dossierStore.currentDossier;
  if (!d) return;
  try {
    const url = await getDecryptedUrl(d._id, photo, 'image/png');
    decryptedPhotoUrls.value[photo] = url;
  } catch {
    // Fallback: only use direct URL for non-encrypted files
    if (!photo.includes('.enc')) {
      decryptedPhotoUrls.value[photo] = `${SERVER_URL}/${photo}`;
    }
    // For .enc files, leave uncached — encrypted binary can't be displayed as image
  }
}

function getDocDownloadUrl(filePath: string): string {
  return `${SERVER_URL}/${filePath}`;
}

async function downloadDecryptedDoc(doc: { fileName: string; filePath: string }) {
  const d = dossierStore.currentDossier;
  if (!d) return;
  try {
    const url = await getDecryptedUrl(d._id, doc.filePath, 'application/octet-stream');
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.fileName.endsWith('.enc') ? doc.fileName.slice(0, -4) : doc.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    // Fallback: open direct URL
    window.open(`${SERVER_URL}/${doc.filePath}`, '_blank');
  }
}

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

// Dossier duration alerts
const dossierAlerts = ref<{ routine: number; priority: number; urgent: number; routineMessage: string; priorityMessage: string; urgentMessage: string }>({
  routine: 30, priority: 14, urgent: 7, routineMessage: '', priorityMessage: '', urgentMessage: '',
});

const durationWarning = computed(() => {
  if (form.status === 'closed' || !form.attributionDate || form.isContinuous) return '';
  const arrival = new Date(form.attributionDate);
  const now = new Date();
  const days = Math.floor((now.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return '';

  let threshold = dossierAlerts.value.routine;
  let classLabel = t('dossier.classificationRoutine');
  if (form.isUrgent) {
    threshold = dossierAlerts.value.urgent;
    classLabel = t('dossier.isUrgent');
  } else if (form.classification === 'priority') {
    threshold = dossierAlerts.value.priority;
    classLabel = t('dossier.classificationPriority');
  }

  if (days <= threshold) return '';

  if (form.isUrgent) {
    return dossierAlerts.value.urgentMessage || t('dossier.durationWarningUrgent', { days, threshold });
  }
  return t('dossier.durationWarning', { days, threshold, classification: classLabel });
});

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
    form.isContinuous = !!d.isContinuous;
    form.magistrate = d.magistrate || '';
    form.isFirstRequest = d.isFirstRequest !== undefined ? d.isFirstRequest : true;
    form.dossierLanguage = d.dossierLanguage || 'fr';
    form.referenceNumber = d.referenceNumber || '';
    form.arrivalDate = d.arrivalDate ? d.arrivalDate.substring(0, 10) : '';
    form.attributionDate = d.attributionDate ? d.attributionDate.substring(0, 10) : '';
    form.closureDate = d.closureDate ? d.closureDate.substring(0, 10) : '';
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
  // Notify collaborators
  getSocket()?.emit('dossier-update', { dossierId: updated._id, dossier: updated });
}

async function handleLogoUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file || !dossierStore.currentDossier) return;
  const dossierId = dossierStore.currentDossier._id;
  try {
    const { data } = await uploadEncryptedFile(dossierId, file, `/dossiers/${dossierId}/logo`, 'logo');
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
  const dossierId = dossierStore.currentDossier._id;
  uploadingDoc.value = true;
  try {
    for (const file of Array.from(files)) {
      const { data } = await uploadEncryptedFile(dossierId, file, `/dossiers/${dossierId}/documents`, 'document');
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
    message: t('dossier.deleteDocumentConfirm', { name: doc.fileName }),
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

// Document viewer
const docViewerOpen = ref(false);
const docViewerDoc = ref<{ fileName: string; filePath: string } | null>(null);
const docViewerUrl = ref<string | null>(null);
const docViewerLoading = ref(false);
const docViewerType = ref<'image' | 'pdf' | 'video' | 'audio'>('image');

const PREVIEW_IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const PREVIEW_PDF_EXTS = ['pdf'];
const PREVIEW_VIDEO_EXTS = ['mp4', 'webm', 'ogg'];
const PREVIEW_AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];

function getFileExt(fileName: string): string {
  // Strip .enc suffix to get the real file extension
  const name = fileName.endsWith('.enc') ? fileName.slice(0, -4) : fileName;
  return name.split('.').pop()?.toLowerCase() || '';
}

function isPreviewable(fileName: string, doc?: { originalContentType?: string }): boolean {
  // If we have originalContentType metadata from encrypted upload, use it
  if (doc?.originalContentType) {
    const ct = doc.originalContentType;
    return ct.startsWith('image/') || ct === 'application/pdf' || ct.startsWith('video/') || ct.startsWith('audio/');
  }
  const ext = getFileExt(fileName);
  return [...PREVIEW_IMAGE_EXTS, ...PREVIEW_PDF_EXTS, ...PREVIEW_VIDEO_EXTS, ...PREVIEW_AUDIO_EXTS].includes(ext);
}

function getContentType(fileName: string, doc?: { originalContentType?: string }): string {
  // Use stored originalContentType if available (encrypted uploads)
  if (doc?.originalContentType) return doc.originalContentType;
  const ext = getFileExt(fileName);
  if (PREVIEW_IMAGE_EXTS.includes(ext)) return ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'ogg') return 'audio/ogg';
  return 'application/octet-stream';
}

// --- Transfer document to node ---
const transferringDocId = ref<string | null>(null);

function getTransferTarget(doc: { fileName: string; originalContentType?: string }): string {
  const ext = getFileExt(doc.fileName);
  const ct = doc.originalContentType || '';
  if (ct.startsWith('image/') || PREVIEW_IMAGE_EXTS.includes(ext)) return 'note';
  if (ct.startsWith('audio/') || PREVIEW_AUDIO_EXTS.includes(ext)) return 'media';
  if (ct.startsWith('video/') || PREVIEW_VIDEO_EXTS.includes(ext)) return 'media';
  return 'document';
}

function getTransferTooltip(doc: { fileName: string; originalContentType?: string }): string {
  const target = getTransferTarget(doc);
  const key = 'dossier.transferTo' + target.charAt(0).toUpperCase() + target.slice(1);
  return t(key);
}

async function transferDoc(doc: { _id: string; fileName: string }) {
  if (!dossierStore.currentDossier || transferringDocId.value) return;
  transferringDocId.value = doc._id;
  try {
    const dossierId = dossierStore.currentDossier._id;
    const { data } = await api.post(`/dossiers/${dossierId}/documents/${doc._id}/transfer`);
    await dossierStore.createNode(data.nodeData);
    await dossierStore.openDossier(dossierId);
  } catch (err) {
    console.error('Failed to transfer document:', err);
  } finally {
    transferringDocId.value = null;
  }
}

function isAudioFile(doc: { fileName: string; originalContentType?: string }): boolean {
  const ct = doc.originalContentType || '';
  if (ct.startsWith('audio/')) return true;
  return PREVIEW_AUDIO_EXTS.includes(getFileExt(doc.fileName));
}

const viewerZoom = ref(1);
const viewerBodyRef = ref<HTMLElement | null>(null);
const viewerImgNatW = ref(0);
const viewerImgNatH = ref(0);
const viewerImgBaseW = ref(0);
const viewerImgBaseH = ref(0);

function onViewerImgLoad(e: Event) {
  const img = e.target as HTMLImageElement;
  viewerImgNatW.value = img.naturalWidth;
  viewerImgNatH.value = img.naturalHeight;
  // Compute fitted size at zoom=1 based on container
  const body = viewerBodyRef.value;
  if (body) {
    const maxW = body.clientWidth - 16;
    const maxH = body.clientHeight - 16;
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    viewerImgBaseW.value = Math.round(img.naturalWidth * ratio);
    viewerImgBaseH.value = Math.round(img.naturalHeight * ratio);
  } else {
    viewerImgBaseW.value = img.naturalWidth;
    viewerImgBaseH.value = img.naturalHeight;
  }
}

function zoomIn() { viewerZoom.value = Math.min(5, viewerZoom.value + 0.25); }
function zoomOut() { viewerZoom.value = Math.max(0.25, viewerZoom.value - 0.25); }
function zoomReset() { viewerZoom.value = 1; }
function onViewerWheel(e: WheelEvent) {
  if (docViewerType.value !== 'image') return;
  if (e.deltaY < 0) zoomIn();
  else zoomOut();
}

// Pan (drag to scroll) when zoomed in
const isPanning = ref(false);
let panStartX = 0;
let panStartY = 0;
let panScrollLeft = 0;
let panScrollTop = 0;

function onPanStart(e: MouseEvent) {
  if (viewerZoom.value <= 1 || !viewerBodyRef.value) return;
  isPanning.value = true;
  panStartX = e.clientX;
  panStartY = e.clientY;
  panScrollLeft = viewerBodyRef.value.scrollLeft;
  panScrollTop = viewerBodyRef.value.scrollTop;
  document.addEventListener('mousemove', onPanMove);
  document.addEventListener('mouseup', onPanEnd);
}

function onPanMove(e: MouseEvent) {
  if (!isPanning.value || !viewerBodyRef.value) return;
  viewerBodyRef.value.scrollLeft = panScrollLeft - (e.clientX - panStartX);
  viewerBodyRef.value.scrollTop = panScrollTop - (e.clientY - panStartY);
}

function onPanEnd() {
  isPanning.value = false;
  document.removeEventListener('mousemove', onPanMove);
  document.removeEventListener('mouseup', onPanEnd);
}

async function openDocViewer(doc: { fileName: string; filePath: string; originalContentType?: string }) {
  const d = dossierStore.currentDossier;
  if (!d) return;

  docViewerDoc.value = doc;
  docViewerUrl.value = null;
  docViewerLoading.value = true;
  viewerZoom.value = 1;
  viewerImgBaseW.value = 0;
  viewerImgBaseH.value = 0;
  docViewerOpen.value = true;

  // Detect type from originalContentType (encrypted) or file extension
  const ct = doc.originalContentType || '';
  const ext = getFileExt(doc.fileName);
  if (ct.startsWith('image/') || PREVIEW_IMAGE_EXTS.includes(ext)) docViewerType.value = 'image';
  else if (ct === 'application/pdf' || PREVIEW_PDF_EXTS.includes(ext)) docViewerType.value = 'pdf';
  else if (ct.startsWith('video/') || PREVIEW_VIDEO_EXTS.includes(ext)) docViewerType.value = 'video';
  else if (ct.startsWith('audio/') || PREVIEW_AUDIO_EXTS.includes(ext)) docViewerType.value = 'audio';

  try {
    docViewerUrl.value = await getDecryptedUrl(d._id, doc.filePath, getContentType(doc.fileName, doc));
  } catch {
    docViewerUrl.value = `${SERVER_URL}/${doc.filePath}`;
  } finally {
    docViewerLoading.value = false;
  }
}

function docIcon(fileName: string): string {
  const ext = getFileExt(fileName);
  const map: Record<string, string> = {
    pdf: 'mdi-file-pdf-box',
    doc: 'mdi-file-word-box', docx: 'mdi-file-word-box',
    xls: 'mdi-file-excel-box', xlsx: 'mdi-file-excel-box',
    ppt: 'mdi-file-powerpoint-box', pptx: 'mdi-file-powerpoint-box',
    jpg: 'mdi-file-image', jpeg: 'mdi-file-image', png: 'mdi-file-image', gif: 'mdi-file-image', webp: 'mdi-file-image', bmp: 'mdi-file-image', svg: 'mdi-file-image',
    mp3: 'mdi-file-music', wav: 'mdi-file-music', ogg: 'mdi-file-music', aac: 'mdi-file-music', m4a: 'mdi-file-music', flac: 'mdi-file-music', opus: 'mdi-file-music',
    mp4: 'mdi-file-video', webm: 'mdi-file-video', mov: 'mdi-file-video', avi: 'mdi-file-video', mkv: 'mdi-file-video',
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

// Auto-fill closureDate when status changes to closed
watch(() => form.status, (newStatus) => {
  if (newStatus === 'closed' && !form.closureDate) {
    form.closureDate = new Date().toISOString().substring(0, 10);
  }
});

watch(() => dossierStore.currentDossier?.tags, (tags) => {
  localTags.value = tags || [];
}, { immediate: true });

async function loadAiConfig() {
  try {
    const { data } = await api.get('/ai/config');
    aiConfig.value = data;
    // Load user preferences for dismissed state
    const prefsRes = await api.get('/auth/preferences');
    disclaimerDismissed.value = !!prefsRes.data.aiDisclaimerDismissed;
  } catch { /* ignore */ }
}

onMounted(async () => {
  try {
    const { data } = await api.get('/dossiers/tags');
    availableTags.value = data;
  } catch (e) {
    console.error('Failed to load tags:', e);
  }
  loadAiConfig();
  // Load dossier alert thresholds from settings
  try {
    const { data: settings } = await api.get('/admin/settings');
    if (settings?.dossierAlerts) {
      dossierAlerts.value = { ...dossierAlerts.value, ...settings.dossierAlerts };
    }
  } catch { /* ignore - use defaults */ }
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
      variant: 'warning',
    });
    if (!confirmed) return;
    form.isEmbargo = true;

    // Sauvegarder isEmbargo immédiatement en base
    await dossierStore.updateDossier(dossierId, { isEmbargo: true });
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

  const dossierId = dossierStore.currentDossier._id;
  uploadingEntityPhoto.value = true;
  try {
    for (const file of Array.from(files)) {
      const { data } = await uploadEncryptedFile(
        dossierId,
        file,
        `/dossiers/${dossierId}/entities/${entityIndex}/photo`,
        'photo',
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

// --- Enrichissement AI (streaming SSE) ---
const enrichingIndex = ref<number | null>(null);
const enrichDialog = ref(false);
const enrichStreaming = ref(false);
const enrichContent = ref('');
const enrichError = ref('');
const enrichTokenCount = ref(0);
const enrichEntityName = ref('');
const enrichEntityType = ref('');
const enrichLogs = ref<Array<{ time: string; message: string; type: string }>>([]);
const enrichLogsExpanded = ref(true);
const enrichBodyRef = ref<HTMLElement | null>(null);
const enrichLogsRef = ref<HTMLElement | null>(null);
let enrichAbortController: AbortController | null = null;

function enrichLogTime() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function enrichEntityAI(index: number) {
  if (!dossierStore.currentDossier || enrichStreaming.value) return;
  const entity = form.entities[index];
  if (!entity) return;

  // Check disclaimer for commercial AI
  if (aiConfig.value?.isCommercial && disclaimerModal.value) {
    const proceed = await disclaimerModal.value.checkAndShow(
      aiConfig.value.disclaimerMessage,
      disclaimerDismissed.value
    );
    if (!proceed) return;
    disclaimerDismissed.value = true;
  }


  enrichingIndex.value = index;
  enrichDialog.value = true;
  enrichStreaming.value = true;
  enrichContent.value = '';
  enrichError.value = '';
  enrichTokenCount.value = 0;
  enrichEntityName.value = entity.name;
  enrichEntityType.value = entity.type;
  enrichLogs.value = [];
  enrichLogsExpanded.value = true;

  enrichAbortController = new AbortController();
  const token = localStorage.getItem('accessToken');
  const dossierId = dossierStore.currentDossier._id;

  enrichLogs.value.push({ time: enrichLogTime(), message: t('dossier.enrichSending'), type: 'info' });

  try {
    const response = await fetch(`${SERVER_URL}/api/ai/enrich-entity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ dossierId, entityIndex: index }),
      signal: enrichAbortController.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));

          if (event.type === 'token') {
            enrichContent.value += event.token;
            enrichTokenCount.value = event.tokenCount;
            if (enrichBodyRef.value) {
              enrichBodyRef.value.scrollTop = enrichBodyRef.value.scrollHeight;
            }
          } else if (event.type === 'log') {
            enrichLogs.value.push({ time: enrichLogTime(), message: event.message, type: 'info' });
            scrollEnrichLogs();
          } else if (event.type === 'done') {
            // Server already saved, update local form
            form.entities[index].description = event.description;
            enrichLogs.value.push({ time: enrichLogTime(), message: t('dossier.enrichDone'), type: 'info' });
            enrichLogsExpanded.value = false;
          } else if (event.type === 'error') {
            enrichError.value = event.message;
            enrichLogs.value.push({ time: enrichLogTime(), message: event.message, type: 'error' });
          } else if (event.type === 'cancelled') {
            enrichLogs.value.push({ time: enrichLogTime(), message: t('dossier.enrichCancelled'), type: 'error' });
          }
        } catch {
          // skip malformed events
        }
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      enrichLogs.value.push({ time: enrichLogTime(), message: t('dossier.enrichCancelled'), type: 'error' });
    } else {
      enrichError.value = `Erreur: ${err.message}`;
      enrichLogs.value.push({ time: enrichLogTime(), message: `Erreur: ${err.message}`, type: 'error' });
    }
  } finally {
    enrichStreaming.value = false;
    enrichAbortController = null;
    enrichingIndex.value = null;
  }
}

function scrollEnrichLogs() {
  setTimeout(() => {
    if (enrichLogsRef.value) enrichLogsRef.value.scrollTop = enrichLogsRef.value.scrollHeight;
  }, 50);
}

async function cancelEnrich() {
  if (enrichAbortController) enrichAbortController.abort();
  if (dossierStore.currentDossier && enrichingIndex.value !== null) {
    try {
      await api.post('/ai/enrich-entity/cancel', {
        dossierId: dossierStore.currentDossier._id,
        entityIndex: enrichingIndex.value,
      });
    } catch {
      // best-effort
    }
  }
}

function closeEnrichDialog() {
  if (enrichStreaming.value) return;
  enrichDialog.value = false;
}

function applyEnrichResult() {
  // Description already updated by 'done' event, just close
  enrichDialog.value = false;
}

// --- Chiffrement E2E (toujours actif, plus de toggle) ---

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

    // Share the encryption key with the new collaborator
    if (encryptionStore.isUnlocked) {
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

    // Remove the collaborator's encryption key
    try {
      await api.delete(`/encryption/dossier/${dossierStore.currentDossier._id}/key/${userId}`);
    } catch (err) {
      console.warn('Could not remove encryption key for collaborator:', err);
    }
  } catch (e) {
    console.error('Failed to remove collaborator:', e);
  }
}
</script>

<style scoped>
.dossier-info {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 32px;
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
  margin-bottom: 16px;
}
.di-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.di-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
@media (min-width: 1200px) {
  .di-form {
    grid-template-columns: 1fr 1fr;
  }
}
.di-full-width {
  grid-column: 1 / -1;
}
.di-section {
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius);
  padding: 16px;
}
.di-tags-display {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.di-tag-chip {
  font-size: 12px;
  letter-spacing: 0.3px;
}
.di-full-width-section {
  grid-column: 1 / -1;
}
.di-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 768px) {
  .di-grid-4 { grid-template-columns: repeat(2, 1fr); }
}
.di-sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.di-header-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}
.di-header-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--me-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.di-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
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
  margin-bottom: 12px;
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
.di-link {
  color: var(--me-accent);
  text-decoration: none;
  transition: opacity 0.15s;
}
.di-link:hover {
  text-decoration: underline;
  opacity: 0.85;
}
.di-value-block {
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--me-text-secondary);
  font-size: 13px;
}
.di-value-rich {
  line-height: 1.6;
  color: var(--me-text-secondary);
  font-size: 13px;
}
.di-value-rich :deep(p) {
  margin: 0 0 4px;
}
.di-value-rich :deep(ul),
.di-value-rich :deep(ol) {
  padding-left: 20px;
  margin: 4px 0;
}
.di-value-rich :deep(strong) {
  color: var(--me-text-primary);
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
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}
.di-status-in_progress {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}
.di-status-closed {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
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
.di-dates-tags-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
.di-dates-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.di-tags-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}
@media (max-width: 700px) {
  .di-dates-tags-grid {
    grid-template-columns: 1fr;
  }
}
.di-empty {
  font-size: 12px;
  color: var(--me-text-muted);
  text-align: center;
  padding: 16px;
}

/* Status select */
.di-edit-header {
  display: flex;
  align-items: center;
  gap: 12px;
}
.di-edit-title-field {
  flex: 1;
  min-width: 200px;
}
.di-edit-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.di-hint {
  font-size: 11px;
  color: var(--me-text-muted);
  margin-top: 2px;
}
.di-date-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}
.di-date-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.di-date-input {
  padding: 8px 12px;
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-xs);
  background: var(--me-bg-surface);
  color: var(--me-text-primary);
  font-size: 14px;
  font-family: var(--me-font-mono);
  outline: none;
  transition: border-color 0.15s;
}
.di-date-input:focus {
  border-color: var(--me-accent);
}
.di-edit-bottom-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 4px;
}
.di-status-select-wrap {
  position: relative;
}
.di-status-select {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  background: var(--me-bg-surface);
  cursor: pointer;
  font-size: 13px;
  color: var(--me-text-primary);
  transition: border-color 0.15s;
}
.di-status-select:hover,
.di-status-select:focus {
  border-color: var(--me-accent);
  outline: none;
}
.di-status-chevron {
  margin-left: auto;
  color: var(--me-text-muted);
  transition: transform 0.15s;
}
.di-chevron-open {
  transform: rotate(180deg);
}
.di-status-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  margin-top: 4px;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}
.di-status-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--me-text-primary);
  cursor: pointer;
  transition: background 0.12s;
}
.di-status-option:hover {
  background: var(--me-accent-glow);
}
.di-status-option-active {
  background: var(--me-accent-glow);
  font-weight: 600;
}
.di-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.di-dot-open {
  background: #22c55e;
}
.di-dot-in_progress {
  background: #3b82f6;
}
.di-dot-closed {
  background: #ef4444;
}

/* Flag toggles (Urgent / Embargo) */
.di-flag-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid var(--me-border);
  background: none;
  color: var(--me-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.di-flag-toggle:hover {
  border-color: var(--me-text-secondary);
  color: var(--me-text-secondary);
}
.di-flag-toggle-active {
  font-weight: 600;
}
.di-flag-urgent-active {
  border-color: var(--me-error);
  background: rgba(248, 113, 113, 0.1);
  color: var(--me-error);
}
.di-flag-urgent-active:hover {
  border-color: var(--me-error);
  color: var(--me-error);
}
.di-flag-embargo-active {
  border-color: var(--me-warning);
  background: rgba(251, 191, 36, 0.1);
  color: var(--me-warning);
}
.di-flag-embargo-active:hover {
  border-color: var(--me-warning);
  color: var(--me-warning);
}

.di-flag-continuous { background: rgba(99, 102, 241, 0.15); color: #818cf8; border-color: #818cf8; }
.di-flag-continuous-active {
  border-color: #818cf8;
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}
.di-flag-continuous-active:hover { border-color: #818cf8; color: #818cf8; }

/* Language selector */
.di-lang-options {
  display: flex;
  gap: 6px;
}
.di-lang-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--me-radius-sm);
  border: 1px solid var(--me-border);
  background: none;
  color: var(--me-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.di-lang-btn:hover {
  border-color: var(--me-text-secondary);
  color: var(--me-text-primary);
}
.di-lang-btn-active {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
  color: var(--me-accent);
  font-weight: 600;
}
.di-lang-btn svg {
  border-radius: 2px;
  flex-shrink: 0;
}

/* Edit form layout */
.di-edit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.di-edit-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
@media (min-width: 1200px) {
  .di-edit-row {
    grid-template-columns: 1fr 1fr;
  }
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
.di-encryption-info {
  font-size: 12px;
  color: var(--me-text-muted);
  line-height: 1.6;
  display: flex;
  align-items: center;
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
/* Document Viewer */
.di-viewer-card {
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow: hidden;
}
.di-viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--me-border);
  flex-shrink: 0;
}
.di-viewer-title-row {
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 1;
}
.di-viewer-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--me-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.di-viewer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.di-viewer-body {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  background: var(--me-bg-secondary);
}
.di-viewer-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
}
.di-viewer-image-wrapper {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.di-viewer-image {
  object-fit: contain;
  transition: width 0.15s ease, height 0.15s ease;
  user-select: none;
}
.di-viewer-zoom-label {
  font-size: 11px;
  color: var(--me-text-muted);
  min-width: 38px;
  text-align: center;
}
.me-btn-icon {
  padding: 4px 6px !important;
  min-width: unset;
}
.di-viewer-pdf {
  width: 100%;
  height: 75vh;
  border: none;
}
.di-viewer-video {
  max-width: 100%;
  max-height: 75vh;
}
.di-viewer-audio {
  width: 90%;
  margin: 40px auto;
}
.me-btn-sm {
  font-size: 12px;
  padding: 4px 10px;
}

/* AI Enrichment streaming dialog */
.enrich-logs-panel {
  border-bottom: 1px solid var(--me-border);
}
.enrich-logs-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 12px;
  color: var(--me-text-secondary);
  gap: 4px;
}
.enrich-logs-header:hover {
  background: rgba(var(--me-accent-rgb, 100, 100, 100), 0.05);
}
.enrich-log-count {
  background: var(--me-bg-elevated);
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
}
.enrich-logs-content {
  max-height: 100px;
  overflow-y: auto;
  padding: 0 16px 8px;
}
.enrich-log-line {
  display: flex;
  gap: 8px;
  font-size: 11px;
  line-height: 1.6;
}
.enrich-log-time {
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.enrich-log-msg {
  color: var(--me-text-secondary);
}
.enrich-log-error {
  color: #f87171;
}
.enrich-body {
  min-height: 150px;
  max-height: 400px;
  overflow-y: auto;
  padding: 16px 20px;
}
.enrich-generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: var(--me-text-secondary);
}
.enrich-content {
  font-size: 13px;
}
.enrich-meta {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: var(--me-text-muted);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--me-border);
  margin-bottom: 12px;
}
.enrich-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.7;
  color: var(--me-text-primary);
  background: none;
  margin: 0;
  padding: 0;
}
.enrich-cursor {
  animation: blink 0.8s step-end infinite;
  color: var(--me-accent);
  font-weight: bold;
}
@keyframes blink {
  50% { opacity: 0; }
}
.enrich-error {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba(248, 113, 113, 0.08);
  border-radius: var(--me-radius-sm);
  color: #f87171;
  font-size: 13px;
}
.enrich-cancel-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  border-radius: var(--me-radius-sm);
  border: 1px solid #f87171;
  color: #f87171;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.enrich-cancel-btn:hover {
  background: rgba(248, 113, 113, 0.1);
}
.enrich-footer-actions {
  display: flex;
  gap: 8px;
  width: 100%;
  justify-content: flex-end;
}
</style>
