# Nexus VA — original design cleanup

## Direction

The current request supersedes the previous rebrand. Restore the original Prototype 1 composition and apply the no-ai-design-slop quality gate within that direction. The audience remains clients, virtual assistants, and administrators managing the service-request journey.

The visual thesis is the original compact workspace: a narrow dark-purple navigation rail, a white sidebar, a light canvas, a lavender delivery-review banner, separate summary cards, and dense work tables. Preserve those proportions. Use Montserrat throughout the interface, as requested by the user, with weights distinguishing headings, body text, and controls. Do not substitute the rebrand's wide dark sidebar or flat metric strip.

## Preserve

- Purple `#7560D4`, deep purple `#292649`, lavender `#F0EDFC`, canvas `#F6F7FB`, and white work surfaces.
- The original two-column dashboard, four individual metrics, document illustration, rounded panels, and separate account cards at sign-in.
- All authentication, requests, messaging, scheduling, file storage, test payments, delivery, feedback, and audit behavior. Keep existing browser storage keys.
- Clear task labels, accurate demo status, focus states, dialog keyboard handling, reduced motion, and mobile access to account status and documents.

## Cleanup decisions

- Remove decorative card stripes, floating sparkles, login orbit effects, avatar stacks, repeated slogan eyebrows, and unsupported registered-trademark marks.
- Use text hierarchy and spacing to distinguish headings, controls, and metadata. Keep functional text readable; secondary text uses `#69657B` and metadata is at least 11 px.
- Keep statuses factual. Demo mode says local demo workspace, payments say simulated, and static lists do not claim to be live.
- Replace vague labels with the service task. Make the service-queue footer a real link and remove the nonfunctional company-switch chevron.
- Preserve category colors and labeled payment/delivery states. Darken text and active controls where contrast is insufficient.
- On narrow screens, use the existing navigation drawer and two-column metric grid. Stack page actions where needed and scroll tables inside their containers. Account information and upcoming appointments stay available.
- Use the Nexus VA product name and a simple N monogram. The previous Instagram branding is preserved in the rebrand version rather than displayed in this restored design.

## Verification

Inspect sign-in, overview, requests, appointments, chat, billing, files, profile, admin logs, and dialogs in the browser. Check widths 320, 390, 768, 1024, and 1440 px for overflow and clipping. Exercise the full client → assistant → admin journey and run the existing test suite and production build.

## Preserved versions

- Original Prototype 1: commit `529c303`, tag `prototype-1`, and `backups/nexus-va-prototype-1-original.zip`.
- Previous rebrand: commit `ce0326a` and `backups/nexus-va-rebrand.zip`.
- Accepted design history: branch `codex/original-design-cleanup`; ongoing work uses `develop`, and tested releases use `main`.
- ZIP archives contain source and configuration templates, without credentials or browser-local uploads.
