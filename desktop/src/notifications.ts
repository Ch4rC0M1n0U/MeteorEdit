import { Notification, BrowserWindow } from 'electron';
import path from 'path';

export function showNativeNotification(
  title: string,
  body: string,
  mainWindow: BrowserWindow | null,
  onClick?: () => void
): void {
  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, '..', 'resources', 'icon.png'),
  });

  notification.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    onClick?.();
  });

  notification.show();
}
