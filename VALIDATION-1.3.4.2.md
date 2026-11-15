# Validation — 1.3.4.2

Validated locally on November 14, 2026.

- `npm run check`: **74 tests passed**, TypeScript check and development build passed.
- Nine new reporting tests cover local inclusive boundaries, Monday-based weeks, full month versus month to date, leap years, year changes, comparison ranges, invalid dates, payment/submission date selection, absent comparison baselines, empty delivery denominators, overnight attendance clipping, excluded corrections, CSV formula escaping and differing multi-month totals.
- Browser: all nine presets changed the displayed dates, metrics and delivery counts. This month: Nov 1–30, $2,485 paid, 13 requests due. Last month: Oct 1–31, $2,480 paid, 8 requests due. Last 90 days: Aug 17–Nov 14, $7,705 paid, 23 requests due. Figures are illustrative local demo records.
- Custom date validation disabled Apply for reversed dates without changing the active report. A future empty period produced zero records and an unknown delivery rate, not a fabricated percentage.
- A valid custom October period applied correctly on mobile; comparison toggle hid comparisons. Export triggered a dated CSV download and confirmation.
- Payment, delivery, team, attendance and assignment drill-downs opened the matching records/workflows. Navigation away and back retained the applied report.
- Light and dark mode visually reviewed. Responsive layouts checked at 320, 375, 768 and default 1280 pixels; no document horizontal overflow.
- Browser console: no warnings or errors observed.
- All **78 source/configuration/documentation files** captured from 1.3.4.1 before copying retained their SHA-256 hashes. Excludes dependency, build, cache and Git directories and the incremental TypeScript build file. Original 1.3.4 Git status remains clean.
- Local server runs on port 5182; earlier versions were not restarted or edited.

Production deployment was not attempted; production environment credentials are not configured. Local attendance and simulated payments retain the limitations documented in the revision notes.
