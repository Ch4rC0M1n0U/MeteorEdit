import { ref } from 'vue';
import { defineStore } from 'pinia';
import api from '../services/api';
import { useDossierStore } from './dossier';
import type { EvidenceRecord } from '../types';

export const useEvidenceStore = defineStore('evidence', () => {
  const currentEvidence = ref<EvidenceRecord | null>(null);
  const dossierEvidence = ref<EvidenceRecord[]>([]);
  const verifying = ref(false);
  const loading = ref(false);

  async function fetchNodeEvidence(nodeId: string) {
    try {
      const { data } = await api.get<EvidenceRecord>(`/nodes/${nodeId}/evidence`);
      currentEvidence.value = data;
    } catch {
      currentEvidence.value = null;
    }
  }

  async function verifyIntegrity(nodeId: string) {
    verifying.value = true;
    try {
      const { data } = await api.post(`/nodes/${nodeId}/evidence/verify`);
      // Refresh the evidence record
      await fetchNodeEvidence(nodeId);
      // Update the node in the dossier store so the tree badge reflects the new status
      const dossierStore = useDossierStore();
      const node = dossierStore.nodes.find(n => n._id === nodeId);
      if (node) {
        node.lastVerificationStatus = data.status;
        node.hashVerifiedAt = new Date().toISOString();
      }
      return data as { status: string; computedHash: string; originalHash: string; match: boolean };
    } finally {
      verifying.value = false;
    }
  }

  async function fetchDossierEvidence(dossierId: string) {
    loading.value = true;
    try {
      const { data } = await api.get<EvidenceRecord[]>(`/dossiers/${dossierId}/evidence`);
      dossierEvidence.value = data;
    } catch {
      dossierEvidence.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function downloadCertificate(nodeId: string, nodeTitle: string) {
    const { data } = await api.get(`/nodes/${nodeId}/evidence/certificate`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificat-integrite-${nodeTitle}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    currentEvidence,
    dossierEvidence,
    verifying,
    loading,
    fetchNodeEvidence,
    verifyIntegrity,
    fetchDossierEvidence,
    downloadCertificate,
  };
});
