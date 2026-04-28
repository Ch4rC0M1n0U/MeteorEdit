import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useDossierStore } from './dossier';
import type { DossierNode } from '../types';

export interface PhoneScanProgress {
  tested: number;
  found: number;
  errors: number;
}

export interface PhoneScan {
  _id: string;
  dossierId: string;
  userId: string;
  pattern: string;
  countryCode: string;
  totalCombinations: number;
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed' | 'rate_limited';
  platforms: string[];
  progress: PhoneScanProgress;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface PhoneScanProfile {
  name?: string;
  about?: string;
  avatarUrl?: string;
  isBusiness?: boolean;
}

export interface PhoneScanResult {
  _id: string;
  scanId: string;
  dossierId: string;
  userId: string;
  phoneE164: string;
  platform: string;
  status: 'exists' | 'not_found' | 'error' | 'rate_limited';
  profile?: PhoneScanProfile;
  errorMessage?: string;
  testedAt: string;
}

export interface ScannerSettings {
  maxDailyChecksGlobal: number;
  maxDailyChecksPerUser: number;
  minDelayMs: number;
  maxDelayMs: number;
  combinationsWarnThreshold: number;
  combinationsBlockThreshold: number;
  resultsTtlDays: number;
  globalDailyCounter: { date: string; count: number };
}

export interface DryRunResponse {
  totalCombinations: number;
  warnLevel: 'ok' | 'warn' | 'block';
  estimatedDurationMs: number;
  thresholds: { warn: number; block: number };
}

export const usePhoneScannerStore = defineStore('phoneScanner', () => {
  const currentScan = ref<PhoneScan | null>(null);
  const results = ref<PhoneScanResult[]>([]);
  const history = ref<PhoneScan[]>([]);
  const settings = ref<ScannerSettings | null>(null);
  const subscribedScanId = ref<string | null>(null);
  const isScanning = computed(() =>
    currentScan.value?.status === 'queued' || currentScan.value?.status === 'running'
  );

  async function loadSettings(): Promise<void> {
    try {
      const { data } = await api.get<{ settings: ScannerSettings }>('/phone-scanner/admin/settings');
      settings.value = data.settings;
    } catch {
      // Non-admin users can't fetch settings; fall back to sensible defaults
      settings.value = {
        maxDailyChecksGlobal: 200,
        maxDailyChecksPerUser: 50,
        minDelayMs: 45000,
        maxDelayMs: 90000,
        combinationsWarnThreshold: 50,
        combinationsBlockThreshold: 200,
        resultsTtlDays: 30,
        globalDailyCounter: { date: '', count: 0 },
      };
    }
  }

  async function previewScan(payload: {
    dossierId: string;
    pattern: string;
    countryCode: string;
    platforms: string[];
  }): Promise<DryRunResponse> {
    const { data } = await api.post<DryRunResponse>('/phone-scanner/scans', {
      ...payload,
      dryRun: true,
    });
    return data;
  }

  async function startScan(payload: {
    dossierId: string;
    pattern: string;
    countryCode: string;
    platforms: string[];
  }): Promise<string> {
    const { data } = await api.post<{ scanId: string }>('/phone-scanner/scans', payload);
    await loadScan(data.scanId);
    subscribeToScan(data.scanId);
    return data.scanId;
  }

  async function loadScan(scanId: string): Promise<void> {
    const { data } = await api.get<{ scan: PhoneScan }>(`/phone-scanner/scans/${scanId}`);
    currentScan.value = data.scan;
    await loadResults(scanId);
  }

  async function loadResults(scanId: string, status?: string): Promise<void> {
    const params = status ? { status } : {};
    const { data } = await api.get<{ results: PhoneScanResult[] }>(
      `/phone-scanner/scans/${scanId}/results`,
      { params }
    );
    results.value = data.results;
  }

  async function cancelScan(scanId: string): Promise<void> {
    await api.delete(`/phone-scanner/scans/${scanId}`);
    if (currentScan.value && currentScan.value._id === scanId) {
      currentScan.value.status = 'cancelled';
    }
  }

  async function loadHistory(dossierId: string, limit = 20): Promise<void> {
    const { data } = await api.get<{ scans: PhoneScan[] }>(
      `/phone-scanner/dossiers/${dossierId}/history`,
      { params: { limit } }
    );
    history.value = data.scans;
  }

  async function createEntityFromResult(
    resultId: string,
    options?: { dossierId?: string; customName?: string; customDescription?: string }
  ): Promise<{ nodeId: string; folderId: string; node?: DossierNode; folder?: DossierNode | null }> {
    const { data } = await api.post<{
      nodeId: string;
      folderId: string;
      node?: DossierNode;
      folder?: DossierNode | null;
    }>(
      `/phone-scanner/results/${resultId}/to-entity`,
      options ?? {}
    );

    // Push new nodes into the dossier tree for instant UI update + notify other clients
    const dossierStore = useDossierStore();
    const dossierId = options?.dossierId ?? dossierStore.currentDossier?._id;
    const socket = getSocket();

    if (data.folder && !dossierStore.nodes.find(n => n._id === data.folder!._id)) {
      dossierStore.nodes.push(data.folder);
      if (dossierId) socket?.emit('node-created', { dossierId, node: data.folder });
    }
    if (data.node && !dossierStore.nodes.find(n => n._id === data.node!._id)) {
      dossierStore.nodes.push(data.node);
      if (dossierId) socket?.emit('node-created', { dossierId, node: data.node });
    }

    return data;
  }

  function subscribeToScan(scanId: string): void {
    const socket = getSocket();
    if (!socket) return;
    if (subscribedScanId.value === scanId) return;
    if (subscribedScanId.value) socket.emit('scan:leave', subscribedScanId.value);
    subscribedScanId.value = scanId;
    socket.emit('scan:join', scanId);

    socket.on('scan:progress', handleProgress);
    socket.on('scan:complete', handleComplete);
    socket.on('scan:error', handleError);
  }

  function unsubscribeFromScan(): void {
    const socket = getSocket();
    if (!socket) return;
    if (subscribedScanId.value) {
      socket.emit('scan:leave', subscribedScanId.value);
      subscribedScanId.value = null;
    }
    socket.off('scan:progress', handleProgress);
    socket.off('scan:complete', handleComplete);
    socket.off('scan:error', handleError);
  }

  function handleProgress(payload: {
    tested: number;
    found: number;
    errors: number;
    total?: number;
    status?: PhoneScan['status'];
    lastResult?: { phoneE164: string; status: string };
  }): void {
    if (!currentScan.value) return;
    currentScan.value.progress = {
      tested: payload.tested,
      found: payload.found,
      errors: payload.errors,
    };
    if (payload.status) currentScan.value.status = payload.status;
    // Auto-refresh results periodically (every 5 tested) to pull latest
    if (payload.tested % 5 === 0 && currentScan.value._id) {
      loadResults(currentScan.value._id).catch(() => {});
    }
  }

  function handleComplete(payload: {
    tested: number;
    found: number;
    errors: number;
    status: PhoneScan['status'];
  }): void {
    if (!currentScan.value) return;
    currentScan.value.progress = {
      tested: payload.tested,
      found: payload.found,
      errors: payload.errors,
    };
    currentScan.value.status = payload.status;
    if (currentScan.value._id) loadResults(currentScan.value._id).catch(() => {});
  }

  function handleError(payload: { message: string }): void {
    if (!currentScan.value) return;
    currentScan.value.status = 'failed';
    currentScan.value.errorMessage = payload.message;
  }

  function reset(): void {
    unsubscribeFromScan();
    currentScan.value = null;
    results.value = [];
  }

  return {
    currentScan,
    results,
    history,
    settings,
    isScanning,
    loadSettings,
    previewScan,
    startScan,
    loadScan,
    loadResults,
    cancelScan,
    loadHistory,
    createEntityFromResult,
    subscribeToScan,
    unsubscribeFromScan,
    reset,
  };
});
