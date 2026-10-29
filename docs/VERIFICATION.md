# Prototype verification

## Original-design cleanup — October 30, 2026

- Restored the original purple rail, white sidebar, individual summary cards, document illustration, and separate sign-in account cards. Removed decorative card stripes, login orbits and avatar stacks, repeated slogans, a redundant activity label, and a nonfunctional company-switch chevron.
- TypeScript/Vite build and all 20 domain/PostgreSQL tests pass.
- Chromium review covered sign-in, overview, service requests, appointments, messages, billing, files, profile, integrations, and the request dialog at 320, 390, 768, 1024, and 1440 px. No document-level horizontal overflow or uncaught browser exceptions remained.
- The complete client → assistant → admin journey passed at desktop and phone sizes: profile editing, sample file upload, appointment scheduling, request creation and acceptance, payment verification, messaging, simulated payment, output upload, delivery, feedback, admin logs, and logout. Checks used isolated browser contexts and preserved the user's demo data.
- Computed text-color checks on the client sign-in and workspace screens found no failures against the applicable 4.5:1 or large-text 3:1 contrast thresholds. This is not a complete accessibility audit.
- The prior rebrand remains preserved at commit `ce0326a` and in `backups/nexus-va-rebrand.zip`. The first-version ZIP and release tag remain unchanged. The application stays local; hosted Supabase and Resend remain unverified.

## Brand refresh — October 29–30, 2026

- Production build and all 20 domain/PostgreSQL tests pass.
- Chromium browser review covered sign-in, overview, service requests, appointments, messages, billing, documents, profile, integrations, and the request dialog at widths of 320, 390, 768, 1024, and 1440 px. No document-level horizontal overflow or browser exceptions remained. Tables scroll within their own containers.
- Complete journeys passed at desktop and phone sizes: profile update, sample document upload, appointment, service request, executive acceptance, payment verification, chat, simulated client payment, sample output upload, delivery, five-star feedback, admin logs, and logout. These ran in isolated browser contexts without changing the user's demo data.
- Computed text-color contrast checks across the client sign-in and workspace pages found no failures against the applicable 4.5:1 or large-text 3:1 thresholds. This check is not a complete accessibility audit.
- The original source archive was created before edits, and both preservation tags resolve to `529c303484acb3eecd2056dae527503916a8c3f9`. ZIP SHA-256: `18e9e9984eb00cca6378becc5849cb11e2f4fe5dfdcbe7e4b93aa31569c2cd92`.
- The local launcher recognizes the new document title. Hosted Supabase and Resend services remain unconfigured and unverified. This refresh is local; the original GitHub release remains unchanged.

## Original prototype — October 28, 2026

The following notes record verification of the first version before its GitHub publication and this brand refresh.

## Automated checks

- TypeScript and Vite production build.
- 12 domain tests covering valid service journeys, automatic and manual assignment, payment ownership and duplicate payment rejection, staff skill preferences, delivery requirements, closure and star ratings, suspension, scheduling conflicts, and invalid input.
- 8 embedded PostgreSQL integration tests executing the actual Supabase migration. These check signup privilege isolation, transaction behavior, row-level security, direct table write denial, automatic matching, staff chat and payment tracking, private upload ownership, delivery and closure, appointment conflicts, and admin-only audit access.
- Dependency audit: no known vulnerabilities at verification time.

## Browser checks

Performed through the real UI in Chrome:

1. Entered the client demo account and created **Client onboarding guide**, Medium difficulty, $125 test budget.
2. Confirmed the initial test payment in Billing and verified automatic assignment to Maya Bennett.
3. Switched to the assistant, opened the request, and stored a sample output in browser IndexedDB through **Try sample output**.
4. Sent a message from the assistant to the client and delivered the output.
5. Switched to the client, triggered the download, approved the delivery, left five stars and written feedback, and closed the request.
6. Booked **Onboarding guide review** and verified it appeared on FullCalendar.
7. Updated the client profile and checked the admin audit log and Paid/Delivered/Completed classification.
8. Checked the client dashboard at a 390 px mobile viewport with no document-level horizontal overflow, and verified mobile navigation.

These actions leave a completed sample request and review appointment in the browser demo so you can inspect the outcome.

Chrome’s extension denied automated selection of a local file because **Allow access to file URLs** was disabled. The built-in sample output exercised the same file storage and delivery path, but arbitrary file-picker automation was not verified. Normal user file selection remains available through the app.

Supabase-hosted Auth, service-backed Storage uploads, live multi-user synchronization, and Resend email sending require project configuration and remain unverified against external services. Nothing was hosted on Railway or published to a GitHub remote.
