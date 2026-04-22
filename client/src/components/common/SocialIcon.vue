<template>
  <Icon
    :icon="resolvedIcon"
    :style="{ color: resolvedColor, fontSize: size + 'px', flexShrink: 0 }"
    :width="size"
    :height="size"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { SOCIAL_ICON_MAP, SOCIAL_COLOR_MAP } from './socialIconMap'

const props = withDefaults(defineProps<{
  platform: string
  size?: number
  color?: string
}>(), {
  size: 16,
  color: undefined,
})

const normalizedPlatform = computed(() => props.platform.toLowerCase().trim())

const resolvedIcon = computed(() =>
  SOCIAL_ICON_MAP[normalizedPlatform.value] ?? 'mdi:help-circle-outline'
)

const resolvedColor = computed(() =>
  props.color ?? SOCIAL_COLOR_MAP[normalizedPlatform.value] ?? '#94a3b8'
)
</script>
