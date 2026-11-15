# Revision 1.3.4.7

Created November 15, 2026 as an additive local test version. Local preview: http://127.0.0.1:5187/. The existing Downloads 1.3.4.6 copy and its running server on 5186 are preserved, along with original 1.3.4 and workspace revisions 1-5.

## Dashboards

- Retains shared neumorphic light/dark styling, original Nexus branding, contextual drawers, inline date editors and feedback refinements from 1.3.4.6.
- Compact Admin-style date toolbar for Client/VA, without Compare. Today is the initial default; presets and custom inclusive ranges are saved separately per role/account. Relative presets recalculate across midnight. Invalid ranges cannot be applied; Cancel preserves the applied range. Mobile toolbar uses two rows with labelled icon controls.
- Client cards: unfinished requests due in the period; deliveries received by delivery timestamp; unpaid payment requests created in the period; currently completed requests due in the period. No invoice-due or completion timestamps are invented. Legitimate unpaid balances remain visible even on completed requests.
- VA cards: unfinished assigned work due in the period; deliveries submitted by timestamp; recorded NexusVA work segments clipped to the period; closed sessions overlapping the period awaiting Admin verification. The last card is read-only and counts entries, not minutes.
- Current delivery/payment actions, all active work, overdue work, waiting-on-client handovers, next appointment and Client conversation previews stay available regardless of summary dates. Ownership applies before calculations, lists and CSV export. Available/unassigned jobs do not inflate VA assignment counts.
- Summary cards open matching record details. Delivery details include actual delivery dates. CSV exports only scoped period records, with date definitions and spreadsheet formula protection. Statuses are current, not historical snapshots.
- VA dashboard has no Reply needed or Conversations panel. Messages remain accessible in navigation. Attendance status has no verification action or clickable arrow.

## Attendance permissions and controls

- VA can clock in against assigned in-progress work, take a break, resume, clock out with a work summary and update their own summary before approval. Dashboard break/resume and clock-out controls use the existing time engine.
- Only Admin can create a time correction, review it, approve/lock an ended time entry, request changes or change timer policy. Both the UI and local action engine enforce these restrictions. Commands also check the actor role/status against the workspace profile.
- Corrections are bounded by an entry's unverified time, require evidence/reasons, remain separate from original segments and are audited. Pending corrections must be resolved before entry approval. Approved entries remain locked.
- Time intervals exclude breaks/unverified gaps from recorded work. Period hours exclude approved adjustments because adjustment work dates are not recorded. Admin approval is an explicit review status, not a claim that browser activity proves productivity.

## Limits

This remains a local demo using browser storage and the device clock, with sample workspace records and simulated payments. Local role checks are not server authorization; browser storage/identity can be changed by the device user. No server attendance tables, authenticated attendance endpoints or new backend policies were added. Connected mode keeps attendance unavailable until that integration exists. NexusVA interaction timestamps cannot verify Excel, calls or other applications, and uncertain time stays flagged for Admin review. No real messages, payments or external account changes were made.
