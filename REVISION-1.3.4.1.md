# NexusVA Test Version 1.3.4.1

November 14, 2026. Independent, local revision based on the preserved 1.3.4 source at commit `5c5bd56`.

## Open this revision

Double-click **Open Nexus VA.cmd**, or run `npm ci` followed by `npm run start:local`. Visit **http://127.0.0.1:5181/**. The development server listens only on this computer. Node.js 22.18 or newer is required.

The unchanged 1.3.4 source remains in `C:\Users\JD\Downloads\NexusVA Test Version 1.3.4`. Its launch port remains 5180. This revision uses its own source folder, dependencies, server port, and browser storage origin. No existing browser records are imported automatically. Use the same address consistently: `localhost` and `127.0.0.1` have separate browser storage.

## Additions

- **Operations watch on Admin overview:** Automatically brings together running timers, time entries needing review, overdue requests, and unassigned work. Attention items open the existing request or time-review view. Counts derive from current records.
- **Time & attendance:** Assistants select assigned, in-progress work and a planned clock-out. Clock-in timestamps and time entries are captured automatically. The timer separates recorded work, explicit breaks, and unverified intervals; it pauses on idle/connection gaps and closes at the planned end. Admin has a current roster, filters, summaries, and CSV export. Outside work can be explained and requested as a bounded correction. Admin review requires reasons and a work summary; approved entries are locked. Original timer segments and approved adjustments remain separate.

- **Work board:** Client, Assistant, and Admin can see role-appropriate requests in Open, In progress, Client review, and Completed lanes. Search by request, client, or assistant. Filter overdue, next seven days, unassigned, client review, and completed work. Admin can filter by client; assistants can separate their assignments from unassigned requests. Each card opens the existing request detail and its existing permitted actions. Admin also gets request-count-based assistant workload, without claiming hours or availability.
- **Clients:** Admin-only directory of existing client profiles, with search and activity filters, contact details, active assigned assistants, request history, overdue work, and outstanding/paid payment records. It does not create accounts, grant permissions, or expose private conversations, files, or calendars.
- **Request templates:** Client-only library of six reusable briefs covering the existing service categories. Choosing a template pre-fills the original request form's title, service, description, and difficulty. The client reviews the brief and supplies the budget and due date before submission. Creation, simulated payment, assignment, delivery, approval, and audit behavior use the existing commands.

## Preserved behavior and limits

The original dashboard, logo, Montserrat typography, light/dark appearance, request workflow, private messages, participant calendar, uploads, billing, profile settings, and privacy-review controls remain in place. These additions do not require a database migration or change the stored workspace schema.

This is a **local prototype with sample data and simulated payments**. Connected Supabase behavior is inherited and has not been verified against a live service in this revision. The work board and directory do not substitute for server authorization. No payment provider, email delivery, or external integration was added. No deployment or GitHub upload was performed.

Attendance is deliberately **NexusVA-only**, as requested. It records interaction timestamps, not typed text, screenshots, other applications, or private conversations. Device time and browser storage are not tamper-resistant. A running timer or an interaction does not prove work; outside-work explanations and task results need review. See [the research and production plan](docs/TIME-TRACKING-RESEARCH-1.3.4.1.md). Browser data is shared only between tabs on the same local origin, not between different people's computers.

The displayed release is **1.3.4.1**. Package managers use the valid semantic package version **1.3.4-1**, with `displayVersion` providing the requested release label.

## Revision discipline

Keep the 1.3.4 base unchanged. Add subsequent revisions to a separate version copy and add a new revision record. Do not replace the preserved base or silently migrate its browser data.

## Validation

Validation results are recorded in `VALIDATION-1.3.4.1.md` after checks complete.
