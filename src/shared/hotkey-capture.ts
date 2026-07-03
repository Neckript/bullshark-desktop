// Converts a captured KeyboardEvent into an Electron accelerator string,
// or null when the combination is unusable as a global hotkey.
// Shared between the renderer (capture field) and any future main-side use;
// must stay free of Electron imports.
export type CapturedKey = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

const KEY_MAP: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right'
};

const isFunctionKey = (key: string) => /^F([1-9]|1[0-9]|2[0-4])$/.test(key);

export const eventToAccelerator = (e: CapturedKey): string | null => {
  if (MODIFIER_KEYS.has(e.key)) return null;

  // Shift alone is too easy to hit accidentally for a global hotkey.
  const hasStrongModifier = e.ctrlKey || e.metaKey || e.altKey;
  if (!hasStrongModifier && !isFunctionKey(e.key)) return null;

  let key: string;
  if (isFunctionKey(e.key)) key = e.key;
  else if (e.key in KEY_MAP) key = KEY_MAP[e.key];
  else if (e.key.length === 1) key = e.key.toUpperCase();
  else return null; // CapsLock, Tab, Enter… not supported

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
};
