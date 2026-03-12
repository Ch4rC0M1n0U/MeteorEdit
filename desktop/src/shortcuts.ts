import { globalShortcut, BrowserWindow } from 'electron';

export function registerShortcuts(mainWindow: BrowserWindow): void {
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}
