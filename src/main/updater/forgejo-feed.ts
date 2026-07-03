const CODEBERG_API_BASE = 'https://codeberg.org/api/v1';
const REPO_OWNER = 'The_Neckript';
const REPO_NAME = 'bullshark-desktop';

// Resolves the electron-updater "generic" feed URL for the latest Codeberg
// release: the download-URL prefix under which latest.yml and the installers
// are attached. Throws on any failure — the caller skips the update check.
export const getForgejoFeedUrl = async (
  deps: { fetch: typeof fetch } = { fetch }
): Promise<string> => {
  const res = await deps.fetch(
    `${CODEBERG_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) throw new Error(`Forgejo releases/latest returned ${res.status}`);
  const release = (await res.json()) as { tag_name?: string };
  if (!release.tag_name) throw new Error('Forgejo release has no tag_name');
  return `https://codeberg.org/${REPO_OWNER}/${REPO_NAME}/releases/download/${release.tag_name}`;
};
