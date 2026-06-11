import { BrowserWindow } from 'electron';
import { BRIDGE } from '../shared/bridge';
import type { VoiceState } from '../shared/types';

let state: VoiceState = { inVoice: false, muted: false };
export const getVoiceState = () => state;

export const setVoiceState = (next: VoiceState) => { state = next; };

export const requestVoiceToggle = () => {
  BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(BRIDGE.voiceToggleRequest));
};
