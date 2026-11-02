# Change log

Versions describe the application source. A release does not deploy the app.
Payments remain simulated throughout Prototype 1.

## Unreleased

Add the next user-visible changes here as they are made.

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
