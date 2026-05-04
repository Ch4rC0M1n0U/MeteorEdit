<template>
  <Avatar
    :image="user?.avatarUrl || undefined"
    :label="user?.avatarUrl ? undefined : initials"
    shape="circle"
    :size="primeSize"
    :style="customStyle"
    :pt="{ root: { title: displayName } }"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Avatar from 'primevue/avatar';

interface UserLite {
  firstName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string | null;
}

const props = defineProps<{
  user: UserLite | null | undefined;
  size?: number;
}>();

// PrimeVue Avatar accepts named sizes; default to inline px via custom style for fine control.
const primeSize = computed<'normal' | 'large' | 'xlarge' | undefined>(() => {
  const s = props.size ?? 32;
  if (s >= 56) return 'xlarge';
  if (s >= 44) return 'large';
  return 'normal';
});

const displayName = computed(() => {
  if (!props.user) return '?';
  const fn = props.user.firstName || '';
  const ln = props.user.lastName || '';
  const full = `${fn} ${ln}`.trim();
  return full || props.user.email || '?';
});

const initials = computed(() => {
  if (!props.user) return '?';
  const fn = props.user.firstName?.[0] ?? '';
  const ln = props.user.lastName?.[0] ?? '';
  const ini = `${fn}${ln}`.toUpperCase();
  if (ini) return ini;
  return (props.user.email?.[0] ?? '?').toUpperCase();
});

// Stable per-user accent (hash) — kept consistent with the site palette range
const accent = computed(() => {
  const seed = props.user?.email || displayName.value;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 50%, 45%)`;
});

const customStyle = computed(() => {
  const s = props.size ?? 32;
  return {
    width: `${s}px`,
    height: `${s}px`,
    fontSize: `${Math.max(10, s * 0.4)}px`,
    backgroundColor: props.user?.avatarUrl ? undefined : accent.value,
    color: '#fff',
    fontWeight: 700,
    flexShrink: 0,
  };
});
</script>
