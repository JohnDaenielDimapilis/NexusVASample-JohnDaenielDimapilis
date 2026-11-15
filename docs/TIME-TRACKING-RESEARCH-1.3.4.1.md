# NexusVA time tracking: research and implementation plan

Prepared November 14, 2026. Scope: additive Version 1.3.4.1; preserve the 1.3.4 base. The user selected tracking inside NexusVA, with outside work flagged for review.

## Recommendation

Use a task-linked timer plus an exception review queue. Capture clock-in/out timestamps automatically after an assistant deliberately starts a work session. Require a selected assigned request and planned end. Show breaks and uncertain intervals separately. Let the assistant explain outside work, then let an admin compare the explanation with request progress, outputs, and a work summary before approving any adjustment. Do not equate pointer or keyboard activity with productive work, or automatically infer dishonesty or deduct pay from missing activity.

For the first pilot, use a five-minute inactivity threshold, a heartbeat every fifteen seconds while the app is visible and online, a ninety-second heartbeat tolerance, and a planned session limit of twelve hours. These are proposed defaults, not employment rules. Admin can choose five, ten, or fifteen minutes for future sessions. Confirm appropriate hours and break arrangements with the business before real use.

## Research findings

- **Canopy:** Its timer can be attached to a client, service, task, or subtask, and supports pause/resume and saved time entries. It allows one running timer at a time. NexusVA follows the task association and saved-entry pattern, using its existing client and service records. [Canopy: Start a Timer](https://support.getcanopy.com/en/articles/9376122-start-a-timer)
- **Browser visibility:** The browser exposes whether its page is visible. Background timers may be delayed, so adding seconds on every callback is unreliable. NexusVA calculates intervals from timestamps and conservatively marks long heartbeat gaps. A hidden page is not proof that the assistant stopped working. [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- **Device idle detection:** The browser Idle Detection API has limited support, requires a secure context and explicit permission, and is experimental. This revision uses ordinary interaction events inside NexusVA instead of depending on that API. It cannot inspect Excel, calls, another tab's content, or another application. [MDN: Idle Detection API](https://developer.mozilla.org/en-US/docs/Web/API/Idle_Detection_API)
- **Activity is contextual:** Hubstaff explains that reading, research, and meetings can produce low input activity while someone is working. Its web timer cannot collect the desktop input activity used by its desktop app. This supports the chosen explanation-and-review approach. A future requirement for cross-app tracking would require an explicitly installed desktop tracker or an integration. [Hubstaff: Activity levels](https://support.hubstaff.com/how-are-activity-levels-calculated/), [Hubstaff: Desktop tracking scope](https://support.hubstaff.com/what-does-the-desktop-application-track/)

## What works in this revision

The assistant clocks in on assigned, in-progress work. Clock-in/out timestamps, deliberate breaks, idle pauses, sleep/connection flags, and planned clock-out are saved locally. Only one open session per assistant is allowed. Returning input never retroactively converts uncertain time to recorded work. Reassigned or delivered requests pause the timer at reconciliation. Admin observation never counts as an assistant heartbeat.

The Admin overview gathers work and time exceptions automatically. The attendance page shows team status, filters, recorded/break/unverified durations, and approved totals. CSV exports visible entries with UTC timestamps. Assistants add summaries and can request a correction no larger than the unverified interval. Admin records a reason, reviews any correction separately, and approves/locks the entry. The action history records those decisions; original segments remain unchanged.

The displayed running duration can advance between saved heartbeats. The idle rule includes its configured grace period, and an admin observing a silent timer can account for the last short heartbeat-tolerance interval before the gap is flagged. Neither figure is a measurement of productive seconds. Switching away briefly does not instantly stop the timer; sufficiently long loss of visible-tab heartbeats produces uncertain time. Known breaks remain breaks even if the tab sleeps.

Scheduled clock-out is enforced whenever the demo next reconciles a session. If every tab is closed, no browser code runs at the scheduled instant; reopening reconciles to the planned timestamp and flags unsupported intervals. This is different from a continuously running attendance server.

## Before use with real VAs

Attendance remains demo-only in this revision. The existing connected workspace does not silently fall back to local attendance. Build the following as a separate reviewed backend addition:

1. **Server-owned timestamps and access:** Store sessions, segments, corrections, shifts, and audit events in dedicated tables. Derive the actor from the authenticated session. Authorize staff against their own current assignment; restrict team reviews to explicitly permitted admins. Clients must have no access to another worker's attendance or internal notes.
2. **One open session and idempotency:** Enforce one open timer per assistant with a database constraint. Use transactional commands, unique operation IDs, and server version checks for retries and competing tabs/devices. The demo uses browser locks where supported; it is not a cross-device lock.
3. **Durable automation:** Receive server-timestamped heartbeats and run a server job to pause stale sessions and close shifts without depending on an open tab. Separate client-reported activity from server-observed connectivity. Preserve uncertainty if either signal is missing.
4. **Reviewable evidence:** Retain original segments, correction requests, reviewer identity, reasons, and immutable approval events. Prevent self-approval and direct record edits after lock. Integrate relevant task milestones and deliverable references without opening private conversations or files to broader access.
5. **Employee visibility and operations:** Show workers the exact tracking scope and allow explanations for calls, reading, accessibility needs, and connection failures. Agree on retention and access rules, an appeal path, and shift timezone/overnight handling. No screenshots or key contents are needed for this chosen scope.
6. **Release validation:** Test row-level permissions through direct APIs, duplicate starts, concurrent devices, outages, DST and overnight shifts, browser closure, clock skew, correction limits, and locked-entry changes against a non-production backend. Do not feed unreviewed demo totals to invoices, payroll, or automated penalties.

No production integration, paid tracker subscription, background desktop agent, deployment, or staff monitoring outside this local demo was installed or enabled.
