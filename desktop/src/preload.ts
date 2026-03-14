import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getServerUrl: (): Promise<string> => ipcRenderer.invoke('get-server-url'),
  setServerUrl: (url: string): Promise<void> => ipcRenderer.invoke('set-server-url', url),
  testServerConnection: (url: string): Promise<boolean> => ipcRenderer.invoke('test-server-connection', url),
  showNotification: (title: string, body: string): void => ipcRenderer.send('show-notification', title, body),
  onDeepLink: (callback: (url: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on('deep-link', handler);
    return () => { ipcRenderer.removeListener('deep-link', handler); };
  },
  onNavigate: (callback: (path: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on('navigate', handler);
    return () => { ipcRenderer.removeListener('navigate', handler); };
  },
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  onUpdateAvailable: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('update-available', handler);
    return () => { ipcRenderer.removeListener('update-available', handler); };
  },
  onUpdateDownloaded: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('update-downloaded', handler);
    return () => { ipcRenderer.removeListener('update-downloaded', handler); };
  },
  installUpdate: (): void => ipcRenderer.send('install-update'),
  setTitleBarOverlay: (options: { color: string; symbolColor: string; height: number }): void =>
    ipcRenderer.send('set-titlebar-overlay', options),
  setUserInfo: (info: { name: string; email: string } | null): void =>
    ipcRenderer.send('set-user-info', info),
  setBranding: (branding: { appName: string; logoUrl: string }): void =>
    ipcRenderer.send('set-branding', branding),
});
