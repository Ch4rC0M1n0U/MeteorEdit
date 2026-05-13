<!--
  CollabAvatarStack.vue — avatars présents temps-réel
  Props : collaborators = [{ userId, firstName, lastName, avatarPath?, status? }]
-->
<script setup lang="ts">
import { computed } from 'vue';
import Avatar from 'primevue/avatar';
import AvatarGroup from 'primevue/avatargroup';
import { SERVER_URL } from '@/services/api';

export interface Collaborator {
  userId: string;
  firstName: string;
  lastName: string;
  initials?: string;
  avatarPath?: string;
  status?: 'active' | 'idle' | 'offline';
}

const props = withDefaults(defineProps<{
  collaborators: Collaborator[];
  max?: number;
}>(), { max: 3 });

const visible = computed(() => props.collaborators.slice(0, props.max));
const overflow = computed(() => Math.max(0, props.collaborators.length - props.max));

const ini = (c: Collaborator) => c.initials || (c.firstName?.[0] || '') + (c.lastName?.[0] || '');
const fullName = (c: Collaborator) => `${c.firstName} ${c.lastName}`.trim();
</script>
<template>
  <AvatarGroup v-if="collaborators.length" class="cas">
    <div v-for="c in visible" :key="c.userId" class="cas__item" :title="fullName(c)">
      <Avatar
        :label="ini(c)"
        :image="c.avatarPath ? `${SERVER_URL}/${c.avatarPath}` : undefined"
        shape="circle"
        size="normal"
        class="cas__avatar"
      />
      <span class="cas__dot" :class="`cas__dot--${c.status || 'active'}`" />
    </div>
    <Avatar
      v-if="overflow > 0"
      :label="`+${overflow}`"
      shape="circle"
      size="normal"
      class="cas__avatar cas__avatar--overflow"
    />
  </AvatarGroup>
</template>
<style scoped>
.cas :deep(.p-avatargroup) { display: flex; }
.cas__item { position: relative; margin-left: -6px; }
.cas__item:first-child { margin-left: 0; }
.cas__avatar :deep(.p-avatar) {
  width: 24px; height: 24px;
  font-size: 10px; font-weight: 600;
  background: var(--accent-soft);
  color: var(--accent);
  border: 2px solid var(--surface);
}
.cas__avatar--overflow :deep(.p-avatar) {
  background: var(--bg-3);
  color: var(--ink-3);
  margin-left: -6px;
}
.cas__dot {
  position: absolute;
  right: 0; bottom: 0;
  width: 7px; height: 7px;
  border-radius: 50%;
  border: 2px solid var(--surface);
}
.cas__dot--active  { background: var(--ok); }
.cas__dot--idle    { background: var(--warn); }
.cas__dot--offline { background: var(--ink-4); }
</style>
