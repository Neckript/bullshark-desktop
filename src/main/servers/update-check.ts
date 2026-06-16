import { compareVersions } from './version';

type UpdateCheckInput = {
  loadedVersion: string | null;
  currentVersion: string | null;
  notifiedVersion: string | null;
};

// Pure decision: should the desktop show an "update available → reload" banner?
// True iff the server is strictly newer than the page currently loaded and we
// have not already notified for this exact server version (dedup). A failed
// /info fetch (currentVersion null) or unknown baseline (loadedVersion null)
// yields false — never a false positive.
export const shouldNotifyUpdate = ({
  loadedVersion,
  currentVersion,
  notifiedVersion
}: UpdateCheckInput): boolean => {
  if (currentVersion === null || loadedVersion === null) return false;
  if (currentVersion === notifiedVersion) return false;
  return compareVersions(currentVersion, loadedVersion) === 1;
};
