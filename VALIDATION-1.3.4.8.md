# Validation - 1.3.4.8

November 15, 2026. Windows, local development/demo mode.

## Automated checks

- Final `npm run check`: 101 tests passed across 8 files, TypeScript passed, Vite development build passed.
- Existing workflow, reporting, attendance, ownership and privacy suites passed alongside the added notification tests.
- Notification tests cover exact destinations despite renamed titles; payment navigation without payment execution; participant/file access; unavailable, reassigned and malformed targets; safe legacy matching; ambiguous fallback; sorting/deduplication; own-record mutation; invalid values; persisted read/unread/dismiss/restore; bulk snapshots; and workflow-generated message/appointment IDs.
- Database tests execute the full migration chain in PGlite. They cover ownership, own read/unread/dismiss/restore, idempotence, direct-write and private-RPC rejection, bulk snapshots, actual request/message/payment IDs, distinct same-title appointments, ignored client target data and transaction context restoration. Existing privacy and business commands pass through the new wrapper.
- Nonfatal build warning: the main minified JavaScript chunk is approximately 507 KB, above Vite's 500 KB advisory threshold. No unrelated bundling changes were made.

## Browser checks

- Client: notification text opened the actual NX-1042 request drawer with existing delivery, files and payment-tracking controls. No business action was executed by opening it.
- Per-item read/unread changed immediately along with the bell and Messages counts. Dismiss removed the active notification; Dismissed showed it; Restore returned it with its original unread state. Mark all read persisted after reloading. The final post-change browser check repeated read/unread successfully.
- Enter activated a notification status button. Escape closed the panel and focused the bell. Existing light and dark themes were visually reviewed.
- Responsive checks used widths 320, 375, 768 and the normal 1280 desktop viewport. Document width matched the tested 320/375/768 viewports; the panel stayed within them. Mobile item actions measured 44 pixels high. The temporary viewport override was reset.
- Isolated QA used http://localhost:5188/, separate from the main http://127.0.0.1:5188/ origin. A genuine local-demo message from Maya on NX-1041 appeared automatically in Alex's already-open notification panel, increasing its unread count from 2 to 3 without a reload. Selecting the new notification opened NX-1041 and displayed the exact QA message. No external recipient or integration was contacted.
- VA: the existing available-request notice opened the Available requests filter. Admin: the empty state and disabled bulk action appeared, and Client/VA notifications were absent. Earlier Admin-only attendance controls and VA read-only status remained visible in their appropriate roles.
- Captured console warning/error logs were empty in the main, Client QA, VA QA and Admin QA tabs. Temporary QA tabs were closed; the main .8 preview remains available.

## Evidence and limits

Screenshots next to the project: `nexusva-1.3.4.8-notifications-desktop.jpg`, `nexusva-1.3.4.8-notifications-light.jpg`, `nexusva-1.3.4.8-notifications-mobile.jpg`, and `nexusva-1.3.4.8-live-conversation-qa.jpg`.

Save-failure rollback/retry and overlapping-refresh guards were code-reviewed; a storage/network failure was not injected in the browser. Invalid commands and denied ownership were exercised by automated tests. Live Supabase connectivity/polling, migration deployment, external messaging/payment integrations and a full accessibility/device audit were not performed. Production build configuration still requires the existing real environment settings; the verified build is development mode.

Original base hashes and clean Git status matched. Earlier preserved file manifests matched: 1.3.4.1: 78, 1.3.4.2: 85, 1.3.4.3: 87, 1.3.4.4: 90, 1.3.4.5: 95, 1.3.4.6: 201, 1.3.4.7: 204, 1.3.4: 65. Runtime build, logs and dependency folders are excluded from preservation manifests. The source ZIP excludes runtime output, dependencies, Git metadata and non-example environment files.
