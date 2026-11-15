# NexusVA Test Version 1.3.4.6

Local UI/UX refinement of 1.3.4.5, prepared November 15, 2026. Earlier copies remain intact. Open **Open Nexus VA.cmd**, or visit **http://127.0.0.1:5186/** while its server is running.

## Interaction choices

| Task | Pattern in this version |
| --- | --- |
| Create a request with brief, budget, service, difficulty and deadline | Dedicated page inside the existing workspace navigation |
| Inspect a request, assistant, report or time entry | Side drawer; underlying workspace remains visible |
| Edit/schedule an appointment or request a payment | Side drawer with a focused form |
| Change report dates or read reporting definitions | Inline expandable panel beside the date controls |
| Read workflow guidance | Accordion sections inside the guide drawer |
| Receive save, upload, payment, message or timer feedback | Dismissible temporary toast |
| Resolve a form/action error | Persistent inline alert beside the current task, plus temporary feedback |
| Confirm test payment, approve/rate delivery, or cancel an appointment | Focused confirmation modal |
| Edit profile and work preferences | Existing dedicated profile page |
| Choose account actions or inspect notifications | Existing contextual popovers, constrained to the viewport |

Confirmation modals were kept where a deliberate decision is useful. Long content and reference material no longer require a centered modal. The prototype payment confirmation remains explicitly simulated.

## Layout and accessibility changes

- Shared spacing, wrapping and minimum-width rules for headings, toolbars, forms, long names and filenames.
- Removed excessive mobile heading space, separated summary cards, aligned upload actions, and made form rows stack on phones.
- Drawers have an opaque sticky title bar, independent scrolling and reachable actions. Mobile drawers use the screen width.
- Header controls fit a 320px viewport without overlapping; mobile header buttons have 44px targets.
- Calendar headings, day labels and grid colours follow the selected appearance.
- Popovers stay within the screen. Toasts avoid desktop drawer actions and use semantic success/error colours; hovering or focusing pauses dismissal.
- Dialogs have accessible titles, Escape dismissal, trapped keyboard focus and inert background content. Dedicated pages and inline panels do not trap focus.
- Errors clear when leaving their task or after successful correction/upload. Opening the guide closes mobile navigation.
- Payment report rows show a readable request reference instead of an internal record identifier.

## Preserved behavior

The existing role rules, request engine, simulated payment state transitions, uploads, delivery approval, messaging, appointment conflict checks, reporting calculations, CSV export and time engine remain in place. This revision changes interaction surfaces and feedback around those functions.

See **VALIDATION-1.3.4.6.md** for the route coverage, acceptance workflow and limits. Screenshots and layout measurements are under **docs/ui-review/**. Changes remain on this PC; no upload or push was performed.
