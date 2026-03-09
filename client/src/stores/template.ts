import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../services/api';
import type { NoteTemplate } from '../types';

export const useTemplateStore = defineStore('template', () => {
  const templates = ref<NoteTemplate[]>([]);
  const loading = ref(false);

  async function fetchTemplates() {
    loading.value = true;
    try {
      const { data } = await api.get<NoteTemplate[]>('/templates');
      templates.value = data;
    } finally {
      loading.value = false;
    }
  }

  async function createTemplate(templateData: { title: string; description?: string; content: any }) {
    const { data } = await api.post<NoteTemplate>('/templates', templateData);
    templates.value.unshift(data);
    return data;
  }

  async function updateTemplate(id: string, templateData: Partial<NoteTemplate>) {
    const { data } = await api.put<NoteTemplate>(`/templates/${id}`, templateData);
    const idx = templates.value.findIndex(t => t._id === id);
    if (idx >= 0) templates.value[idx] = data;
    return data;
  }

  async function deleteTemplate(id: string) {
    await api.delete(`/templates/${id}`);
    templates.value = templates.value.filter(t => t._id !== id);
  }

  async function resolveTemplate(templateId: string, dossierId: string): Promise<any> {
    const { data } = await api.post(`/templates/${templateId}/resolve`, { dossierId });
    return data.content;
  }

  return {
    templates, loading,
    fetchTemplates, createTemplate, updateTemplate, deleteTemplate, resolveTemplate,
  };
});
