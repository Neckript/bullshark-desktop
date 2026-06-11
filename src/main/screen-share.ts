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
    const parent = getParent();
    if (pending || !parent) {
      callback({});
      return;
    }
    let sources: DesktopCapturerSource[];
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });
    } catch {
      callback({});
      return;
    }
    pending = { callback, sources };
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
