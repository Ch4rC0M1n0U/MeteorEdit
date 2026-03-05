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
          <p class="login-subtitle">{{ brandingStore.loginMessage || 'Plateforme d\'investigation OSINT' }}</p>
        </div>

        <v-alert v-if="error" type="error" variant="tonal" class="mb-4" closable @click:close="error = ''">
          {{ error }}
        </v-alert>

        <v-form v-if="!show2FA" @submit.prevent="handleLogin" :disabled="authStore.loading">
          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            prepend-inner-icon="mdi-email-outline"
            required
            class="mb-1"
          />
          <v-text-field
            v-model="password"
            label="Mot de passe"
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
            Se connecter
          </v-btn>
        </v-form>

        <div v-if="show2FA" class="tfa-login-section">
          <p class="tfa-login-text mono">Entrez le code de votre application d'authentification</p>
          <v-text-field
            v-model="tfaCode"
            label="Code 2FA"
            maxlength="8"
            autofocus
            prepend-inner-icon="mdi-shield-key-outline"
            @keyup.enter="handle2FA"
            class="mb-4"
          />
          <v-btn type="button" block size="large" :loading="authStore.loading" class="btn-accent mb-2" @click="handle2FA">
            Verifier
          </v-btn>
          <button class="tfa-back-btn" @click="show2FA = false; tempToken = ''">
            <v-icon size="14" class="mr-1">mdi-arrow-left</v-icon>
            Retour
          </button>
        </div>

        <div class="login-footer">
          <span class="text-muted">Pas encore de compte ?</span>
          <router-link to="/register" class="login-link">S'inscrire</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useBrandingStore } from '../stores/branding';

const authStore = useAuthStore();
const brandingStore = useBrandingStore();
const router = useRouter();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const error = ref('');
const show2FA = ref(false);
const tempToken = ref('');
const tfaCode = ref('');

async function handleLogin() {
  error.value = '';
  try {
    const result = await authStore.login(email.value, password.value);
    if (result?.requires2FA) {
      tempToken.value = result.tempToken!;
      show2FA.value = true;
      return;
    }
    router.push('/');
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erreur de connexion';
  }
}

async function handle2FA() {
  error.value = '';
  try {
    await authStore.validate2FA(tempToken.value, tfaCode.value);
    router.push('/');
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Code invalide';
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
  max-width: 420px;
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
.tfa-login-section { margin-top: 8px; }
.tfa-login-text { font-size: 13px; color: var(--me-text-secondary); margin-bottom: 16px; text-align: center; }
.tfa-back-btn { display: flex; align-items: center; justify-content: center; width: 100%; margin-top: 8px; background: none; border: none; color: var(--me-text-muted); cursor: pointer; font-size: 13px; }
.tfa-back-btn:hover { color: var(--me-text-primary); }
</style>
