import { BrowserWindow } from 'electron';
import { BRIDGE } from '../shared/bridge';

let muted = false;
export const isNotificationsMuted = () => muted;
export const setNotificationsMuted = (value: boolean) => {
  muted = value;
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(BRIDGE.setMuted, value));
};
