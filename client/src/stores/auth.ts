import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';
import type { User, LoginResponse } from '../types';
import { useEncryptionStore } from './encryption';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const loading = ref(false);
  // Temporarily cached password for 2FA flow (cleared after use)
  let pendingPassword: string | null = null;

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  async function login(email: string, password: string): Promise<{ requires2FA?: boolean; tempToken?: string }> {
    loading.value = true;
    try {
      const { data } = await api.post<LoginResponse & { requires2FA?: boolean; tempToken?: string }>('/auth/login', { email, password });
      if (data.requires2FA) {
        pendingPassword = password;
        return { requires2FA: true, tempToken: data.tempToken };
      }
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      user.value = data.user;

      // Auto-unlock encryption keys after login
      const encStore = useEncryptionStore();
      const restored = await encStore.tryRestoreFromSession();
      if (!restored) {
        const hasKeys = await encStore.checkKeys();
        if (hasKeys) {
          await encStore.unlockKeys(password);
        } else {
          // Legacy user without keys - initialize them now
          await encStore.initializeKeys(password);
        }
      }

      return {};
    } finally {
      loading.value = false;
    }
  }

  async function validate2FA(tempToken: string, code: string) {
    loading.value = true;
    try {
      const { data } = await api.post<LoginResponse>('/auth/2fa/validate', { tempToken, code });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      user.value = data.user;

      // Auto-unlock encryption keys using cached password from login step
      if (pendingPassword) {
        const encStore = useEncryptionStore();
        const restored = await encStore.tryRestoreFromSession();
        if (!restored) {
          const hasKeys = await encStore.checkKeys();
          if (hasKeys) {
            await encStore.unlockKeys(pendingPassword);
          } else {
            // Legacy user without keys - initialize them now
            await encStore.initializeKeys(pendingPassword);
          }
        }
        pendingPassword = null;
      }
    } finally {
      loading.value = false;
    }
  }

  async function register(email: string, password: string, firstName: string, lastName: string): Promise<{ autoLoginSuccess?: boolean }> {
    loading.value = true;
    try {
      await api.post('/auth/register', { email, password, firstName, lastName });

      // Try auto-login after registration to initialize encryption keys
      try {
        const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        user.value = data.user;

        // Auto-initialize encryption keys with the registration password
        const encStore = useEncryptionStore();
        await encStore.initializeKeys(password);

        return { autoLoginSuccess: true };
      } catch {
        // Auto-login may fail (e.g. admin activation required) - that's OK
        return {};
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchMe() {
    try {
      const { data } = await api.get<User>('/auth/me');
      user.value = data;
    } catch {
      logout();
    }
  }

  function logout() {
    user.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    pendingPassword = null;
    const encStore = useEncryptionStore();
    encStore.lockKeys();
  }

  async function init() {
    const token = localStorage.getItem('accessToken');
    if (token) {
      await fetchMe();
    }
  }

  return { user, loading, isAuthenticated, isAdmin, login, validate2FA, register, fetchMe, logout, init };
});
