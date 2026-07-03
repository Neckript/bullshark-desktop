# Global mute hotkey — design

**Date:** 2026-07-03
**Status:** Approved
**Repos:** bullshark-desktop (primary) + bullshark (client web companion)

## Problem

Bullshark positions itself as a gaming-focused Discord alternative, but a player
in a fullscreen game cannot mute/unmute their microphone: the web client's PTT
and mute controls are window-scoped, and the desktop app registers no global
shortcut. On top of that, the desktop's voice bridge is only half wired: the
`bridge` preload exposes `window.bullshark.voice` (`reportState`,
`onToggleRequest`) but the web client never consumes it, so the existing tray
"Microphone" toggle is inert (`voiceState.inVoice` is never reported, the menu
item stays disabled).

## Goal (v1 scope)

- A **global mute/unmute toggle hotkey**, default `CommandOrControl+Shift+M`,
  working while any app (e.g. a game) has focus.
- Hotkey **configurable** in the existing Servers window, persisted as a pref.
- **Audio cue** (beep) on every mic mute/unmute while in voice, regardless of
  origin (UI click, tray, hotkey) — Discord-familiar behavior.
- Wiring the client to the existing voice bridge, which **also activates the
  dormant tray microphone toggle** and the `mic-muted` tray icon.

### Out of scope (v1)

- True hold-to-talk global PTT. Electron's `globalShortcut` only fires on
  keydown (no keyup), so hold-PTT requires a native keyboard hook
  (`uiohook-napi`). Deliberately deferred.
- Additional hotkeys (deafen, overlay…). `hotkeys.ts` is structured so more can
  be added later.
- Configurable/disable-able sound cue.

## Decisions made

| Question | Decision |
|---|---|
| Hotkey mechanism | Electron `globalShortcut` only, no native hook dependency |
| Configurability | Default accelerator + editable field in Servers window |
| In-game feedback | Tray icon (existing) + sound cue |
| Cue scope | Beep on **every** mute/unmute while in voice, any origin |
| Client integration | New `use-desktop-bridge` hook inside `VoiceProvider` |

## Architecture

End-to-end flow:

```
OS hotkey
  → globalShortcut callback (main, hotkeys.ts)
  → requestVoiceToggle()                      [existing, voice-bridge.ts]
  → BRIDGE.voiceToggleRequest → bridge preload [existing]
  → window.bullshark.voice.onToggleRequest    [existing preload API]
  → use-desktop-bridge hook → toggleMic()     [new, client]
  → micMuted change → reportState()           [new, client]
  → BRIDGE.voiceState → setVoiceState → refreshTray  [existing, main]
```

## bullshark-desktop changes

### `src/main/hotkeys.ts` (new)

- `registerHotkeys(store)`: reads pref `muteHotkey` (default
  `CommandOrControl+Shift+M`), calls
  `globalShortcut.register(accel, () => requestVoiceToggle())`.
- `refreshHotkeys(store)`: unregister + re-register when the pref changes
  (called from the `IPC.prefsSet` path).
- Invalid or already-taken accelerator: log a warning, continue without the
  hotkey — never crash or block startup.
- `globalShortcut.unregisterAll()` on `will-quit`.

### Prefs

- `muteHotkey?: string` added to `Prefs` in `src/shared/types`.
- Added to the `allowed` keys list in `IPC.prefsSet` (`src/main/ipc.ts`).
- Empty string = hotkey disabled (nothing registered).

### Servers window UI

- New "Global mute shortcut" field: click to focus, press the desired
  combination, it is captured via `keydown` and converted to an Electron
  accelerator string; a reset-to-default button restores
  `CommandOrControl+Shift+M`.
- Localized via the existing `shared/i18n` system.
- Saving goes through the existing `prefsSet` IPC; main re-registers on change.

### Main-process behavior notes

- If the user is not in voice, the toggle request is still broadcast; the
  client ignores it (no-op). No voice-state logic in main.

## bullshark (client web) changes

### `components/voice-provider/hooks/use-desktop-bridge.ts` (new)

Mounted inside `VoiceProvider`, mirroring the style of `use-ptt` / `use-vad`:

- If `window.bullshark?.voice` is absent (plain browser): full no-op.
- Effect: on every change of `(inVoice, micMuted)`, call
  `reportState({ inVoice, muted: micMuted })`.
- Subscribes to `onToggleRequest`; on request, calls `toggleMic()` **only when
  in voice**, otherwise ignores.
- Cleans up the subscription on unmount (the preload API returns an
  unsubscribe function).

### Sound cue — `helpers/sound-cues.ts` (new)

- Two short distinct cues (~150 ms), WebAudio oscillators — no bundled assets:
  lower pitch = muted, higher pitch = unmuted.
- Triggered from `VoiceProvider` whenever `micMuted` changes **while in
  voice**, any origin (UI, tray, hotkey).

### Typings

- Global `window.bullshark` declaration added (in `vite-env.d.ts` or a
  dedicated `bullshark.d.ts`): `isDesktop`, `voice.reportState`,
  `voice.onToggleRequest`, plus the already-exposed `notifications.isMuted`,
  `focusWindow`, `onMuteChanged` for completeness.

## Error handling

| Failure | Behavior |
|---|---|
| Invalid accelerator string | Warn + skip registration; app runs normally |
| Accelerator taken by another app | `globalShortcut.register` returns false → warn, no hotkey |
| `window.bullshark` absent (browser) | Hook is a no-op |
| Toggle request while not in voice | Ignored client-side |
| Old desktop + new client / new desktop + old client | Both degrade to today's behavior (no companion), nothing breaks |

## Testing

- **Desktop** — `src/main/hotkeys.test.ts` (same style as `store.test.ts`):
  registration with default and custom accelerator, re-registration on pref
  change, invalid accelerator does not throw, unregister on quit.
- **Client** — hook test with a mocked `window.bullshark`: `reportState`
  called on state changes, toggle applied only when in voice, unsubscribe on
  unmount. Sound-cue module smoke test (no-throw without AudioContext).
- **Manual** — Windows: hotkey while a game/another app is focused; tray icon
  flips; beep audible; tray Microphone toggle now works.
