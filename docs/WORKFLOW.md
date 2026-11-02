# Development and releases

Use two branches and two environments. No deployment runs automatically.

| Branch    | Purpose                                                           |
| --------- | ----------------------------------------------------------------- |
| `develop` | Everyday changes and local testing. Leave your working copy here. |
| `main`    | Tested, versioned source ready for a release.                     |

The existing `codex/*` design branches and original `prototype-1` tags remain as history. No history is rewritten. New releases use `v0.2.0`, `v0.2.1`, and so on. `0.x` versions are still prototype releases.

## Everyday work

```powershell
git switch develop
git pull --ff-only
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The Windows launcher also starts development mode. Without credentials, the existing demo accounts and browser-local records keep working.

After a change, add one short note under **Unreleased** in `CHANGELOG.md`, then:

```powershell
npm run check
git status
git add <the-files-you-changed>
git commit -m "Describe the change"
git push origin develop
```

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

1. On `develop`, run `npm version patch --no-git-tag-version` for a fix, or `npm version minor --no-git-tag-version` for a feature. This updates both package files. Move the Unreleased notes into a dated section with that version.
2. Run `npm run check`, inspect the relevant screens, commit the release notes and package files, then push `develop`. Wait for GitHub's **App checks** to pass.
3. Promote the tested commit. For example, if the new version is `0.2.1`:

   ```powershell
   git switch main
   git pull --ff-only
   git merge --ff-only develop
   git tag -a v0.2.1 -m "Prototype 1 - version 0.2.1"
   git push origin main v0.2.1
   git switch develop
   ```

If a fast-forward fails, stop and inspect the changes; do not force-push. Optional pull requests can review `develop` → `main` before promotion. Keep the normal merge history rather than squashing the long-lived development branch.

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
