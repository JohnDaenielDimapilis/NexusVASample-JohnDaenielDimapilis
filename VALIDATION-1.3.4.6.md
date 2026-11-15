# Validation: 1.3.4.6

Reviewed November 15, 2026 at **http://127.0.0.1:5186/** in the browser-local demo.

## Automated checks

`npm run check`: 7 test files / 83 tests passed, TypeScript passed, development build passed. The existing tests cover domain behavior; browser interaction checks below supplement them.

## Role and layout coverage

| Role | Main pages inspected at desktop and phone sizes |
| --- | --- |
| Client | Overview, Work board, Requests, Request templates, Assistants, Messages, Appointments, Files & documents, Billing |
| Virtual assistant | Overview, Work board, Requests, Time & attendance, Messages, Appointments, Files & documents, Billing |
| Admin | Overview, Work board, Requests, Clients, Time & attendance, Billing, Activity logs, Conversation Review, Schedule History, Administrative Audit Logs |

Shared profile, tools and guide surfaces were inspected, including assistant-specific profile preferences. Sign-in/demo-entry layouts were checked at desktop and 320px phone widths. Representative dark-mode views, request forms, report definitions and profile views were inspected. Viewports used: **1440x1000, 1024x900, 900x900, 390x844 and 320x740**. Tablet and dark-mode checks were representative, rather than every route at every viewport.

DOM measurements recorded no document-width overflow or uncontained main-content horizontal overflow in the captured states. Intentional table/board scroll containers are excluded from that measurement. Screenshots were visually reviewed for spacing and alignment; the mobile heading gap and cramped form rows found during that review were corrected. A separate 320px assistant-header check found no intersecting controls and confirmed 44px control targets.

## Functional acceptance checks

- Created **NX-2023, UX review acceptance workflow**, through the dedicated request page, with a $125 test budget.
- Confirmed its simulated payment; matching assigned Maya Bennett.
- Attempted delivery without an output: received a persistent inline error and temporary error message.
- Uploaded the sample output, delivered it, then approved it as Client on mobile with a five-star rating. The request reached Completed.
- Started a work session, took a break, resumed, clocked out and saved a summary. Feedback appeared for the user actions.
- Reviewed and approved/locked that local time entry as Admin, with a recorded reason and success feedback.
- Assigned the sample Monthly research brief request to Luis Torres; request status and workload updated.
- Sent a local demo conversation message on mobile; the message and success feedback appeared.
- Saved assistant profile information; success feedback appeared.
- Opened appointment details and editing; saving succeeded. Cancellation opened a confirmation, and Keep appointment retained the appointment.
- Changed a report date using native keyboard input and applied it; report totals changed. Restored the standard reporting period afterward.
- Opened payment-report and time-review drawers; inspected payment-request and appointment forms.
- Downloaded the Admin report CSV and observed its temporary confirmation.
- Expanded workflow guide sections; checked Escape dismissal and keyboard wrapping within the drawer. Background content had the inert attribute while the overlay was open.
- Observed temporary success feedback disappear during subsequent work. Errors remain available inline until correction or leaving the task.
- Switched among all three demo roles and signed out/back into a demo workspace; saved local records persisted.
- Browser diagnostics returned no warning/error entries at the final review.

## Limits

Payments, identities and records are simulated/browser-local. No real payment, email, external integration or live authentication was tested. Privacy oversight pages were checked in their truthful connection-required/empty states; connected Supabase case access, private content and production permissions require a configured backend and separate verification. This is a local prototype build, not a production deployment certification.

Evidence: **docs/ui-review/layout-measurements.json**, route screenshots, and the final overview screenshot. Earlier screenshots/contact sheets capture intermediate review states; final named screenshots and the final comparison sheet show the refinements.
