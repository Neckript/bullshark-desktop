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
