import { autoUpdater } from 'electron-updater';
import { BrowserWindow } from 'electron';
import { showNativeNotification } from './notifications';

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-available');
    showNativeNotification(
      'Mise à jour disponible',
      'Une nouvelle version de MeteorEdit est en cours de téléchargement.',
      mainWindow
    );
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
    showNativeNotification(
      'Mise à jour prête',
      'Redémarrez MeteorEdit pour installer la mise à jour.',
      mainWindow
    );
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err);
  });

  autoUpdater.checkForUpdatesAndNotify().catch(console.error);
}
