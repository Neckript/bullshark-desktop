# Client↔Server Version Compatibility — Design

**Date:** 2026-06-11
**Status:** Approved (brainstorming)
**Scope:** Sub-project #2 of the self-hoster UX effort. #1 (connection friction) is done.
#3 (discovery / deployment docs / share links) gets its own spec later.

## Problem

Bullshark Desktop wraps the server's own web UI, so the web app always matches the server
version — there is no risk of a stale client bundle. The only desktop-specific coupling is the
`window.bullshark` bridge plus the "companion change" the server's web app must adopt to light
up the three native features from #1 (notification DND, mic mute, notification-click focus).

Today the desktop says nothing about the server's version. We want layered, **non-blocking**
warnings driven by the server's reported version:

- A **hard-floor** warning (strong/red) when the server is older than a declared minimum.
- A **capability** notice (soft/amber) when the server lacks the native-features companion
  change.

The server already exposes everything needed: an unauthenticated `GET /info` endpoint returning
JSON `{ serverId, version, name, description, logo, allowNewUsers }` (CORS `*`). The desktop
main process can fetch it freely (CORS does not apply to main-process fetch).

## Decisions (locked during brainstorming)

- **Two layers, warnings only — never block** a connection (nothing truly breaks on an old
  server today; the UI is served by the server itself).
- **Warn only on a real version we read.** If `/info` is missing, non-200, or unparseable →
  verdict `unknown` → silent (no banner). This avoids false positives from proxies, network
  hiccups, or non-Bullshark servers.
- **Capability layer is dormant until the companion version is known.** The native-features
  threshold is `null` until the companion change ships; while `null`, the soft notice never
  fires (we don't nag about a feature that exists nowhere yet). Set the constant when companion
  ships and the notice activates for older servers.
- **Banner mechanism:** the existing `bridge.cjs` preload injects a fixed banner into the
  remote page DOM (preloads have direct DOM access even under contextIsolation). Desktop-owned,
  no dependency on the web app cooperating.
- **Both banners are dismissible.** Dismissal is per window instance (in-memory); the banner
  reappears on the next server open/switch while the condition persists. No persisted state.
- **Red banner = `too-old`; amber notice = `native-unavailable`.** Both dismissible.

## Architecture

The main process reads and judges the version and produces a localized message + a verdict; the
preload only renders/dismisses a banner. Stable verdict strings keep logic testable without DOM.

```
src/main/servers/server-info.ts  → fetchServerInfo(baseUrl): { version } | null
src/main/servers/version.ts      → compareVersions(a, b): -1 | 0 | 1
src/main/servers/compat.ts       → MIN_SERVER_VERSION, MIN_SERVER_VERSION_NATIVE_FEATURES,
                                    evaluateCompat(version | null): CompatVerdict
src/main/windows/main-window.ts  → after loadURL, fetch + evaluate + send BRIDGE.compat
src/shared/ipc.ts                → BRIDGE.compat channel
src/preload/bridge.ts            → inject/dismiss the banner from the verdict payload
src/shared/i18n/messages.ts      → server-too-old, server-native-unavailable (7 locales)
```

### 1. Server info — `src/main/servers/server-info.ts` (new)

`fetchServerInfo(baseUrl: string, fetchImpl = fetch, timeoutMs = 4000): Promise<{ version: string } | null>`

- `GET` `${baseUrl}/info` with an AbortController timeout.
- On non-2xx, network error, timeout, or JSON without a string `version` → return `null`.
- On success → `{ version }` (only the field we need; ignore the rest).
- Pure-ish and unit-testable via injected `fetchImpl`.

### 2. Version comparison — `src/main/servers/version.ts` (new)

`compareVersions(a: string, b: string): -1 | 0 | 1`

- Strips a leading `v`. Splits off any pre-release suffix after `-`.
- Compares numeric `major.minor.patch`. A version **with** a pre-release suffix sorts **below**
  the same version without one (`0.1.0-alpha` < `0.1.0`); pre-release identifiers compared
  lexically as a tiebreaker.
- Missing numeric parts treated as `0` (`1.2` == `1.2.0`). Non-numeric/garbage segments treated
  as `0` so a malformed version never throws.
- No external dependency (matches the repo's zero-extra-dep stance).

### 3. Compatibility verdict — `src/main/servers/compat.ts` (new)

```
export const MIN_SERVER_VERSION = '0.0.0';            // hard floor; bump on a real API break
export const MIN_SERVER_VERSION_NATIVE_FEATURES: string | null = null; // set when companion ships

export type CompatVerdict = 'ok' | 'too-old' | 'native-unavailable' | 'unknown';
export const evaluateCompat = (version: string | null): CompatVerdict => { ... }
```

Logic:
- `version === null` → `unknown`.
- `compareVersions(version, MIN_SERVER_VERSION) < 0` → `too-old`.
- `MIN_SERVER_VERSION_NATIVE_FEATURES !== null` AND
  `compareVersions(version, MIN_SERVER_VERSION_NATIVE_FEATURES) < 0` → `native-unavailable`.
- else → `ok`.

With the shipped defaults (`MIN_SERVER_VERSION = '0.0.0'`, native threshold `null`), every real
version evaluates to `ok` and the feature is effectively dormant — correct: it ships the
mechanism without firing spuriously until thresholds are set.

### 4. Wiring on server open — `src/main/windows/main-window.ts`

- After `void mainWindow.loadURL(server.url)`, run an async step: `fetchServerInfo(server.url)`
  → `evaluateCompat(...)`. If the verdict warrants a banner (`too-old` or `native-unavailable`),
  resolve locale via `resolveLocale(app.getLocale())`, build the message with `t(code, locale)`,
  and `webContents.send(BRIDGE.compat, { verdict, message })` once the contents have finished
  loading. For `ok`/`unknown`, send nothing (or a clear payload).
- Failures in this path are swallowed (a compat check must never break loading the server).

### 5. Banner — `src/preload/bridge.ts`

- Listen on `BRIDGE.compat`. On a banner-worthy payload, inject a fixed-position `<div>` at the
  top of `document.body` (create on `DOMContentLoaded` if needed) with the message text and a
  close button. Style: red background for `too-old`, amber for `native-unavailable`. High
  `z-index`, `position: fixed`, full width, does not capture the whole page.
- Close button removes the element (in-memory dismissal for this window instance only).
- The preload renders only the provided string — no translation logic in the preload.

### 6. IPC — `src/shared/ipc.ts`

Add to `BRIDGE`:
```
compat: 'bridge:compat'   // main → remote ({ verdict, message })
```

### 7. i18n — `src/shared/i18n/messages.ts` (extended)

Add two error codes to `ERROR_CODES` and `MESSAGES`, each with all 7 locales:
- `server-too-old` — e.g. "This server is older than this app supports — some things may not
  work. Update your Bullshark server."
- `server-native-unavailable` — e.g. "This server doesn't support the desktop's native features
  yet (notifications DND, mic mute). Update your Bullshark server."

## Error/failure handling

- Any `/info` fetch/parse failure → `null` → `unknown` → silent. The compat path never throws
  into the load path.
- Unknown verdict in the preload → no banner.
- Missing locale entry → `t` already falls back to `en` (from #1).

## Testing

- **`version.ts`** — ordering across major/minor/patch; `v` prefix; `0.1.0-alpha` < `0.1.0`;
  `1.2` == `1.2.0`; malformed input does not throw and sorts deterministically.
- **`compat.ts`** — `null` → `unknown`; below floor → `too-old`; with a non-null native
  threshold, between floor and threshold → `native-unavailable`; at/above threshold → `ok`;
  with native threshold `null`, a normal version never yields `native-unavailable`.
- **`server-info.ts`** — valid JSON with `version` → `{ version }`; non-200 → `null`; thrown
  fetch → `null`; JSON without string `version` → `null` (all via mocked `fetchImpl`).
- **i18n** — `server-too-old` and `server-native-unavailable` present and non-empty in all 7
  locales.
- Banner injection/dismissal in the preload: verified by typecheck + manual smoke (no renderer
  unit harness), consistent with #1.

## Out of scope (future / declined)

- Hard blocking or connect-time override prompts (chosen: warnings only).
- Persisted dismissal across launches (chosen: in-memory per window).
- A real native-features threshold value (set when the companion change ships in the server).
- Detecting capability by runtime feature-probe instead of version (version via `/info` is the
  available signal).
- #3 discovery / deployment docs / share links.
