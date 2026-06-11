import { BrowserWindow, desktopCapturer, type Session, type DesktopCapturerSource } from 'electron';
import { openSharePicker, closeSharePicker } from './windows/picker-window';
import type { SourceDto } from '../shared/types';

type CapturerSourceLike = {
  id: string;
  name: string;
  thumbnail: { toDataURL(): string };
  appIcon?: { isEmpty(): boolean; toDataURL(): string } | null;
};

export const toSourceDto = (s: CapturerSourceLike): SourceDto => {
  const dto: SourceDto = { id: s.id, name: s.name, thumbnailDataUrl: s.thumbnail.toDataURL() };
  if (s.appIcon && !s.appIcon.isEmpty()) dto.appIconDataUrl = s.appIcon.toDataURL();
  return dto;
};

export const pickSourceById = <T extends { id: string }>(sources: T[], id: string): T | undefined =>
  sources.find((s) => s.id === id);

type DisplayMediaCallback = (streams: { video?: DesktopCapturerSource }) => void;

let pending: { callback: DisplayMediaCallback; sources: DesktopCapturerSource[] } | null = null;

// Installs the screen-share handler on a session. When the remote page calls
// getDisplayMedia(), fetch the sources and open the in-app picker; the picker
// resolves via chooseSource()/cancelShare(). One request at a time.
export const installScreenShareHandler = (session: Session, getParent: () => BrowserWindow | null) => {
  session.setDisplayMediaRequestHandler(async (_request, callback) => {
    if (pending || !getParent()) {
      callback({});
      return;
    }
    // Claim the slot before the async getSources so a second concurrent request
    // is denied instead of overwriting this one (which would orphan its callback).
    pending = { callback, sources: [] };
    let sources: DesktopCapturerSource[];
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });
    } catch {
      pending = null;
      callback({});
      return;
    }
    // cancelShare/chooseSource cannot run during the await (no picker, no IPC
    // yet), so `pending` is still our claim here. Only the parent may have gone.
    const parent = getParent();
    if (!parent) {
      pending = null;
      callback({});
      return;
    }
    pending.sources = sources;
    openSharePicker(parent, cancelShare);
  });
};

export const getSourceDtos = (): SourceDto[] => (pending ? pending.sources.map(toSourceDto) : []);

export const chooseSource = (id: string) => {
  if (!pending) return;
  const source = pickSourceById(pending.sources, id);
  const { callback } = pending;
  pending = null;
  callback(source ? { video: source } : {});
  closeSharePicker();
};

export const cancelShare = () => {
  if (!pending) return;
  const { callback } = pending;
  pending = null;
  callback({});
  closeSharePicker();
};
