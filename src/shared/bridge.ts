// Channels for the remote-page bridge preload (window.bullshark).
// Kept in its own module so the sandboxed `bridge` preload and the `shell`
// preload do not share a bundled module — a shared chunk cannot be require()d
// by a sandboxed preload (it must be a single self-contained file).
export const BRIDGE = {
  setMuted: 'bridge:set-muted',              // main → remote (DND state)
  voiceToggleRequest: 'bridge:voice-toggle', // main → remote (toggle mic)
  voiceState: 'bridge:voice-state',          // remote → main ({ inVoice, muted })
  focusWindow: 'bridge:focus-window',        // remote → main (show/focus the window)
  compat: 'bridge:compat'                    // main → remote ({ verdict, message })
} as const;
