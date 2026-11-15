# Development and releases

Use two branches and two environments. No deployment runs automatically.

| Branch    | Purpose                                                                        |
| --------- | ------------------------------------------------------------------------------ |
| `develop` | Shared changes and owner testing before release. Leave your working copy here. |
| `main`    | Tested, versioned source ready for a release.                                  |

Contributor feature branch → pull request into `develop` → @Seperoth reviews and tests → owner opens `develop` → `main` release PR → owner merges.

Do not send contributor feature PRs straight to `main`. Keep normal merge commits when promoting or syncing the long-lived branches; do not squash or rebase `develop` into `main`.

### GitHub enforcement status

On November 15, 2026, GitHub's branch-protection API returned HTTP 403: "Upgrade to GitHub Pro or make this repository public to enable this feature." Mandatory approvals, blocked direct pushes and required checks could not be enabled under the current repository settings. No visibility or subscription change was made.

`CODEOWNERS` names @Seperoth for review requests. The **Branch flow** check fails a PR into `main` unless it comes from this repository's `develop` and is opened by @Seperoth. Until branch protection is available, these are review guidance and visible checks, not an enforced barrier: writers can still push directly or merge a failing PR. Collaborators must follow the workflow below.

When protection becomes available, require PRs, passing **check** and **Branch flow** checks, resolved conversations, and @Seperoth's code-owner approval on both branches; block force pushes and deletion. Keep owner bypass available for owner-authored release PRs because GitHub does not allow authors to approve their own PRs. Collaborators should have write access rather than admin/bypass access. See [GitHub branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

The existing `codex/*` design branches and original `prototype-1` tags remain as history. No history is rewritten. New releases use `v0.2.0`, `v0.2.1`, and so on. `0.x` versions are still prototype releases.

## Everyday work

```powershell
git switch develop
git pull --ff-only origin develop
git switch -c codex/describe-your-change
npm ci
npm run dev
```

Open **http://127.0.0.1:5189** for Test Version 1.3.4.9, or use the URL printed by Vite if the port changes in a later version. The Windows launcher also starts development mode. Browser data is separate for each origin/port. Without credentials, the existing demo accounts and browser-local records keep working.

After a change, add one short note under **Unreleased** in `CHANGELOG.md`, then:

```powershell
npm run check
git status
git add <the-files-you-changed>
git commit -m "Describe the change"
git push -u origin codex/describe-your-change
```

Open a GitHub PR with **base `develop`** and your feature branch as the source. Request @Seperoth's review. Resolve feedback and wait for passing checks; the owner reviews and merges the change into `develop` before testing the combined version. Contributors do not merge into `main`.

GitHub runs the checks on `develop`, `main`, version tags, and pull requests. Its production build uses clearly fake public connection values only to check compilation; it does not connect to a database, upload an artifact, or deploy anything. Live Supabase and email behavior still need manual verification after those services are configured.

## Development and production settings

|                     | Development                                            | Production                                    |
| ------------------- | ------------------------------------------------------ | --------------------------------------------- |
| Local settings      | `.env.development.local`                               | `.env.production.local`                       |
| Template            | `.env.development.example`                             | `.env.production.example`                     |
| Data                | Demo by default; optional development Supabase project | Separate production Supabase project required |
| Build               | `npm run build:dev` → `dist/development`               | `npm run build` → `dist/production`           |
| Local build preview | `npm run preview:dev` → port 4174                      | `npm run preview` → port 4173                 |

Create the development file only if you want to customize its settings:

```powershell
Copy-Item .env.development.example .env.development.local
```

To use real test accounts, set `VITE_DATA_MODE=supabase` and fill in the development project's URL and **public anon/publishable key**. A partial connection stops startup rather than switching to demo. Keep demo values blank when using `VITE_DATA_MODE=demo`.

When preparing production:

```powershell
Copy-Item .env.production.example .env.production.local
# Fill in the production project's public connection settings, then:
npm run build
npm run preview
```

Production configuration is prepared, but no production Supabase project or hosting has been provisioned. Builds deliberately stop until both connection settings are supplied. Production mode does not offer demo accounts. It also rejects the development Supabase URL when that URL is configured in a development env file. If development settings are supplied only by an external process or another machine, confirm the projects are different yourself.

Use separate Supabase projects for the two environments, each with its own Auth users, database, and private document storage. Apply the existing migration to a **new** project once; never reset production to refresh test data. For future schema changes, add another timestamped migration instead of editing an already applied one. Configure Supabase Auth's allowed URLs per environment. Test migrations and the client → assistant → admin journey in development before applying a release to production.

Only `.env.*.example` templates are committed. Real env files are ignored. Shared `VITE_` settings in `.env` or `.env.local` are rejected so they cannot affect both environments. If you have an older `.env.local`, move its browser settings to `.env.development.local`.

The app allows only `VITE_DATA_MODE`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` in its browser configuration. Never add service-role, Supabase secret, or Resend keys there. Email secrets (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `PAYMENT_WEBHOOK_SECRET`, `APP_URL`) belong in each Supabase project's Edge Function secrets. Point `APP_URL` to that environment's app URL and use a test recipient during development.

Frontend settings are embedded at build time, so rebuild after changing them. See [Vite's environment documentation](https://vite.dev/guide/env-and-mode). A production build is a static app package; the preview command only serves it locally. Payments remain simulated in both environments.

## Make a release

1. Contributor PRs first enter `develop`. Prepare any release metadata in another feature PR targeting `develop`. Update both package files, the optional `displayVersion`, and the dated change log together. Current 1.3.4.9 uses package version `1.3.4-9` and display version `1.3.4.9`; keep them consistent without silently renumbering existing releases.
2. As @Seperoth, update and verify the combined development version:

   ```powershell
   git switch develop
   git pull --ff-only origin develop
   npm ci
   npm run check
   npm run dev
   ```

3. Verify the affected Client, VA and Admin workflows in the browser; review changes, migrations and configuration. Confirm GitHub **App checks** passed. Do not apply a live migration or deploy just to merge source.
4. Only after verification, @Seperoth opens a PR with **base `main`**, **source `develop` in this repository**. Summarize the tested changes and mark the release-verification checkbox. If code changes during review, recheck the affected behavior. The owner merges using **Create a merge commit**; never squash or rebase this long-lived branch.
5. Update local branches after the release, then sync the release merge back into development:

   ```powershell
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch develop
   git pull --ff-only origin develop
   git merge --ff-only main
   git push origin develop
   ```

   With enforced branch protection, use an owner-reviewed `main` → `develop` sync PR instead of a direct push if owner bypass is unavailable. If `develop` has gained other commits and fast-forward fails, use a sync PR; do not force-push. Tag the tested `main` commit with the agreed release identifier after approval. Existing tags remain untouched.

Use **patch** (`0.2.0` → `0.2.1`) for fixes and **minor** (`0.2.0` → `0.3.0`) for features. The app reads its version from `package.json`; no separate UI number needs editing. Hover the version/environment status to see the source commit. Commit your changes before making the final release build so the revision identifies that source accurately.

## See changes or recover an old version

```powershell
git log --oneline -10
git diff main..develop --stat
git diff v0.1.0..v0.2.0 --stat
```

Read `CHANGELOG.md` for the plain-language history. To inspect an older release without changing your development folder, create a separate checkout:

```powershell
git worktree add --detach ../nexus-va-v0.1.0 v0.1.0
```

Install dependencies in that folder and use port 5174 if development is already running. To undo a bad source change on a shared branch, use `git revert <commit>` and make a new patch release. Do not reset shared history. Source rollback does not undo a database migration; back up and plan database changes separately.
