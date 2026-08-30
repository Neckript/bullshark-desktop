import type { ServerEntry, Prefs, SourceDto } from '../shared/types';
import type { Locale } from '../shared/i18n/locales';

declare global {
  interface Window {
    shell: {
      servers: {
        list: () => Promise<ServerEntry[]>;
        add: (url: string, label: string) => Promise<{ ok: boolean; reason?: string; id?: string }>;
        update: (id: string, patch: Partial<ServerEntry>) => Promise<{ ok: boolean; reason?: string }>;
        remove: (id: string) => Promise<{ ok: boolean }>;
        switchTo: (id: string) => Promise<{ ok: boolean }>;
        validateUrl: (url: string) => Promise<{ ok: boolean; reason?: string; url?: string }>;
      };
      prefs: {
        get: () => Promise<Prefs>;
        set: (patch: Partial<Prefs>) => Promise<void>;
      };
      screen: {
        getSources: () => Promise<SourceDto[]>;
        choose: (id: string) => Promise<void>;
        cancel: () => Promise<void>;
      };
      locale: () => Promise<Locale>;
      version: () => Promise<string>;
      openRepository: () => Promise<void>;
      onServersChanged: (cb: () => void) => () => void;
    };
  }
}

export {};
