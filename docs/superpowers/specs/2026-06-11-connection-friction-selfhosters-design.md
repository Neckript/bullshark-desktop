# Connection friction for self-hosters — Design

**Date:** 2026-06-11
**Status:** Approved (brainstorming)
**Scope:** Sub-project #1 of a 3-part effort to improve Bullshark Desktop for self-hosters.
Sub-projects #2 (client↔server version compatibility) and #3 (discovery / setup) get their
own specs later.

## Problem

Bullshark Desktop targets people who self-host their own Bullshark server. The Bullshark
server binary serves **plain HTTP on port 4991** and is *not fully functional over HTTP*
(voice/WebRTC, notifications and service workers require a secure context). The recommended
deployment therefore puts the server behind a reverse proxy that terminates TLS with a
**publicly trusted certificate** — Cloudflare today, Caddy + Let's Encrypt (via OVH/Hetzner
DNS) on the roadmap.

Two gaps make the first-connection experience worse than it should be for this audience:

1. `normalizeServerUrl` accepts `http://` silently, but an HTTP server gives a broken
   experience (no voice, no notifications).
2. The reachability probe returns a raw error string (`e.message`) or a bare `unreachable`,
   which is not actionable and is not localized — while the server itself ships 7 locales.

## Decisions (locked during brainstorming)

- **Force HTTPS.** Keep the existing `https://` default-scheme behaviour. No HTTP fallback.
- **Reject `http://` firmly** — remote *and* `localhost` (no exception). The desktop is for
  end users connecting to deployed HTTPS servers; an admin testing locally uses a browser,
  which the server already instructs (`open http://localhost:4991`).
- **Assume a valid public certificate.** Keep strict certificate rejection. No self-signed /
  cert-pinning support — that case is the deployment path the project actively discourages.
- **Localized, actionable errors** in 7 languages with parity to the server:
  `cs, en, es, fr, it, ru, zh`. Detect via `app.getLocale()`, fall back to `en`.
- **No external link for now.** Error text is actionable on its own ("put your server behind
  an HTTPS proxy…"); a deploy-guide URL is added later when the guide exists.

## Architecture

Chosen approach: **stable error codes + a shared i18n catalogue** (Approach A).

The main process never produces user-facing text. Validation and the probe emit **stable
codes**; a pure, shared i18n module maps `code + locale → message`. This keeps network/main
logic testable against codes (not translated strings), centralizes translations, and keeps a
single source of truth for the locale.

```
src/main/servers/url.ts        → emits reason code  http-not-allowed (+ existing codes)
src/main/servers/validate.ts   → maps fetch errors to stable probe codes
src/shared/i18n/               → catalogues + resolveLocale() + t(code, locale)
src/main (startup)             → resolveLocale(app.getLocale()), exposed to renderer via IPC
src/renderer/pages/*.tsx       → render localized message from code + locale
```

### 1. URL validation — `src/main/servers/url.ts`

- Keep: default-prepend `https://` when no scheme present; strip trailing slash; reject empty
  and non-http(s) schemes.
- Change: reject `http:` with `{ ok: false, reason: 'http-not-allowed' }`. This applies to all
  hosts, including `localhost` / `127.0.0.1`.
- `reason` values become part of the stable error-code set consumed by i18n.

### 2. Probe categorization — `src/main/servers/validate.ts`

Replace the raw `e.message` / `unreachable` result with a stable `reason` code. The probe keeps
its `{ reachable, status?, reason? }` shape; `reason` is now drawn from a fixed set.

| Real cause                         | Detection signal                          | Code                 |
|------------------------------------|-------------------------------------------|----------------------|
| Untrusted / invalid certificate    | cert-related error (e.g. `CERT_`, `cert`) | `cert-untrusted`     |
| Host not found (DNS)               | `ENOTFOUND` / `EAI_AGAIN`                  | `dns-failure`        |
| Connection refused                 | `ECONNREFUSED`                             | `connection-refused` |
| Timeout / aborted                  | `AbortError` / abort signal               | `timeout`            |
| HTTP 5xx response                  | `status >= 500`                            | `server-error`       |
| Anything else                      | fallback                                   | `unreachable`        |

Detection inspects the thrown error's `code`/`name`/`message`. Mapping lives in a small pure
helper (`classifyProbeError`) so it is unit-testable without real network calls.

### 3. Shared i18n — `src/shared/i18n/`

- `locales.ts` — the supported set `['cs','en','es','fr','it','ru','zh']` and
  `resolveLocale(raw: string): Locale` (normalize e.g. `fr-FR` → `fr`; unknown → `en`).
- `messages.ts` — catalogue keyed by error code, one entry per supported locale, for every
  code: `http-not-allowed`, `cert-untrusted`, `dns-failure`, `connection-refused`, `timeout`,
  `server-error`, `unreachable`, plus the existing url reasons surfaced to the user
  (`empty`, `invalid`, `scheme`).
- `t(code: ErrorCode, locale: Locale): string` — pure lookup, falls back to `en` if a locale
  entry is missing.

### 4. Locale plumbing

- At startup the main process computes `resolveLocale(app.getLocale())`.
- Exposed to the renderer through the existing IPC/preload mechanism (alongside current
  `prefsGet`-style calls) as a `locale` value the renderer reads once.
- No dynamic language switching in this sub-project (YAGNI) — locale is read at launch.

### 5. Renderer display — `src/renderer/pages/Onboarding.tsx`, `Servers.tsx`

- On a failed validation/probe, take the returned `reason` code and the resolved `locale` and
  render `t(code, locale)`.
- Message is shown inline near the URL field. No external link in this iteration.

## Error/failure handling

- Unknown/unmapped probe errors fall through to `unreachable` (never a raw stack/message
  reaches the UI).
- Missing locale entry in the catalogue falls back to `en` rather than showing a bare code.
- `app.getLocale()` returning an unexpected/empty value resolves to `en`.

## Testing

- **`url.ts`** — `http://host`, `http://localhost:4991`, and `http://127.0.0.1` all rejected
  with `http-not-allowed`; bare host and `https://` still normalize OK; existing trailing-slash
  / empty / non-http(s) cases preserved.
- **`classifyProbeError`** — each signal (cert / DNS / refused / timeout / 5xx / other) maps to
  the expected code, using a mocked `fetchImpl` and synthesized errors.
- **i18n** — every error code has an entry in all 7 locales; `resolveLocale` normalizes region
  variants and maps unknown → `en`; `t` falls back to `en` for a missing entry.
- Existing probe/store/session/url tests continue to pass.

## Out of scope (future sub-projects)

- #2 — client↔server version compatibility warnings.
- #3 — discovery / deployment docs / port detection / share links.
- Self-signed certificate trust/pinning (explicitly declined).
- A live deploy-guide URL (added when the guide exists).
- Dynamic in-app language switching.
