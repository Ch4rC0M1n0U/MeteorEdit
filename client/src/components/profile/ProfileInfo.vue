<template>
  <div class="profile-info">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-account-outline</v-icon>
        Mon profil
      </h2>
    </div>

    <!-- Avatar -->
    <div class="branding-card glass-card fade-in fade-in-delay-1">
      <h3 class="branding-card-title mono">Avatar</h3>
      <div class="avatar-section">
        <div class="avatar-preview">
          <img v-if="avatarUrl" :src="avatarUrl" alt="Avatar" class="avatar-img" />
          <span v-else class="avatar-initials">{{ initials }}</span>
        </div>
        <div class="avatar-actions">
          <button class="me-btn-primary" @click="triggerAvatarInput">
            <v-icon size="14" class="mr-1">mdi-camera-outline</v-icon>
            Changer
          </button>
          <button v-if="avatarUrl" class="me-btn-ghost" @click="removeAvatar">
            <v-icon size="14" class="mr-1">mdi-delete-outline</v-icon>
            Supprimer
          </button>
        </div>
        <input ref="avatarInput" type="file" accept="image/png,image/jpeg" hidden @change="handleAvatarSelect" />
      </div>
    </div>

    <!-- Info form -->
    <div class="branding-card glass-card fade-in fade-in-delay-2">
      <h3 class="branding-card-title mono">Informations personnelles</h3>
      <div class="form-grid">
        <v-text-field v-model="form.firstName" label="Prenom" density="compact" hide-details />
        <v-text-field v-model="form.lastName" label="Nom" density="compact" hide-details />
      </div>
      <v-text-field v-model="form.email" label="Email" type="email" density="compact" hide-details class="mt-4" />
      <div class="branding-actions mt-4">
        <button class="me-btn-primary" @click="saveProfile" :disabled="saving">
          {{ saving ? 'Sauvegarde...' : 'Sauvegarder' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import api, { SERVER_URL } from '../../services/api';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();
const avatarInput = ref<HTMLInputElement | null>(null);
const saving = ref(false);

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
});

const initials = computed(() => {
  const f = authStore.user?.firstName?.[0] || '';
  const l = authStore.user?.lastName?.[0] || '';
  return (f + l).toUpperCase();
});

const avatarUrl = computed(() => {
  return authStore.user?.avatarPath ? `${SERVER_URL}/${authStore.user.avatarPath}` : null;
});

onMounted(() => {
  if (authStore.user) {
    form.firstName = authStore.user.firstName;
    form.lastName = authStore.user.lastName;
    form.email = authStore.user.email;
  }
});

function triggerAvatarInput() { avatarInput.value?.click(); }

async function handleAvatarSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('avatar', file);
  await api.post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  await authStore.fetchMe();
}

async function removeAvatar() {
  await api.delete('/auth/avatar');
  await authStore.fetchMe();
}

async function saveProfile() {
  saving.value = true;
  try {
    await api.put('/auth/profile', { ...form });
    await authStore.fetchMe();
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }
.branding-card { padding: 20px; margin-bottom: 16px; }
.branding-card-title { font-size: 14px; font-weight: 700; color: var(--me-text-primary); margin-bottom: 12px; }
.avatar-section { display: flex; align-items: center; gap: 20px; }
.avatar-preview {
  width: 80px; height: 80px; border-radius: 50%;
  background: var(--me-bg-elevated); border: 2px solid var(--me-border);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; flex-shrink: 0;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-initials {
  font-size: 24px; font-weight: 700; font-family: var(--me-font-mono);
  color: var(--me-accent);
}
.avatar-actions { display: flex; gap: 8px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.branding-actions { display: flex; justify-content: flex-end; }
.mt-4 { margin-top: 16px; }
.me-btn-primary { padding: 8px 16px; border-radius: var(--me-radius-xs); background: var(--me-accent); border: none; color: var(--me-bg-deep); cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; }
.me-btn-primary:hover { box-shadow: 0 0 16px var(--me-accent-glow); }
.me-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.me-btn-ghost { padding: 8px 16px; border-radius: var(--me-radius-xs); background: none; border: 1px solid var(--me-border); color: var(--me-text-secondary); cursor: pointer; font-size: 13px; display: flex; align-items: center; }
.me-btn-ghost:hover { border-color: var(--me-border-hover); color: var(--me-text-primary); }
.mr-1 { margin-right: 4px; }
</style>
