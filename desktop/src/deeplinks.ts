import { BrowserWindow } from 'electron';
import store from './store';

export function handleDeepLink(url: string, mainWindow: BrowserWindow | null): void {
  if (!mainWindow || !url.startsWith('meteoredit://')) return;

  const serverUrl = store.get('serverUrl');
  if (!serverUrl) return;

  const parsed = url.replace('meteoredit://', '');
  const [type, id] = parsed.split('/');

  let targetPath = '/';
  if (type === 'dossier' && id) {
    targetPath = `/dossier/${id}`;
  } else if (type === 'node' && id) {
    targetPath = `/node/${id}`;
  }

  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('navigate', targetPath);
}
