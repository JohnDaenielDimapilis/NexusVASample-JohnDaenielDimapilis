# Change log

Versions describe the application source. A release does not deploy the app.
Payments remain simulated throughout Prototype 1.

## Test Version 1.3.4.9 - 2026-11-15

- Removed the shared Workspace/current-page breadcrumb while retaining mobile navigation, existing header layout and functionality.
- Created a separate local revision on port 5189; previous versions preserved.

## Test Version 1.3.4.8 - 2026-11-15

- Made existing notifications actionable with validated record destinations, persistent read/unread controls, reversible dismissal and ownership enforcement.
- Retained existing appearance and data architecture; added keyboard/touch behavior, automatic-update reconciliation and save-failure feedback.
- Added a notification-only migration and local/domain/database regression checks. No external database migration or deployment was performed.

## Test Version 1.3.4.1 — 2026-11-14

- Created a separate additive revision of the preserved 1.3.4 base, with an independent local launcher on port 5181 and display version 1.3.4.1.
- Added Operations watch to Admin overview: current timer status, time reviews, overdue requests, and unassigned work derive from actual local records.
- Added task-linked assistant timers, automatic time entries, scheduled clock-out, explicit breaks, idle pauses, connection/sleep flags, and timestamp-based reconciliation.
- Added admin attendance roster, filtered time summaries, CSV export, work explanations, bounded correction requests, separate correction approval, and locked approved entries with action history.
- Added a role-scoped work board, admin client directory, and six client request templates that reuse the existing request form and workflow.
- Kept existing request, message, document, payment, calendar, theme, and privacy-review behavior. Attendance stays in a new local storage namespace and does not change the existing workspace schema.
- Added access and timer tests, screenshot-informed reference notes, and a researched plan for server-authoritative attendance before real use.

## Unreleased

- Proposes the cumulative NexusVA 1.3.4.9 test version for review against the previous 0.2.0 main branch. Includes role dashboards, local attendance with Admin-only verification, privacy oversight, interactive notifications and the latest breadcrumb removal. README documents the additions, review steps and migration/demo limits; no merge or deployment is included.

- Test Version 1.3.4 adds case-based conversation review, historical schedule review, administrative audit, and explicit privacy roles and permissions in additive Supabase migrations.
- Admin direct message, live calendar, and request attachment paths are removed. Client and VA calendars gain a compact Nexus-branded layout with day, week, month, edit, reschedule, and no-show actions.
- The privacy notice, agreement draft, and Privacy Impact Assessment working record document the controls and decisions pending organizational review.
- Test Version 1.3.3 groups navigation by role and clarifies active pages.
- Admins can inspect request-intake bars, open the matching date-filtered requests, and export selected request summaries.
- Requests show clearer filter feedback; table sorting and clickable rows have improved keyboard behavior.
- Reduced decorative dashboard card effects while retaining the Nexus visual system and Version 1.3.2 scrolling behavior.

## 0.2.0 — 2026-11-02

- Restored the original purple workspace design with clearer labels and less decorative clutter.
- Applied Montserrat across the application.
- Established `develop` for daily changes and `main` for tested releases, preserving the original prototype tags and design history.
- Separated development and production configuration and build folders.
- Added checks for missing production settings, unsafe browser keys, and reuse of a configured development database.
- Displayed the app version and environment at sign-in and in the workspace; hover the version for the Git revision.
- Added GitHub checks for tests, type checking, and both build configurations.

## 0.1.0 — 2026-10-29

Original **Prototype 1**, preserved by the `prototype-1` tag and release.

- Client, assistant, and administrator workspaces with browser-local demo accounts.
- Service requests, assignment, messaging, appointments, document uploads, simulated payments, delivery, star feedback, and audit logs.
- Supabase Auth, database, private Storage, and optional Resend integration.
