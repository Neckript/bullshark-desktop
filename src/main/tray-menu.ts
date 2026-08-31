import type { MenuItemConstructorOptions } from 'electron';
import type { Locale } from '../shared/i18n/locales';
import { t } from '../shared/i18n/messages';
import type { ServerEntry, VoiceState } from '../shared/types';

// Le menu du tray est un menu Windows/macOS natif : Electron n'expose aucune
// API pour le styler, il suit le theme du systeme. Ce qui NOUS appartient, en
// revanche, c'est le texte — d'ou cette fonction pure, qui ne fait que decrire
// le menu. Tout ce qui touche a Electron reste dans tray.ts, et ce fichier se
// teste sans lancer d'application.
export type TrayMenuInput = {
  locale: Locale;
  servers: ServerEntry[];
  activeId: string | null;
  voice: VoiceState;
  notificationsMuted: boolean;
  actions: {
    toggleNotifications: () => void;
    toggleMicrophone: () => void;
    switchServer: (id: string) => void;
    openSettings: () => void;
    showApp: () => void;
    quit: () => void;
  };
};

export const buildTrayTemplate = ({
  locale,
  servers,
  activeId,
  voice,
  notificationsMuted,
  actions
}: TrayMenuInput): MenuItemConstructorOptions[] => {
  const active = servers.find((s) => s.id === activeId) ?? null;

  return [
    // Entete inerte : elle nomme le serveur courant, elle ne se clique pas.
    { label: active ? `Bullshark — ${active.label || active.url}` : 'Bullshark', enabled: false },
    { type: 'separator' },
    {
      label: t('tray-notifications', locale),
      type: 'checkbox',
      // Cochee = les notifications passent. C'est l'etat souhaite qu'on montre,
      // pas la coupure.
      checked: !notificationsMuted,
      click: actions.toggleNotifications
    },
    {
      label: t('tray-microphone', locale),
      type: 'checkbox',
      checked: voice.inVoice && !voice.muted,
      enabled: voice.inVoice,
      click: actions.toggleMicrophone
    },
    { type: 'separator' },
    {
      label: t('tray-servers', locale),
      submenu: [
        ...servers.map(
          (s): MenuItemConstructorOptions => ({
            label: s.label || s.url,
            type: 'radio',
            checked: s.id === activeId,
            click: () => actions.switchServer(s.id)
          })
        ),
        { type: 'separator' },
        { label: t('tray-settings', locale), click: actions.openSettings }
      ]
    },
    { type: 'separator' },
    { label: t('tray-show', locale), click: actions.showApp },
    { label: t('tray-quit', locale), click: actions.quit }
  ];
};
