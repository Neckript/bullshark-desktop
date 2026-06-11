# Connection Friction for Self-Hosters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a self-hoster's first connection succeed or fail clearly: force HTTPS, reject HTTP, and turn raw network errors into localized, actionable messages in the server's 7 languages.

**Architecture:** The main process never produces user-facing text. URL validation and the reachability probe emit **stable error codes**; a pure shared i18n module maps `code + locale → message`. The renderer resolves the locale once (from `app.getLocale()` via IPC) and renders `t(code, locale)`. No certificate handling, no HTTP fallback.

**Tech Stack:** Electron, TypeScript, React, Vitest, electron-vite.

Spec: `docs/superpowers/specs/2026-06-11-connection-friction-selfhosters-design.md`

---

## File Structure

**Create:**
- `src/shared/i18n/locales.ts` — `Locale` type, `SUPPORTED_LOCALES`, `resolveLocale()`.
- `src/shared/i18n/locales.test.ts` — locale resolution tests.
- `src/shared/i18n/messages.ts` — `ErrorCode`, `MESSAGES` catalogue (7 locales), `t()`.
- `src/shared/i18n/messages.test.ts` — catalogue completeness + `t()` tests.

**Modify:**
- `src/main/servers/url.ts` — reject `http://` with `http-not-allowed`.
- `src/main/servers/url.test.ts` — update HTTP test, add localhost/IP cases.
- `src/main/servers/validate.ts` — add `classifyProbeError`, emit stable codes.
- `src/main/servers/validate.test.ts` — classifier tests.
- `src/shared/ipc.ts` — add `appLocale` channel.
- `src/main/ipc.ts` — register `appLocale` handler.
- `src/preload/shell.ts` — expose `locale()`.
- `src/renderer/shell.d.ts` — type `locale()`.
- `src/renderer/pages/Onboarding.tsx` — validate-then-add, localized errors.
- `src/renderer/pages/Servers.tsx` — localized add errors.

---

## Task 1: Locale resolution module

**Files:**
- Create: `src/shared/i18n/locales.ts`
- Test: `src/shared/i18n/locales.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/shared/i18n/locales.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { resolveLocale, SUPPORTED_LOCALES } from './locales';

describe('resolveLocale', () => {
  test('normalizes a region variant to its base language', () => {
    expect(resolveLocale('fr-FR')).toBe('fr');
  });
  test('is case-insensitive', () => {
    expect(resolveLocale('FR')).toBe('fr');
  });
  test('handles multi-part tags', () => {
    expect(resolveLocale('zh-Hans-CN')).toBe('zh');
  });
  test('falls back to en for unsupported languages', () => {
    expect(resolveLocale('pt-BR')).toBe('en');
  });
  test('falls back to en for empty or missing input', () => {
    expect(resolveLocale('')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
    expect(resolveLocale(null)).toBe('en');
  });
  test('supports exactly the 7 server locales', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(['cs', 'en', 'es', 'fr', 'it', 'ru', 'zh']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- locales`
Expected: FAIL — cannot resolve `./locales`.

- [ ] **Step 3: Write minimal implementation**

Create `src/shared/i18n/locales.ts`:

```ts
export const SUPPORTED_LOCALES = ['cs', 'en', 'es', 'fr', 'it', 'ru', 'zh'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const resolveLocale = (raw: string | undefined | null): Locale => {
  const base = (raw ?? '').toLowerCase().split('-')[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(base) ? (base as Locale) : 'en';
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- locales`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/i18n/locales.ts src/shared/i18n/locales.test.ts
git commit -m "feat(i18n): resolveLocale with 7 server locales + en fallback"
```

---

## Task 2: Error message catalogue + t()

**Files:**
- Create: `src/shared/i18n/messages.ts`
- Test: `src/shared/i18n/messages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/shared/i18n/messages.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { ERROR_CODES, MESSAGES, t } from './messages';
import { SUPPORTED_LOCALES } from './locales';

describe('messages catalogue', () => {
  test('every error code has a non-empty entry in all 7 locales', () => {
    for (const code of ERROR_CODES) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(MESSAGES[code][locale]?.length, `${code}/${locale}`).toBeGreaterThan(0);
      }
    }
  });
  test('t returns the localized string for a known code', () => {
    expect(t('http-not-allowed', 'fr')).toBe(MESSAGES['http-not-allowed'].fr);
    expect(t('cert-untrusted', 'ru')).toBe(MESSAGES['cert-untrusted'].ru);
  });
  test('t falls back to the unreachable message for an unknown code', () => {
    expect(t('totally-unknown', 'en')).toBe(MESSAGES.unreachable.en);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- messages`
Expected: FAIL — cannot resolve `./messages`.

- [ ] **Step 3: Write minimal implementation**

Create `src/shared/i18n/messages.ts`:

```ts
import type { Locale } from './locales';

export const ERROR_CODES = [
  'empty',
  'invalid',
  'scheme',
  'http-not-allowed',
  'cert-untrusted',
  'dns-failure',
  'connection-refused',
  'timeout',
  'server-error',
  'unreachable',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

type Catalogue = Record<ErrorCode, Record<Locale, string>>;

export const MESSAGES: Catalogue = {
  empty: {
    en: 'Please enter a server URL.',
    fr: "Saisis l'URL de ton serveur.",
    es: 'Introduce la URL de tu servidor.',
    it: "Inserisci l'URL del tuo server.",
    ru: 'Введите URL вашего сервера.',
    zh: '请输入服务器地址。',
    cs: 'Zadejte adresu URL svého serveru.',
  },
  invalid: {
    en: "That doesn't look like a valid URL.",
    fr: 'Cette URL ne semble pas valide.',
    es: 'Esa URL no parece válida.',
    it: 'Questo URL non sembra valido.',
    ru: 'Это не похоже на корректный URL.',
    zh: '这看起来不是有效的网址。',
    cs: 'Tato adresa URL nevypadá platně.',
  },
  scheme: {
    en: 'Only HTTPS servers are supported.',
    fr: 'Seuls les serveurs HTTPS sont pris en charge.',
    es: 'Solo se admiten servidores HTTPS.',
    it: 'Sono supportati solo server HTTPS.',
    ru: 'Поддерживаются только серверы HTTPS.',
    zh: '仅支持 HTTPS 服务器。',
    cs: 'Podporovány jsou pouze servery HTTPS.',
  },
  'http-not-allowed': {
    en: "Bullshark requires HTTPS — voice and notifications don't work over HTTP. Put your server behind an HTTPS proxy.",
    fr: "Bullshark nécessite HTTPS — la voix et les notifications ne fonctionnent pas en HTTP. Place ton serveur derrière un proxy HTTPS.",
    es: 'Bullshark requiere HTTPS: la voz y las notificaciones no funcionan por HTTP. Coloca tu servidor detrás de un proxy HTTPS.',
    it: 'Bullshark richiede HTTPS: voce e notifiche non funzionano via HTTP. Metti il tuo server dietro un proxy HTTPS.',
    ru: 'Bullshark требует HTTPS — голос и уведомления не работают по HTTP. Разместите сервер за HTTPS-прокси.',
    zh: 'Bullshark 需要 HTTPS——语音和通知在 HTTP 下无法使用。请将服务器置于 HTTPS 代理之后。',
    cs: 'Bullshark vyžaduje HTTPS – hlas a oznámení přes HTTP nefungují. Umístěte server za HTTPS proxy.',
  },
  'cert-untrusted': {
    en: "The server's certificate isn't trusted. Put your server behind a proxy with a valid certificate (Cloudflare, or Caddy + Let's Encrypt).",
    fr: "Le certificat du serveur n'est pas reconnu. Place ton serveur derrière un proxy avec un certificat valide (Cloudflare, ou Caddy + Let's Encrypt).",
    es: "El certificado del servidor no es de confianza. Coloca tu servidor detrás de un proxy con un certificado válido (Cloudflare, o Caddy + Let's Encrypt).",
    it: "Il certificato del server non è attendibile. Metti il tuo server dietro un proxy con un certificato valido (Cloudflare, o Caddy + Let's Encrypt).",
    ru: 'Сертификат сервера не является доверенным. Разместите сервер за прокси с действительным сертификатом (Cloudflare или Caddy + Let\'s Encrypt).',
    zh: "服务器的证书不受信任。请将服务器置于具有有效证书的代理之后（Cloudflare，或 Caddy + Let's Encrypt）。",
    cs: "Certifikát serveru není důvěryhodný. Umístěte server za proxy s platným certifikátem (Cloudflare nebo Caddy + Let's Encrypt).",
  },
  'dns-failure': {
    en: "Couldn't find that server. Check the address for typos.",
    fr: "Serveur introuvable. Vérifie l'adresse (fautes de frappe).",
    es: 'No se encontró el servidor. Revisa la dirección por si hay errores.',
    it: "Server non trovato. Controlla l'indirizzo per eventuali errori.",
    ru: 'Сервер не найден. Проверьте адрес на опечатки.',
    zh: '找不到该服务器。请检查地址是否有误。',
    cs: 'Server nebyl nalezen. Zkontrolujte adresu, zda neobsahuje překlepy.',
  },
  'connection-refused': {
    en: "The server refused the connection. Check it's running and the port is reachable.",
    fr: "Le serveur a refusé la connexion. Vérifie qu'il tourne et que le port est accessible.",
    es: 'El servidor rechazó la conexión. Comprueba que está en marcha y que el puerto es accesible.',
    it: 'Il server ha rifiutato la connessione. Verifica che sia in esecuzione e che la porta sia raggiungibile.',
    ru: 'Сервер отклонил подключение. Убедитесь, что он запущен и порт доступен.',
    zh: '服务器拒绝了连接。请确认它正在运行且端口可访问。',
    cs: 'Server odmítl připojení. Ověřte, že běží a že je port dostupný.',
  },
  timeout: {
    en: 'The server took too long to respond. Check the address and your network.',
    fr: "Le serveur a mis trop de temps à répondre. Vérifie l'adresse et ta connexion.",
    es: 'El servidor tardó demasiado en responder. Revisa la dirección y tu red.',
    it: "Il server ha impiegato troppo tempo a rispondere. Controlla l'indirizzo e la rete.",
    ru: 'Сервер слишком долго не отвечает. Проверьте адрес и сеть.',
    zh: '服务器响应超时。请检查地址和网络。',
    cs: 'Server odpovídal příliš dlouho. Zkontrolujte adresu a síť.',
  },
  'server-error': {
    en: 'The server responded with an error. It may be misconfigured or still starting up.',
    fr: 'Le serveur a renvoyé une erreur. Il est peut-être mal configuré ou en cours de démarrage.',
    es: 'El servidor respondió con un error. Puede estar mal configurado o iniciándose.',
    it: 'Il server ha risposto con un errore. Potrebbe essere mal configurato o in fase di avvio.',
    ru: 'Сервер ответил с ошибкой. Возможно, он неправильно настроен или запускается.',
    zh: '服务器返回错误。可能配置有误或正在启动。',
    cs: 'Server odpověděl chybou. Možná je špatně nakonfigurován nebo se spouští.',
  },
  unreachable: {
    en: "Couldn't reach the server. Check the address and your network.",
    fr: "Impossible de joindre le serveur. Vérifie l'adresse et ta connexion.",
    es: 'No se pudo contactar con el servidor. Revisa la dirección y tu red.',
    it: 'Impossibile raggiungere il server. Controlla l\'indirizzo e la rete.',
    ru: 'Не удалось подключиться к серверу. Проверьте адрес и сеть.',
    zh: '无法连接到服务器。请检查地址和网络。',
    cs: 'Server není dostupný. Zkontrolujte adresu a síť.',
  },
};

export const t = (code: string, locale: Locale): string => {
  const entry = MESSAGES[code as ErrorCode] ?? MESSAGES.unreachable;
  return entry[locale] ?? entry.en;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- messages`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/i18n/messages.ts src/shared/i18n/messages.test.ts
git commit -m "feat(i18n): error message catalogue (7 locales) + t()"
```

---

## Task 3: Reject http:// in URL normalization

**Files:**
- Modify: `src/main/servers/url.ts`
- Test: `src/main/servers/url.test.ts`

- [ ] **Step 1: Update the failing tests**

In `src/main/servers/url.test.ts`, **replace** the existing test `keeps http when explicit` with the block below (the others stay as they are):

```ts
  test('rejects explicit http (remote)', () => {
    expect(normalizeServerUrl('http://chat.example.com')).toEqual({ ok: false, reason: 'http-not-allowed' });
  });
  test('rejects http on localhost (no exception)', () => {
    expect(normalizeServerUrl('http://localhost:4991').ok).toBe(false);
    expect(normalizeServerUrl('http://localhost:4991').reason).toBe('http-not-allowed');
  });
  test('rejects http on a bare IP', () => {
    expect(normalizeServerUrl('http://192.168.1.42:4991').reason).toBe('http-not-allowed');
  });
  test('defaults a bare host to https', () => {
    expect(normalizeServerUrl('192.168.1.42:4991')).toEqual({ ok: true, url: 'https://192.168.1.42:4991' });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- url`
Expected: FAIL — current code returns `{ ok: true }` for `http://` URLs.

- [ ] **Step 3: Edit the implementation**

In `src/main/servers/url.ts`, **replace** this block:

```ts
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'scheme' };
  }
```

with:

```ts
  if (parsed.protocol === 'http:') {
    return { ok: false, reason: 'http-not-allowed' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'scheme' };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- url`
Expected: PASS (all url tests, including the new HTTP-rejection cases).

- [ ] **Step 5: Commit**

```bash
git add src/main/servers/url.ts src/main/servers/url.test.ts
git commit -m "feat(servers): reject http:// (remote + localhost) as http-not-allowed"
```

---

## Task 4: Categorize probe errors into stable codes

**Files:**
- Modify: `src/main/servers/validate.ts`
- Test: `src/main/servers/validate.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/main/servers/validate.test.ts`, add these tests (keep the existing three) and add `classifyProbeError` to the import:

```ts
import { classifyProbeError, probeServer } from './validate';

describe('classifyProbeError', () => {
  test('cert errors → cert-untrusted', () => {
    expect(classifyProbeError({ cause: { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' } })).toBe('cert-untrusted');
    expect(classifyProbeError(new Error('unable to verify the first certificate'))).toBe('cert-untrusted');
  });
  test('DNS errors → dns-failure', () => {
    expect(classifyProbeError({ code: 'ENOTFOUND' })).toBe('dns-failure');
    expect(classifyProbeError({ cause: { code: 'EAI_AGAIN' } })).toBe('dns-failure');
  });
  test('refused → connection-refused', () => {
    expect(classifyProbeError({ cause: { code: 'ECONNREFUSED' } })).toBe('connection-refused');
  });
  test('abort/timeout → timeout', () => {
    expect(classifyProbeError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe('timeout');
  });
  test('anything else → unreachable', () => {
    expect(classifyProbeError(new Error('weird'))).toBe('unreachable');
  });
});

describe('probeServer reason codes', () => {
  test('5xx → server-error', async () => {
    const res = await probeServer('https://a.com', async () => ({ ok: false, status: 503 }) as Response);
    expect(res.reason).toBe('server-error');
  });
  test('thrown DNS error → dns-failure', async () => {
    const res = await probeServer('https://a.com', async () => { throw { code: 'ENOTFOUND' }; });
    expect(res).toEqual({ reachable: false, reason: 'dns-failure' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- validate`
Expected: FAIL — `classifyProbeError` is not exported.

- [ ] **Step 3: Edit the implementation**

Replace the full contents of `src/main/servers/validate.ts` with:

```ts
export type ProbeReason =
  | 'cert-untrusted'
  | 'dns-failure'
  | 'connection-refused'
  | 'timeout'
  | 'server-error'
  | 'unreachable';

export type ProbeResult = { reachable: boolean; status?: number; reason?: ProbeReason };
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const classifyProbeError = (err: unknown): Exclude<ProbeReason, 'server-error'> => {
  const e = err as { code?: string; name?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = e?.code ?? e?.cause?.code ?? '';
  const name = e?.name ?? '';
  const msg = `${e?.message ?? ''} ${e?.cause?.message ?? ''}`;

  if (name === 'AbortError' || name === 'TimeoutError' || code === 'UND_ERR_CONNECT_TIMEOUT') return 'timeout';
  if (code === 'ECONNREFUSED') return 'connection-refused';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'dns-failure';
  if (code.includes('CERT') || /self.?signed|certificate|unable to verify/i.test(msg)) return 'cert-untrusted';
  return 'unreachable';
};

export const probeServer = async (
  url: string,
  fetchImpl: FetchLike = fetch,
  timeoutMs = 5000
): Promise<ProbeResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: 'GET', signal: controller.signal });
    if (res.status >= 500) return { reachable: false, status: res.status, reason: 'server-error' };
    return { reachable: true, status: res.status };
  } catch (e) {
    return { reachable: false, reason: classifyProbeError(e) };
  } finally {
    clearTimeout(timer);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- validate`
Expected: PASS (existing 3 + new classifier/probe tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/servers/validate.ts src/main/servers/validate.test.ts
git commit -m "feat(servers): classify probe errors into stable reason codes"
```

---

## Task 5: Expose resolved locale to the renderer

**Files:**
- Modify: `src/shared/ipc.ts`, `src/main/ipc.ts`, `src/preload/shell.ts`, `src/renderer/shell.d.ts`

This task wires IPC; it is verified by `typecheck` (no unit test — it crosses the Electron process boundary).

- [ ] **Step 1: Add the IPC channel name**

In `src/shared/ipc.ts`, add `appLocale` to the `IPC` object (after `serversChanged`):

```ts
export const IPC = {
  serversList: 'servers:list',
  serversAdd: 'servers:add',
  serversUpdate: 'servers:update',
  serversRemove: 'servers:remove',
  serversSwitch: 'servers:switch',
  serversValidate: 'servers:validate',
  prefsGet: 'prefs:get',
  prefsSet: 'prefs:set',
  serversChanged: 'servers:changed',
  appLocale: 'app:locale'
} as const;
```

- [ ] **Step 2: Register the handler in main**

In `src/main/ipc.ts`, add `app` to the electron import and register the handler. Change the import line:

```ts
import { app, BrowserWindow, ipcMain } from 'electron';
```

Add this import near the other `./servers/*` imports:

```ts
import { resolveLocale } from '../shared/i18n/locales';
```

Inside `registerIpc`, add (next to the other `ipcMain.handle` calls):

```ts
  ipcMain.handle(IPC.appLocale, () => resolveLocale(app.getLocale()));
```

- [ ] **Step 3: Expose it in the preload**

In `src/preload/shell.ts`, add `Locale` to imports:

```ts
import type { Locale } from '../shared/i18n/locales';
```

Add a `locale` method to the exposed object (after the `prefs` block, before `onServersChanged`):

```ts
  locale: (): Promise<Locale> => ipcRenderer.invoke(IPC.appLocale),
```

- [ ] **Step 4: Type it in the renderer global**

In `src/renderer/shell.d.ts`, add the import and the method. Change the first line to:

```ts
import type { ServerEntry, Prefs } from '../shared/types';
import type { Locale } from '../shared/i18n/locales';
```

Add inside the `shell` interface (after the `prefs` block):

```ts
      locale: () => Promise<Locale>;
```

- [ ] **Step 5: Verify types compile**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 6: Commit**

```bash
git add src/shared/ipc.ts src/main/ipc.ts src/preload/shell.ts src/renderer/shell.d.ts
git commit -m "feat(ipc): expose resolved app locale to the renderer"
```

---

## Task 6: Localized, actionable errors in the UI

**Files:**
- Modify: `src/renderer/pages/Onboarding.tsx`, `src/renderer/pages/Servers.tsx`

Onboarding now **validates (probes) before adding**, so the full error set (cert/DNS/timeout/…) reaches the user. Verified by `typecheck` + manual smoke (no renderer unit harness in this repo).

- [ ] **Step 1: Rewrite Onboarding**

Replace the full contents of `src/renderer/pages/Onboarding.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import { t } from '../../shared/i18n/messages';
import type { Locale } from '../../shared/i18n/locales';

export const Onboarding = () => {
  const [url, setUrl] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { void window.shell.locale().then(setLocale); }, []);

  const onSubmit = async () => {
    setError(null);
    setChecking(true);
    try {
      const v = await window.shell.servers.validateUrl(url);
      if (!v.ok) { setError(t(v.reason ?? 'unreachable', locale)); return; }
      const res = await window.shell.servers.add(url, '');
      if (res.ok && res.id) {
        await window.shell.servers.switchTo(res.id);
        window.close();
      } else {
        setError(t(res.reason ?? 'unreachable', locale));
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2>Connect to your Bullshark server</h2>
      <p>Enter the URL of your Bullshark instance.</p>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://chat.example.com"
        style={{ width: '100%', padding: 8 }}
      />
      <button onClick={onSubmit} disabled={checking} style={{ marginTop: 12 }}>
        {checking ? 'Checking…' : 'Connect'}
      </button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  );
};
```

- [ ] **Step 2: Update Servers to show localized add errors**

Replace the full contents of `src/renderer/pages/Servers.tsx` with:

```tsx
import { useEffect, useState } from 'react';
import type { ServerEntry } from '../../shared/types';
import type { Locale } from '../../shared/i18n/locales';
import { t } from '../../shared/i18n/messages';

export const Servers = () => {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [url, setUrl] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => setServers(await window.shell.servers.list());
  useEffect(() => { void refresh(); return window.shell.onServersChanged(refresh); }, []);
  useEffect(() => { void window.shell.locale().then(setLocale); }, []);

  const add = async () => {
    setError(null);
    const v = await window.shell.servers.validateUrl(url);
    if (!v.ok) { setError(t(v.reason ?? 'unreachable', locale)); return; }
    const r = await window.shell.servers.add(url, '');
    if (r.ok) { setUrl(''); } else { setError(t(r.reason ?? 'unreachable', locale)); }
  };

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2>Servers</h2>
      <ul>
        {servers.map((s) => (
          <li key={s.id}>
            {s.label || s.url}
            <button onClick={() => window.shell.servers.switchTo(s.id)}>Open</button>
            <button onClick={() => window.shell.servers.remove(s.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://chat.example.com" />
      <button onClick={add}>Add</button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </div>
  );
};
```

- [ ] **Step 3: Verify the whole suite + types + lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all PASS.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run: `npm run dev`
- Type `http://localhost:4991` → expect the HTTP-not-allowed message in your system language (English if unsupported).
- Type `https://nonexistent.invalid` → expect the DNS / unreachable message.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pages/Onboarding.tsx src/renderer/pages/Servers.tsx
git commit -m "feat(ui): localized, actionable connection errors (validate-then-add)"
```

---

## Self-Review Notes

- **Spec coverage:** force HTTPS (Task 3 keeps https default), reject http incl. localhost (Task 3), strict cert / no self-signed (no cert code added — preserved), probe codes (Task 4), 7-locale catalogue + resolveLocale + en fallback (Tasks 1–2), locale plumbing (Task 5), localized actionable UI with no external link (Task 6). All covered.
- **No placeholders:** every code/translation is concrete.
- **Type consistency:** `reason` codes emitted by `url.ts` (`http-not-allowed`, `scheme`, `invalid`, `empty`) and `validate.ts` (`ProbeReason`) are all members of `ERROR_CODES`; `t()` accepts `string` and falls back, so UI `res.reason` (typed `string`) passes cleanly. `Locale` is imported consistently in preload, shell.d.ts, and both pages.
- **Note for executor:** `prefsSet` and `serversUpdate`/`Remove`/`Switch` can still return `reason: 'not-found'`, which is not in `ERROR_CODES`; those paths are not surfaced through `t()` in this plan, so `t('not-found', …)` would fall back to the `unreachable` message if ever wired — acceptable, out of scope here.
