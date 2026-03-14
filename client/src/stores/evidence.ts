import { ref } from 'vue';
import { defineStore } from 'pinia';
import api from '../services/api';
import { useDossierStore } from './dossier';
import type { EvidenceRecord } from '../types';

export const useEvidenceStore = defineStore('evidence', () => {
  const currentEvidence = ref<EvidenceRecord | null>(null);
  const nodeEvidenceRecords = ref<EvidenceRecord[]>([]);
  const dossierEvidence = ref<EvidenceRecord[]>([]);
  const verifying = ref(false);
  const loading = ref(false);

  async function fetchNodeEvidence(nodeId: string) {
    try {
      const { data } = await api.get<EvidenceRecord[]>(`/nodes/${nodeId}/evidence`);
      nodeEvidenceRecords.value = data;
      currentEvidence.value = data.length ? data[0] : null;
    } catch {
      nodeEvidenceRecords.value = [];
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
    } catch (err) {
      console.error('verifyIntegrity error:', err);
      throw err;
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

  async function verifyAllForNode(nodeId: string) {
    verifying.value = true;
    try {
      const { data } = await api.post(`/nodes/${nodeId}/evidence/verify-all`);
      const dossierStore = useDossierStore();
      const node = dossierStore.nodes.find(n => n._id === nodeId);
      if (node) {
        node.lastVerificationStatus = data.worstStatus;
        node.hashVerifiedAt = new Date().toISOString();
      }
      return data as { results: { id: string; status: string }[]; worstStatus: string };
    } finally {
      verifying.value = false;
    }
  }

  async function verifyAllDossier(dossierId: string) {
    verifying.value = true;
    try {
      console.log('verifyAllDossier: calling API for', dossierId);
      const { data } = await api.post(`/dossiers/${dossierId}/evidence/verify-all`);
      console.log('verifyAllDossier: result', data);
      return data as { results: { id: string; status: string }[]; worstStatus: string; total: number };
    } catch (err) {
      console.error('verifyAllDossier error:', err);
      throw err;
    } finally {
      verifying.value = false;
    }
  }

  async function rehashEvidence(nodeId: string) {
    try {
      const { data } = await api.post(`/nodes/${nodeId}/evidence/rehash`);
      await fetchNodeEvidence(nodeId);
      const dossierStore = useDossierStore();
      const node = dossierStore.nodes.find(n => n._id === nodeId);
      if (node && data.updated > 0) {
        node.lastVerificationStatus = 'enriched';
        node.hashVerifiedAt = new Date().toISOString();
      }
      return data as { updated: number; total: number };
    } catch (err) {
      console.error('rehashEvidence error:', err);
      return { updated: 0, total: 0 };
    }
  }

  async function purgeMissing(dossierId: string) {
    loading.value = true;
    try {
      const { data } = await api.delete(`/dossiers/${dossierId}/evidence/purge-missing`);
      return data as { purged: number; remaining: number };
    } finally {
      loading.value = false;
    }
  }

  return {
    currentEvidence,
    nodeEvidenceRecords,
    dossierEvidence,
    verifying,
    loading,
    fetchNodeEvidence,
    verifyIntegrity,
    verifyAllForNode,
    verifyAllDossier,
    purgeMissing,
    rehashEvidence,
    fetchDossierEvidence,
  };
});
