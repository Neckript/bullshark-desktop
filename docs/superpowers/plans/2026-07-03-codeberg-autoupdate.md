# Desktop Codeberg Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point the desktop auto-updater at Codeberg (Forgejo) releases instead of the GitHub API, and upload release artifacts to Codeberg from CI.

**Architecture:** A new `forgejo-feed.ts` resolves the latest Codeberg release tag and builds a download-URL prefix; `initNativeUpdater` becomes async and calls `autoUpdater.setFeedURL({ provider: 'generic', url })` before each check (overriding the packaged GitHub `app-update.yml`). The unsigned-macOS fallback polls the Forgejo API instead of `api.github.com`. CI gains a `continue-on-error` step uploading artifacts + `latest*.yml` to a Codeberg release.

**Tech Stack:** electron-updater (generic provider), Forgejo REST API v1, vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-06-30-desktop-codeberg-autoupdate-design.md`

## Global Constraints

- Repo: `C:\Users\Neckr\Documents\bullshark-desktop`, branch `development`.
- No new dependencies.
- Codeberg repo is exactly `The_Neckript/bullshark-desktop`; API base `https://codeberg.org/api/v1`; download prefix `https://codeberg.org/The_Neckript/bullshark-desktop/releases/download/<tag>`.
- `electron-builder.yml` must NOT change (GitHub Releases keeps receiving artifacts as backup/mirror).
- `src/main/updater/select.test.ts` must remain untouched and passing.
- Update-check failures must never surface to the user: Codeberg unreachable → skip check, retry at the next 6h interval.
- Commands: `npm test` (vitest), `npm run typecheck`, `npm run lint`.
- Commit trailer lines required on every commit:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` and
  `Claude-Session: https://claude.ai/code/session_01Ab6ZFXRDrHP8tBcnkoaFKe`

---

### Task 1: `forgejo-feed.ts` — resolve the Codeberg feed URL

**Files:**
- Create: `src/main/updater/forgejo-feed.ts`
- Test: `src/main/updater/forgejo-feed.test.ts`

**Interfaces:**
- Produces: `getForgejoFeedUrl(deps?: { fetch: typeof fetch }): Promise<string>` — resolves `https://codeberg.org/The_Neckript/bullshark-desktop/releases/download/<tag_name>`; throws on non-OK response or network failure. Task 2 calls it with no arguments (default `fetch`).

- [ ] **Step 1: Write the failing tests**

Create `src/main/updater/forgejo-feed.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { getForgejoFeedUrl } from './forgejo-feed';

const fetchReturning = (status: number, body: unknown): typeof fetch =>
  (() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body)
    } as Response)) as typeof fetch;

describe('getForgejoFeedUrl', () => {
  test('returns the download URL for the latest tag', async () => {
    const url = await getForgejoFeedUrl({
      fetch: fetchReturning(200, { tag_name: 'v0.1.5' })
    });
    expect(url).toBe(
      'https://codeberg.org/The_Neckript/bullshark-desktop/releases/download/v0.1.5'
    );
  });
  test('throws on a non-OK response', async () => {
    await expect(
      getForgejoFeedUrl({ fetch: fetchReturning(404, {}) })
    ).rejects.toThrow();
  });
  test('propagates network errors', async () => {
    const failingFetch = (() => Promise.reject(new Error('offline'))) as typeof fetch;
    await expect(getForgejoFeedUrl({ fetch: failingFetch })).rejects.toThrow('offline');
  });
  test('throws when tag_name is missing from the response', async () => {
    await expect(
      getForgejoFeedUrl({ fetch: fetchReturning(200, {}) })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- forgejo-feed`
Expected: FAIL — cannot find module `./forgejo-feed`.

- [ ] **Step 3: Implement**

Create `src/main/updater/forgejo-feed.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` then `npm run typecheck`
Expected: all PASS (including the untouched `select.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/main/updater/forgejo-feed.ts src/main/updater/forgejo-feed.test.ts
git commit -m "feat: add Forgejo feed URL resolver for Codeberg auto-update"
```

---

### Task 2: point both updater strategies at Codeberg + rewire the entrypoint

**Files:**
- Modify: `src/main/updater/electron-updater-impl.ts`
- Modify: `src/main/updater/github-fallback.ts`
- Modify: `src/main/updater/index.ts`
- Modify: `src/main/index.ts:32`

**Interfaces:**
- Consumes: `getForgejoFeedUrl()` from `./forgejo-feed` (Task 1).
- Produces: `initNativeUpdater(): Promise<void>` (now async); `initForgejoFallback(): void` (renamed from `initGithubFallback`, no repo argument); `initUpdater(opts?: { macSigned?: boolean }): Promise<void>`. `selectUpdaterKind` and `select.test.ts` unchanged.

One task, one commit: the strategy rename and the entrypoint rewiring are inseparable (typecheck fails between them).

No new unit tests: these files are thin Electron wiring (imports `electron` + `electron-updater`), consistent with their current untested state; the testable logic lives in `forgejo-feed.ts` (Task 1). Verified via typecheck/lint and the release smoke test.

- [ ] **Step 1: Rewrite `src/main/updater/electron-updater-impl.ts`**

Replace the whole file with:

```ts
import { Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import { getForgejoFeedUrl } from './forgejo-feed';

const checkFromCodeberg = async () => {
  try {
    const url = await getForgejoFeedUrl();
    autoUpdater.setFeedURL({ provider: 'generic', url });
  } catch {
    // Codeberg unreachable — skip this check, retry at the next interval.
    return;
  }
  void autoUpdater.checkForUpdates();
};

export const initNativeUpdater = async () => {
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', () => {
    const n = new Notification({ title: 'Bullshark', body: 'Update ready — restart to apply.' });
    n.on('click', () => autoUpdater.quitAndInstall());
    n.show();
  });
  await checkFromCodeberg();
  setInterval(() => void checkFromCodeberg(), 6 * 60 * 60 * 1000);
};
```

- [ ] **Step 2: Rewrite `src/main/updater/github-fallback.ts`**

Replace the whole file with:

```ts
import { Notification, shell, app } from 'electron';

const RELEASES_LATEST_URL =
  'https://codeberg.org/api/v1/repos/The_Neckript/bullshark-desktop/releases/latest';

// macOS unsigned: poll Codeberg (Forgejo) releases; on a newer version,
// notify + open the release page.
export const initForgejoFallback = () => {
  const check = async () => {
    try {
      const res = await fetch(RELEASES_LATEST_URL, {
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) return;
      const latest = (await res.json()) as { tag_name: string; html_url: string };
      const latestVersion = latest.tag_name.replace(/^v/, '');
      if (latestVersion && latestVersion !== app.getVersion()) {
        const n = new Notification({ title: 'Bullshark update available', body: `Version ${latestVersion} is available. Click to download.` });
        n.on('click', () => void shell.openExternal(latest.html_url));
        n.show();
      }
    } catch { /* offline — ignore */ }
  };
  void check();
  setInterval(check, 6 * 60 * 60 * 1000);
};
```

- [ ] **Step 3: Rewrite `src/main/updater/index.ts`**

Replace the whole file with:

```ts
export type UpdaterKind = 'native' | 'github-fallback';

// macOS Squirrel requires a signed+notarized build; unsigned mac falls back to
// notify + open-release. Win/Linux auto-update unsigned via electron-updater.
export const selectUpdaterKind = (platform: NodeJS.Platform, macSigned: boolean): UpdaterKind => {
  if (platform === 'darwin' && !macSigned) return 'github-fallback';
  return 'native';
};

// Strategy modules are imported dynamically so this module stays loadable in
// unit tests (which cannot load electron-updater).
export const initUpdater = async (opts: { macSigned?: boolean } = {}) => {
  const kind = selectUpdaterKind(process.platform, opts.macSigned ?? false);
  if (kind === 'native') {
    const { initNativeUpdater } = await import('./electron-updater-impl');
    await initNativeUpdater();
  } else {
    const { initForgejoFallback } = await import('./github-fallback');
    initForgejoFallback();
  }
};
```

Note: the `UpdaterKind` literal `'github-fallback'` stays as-is — it is an internal strategy label asserted by `select.test.ts`, which must not change.

- [ ] **Step 4: Update the call in `src/main/index.ts`**

Replace:

```ts
    void initUpdater({ repo: 'Neckript/bullshark-desktop' });
```

with:

```ts
    void initUpdater();
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all PASS, `select.test.ts` untouched and green.

- [ ] **Step 6: Commit**

```bash
git add src/main/updater/electron-updater-impl.ts src/main/updater/github-fallback.ts src/main/updater/index.ts src/main/index.ts
git commit -m "feat: point auto-updater at Codeberg (Forgejo) releases"
```

---

### Task 3: CI — upload release artifacts to Codeberg

**Files:**
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: nothing from other tasks (independent of the runtime code).
- Produces: every `v*` tag build uploads `dist/*.exe`, `dist/*.AppImage`, `dist/*.dmg`, `dist/*.zip`, `dist/latest*.yml` to the matching Codeberg release. Requires the `CODEBERG_TOKEN` repo secret (user action — see Task 5).

- [ ] **Step 1: Append the Codeberg upload step**

In `.github/workflows/release.yml`, after the `npx electron-builder --publish always` step, append:

```yaml
      - name: Upload artifacts to Codeberg
        continue-on-error: true
        shell: bash
        env:
          CODEBERG_TOKEN: ${{ secrets.CODEBERG_TOKEN }}
        run: |
          TAG=${GITHUB_REF_NAME}
          # Create release (idempotent — fall back to fetching it if it already exists)
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

`continue-on-error: true` keeps a Codeberg outage from blocking the GitHub release; `shell: bash` is required on `windows-latest` (Git Bash is pre-installed, as is `jq`, on all three runners). `electron-builder.yml` is not touched.

- [ ] **Step 2: Verify the YAML**

Run: `npx --yes yaml-lint .github/workflows/release.yml 2>/dev/null || node -e "const fs=require('fs');const yaml=require('js-yaml');yaml.load(fs.readFileSync('.github/workflows/release.yml','utf8'));console.log('YAML OK')"`
Expected: `YAML OK` (js-yaml ships with electron-builder's dependency tree). If neither tool is available, careful visual indentation check against the existing steps (6-space step indent).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: upload release artifacts to Codeberg (Forgejo)"
```

---

### Task 4: Release v0.1.5 (controller + user actions — not a subagent task)

**Files:** none (operations only).

- [ ] **Step 1 (USER): create the `CODEBERG_TOKEN` secret**

1. Codeberg → Settings → Applications → Generate new token, scope `write:repository` (misc/package rights not needed), name e.g. `bullshark-desktop-ci`.
2. GitHub → `Neckript/bullshark-desktop` → Settings → Secrets and variables → Actions → New repository secret → name `CODEBERG_TOKEN`, paste the token.

- [ ] **Step 2: merge development → main, push both remotes (with user approval)**

- [ ] **Step 3: release**

```bash
npm run release:patch   # bumps 0.1.4 → 0.1.5, creates tag v0.1.5, pushes with --follow-tags
```

The Codeberg push mirror propagates the tag to GitHub, GitHub Actions builds all 3 OS targets, publishes the GitHub release, and uploads the artifacts + `latest*.yml` to the Codeberg release.

- [ ] **Step 4: verify**

1. GitHub Actions run green on the `v0.1.5` tag.
2. Codeberg release `v0.1.5` exists with `.exe`, `.AppImage`, `.dmg`/`.zip`, and `latest*.yml` attached.
3. `curl -s https://codeberg.org/api/v1/repos/The_Neckript/bullshark-desktop/releases/latest | jq .tag_name` → `"v0.1.5"`.
4. Install v0.1.5 on Windows; it should silently auto-update from Codeberg on the NEXT release (v0.1.6) — the old installed 0.1.4 app updates to 0.1.5 via GitHub (its updater still points there), which is the designed migration path.
