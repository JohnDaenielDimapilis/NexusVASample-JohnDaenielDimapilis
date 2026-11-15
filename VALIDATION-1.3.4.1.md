# Validation: NexusVA Test Version 1.3.4.1

November 14, 2026. Local development/demo only.

## Results

- `npm run check` passed: **65 tests**, TypeScript checking, and Vite development build.
- The suite includes the original request/environment/SQL permission checks, six operations access/date tests, and thirteen timer access/accounting/review tests.
- `git diff --check` passed. The new copy has no Git remote; nothing was uploaded or pushed.
- All **65 tracked files** in the original 1.3.4 source were checked against the SHA-256 manifest captured before copying. Every file is unchanged and the original checkout remains clean. A copy of the manifest is in `docs/BASELINE-1.3.4.sha256.json`.

## Browser checks

Checked in Chromium using the local demo at http://127.0.0.1:5181/:

- Assistant clock-in on assigned work; recorded time; explicit break; resume; work summary; clock-out; automatically saved entry.
- Admin review with a reason, approval and locking, filtered summaries, CSV download, and validation of exported recorded/break values and approval status.
- Admin overview's Operations watch derives its pending review count from the saved time entry. Approved entries leave that queue.
- Client template pre-fills the existing request form, then creates a demo request with the chosen budget and deadline.
- Clients do not see the internal attendance destination. Admin and Assistant use the same saved local time records with their respective view/action scopes.
- Admin overview, work board, client directory, and attendance at 320, 375, 768, and 1440px: no document/workspace/content horizontal overflow after the mobile header fix.
- Assistant work board and attendance, and Client work board and templates, at 320, 375, 768, and 1440px: no workspace horizontal overflow.
- Light and dark appearance, visible mobile menu icon, responsive controls, modal review, account switching, and reload persistence.
- Browser console reported **zero errors and zero warnings** during these checks.

The browser review caught a UI clock/render timing issue and a narrow-header overflow; both were corrected. Timer unit tests also retain a regression case for rendering a slightly stale UI clock without changing or falsely pausing saved time.

## Automated edge cases

The timer tests cover one open session, assigned-request validation, maximum shift length, actor access, five-minute idle handling despite heartbeats, admin observation not counting as a worker heartbeat, long sleep gaps, breaks, scheduled clock-out after sleep, reassignment, backwards device clocks, bounded corrections, original segment preservation, admin-only review, missing work summaries, locked approvals, and policy changes applying only to new sessions.

## Limits

This was not a production deployment or a live Supabase attendance test. Browser storage and device time remain editable and shared only within one browser origin. When all tabs are closed, scheduled end and stale-gap rules reconcile on the next visit, rather than executing as a background server job. Desktop applications and other tabs' contents are outside the chosen tracking scope. Review decisions and activity signals do not certify productivity or payroll eligibility.
