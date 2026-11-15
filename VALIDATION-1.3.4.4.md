# Validation — 1.3.4.4

Date: November 14, 2026. Local development/demo mode.

## Automated checks

- Existing Vitest suite: 74 tests passed after creating this revision.
- Type checking and development build: passed. Repeated after final CSS refinements.
- Final preview console: no captured warnings or errors.
- Original base: recorded SHA-256 hashes match and Git working tree is clean.
- Earlier revision manifests match: 1.3.4.1: 78 files, 1.3.4.2: 85 files, 1.3.4.3: 87 files, 1.3.4: 65 files.

## Browser review

- Reviewed sign-in, Admin light/dark overview, work board, client directory, attendance, billing and privacy case demo state.
- Reviewed VA overview, dark messaging, calendar, file table and timer start form; Client overview, templates, assistant directory and profile form.
- Standalone privacy notice reviewed in both light and dark modes.
- Date dialog opens with the applied range and cancels without changing it; compact custom-date apply/validation and focus handling were verified in 1.3.4.3. No report logic changed in 1.3.4.4.
- Mobile owner view checked at 375×812 and 320×740 with no document horizontal overflow; mobile date-dialog cancel retained the applied period. Desktop VA calendar checked at 1280×720 after header fix with document width equal to viewport width.
- Fixed duplicate input shadows, sidebar count contrast, Auth badge placement, dialog padding, assistant directory muted text, profile status contrast and desktop header crowding.

## Evidence and limits

Saved previews beside the project: `nexusva-neumorphism-1.3.4.4.jpg`, `nexusva-neumorphism-dark-1.3.4.4.jpg`, and `nexusva-neumorphism-mobile-1.3.4.4.jpg`.

These are representative visual checks, not a full browser/device or accessibility audit. No real payments, uploads, messages, clock-ins, backend permission changes or production integrations were exercised for styling QA. All prior local/demo limitations remain in effect.
