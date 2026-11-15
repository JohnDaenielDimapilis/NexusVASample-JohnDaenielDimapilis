# NexusVA Test Version 1.3.4.2

This additive local revision turns the owner-dashboard picture into a working Admin overview. Version 1.3.4 and the complete 1.3.4.1 project are preserved.

## Open the revision

- Address: http://127.0.0.1:5182/
- Choose **Admin workspace**, then **Overview**.
- Restart with `Open Nexus VA.cmd`. For an extracted source ZIP, run `npm ci` first.
- Earlier revisions remain on their own ports (5180 and 5181).

## Date filters and owner reports

- Today; Monday–Sunday this week; last 7 days; next 7 days including today; this calendar month; month to date; last calendar month; last 30 days; last 90 days; custom dates.
- Presets apply immediately. Custom dates require **Apply dates**; invalid or reversed dates do not replace the active report. **Revert dates** restores the applied dates.
- Both calendar boundaries are inclusive in the displayed browser time zone. Overnight attendance is clipped to the period.
- The applied filter is remembered when navigating away or reopening this browser. Presets resolve to current dates when reopening.
- Optional previous-period comparison uses prior calendar months for full-month reports and corresponding elapsed days for month-to-date reports (clamped to the previous month’s last day). Other comparisons use the immediately preceding equal number of calendar days.
- Cards and lists derive from actual accessible workspace records. Clicking a figure opens its dated breakdown; request actions open the existing request workflow.
- CSV exports use the same selected record sets, include date-basis labels and preserve cents. Text that could become a spreadsheet formula is escaped.

## What each date means

| Section | Date basis |
| --- | --- |
| Payments marked paid / collections recorded | Payment `paidAt`, with status Paid |
| Outstanding payments | Payment creation date; current unpaid status |
| On-time delivery | Delivery submission date; compared with the request’s local due date |
| Requests, workload and request issues | Request due date; current status |
| Payment issues | Payment creation date; current unpaid status |
| Client attention | Clients associated with the selected request or payment issues |
| Attendance | Entries overlapping the period; work segments clipped to its boundaries |

Historical date filters select dated records, **not a reconstructed historical status snapshot**. Current periods are incomplete. Submission does not imply client acceptance. Outstanding payments are not called overdue because invoice due dates are not stored.

## Demo and data limits

A fresh browser on this revision gets the original sample workspace plus clearly illustrative reporting records spread over three months. Existing saved workspaces are never reset or enriched automatically. This revision uses a separate browser origin from earlier versions; data is not automatically migrated between them.

Payments remain simulated in demo mode. Attendance remains local browser data, with no shared server attendance service. No time entries were invented for this revision. Attendance summaries exclude unallocated time corrections. Schedules, effort estimates, invoice due dates, contract renewals and costs are not present, so missing shifts, capacity hours, overdue invoice aging, renewals and profit are not fabricated. Workload shows unfinished request counts instead of an invented capacity percentage.

No deployment, upload, push or external integration was performed. The local project reuses the prior revision’s installed dependencies through a directory junction; the source ZIP can be independently installed with `npm ci`.
