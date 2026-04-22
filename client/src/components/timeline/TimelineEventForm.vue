<template>
  <Dialog
    v-model:visible="localVisible"
    :header="isEdit ? $t('timeline.editEvent') : $t('timeline.addEvent')"
    :style="{ width: '480px' }"
    modal
    @hide="onCancel"
  >
    <div class="tef-form">
      <!-- Titre -->
      <div class="tef-field">
        <label>{{ $t('timeline.eventTitle') }} *</label>
        <InputText v-model="form.title" class="w-full" autofocus />
      </div>

      <!-- Type de date -->
      <div class="tef-field">
        <label>{{ $t('timeline.dateType') }}</label>
        <SelectButton
          v-model="form.dateType"
          :options="dateTypeOptions"
          option-label="label"
          option-value="value"
        />
      </div>

      <!-- Date exacte -->
      <div v-if="form.dateType === 'exact'" class="tef-field tef-row">
        <div class="tef-col">
          <label>{{ $t('timeline.date') }}</label>
          <DatePicker v-model="form.dateObj" date-format="dd/mm/yy" class="w-full" />
        </div>
        <div class="tef-col tef-col-small">
          <label>{{ $t('timeline.time') }} ({{ $t('timeline.optional') }})</label>
          <InputText v-model="form.time" placeholder="HH:mm" maxlength="5" class="w-full" />
        </div>
      </div>

      <!-- Date approximative -->
      <div v-else class="tef-field">
        <label>{{ $t('timeline.approximateDate') }}</label>
        <InputText v-model="form.date" :placeholder="$t('timeline.approximatePlaceholder')" class="w-full" />
      </div>

      <!-- Catégorie -->
      <div class="tef-field">
        <label>{{ $t('timeline.category') }}</label>
        <Select
          v-model="form.category"
          :options="categoryOptions"
          option-label="label"
          option-value="value"
          class="w-full"
        />
        <InputText
          v-if="form.category === '__custom__'"
          v-model="form.customCategory"
          :placeholder="$t('timeline.customCategoryPlaceholder')"
          class="w-full mt-2"
        />
      </div>

      <!-- Description -->
      <div class="tef-field">
        <label>{{ $t('timeline.description') }} ({{ $t('timeline.optional') }})</label>
        <Textarea v-model="form.description" rows="3" class="w-full" auto-resize />
      </div>

      <!-- Source -->
      <div class="tef-field">
        <label>{{ $t('timeline.source') }} ({{ $t('timeline.optional') }})</label>
        <InputText v-model="form.source" class="w-full" />
      </div>
    </div>

    <template #footer>
      <Button :label="$t('common.cancel')" text @click="onCancel" />
      <Button :label="$t('common.save')" :disabled="!form.title.trim()" @click="onSave" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import DatePicker from 'primevue/datepicker'
import Button from 'primevue/button'
import { TIMELINE_CATEGORIES } from '../../types'
import type { TimelineEvent } from '../../types'

const props = defineProps<{
  visible: boolean
  event?: TimelineEvent | null
  customCategories: string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'save', event: TimelineEvent): void
}>()

const { t } = useI18n()

const localVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const isEdit = computed(() => !!props.event)

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function emptyForm() {
  return {
    title: '',
    dateType: 'exact' as 'exact' | 'approximate',
    dateObj: null as Date | null,
    date: '',
    time: '',
    category: 'other',
    customCategory: '',
    description: '',
    source: '',
  }
}

const form = ref(emptyForm())

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    if (props.event) {
      form.value = {
        title: props.event.title,
        dateType: props.event.dateType,
        dateObj: props.event.dateType === 'exact' ? new Date(props.event.date) : null,
        date: props.event.dateType === 'approximate' ? props.event.date : '',
        time: props.event.time ?? '',
        category: props.event.category,
        customCategory: '',
        description: props.event.description ?? '',
        source: props.event.source ?? '',
      }
    } else {
      form.value = emptyForm()
    }
  }
)

const dateTypeOptions = computed(() => [
  { label: t('timeline.exact'), value: 'exact' },
  { label: t('timeline.approximate'), value: 'approximate' },
])

const categoryOptions = computed(() => [
  ...TIMELINE_CATEGORIES.map((c) => ({ label: c.label, value: c.key })),
  ...props.customCategories.map((c) => ({ label: c, value: c })),
  { label: t('timeline.customCategory'), value: '__custom__' },
])

function onCancel() {
  emit('update:visible', false)
}

function onSave() {
  const finalCategory =
    form.value.category === '__custom__'
      ? form.value.customCategory.trim() || 'other'
      : form.value.category

  const finalDate =
    form.value.dateType === 'exact' && form.value.dateObj
      ? form.value.dateObj.toISOString()
      : form.value.date

  const event: TimelineEvent = {
    id: props.event?.id ?? uid(),
    dateType: form.value.dateType,
    date: finalDate,
    time: form.value.time.trim() || undefined,
    title: form.value.title.trim(),
    description: form.value.description.trim() || undefined,
    category: finalCategory,
    source: form.value.source.trim() || undefined,
  }

  emit('save', event)
  emit('update:visible', false)
}
</script>

<style scoped>
.tef-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tef-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tef-field label {
  font-size: 13px;
  font-weight: 500;
  color: var(--me-text-muted, #94a3b8);
}
.tef-row {
  flex-direction: row;
  gap: 12px;
}
.tef-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tef-col-small {
  flex: 0 0 130px;
}
.mt-2 { margin-top: 8px; }
.w-full { width: 100%; }
</style>
