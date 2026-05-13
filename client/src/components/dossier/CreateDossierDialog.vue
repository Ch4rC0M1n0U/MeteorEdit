<!--
  CreateDossierDialog.vue — formulaire création dossier v3
  Sections collapsibles via PrimeVue Accordion.
  PRÉSERVE l'API : <Button> trigger + Dialog + appel dossierStore.createDossier(payload).
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import Select from 'primevue/select';
import DatePicker from 'primevue/datepicker';
import Checkbox from 'primevue/checkbox';
import Accordion from 'primevue/accordion';
import AccordionPanel from 'primevue/accordionpanel';
import AccordionHeader from 'primevue/accordionheader';
import AccordionContent from 'primevue/accordioncontent';

import DialogShell from '../common/DialogShell.vue';
import FormField from '../shared/FormField.vue';
import IconPicker from '../shared/IconPicker.vue';
import TagInput from '../shared/TagInput.vue';
import { useDossierStore } from '@/stores/dossier';

const { t } = useI18n();
const dossierStore = useDossierStore();

const open = ref(false);

// Champs (alignés sur le modèle Dossier MeteorEdit)
const title = ref('');
const description = ref('');
const icon = ref<string | null>(null);
const classification = ref<'priority' | 'routine'>('routine');
const isUrgent = ref(false);
const isEmbargo = ref(false);
const magistrate = ref('');
const language = ref<'fr' | 'nl'>('fr');
const arrivalDate = ref<Date | null>(null);
const tags = ref<string[]>([]);

const classifOptions = computed(() => [
  { value: 'priority', label: t('dossier.classificationPriority') },
  { value: 'routine', label: t('dossier.classificationRoutine') },
]);

const langOptions = [
  { value: 'fr', label: 'Français' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'en', label: 'English' },
];

const canCreate = computed(() => title.value.trim().length > 0);

function reset() {
  title.value = ''; description.value = ''; icon.value = null;
  classification.value = 'routine'; isUrgent.value = false;
  isEmbargo.value = false;
  magistrate.value = '';
  language.value = 'fr'; arrivalDate.value = null; tags.value = [];
}

async function handleCreate() {
  await dossierStore.createDossier({
    title: title.value,
    description: description.value || '',
    icon: icon.value,
    classification: classification.value,
    isUrgent: isUrgent.value,
    isEmbargo: isEmbargo.value,
    magistrate: magistrate.value || '',
    dossierLanguage: language.value,
    arrivalDate: arrivalDate.value ? arrivalDate.value.toISOString() : null,
    tags: tags.value,
  });
  reset();
  open.value = false;
}
</script>

<template>
  <Button icon="pi pi-plus" :label="t('dossier.newDossier')" @click="open = true" />

  <DialogShell
    v-model="open"
    :title="t('dossier.newDossier')"
    icon="pi-folder-plus"
    width="md"
  >
    <Accordion :value="['identity']" multiple>
      <!-- Identité -->
      <AccordionPanel value="identity">
        <AccordionHeader>{{ t('modal.create.section.identity') }}</AccordionHeader>
        <AccordionContent>
          <div class="cd__col">
            <FormField :label="t('dossier.dossierIcon')">
              <IconPicker v-model="icon" />
            </FormField>
            <FormField :label="t('dossier.dossierTitle')" required for="cd-title">
              <InputText id="cd-title" v-model="title" :placeholder="t('dossier.dossierTitle')" autofocus fluid />
            </FormField>
            <FormField :label="t('common.description')" for="cd-desc">
              <Textarea id="cd-desc" v-model="description" rows="3" fluid />
            </FormField>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <!-- Classification -->
      <AccordionPanel value="classification">
        <AccordionHeader>{{ t('modal.create.section.classification') }}</AccordionHeader>
        <AccordionContent>
          <div class="cd__col">
            <FormField :label="t('dossier.classification')">
              <Select v-model="classification" :options="classifOptions" optionLabel="label" optionValue="value" fluid />
            </FormField>
            <div class="cd__row">
              <label class="cd__check">
                <Checkbox v-model="isUrgent" :binary="true" />
                <span>{{ t('dossier.urgent') }}</span>
              </label>
              <label class="cd__check">
                <Checkbox v-model="isEmbargo" :binary="true" />
                <span>{{ t('dossier.isEmbargo') }}</span>
              </label>
            </div>
          </div>
        </AccordionContent>
      </AccordionPanel>

      <!-- Affectation -->
      <AccordionPanel value="assignment">
        <AccordionHeader>{{ t('modal.create.section.assignment') }}</AccordionHeader>
        <AccordionContent>
          <div class="cd__col">
            <FormField :label="t('dossier.magistrate')" for="cd-mag">
              <InputText id="cd-mag" v-model="magistrate" fluid />
            </FormField>
            <FormField :label="t('dossier.dossierLanguage')">
              <Select v-model="language" :options="langOptions" optionLabel="label" optionValue="value" fluid />
            </FormField>
            <FormField :label="t('dossier.arrivalDate')">
              <DatePicker v-model="arrivalDate" showIcon fluid />
            </FormField>
            <FormField :label="t('common.tags')">
              <TagInput v-model="tags" />
            </FormField>
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <template #footer="{ close }">
      <Button :label="t('common.cancel')" text severity="secondary" @click="close()" />
      <Button :label="t('common.create')" icon="pi pi-check" :disabled="!canCreate" @click="handleCreate" />
    </template>
  </DialogShell>
</template>

<style scoped>
.cd__col { display: flex; flex-direction: column; gap: 14px; }
.cd__row { display: flex; gap: 16px; align-items: center; }
.cd__check {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--ink-2); cursor: pointer;
}
.cd__check :deep(.p-checkbox-box) {
  border: 1px solid var(--line-2) !important;
  background: var(--surface) !important;
}
.cd__check :deep(.p-checkbox.p-highlight .p-checkbox-box) {
  background: var(--accent) !important;
  border-color: var(--accent) !important;
}

:deep(.p-accordionpanel) {
  border: 1px solid var(--line);
  border-radius: var(--r-md) !important;
  margin-bottom: 8px;
  background: var(--surface);
  overflow: hidden;
}
:deep(.p-accordionheader) {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink);
  padding: 10px 12px !important;
  background: var(--bg-2) !important;
  border: 0 !important;
}
:deep(.p-accordionheader:hover) { background: var(--bg-3) !important; }
:deep(.p-accordioncontent-content) {
  padding: 14px 12px 16px !important;
  background: var(--surface) !important;
}
</style>
