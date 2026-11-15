# Validation - 1.3.4.7

November 15, 2026. Development/demo mode on Windows.

## Automated checks

- `npm run check`: 87 tests passed across 7 test files; TypeScript check and Vite development build passed after final changes.
- Report tests cover role ownership, exclusion of available jobs, completed/unpaid records, delivery timestamp versus due date, current actions under historical filters, participant-only next meetings, date boundaries/invalid ranges, empty periods, midnight clipping, breaks/unverified separation, correction exclusion and private-record/formula-safe CSV output.
- Attendance tests cover idle/sleep gaps, automatic scheduled clock-out, reassignment, backwards clocks, Admin-only correction/review/policy commands, forged-role rejection, immutable original segments and approval locking.

## Browser checks

- Client and VA light dashboards and dark mode reviewed. Period presets updated totals; custom historical dates applied. Native date edits produced an invalid-range error and disabled Apply. Cancel retained the previous applied range. Current work/actions stayed visible when summary dates changed.
- Client delivery drilldown showed matching records, due dates and actual delivery dates. Date definitions showed the recorded-date limitations and no Compare control.
- Responsive views checked at Client 375x812 and VA 320x740: document scroll width equalled viewport width. Temporary viewport overrides were reset. VA verification card is a DIV, not a button. No VA Reply needed or Conversations dashboard panel appeared.
- Isolated attendance QA used http://localhost:5187 (a separate browser origin from the main http://127.0.0.1:5187 preview). A clearly labelled non-billable QA session passed clock-in -> dashboard break -> resume -> clock-out with summary -> VA read-only verification status -> Admin approve and lock. Admin review controls were absent for the VA; approval removed edit controls. QA clocking did not add hours to the main preview origin.
- Corrections with unverified gaps were exercised by the action-engine tests; the browser QA session had no unverified gap and did not require a correction.
- Captured console logs for dashboard and attendance QA contained no warnings/errors. Final local page displayed Test Version 1.3.4.7.

## Preservation and evidence

Original base hashes and clean Git status matched. Earlier manifests matched: 1.3.4.1: 78 files, 1.3.4.2: 85 files, 1.3.4.3: 87 files, 1.3.4.4: 90 files, 1.3.4.5: 95 files, 1.3.4.6: 201 files, 1.3.4: 65 files. Runtime build/log/dependency folders are excluded from manifests.

Actual screenshots saved alongside this project: nexusva-client-1.3.4.7.jpg, nexusva-va-1.3.4.7.jpg, nexusva-va-mobile-1.3.4.7.jpg and nexusva-admin-verification-qa-1.3.4.7.jpg. These show sample data, not production attendance.

This was a focused dashboard/attendance review, not a full production, device or accessibility audit. Production-mode deployment, live payments, messaging integrations and server attendance authorization were not tested or added.
