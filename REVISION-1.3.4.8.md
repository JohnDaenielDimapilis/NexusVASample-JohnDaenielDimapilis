# Revision 1.3.4.8

November 15, 2026. Additive local test revision of 1.3.4.7. Preview: http://127.0.0.1:5188/.

## Notification behavior

- The existing bell, dropdown, typography, colors, surfaces, icons and responsive positioning are retained. Notification text and the existing contextual action are semantic buttons. All notifications are accessible in the scrollable panel; the former 12-item limit is removed.
- Newly generated workflow notifications include actual record IDs. Request and delivery events open the existing request drawer. Message events open the exact participant conversation. Payment events open the request drawer containing real payment-tracking records and never execute payment. Appointment events open the existing appointment details. Reviewed-file events open the accessible Files view filtered to that file name.
- Legacy records without IDs use a unique, case-insensitive title/name match or open the relevant list. Ambiguous legacy notices never guess a specific record. Missing, reassigned, private or malformed targets show the actual notification text and an availability explanation in the existing modal.
- Individual Mark read/Mark unread, snapshot-based Mark all read, Dismiss and Restore use the existing command/data architecture. Bulk read affects the active unread IDs present when clicked, excluding later arrivals and dismissed records. Dismissal is reversible and preserves read status. Active counts exclude dismissed records; restoring an unread item restores its badge.
- Read status and counts update optimistically. Shared save locks and a synchronous component guard prevent overlapping actions. Failed saves restore affected fields, retain unrelated/new records and show a toast plus inline retry feedback. Background refreshes that cross a notification save are reconciled after the save. Late results are ignored after an account change.
- Keyboard activation, accessible status labels, live announcements, focus outlines and Escape-to-bell focus are included. Notification actions wrap on small screens and use larger touch targets.
- Existing local storage/change events automatically update the panel, including across tabs. Connected mode keeps the existing 15-second polling; this revision does not add websocket delivery or external push/email notifications.

## Connected backend

Apply `supabase/migrations/202611150001_notification_actions.sql` after the three earlier migrations. It adds optional target metadata and reversible dismissal. The existing public RPC remains the entry point; notification commands check an active account and own-record access. Existing RLS and direct-write restrictions remain. All other commands delegate to the prior implementation, retaining business and privacy checks. Notification-only triggers attach validated command/generated record IDs without changing source records. Client-supplied target objects are not trusted.

The migration was executed and tested in local PostgreSQL-compatible PGlite. It has not been applied to a live Supabase project. Existing seed records are retained; no fabricated notification feed or placeholder navigation was added. The browser-only QA message is confined to the separate localhost origin and is not included in source/seed data.

## Scope

Changes are limited to notification types, generation metadata, notification state/navigation handlers, the extracted notification component, scoped interaction styles, tests, one additive migration, release labels/launcher port and release documentation. Existing dashboards, role permissions, Admin-only attendance verification, timers, request transitions, payment simulation, calendar and privacy features are retained.
