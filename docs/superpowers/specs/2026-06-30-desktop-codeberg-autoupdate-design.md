# Desktop Codeberg Auto-Update — Design Spec

**Date:** 2026-06-30  
**Goal:** Migrate the Bullshark desktop auto-updater from GitHub Releases to Codeberg (Forgejo), so that update checks and downloads are sovereign and no longer depend on the GitHub API.

---

## Context

The current updater uses `electron-updater` with `publish.provider: github` (owner `Neckript`, repo `bullshark-desktop`). On Windows and Linux, `electron-updater` fetches `latest.yml` from GitHub Releases, compares versions, and auto-downloads the NSIS/AppImage installer. On unsigned macOS, `github-fallback.ts` polls `api.github.com` and notifies the user.

The Codeberg repo is `The_Neckript/bullshark-desktop`. A Codeberg→GitHub push mirror is already configured, so pushing a tag to Codeberg mirrors to GitHub and triggers GitHub Actions — the CI build infrastructure stays on GitHub.

Reference implementation: the server's sovereign Codeberg auto-updater (`apps/server/src/utils/updater/forgejo.ts` + `updater.ts`).

---

## Approach: Forgejo API → `setFeedURL` generic provider

1. Before calling `checkForUpdates()`, the app hits the Forgejo API to get the latest release's `tag_name`.
2. It calls `autoUpdater.setFeedURL({ provider: 'generic', url: 'https://codeberg.org/The_Neckript/bullshark-desktop/releases/download/<tag>' })`.
3. electron-updater then fetches `latest.yml` from that URL prefix, compares the version, and if newer downloads and installs the appropriate artifact — identical behaviour to today, just pointing at Codeberg assets.

This preserves the full auto-download + silent install UX on Windows, reuses all of electron-updater's existing machinery, and mirrors what the server already does for its own Forgejo updater.

---

## Runtime Architecture

### `src/main/updater/forgejo-feed.ts` (new)

Single exported function:

```ts
export const getForgejoFeedUrl = async (
  deps: { fetch: typeof fetch } = { fetch }
): Promise<string>
```

- Fetches `https://codeberg.org/api/v1/repos/The_Neckript/bullshark-desktop/releases/latest`
- Extracts `tag_name` from the JSON response
- Returns `https://codeberg.org/The_Neckript/bullshark-desktop/releases/download/${tag_name}`
- Throws on non-OK response or network failure (caller handles gracefully)

Constants `CODEBERG_API_BASE`, `REPO_OWNER`, `REPO_NAME` are module-level (no export needed; the function is the public surface).

### `src/main/updater/electron-updater-impl.ts` (modify)

`initNativeUpdater` becomes `async`. Before `checkForUpdates()`:

```ts
try {
  const url = await getForgejoFeedUrl();
  autoUpdater.setFeedURL({ provider: 'generic', url });
} catch {
  // Codeberg unreachable — skip this check, retry next interval
  return;
}
```

`autoDownload` stays `true`. The `update-downloaded` notification and `quitAndInstall` are unchanged.

### `src/main/updater/github-fallback.ts` (modify)

Replace the `api.github.com` call with the Forgejo API equivalent:

- URL: `https://codeberg.org/api/v1/repos/The_Neckript/bullshark-desktop/releases/latest`
- Header: `Accept: application/json` (not `application/vnd.github+json`)
- Response shape is the same: `{ tag_name: string; html_url: string }`
- Logic (compare version, show notification with link) is unchanged

### `src/main/updater/index.ts` (modify)

- Remove `repo` from `opts` (no longer needed — repo is hardcoded in `forgejo-feed.ts`)
- `initUpdater()` takes no arguments
- `initGithubFallback` call updated to `initForgejoFallback` (rename the import)
- `selectUpdaterKind` logic is unchanged; tests remain valid

### `src/main/index.ts` (modify)

```ts
void initUpdater();   // was: initUpdater({ repo: 'Neckript/bullshark-desktop' })
```

### Error handling

Two-level graceful degradation:
1. `getForgejoFeedUrl()` throws → log at debug level, return early, retry at next 6h interval. App continues normally.
2. `checkForUpdates()` fails after `setFeedURL` → electron-updater logs and swallows, existing behaviour.

No user-visible error for update check failures. This matches current behaviour.

---

## Tests

### `src/main/updater/forgejo-feed.test.ts` (new)

Uses vitest (same as `select.test.ts`). `fetch` is injected via the `deps` parameter — no network calls.

Cases:
- Happy path: `tag_name: 'v0.1.5'` → returns correct URL
- Non-OK response (`status: 404`) → throws
- Network error (fetch rejects) → propagates

### `src/main/updater/select.test.ts` (unchanged)

---

## CI — `.github/workflows/release.yml`

### Existing step (unchanged)

```yaml
- run: npx electron-builder --publish always
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

GitHub Releases continues to receive all artifacts (backup + mirror). `electron-builder.yml` is **not changed** — `publish.provider: github` only affects where `--publish always` uploads; the app's runtime `setFeedURL` call overrides the packaged `app-update.yml`.

### New step — upload to Codeberg (added on each OS runner)

```yaml
- name: Upload artifacts to Codeberg
  continue-on-error: true
  shell: bash
  env:
    CODEBERG_TOKEN: ${{ secrets.CODEBERG_TOKEN }}
  run: |
    TAG=${GITHUB_REF_NAME}
    # Create release (idempotent — ignore 409/422 if already exists)
    RELEASE_ID=$(curl -sf \
      -H "Authorization: token $CODEBERG_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"tag_name\":\"$TAG\",\"name\":\"$TAG\"}" \
      "https://codeberg.org/api/v1/repos/The_Neckript/bullshark-desktop/releases" \
      | jq -r '.id' || \
      curl -sf \
        -H "Authorization: token $CODEBERG_TOKEN" \
        "https://codeberg.org/api/v1/repos/The_Neckript/bullshark-desktop/releases/tags/$TAG" \
        | jq -r '.id')
    # Upload per-OS artifacts
    for f in dist/*.exe dist/*.AppImage dist/*.dmg dist/*.zip dist/latest*.yml; do
      [ -f "$f" ] || continue
      curl -sf \
        -H "Authorization: token $CODEBERG_TOKEN" \
        -F "attachment=@$f" \
        "https://codeberg.org/api/v1/repos/The_Neckript/bullshark-desktop/releases/$RELEASE_ID/assets" \
        || true
    done
```

`continue-on-error: true` ensures a Codeberg upload failure does not block the GitHub release. `shell: bash` is set explicitly — PowerShell is the default on `windows-latest` and would not support the bash globbing and `||` syntax used here. Git Bash is pre-installed on GitHub-hosted Windows runners. `jq` is also pre-installed on all three OS runners.

---

## Files Changed

| Action | Path |
|--------|------|
| Create | `src/main/updater/forgejo-feed.ts` |
| Create | `src/main/updater/forgejo-feed.test.ts` |
| Modify | `src/main/updater/electron-updater-impl.ts` |
| Modify | `src/main/updater/github-fallback.ts` |
| Modify | `src/main/updater/index.ts` |
| Modify | `src/main/index.ts` |
| Modify | `.github/workflows/release.yml` |
| Unchanged | `electron-builder.yml` |
| Unchanged | `src/main/updater/select.test.ts` |
