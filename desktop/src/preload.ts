import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getServerUrl: (): Promise<string> => ipcRenderer.invoke('get-server-url'),
  setServerUrl: (url: string): Promise<void> => ipcRenderer.invoke('set-server-url', url),
  testServerConnection: (url: string): Promise<boolean> => ipcRenderer.invoke('test-server-connection', url),
  showNotification: (title: string, body: string): void => ipcRenderer.send('show-notification', title, body),
  onDeepLink: (callback: (url: string) => void): void => {
    ipcRenderer.on('deep-link', (_event, url: string) => callback(url));
  },
  onNavigate: (callback: (path: string) => void): void => {
    ipcRenderer.on('navigate', (_event, path: string) => callback(path));
  },
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  onUpdateAvailable: (callback: () => void): void => {
    ipcRenderer.on('update-available', () => callback());
  },
  onUpdateDownloaded: (callback: () => void): void => {
    ipcRenderer.on('update-downloaded', () => callback());
  },
  installUpdate: (): void => ipcRenderer.send('install-update'),
});
