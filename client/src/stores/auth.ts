import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';
import type { User, LoginResponse } from '../types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const loading = ref(false);

  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  async function login(email: string, password: string) {
    loading.value = true;
    try {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      user.value = data.user;
    } finally {
      loading.value = false;
    }
  }

  async function register(email: string, password: string, firstName: string, lastName: string) {
    loading.value = true;
    try {
      await api.post('/auth/register', { email, password, firstName, lastName });
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
  }

  async function init() {
    const token = localStorage.getItem('accessToken');
    if (token) {
      await fetchMe();
    }
  }

  return { user, loading, isAuthenticated, isAdmin, login, register, fetchMe, logout, init };
});
