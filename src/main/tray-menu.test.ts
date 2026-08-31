import { describe, expect, test, vi } from 'vitest';
import type { MenuItemConstructorOptions } from 'electron';
import { buildTrayTemplate, type TrayMenuInput } from './tray-menu';
import { MESSAGES } from '../shared/i18n/messages';
import type { ServerEntry } from '../shared/types';

const servers: ServerEntry[] = [
  { id: 'a', label: 'Maison', url: 'https://a.example', lastUsedAt: 2 },
  { id: 'b', label: '', url: 'https://b.example', lastUsedAt: 1 }
];

const noop = () => {};
const actions = (): TrayMenuInput['actions'] => ({
  toggleNotifications: noop,
  toggleMicrophone: noop,
  switchServer: noop,
  openSettings: noop,
  showApp: noop,
  quit: noop
});

const input = (patch: Partial<TrayMenuInput> = {}): TrayMenuInput => ({
  locale: 'fr',
  servers,
  activeId: 'a',
  voice: { inVoice: false, muted: false },
  notificationsMuted: false,
  actions: actions(),
  ...patch
});

// Le template est plat : entetes, separateurs et entrees melees. On cherche par
// libelle plutot que par index, pour qu'un separateur ajoute ne casse pas tout.
const labels = (t: MenuItemConstructorOptions[]) => t.map((i) => i.label).filter(Boolean);
const find = (t: MenuItemConstructorOptions[], label: string) => t.find((i) => i.label === label);

describe('buildTrayTemplate', () => {
  test('tire tous ses libelles du catalogue, dans la locale demandee', () => {
    const fr = labels(buildTrayTemplate(input({ locale: 'fr' })));
    expect(fr).toContain(MESSAGES['tray-notifications'].fr);
    expect(fr).toContain(MESSAGES['tray-microphone'].fr);
    expect(fr).toContain(MESSAGES['tray-servers'].fr);
    expect(fr).toContain(MESSAGES['tray-show'].fr);
    expect(fr).toContain(MESSAGES['tray-quit'].fr);

    const cs = labels(buildTrayTemplate(input({ locale: 'cs' })));
    expect(cs).toContain(MESSAGES['tray-quit'].cs);
    expect(cs).not.toContain(MESSAGES['tray-quit'].fr);
  });

  test('les reglages sont a la RACINE, pas dans le sous-menu des serveurs', () => {
    const template = buildTrayTemplate(input());
    expect(labels(template)).toContain(MESSAGES['tray-settings'].fr);

    // Le sous-menu ne sert plus qu'a montrer et changer de serveur : ni entree
    // de reglages, ni separateur devenu inutile.
    const sub = find(template, MESSAGES['tray-servers'].fr)?.submenu as MenuItemConstructorOptions[];
    expect(labels(sub)).not.toContain(MESSAGES['tray-settings'].fr);
    expect(labels(sub)).not.toContain('Manage servers…');
    expect(sub.every((i) => i.type === 'radio')).toBe(true);
  });

  test('cliquer les reglages a la racine appelle openSettings', () => {
    const openSettings = vi.fn();
    const template = buildTrayTemplate(input({ actions: { ...actions(), openSettings } }));
    (find(template, MESSAGES['tray-settings'].fr)?.click as () => void)();
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  test('le sous-menu coche le serveur actif et lui seul', () => {
    const sub = find(buildTrayTemplate(input()), MESSAGES['tray-servers'].fr)
      ?.submenu as MenuItemConstructorOptions[];
    const radios = sub.filter((i) => i.type === 'radio');
    expect(radios.map((i) => i.label)).toEqual(['Maison', 'https://b.example']);
    expect(radios.map((i) => i.checked)).toEqual([true, false]);
  });

  test('choisir un serveur passe son id a switchServer', () => {
    const switchServer = vi.fn();
    const template = buildTrayTemplate(input({ actions: { ...actions(), switchServer } }));
    const sub = find(template, MESSAGES['tray-servers'].fr)?.submenu as MenuItemConstructorOptions[];
    const second = sub.filter((i) => i.type === 'radio')[1];
    (second.click as () => void)();
    expect(switchServer).toHaveBeenCalledWith('b');
  });

  test('sans aucun serveur, le sous-menu est desactive au lieu de s ouvrir vide', () => {
    const entry = find(buildTrayTemplate(input({ servers: [], activeId: null })),
      MESSAGES['tray-servers'].fr);
    expect(entry?.enabled).toBe(false);
    // Les reglages, eux, restent atteignables : c'est par la qu'on ajoute un
    // premier serveur.
    expect(labels(buildTrayTemplate(input({ servers: [], activeId: null }))))
      .toContain(MESSAGES['tray-settings'].fr);
  });

  test('le micro est desactive hors vocal, actif dedans', () => {
    const out = find(buildTrayTemplate(input()), MESSAGES['tray-microphone'].fr);
    expect(out?.enabled).toBe(false);
    expect(out?.checked).toBe(false);

    const inVoice = find(
      buildTrayTemplate(input({ voice: { inVoice: true, muted: false } })),
      MESSAGES['tray-microphone'].fr
    );
    expect(inVoice?.enabled).toBe(true);
    expect(inVoice?.checked).toBe(true);
  });

  test('la case Notifications est cochee quand elles NE sont PAS coupees', () => {
    const on = find(buildTrayTemplate(input()), MESSAGES['tray-notifications'].fr);
    expect(on?.checked).toBe(true);
    const off = find(
      buildTrayTemplate(input({ notificationsMuted: true })),
      MESSAGES['tray-notifications'].fr
    );
    expect(off?.checked).toBe(false);
  });

  test("l'entete porte le serveur actif et reste inerte", () => {
    const header = buildTrayTemplate(input())[0];
    expect(header.label).toBe('Bullshark — Maison');
    expect(header.enabled).toBe(false);

    const none = buildTrayTemplate(input({ activeId: null }))[0];
    expect(none.label).toBe('Bullshark');
  });
});
