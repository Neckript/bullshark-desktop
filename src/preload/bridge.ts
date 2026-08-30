import { contextBridge, ipcRenderer } from 'electron';
import { BRIDGE } from '../shared/bridge';
import type { VoiceState, CompatBannerPayload, UpdateBannerPayload } from '../shared/types';

let muted = false;
ipcRenderer.on(BRIDGE.setMuted, (_e, value: boolean) => { muted = value; });

const showCompatBanner = ({ verdict, message }: CompatBannerPayload) => {
  const inject = () => {
    document.getElementById('bullshark-compat-banner')?.remove();
    const bar = document.createElement('div');
    bar.id = 'bullshark-compat-banner';
    bar.textContent = message;
    Object.assign(bar.style, {
      position: 'fixed', top: '0', left: '0', right: '0', zIndex: '2147483647',
      padding: '8px 40px 8px 12px', fontFamily: 'system-ui, sans-serif',
      fontSize: '13px', lineHeight: '1.4',
      color: verdict === 'too-old' ? '#ffffff' : '#222222',
      background: verdict === 'too-old' ? '#c0392b' : '#f0ad4e',
      boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
    } as Partial<CSSStyleDeclaration>);
    const close = document.createElement('button');
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Dismiss');
    Object.assign(close.style, {
      position: 'absolute', top: '4px', right: '8px', background: 'transparent',
      border: 'none', color: 'inherit', fontSize: '14px', cursor: 'pointer'
    } as Partial<CSSStyleDeclaration>);
    close.addEventListener('click', () => bar.remove());
    bar.appendChild(close);
    document.body.appendChild(bar);
  };
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject, { once: true });
};

ipcRenderer.on(BRIDGE.compat, (_e, payload: CompatBannerPayload) => showCompatBanner(payload));

const showUpdateBanner = ({ message, reloadLabel }: UpdateBannerPayload) => {
  const inject = () => {
    document.getElementById('bullshark-update-banner')?.remove();
    const bar = document.createElement('div');
    bar.id = 'bullshark-update-banner';
    Object.assign(bar.style, {
      position: 'fixed', top: '0', left: '0', right: '0', zIndex: '2147483647',
      padding: '8px 40px 8px 12px', fontFamily: 'system-ui, sans-serif',
      fontSize: '13px', lineHeight: '1.4', color: '#ffffff',
      background: '#2d7d46', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: '12px'
    } as Partial<CSSStyleDeclaration>);

    const label = document.createElement('span');
    label.textContent = message;
    label.style.flex = '1';

    const reload = document.createElement('button');
    reload.textContent = reloadLabel;
    Object.assign(reload.style, {
      background: '#ffffff', color: '#2d7d46', border: 'none',
      borderRadius: '4px', padding: '4px 12px', fontSize: '13px',
      fontWeight: '600', cursor: 'pointer', flex: '0 0 auto'
    } as Partial<CSSStyleDeclaration>);
    reload.addEventListener('click', () => ipcRenderer.send(BRIDGE.reloadRequest));

    const close = document.createElement('button');
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Dismiss');
    Object.assign(close.style, {
      position: 'absolute', top: '4px', right: '8px', background: 'transparent',
      border: 'none', color: 'inherit', fontSize: '14px', cursor: 'pointer'
    } as Partial<CSSStyleDeclaration>);
    close.addEventListener('click', () => bar.remove());

    bar.appendChild(label);
    bar.appendChild(reload);
    bar.appendChild(close);
    document.body.appendChild(bar);
  };
  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject, { once: true });
};

ipcRenderer.on(BRIDGE.updateAvailable, (_e, payload: UpdateBannerPayload) => showUpdateBanner(payload));

// NOTE: we deliberately do NOT override window.Notification here. Under
// contextIsolation the preload's globals are isolated from the page, so an
// override would have no effect. DND is enforced by the web app companion
// change consulting notifications.isMuted() before calling new Notification().
contextBridge.exposeInMainWorld('bullshark', {
  isDesktop: true,
  notifications: { isMuted: () => muted },
  voice: {
    reportState: (state: VoiceState) => ipcRenderer.send(BRIDGE.voiceState, state),
    onToggleRequest: (cb: () => void) => {
      const h = () => cb();
      ipcRenderer.on(BRIDGE.voiceToggleRequest, h);
      return () => ipcRenderer.removeListener(BRIDGE.voiceToggleRequest, h);
    }
  },
  setTitleBarColors: (colors: { color: string; symbolColor: string }) =>
    ipcRenderer.send(BRIDGE.titleBarColors, colors),
  focusWindow: () => ipcRenderer.send(BRIDGE.focusWindow),
  onMuteChanged: (cb: (muted: boolean) => void) => {
    const h = (_e: unknown, v: boolean) => cb(v);
    ipcRenderer.on(BRIDGE.setMuted, h);
    return () => ipcRenderer.removeListener(BRIDGE.setMuted, h);
  }
});
