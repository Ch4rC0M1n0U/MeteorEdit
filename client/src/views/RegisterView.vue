<template>
  <div class="login-page">
    <div class="login-bg" />
    <div class="login-container fade-in">
      <div class="login-card glass-card">
        <div class="login-header">
          <img v-if="brandingStore.logoUrl" :src="brandingStore.logoUrl" :alt="brandingStore.appName" class="login-logo-img" />
          <div class="login-logo mono">
            <span v-if="!brandingStore.logoUrl" class="logo-icon">&#9670;</span>
            {{ brandingStore.appName }}
          </div>
          <p class="login-subtitle">Creer un compte</p>
        </div>

        <v-alert v-if="success" type="success" variant="tonal" class="mb-4">
          Compte cree. Un administrateur doit activer votre compte.
        </v-alert>

        <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
          {{ error }}
        </v-alert>

        <v-form v-if="!success" @submit.prevent="handleRegister" :disabled="authStore.loading">
          <div class="d-flex ga-3 mb-1">
            <v-text-field v-model="firstName" label="Prenom" prepend-inner-icon="mdi-account-outline" required />
            <v-text-field v-model="lastName" label="Nom" required />
          </div>
          <v-text-field v-model="email" label="Email" type="email" prepend-inner-icon="mdi-email-outline" required class="mb-1" />
          <v-text-field
            v-model="password"
            label="Mot de passe (min. 8)"
            :type="showPassword ? 'text' : 'password'"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
            required
            class="mb-4"
          />
          <v-btn
            type="submit"
            block
            size="large"
            :loading="authStore.loading"
            class="btn-accent mb-2"
          >
            S'inscrire
          </v-btn>
        </v-form>

        <div class="login-footer">
          <span class="text-muted">Deja un compte ?</span>
          <router-link to="/login" class="login-link">Se connecter</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useBrandingStore } from '../stores/branding';

const authStore = useAuthStore();
const brandingStore = useBrandingStore();

const firstName = ref('');
const lastName = ref('');
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const error = ref('');
const success = ref(false);

async function handleRegister() {
  error.value = '';
  try {
    await authStore.register(email.value, password.value, firstName.value, lastName.value);
    success.value = true;
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erreur lors de l\'inscription';
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: var(--me-bg-deep);
}
.login-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 60% at 20% 80%, rgba(56, 189, 248, 0.06) 0%, transparent 70%),
    radial-gradient(ellipse 60% 50% at 80% 20%, rgba(245, 158, 11, 0.04) 0%, transparent 70%);
}
.login-container {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 480px;
  padding: 0 16px;
}
.login-card {
  padding: 40px 32px;
}
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.login-logo {
  font-size: 28px;
  font-weight: 700;
  color: var(--me-text-primary);
  letter-spacing: -0.5px;
}
.logo-icon {
  color: var(--me-accent);
  margin-right: 4px;
}
.login-logo-img {
  height: 56px;
  width: auto;
  object-fit: contain;
  margin-bottom: 12px;
}
.login-subtitle {
  color: var(--me-text-muted);
  font-size: 13px;
  margin-top: 6px;
  letter-spacing: 1px;
  text-transform: uppercase;
  font-family: var(--me-font-mono);
}
.login-footer {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
}
.text-muted {
  color: var(--me-text-muted);
}
.login-link {
  color: var(--me-accent);
  text-decoration: none;
  margin-left: 6px;
  font-weight: 500;
}
.login-link:hover {
  text-decoration: underline;
}
</style>
