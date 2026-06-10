export type UpdaterKind = 'native' | 'github-fallback';

// macOS Squirrel requires a signed+notarized build; unsigned mac falls back to
// notify + open-release. Win/Linux auto-update unsigned via electron-updater.
export const selectUpdaterKind = (platform: NodeJS.Platform, macSigned: boolean): UpdaterKind => {
  if (platform === 'darwin' && !macSigned) return 'github-fallback';
  return 'native';
};

// Strategy modules are imported dynamically so this module stays loadable in
// unit tests (which cannot load electron-updater).
export const initUpdater = async (opts: { repo: string; macSigned?: boolean }) => {
  const kind = selectUpdaterKind(process.platform, opts.macSigned ?? false);
  if (kind === 'native') {
    const { initNativeUpdater } = await import('./electron-updater-impl');
    initNativeUpdater();
  } else {
    const { initGithubFallback } = await import('./github-fallback');
    initGithubFallback(opts.repo);
  }
};
