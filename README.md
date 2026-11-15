# NexusVA Test Version 1.3.4.9 - Header breadcrumb removal

Open **Open Nexus VA.cmd**, then visit **http://127.0.0.1:5189/**.

Removed the shared header's `Workspace > current page` breadcrumb shown in the supplied screenshot. The mobile navigation button, header controls, existing header height/spacing, page headings and all workflows are retained. No CSS, business logic, notification handlers, integrations or database migrations changed in this revision. Original 1.3.4 and revisions 1-8 are preserved.

Local source uses the existing dependency junction to 1.3.4.1. After extracting the portable source ZIP elsewhere, use Node.js 22.18 or later and `npm ci` before opening the launcher. See REVISION-1.3.4.9.md and VALIDATION-1.3.4.9.md.

## Earlier release notes retained below

# NexusVA Test Version 1.3.4.8 - Interactive notifications

Open **Open Nexus VA.cmd**, then visit **http://127.0.0.1:5188/**. This is a separate local revision of 1.3.4.7. Original 1.3.4 and all earlier test copies are preserved.

Notifications open their actual request, conversation, appointment, payment details or accessible file view. Individual read/unread changes, Mark all read, Dismiss and Restore persist through the existing data layer. Status and badges update immediately. The existing Nexus appearance and workflows are retained.

See REVISION-1.3.4.8.md and VALIDATION-1.3.4.8.md for details. Local changes arrive through the existing browser events; connected Supabase mode retains its existing 15-second polling. The new migration `supabase/migrations/202611150001_notification_actions.sql` must be applied after the earlier migrations before using the new actions with a connected backend. It was tested locally and has not been applied to any external database.

The local copy reuses 1.3.4.1 dependencies through a directory junction. For the portable source ZIP, install Node.js 22.18 or later, run `npm ci`, then open the launcher. `npm run check` runs tests, TypeScript and the development build. Production configuration checks remain enabled.

The existing demo boundaries remain: sample workspace data, simulated payments and browser-local attendance. No GitHub upload, push or deployment was performed.

## Earlier release notes retained below

# NexusVA Test Version 1.3.4.7 - Role dashboards and Admin attendance verification

Open **Open Nexus VA.cmd**, then visit **http://127.0.0.1:5187/** and choose Client, Virtual assistant or Admin. This is a new local revision carrying forward the existing 1.3.4.6 UX refinements. Original 1.3.4 and every earlier test copy are preserved.

Client and VA dashboards use compact date filters without Compare, honest date-based summaries and current work panels that remain visible across historical ranges. VA attendance status is read-only; only Admin can create/review corrections, verify time entries and change tracking rules. The VA retains clock-in, break, resume, clock-out and work-summary controls. The VA dashboard has no Reply needed or Conversations panel.

See REVISION-1.3.4.7.md and VALIDATION-1.3.4.7.md. The local folder reuses dependencies from 1.3.4.1 via a directory junction. A portable source ZIP is supplied without dependencies: after extraction, install Node.js 22.18 or later and run `npm ci`, then open the launcher. `npm run check` runs tests, type checking and the development build.

Attendance remains a browser-local demo; production server enforcement and payroll-grade records are not implemented. Payments are simulated. No upload, push or deployment was performed.

## Earlier release notes retained below

# NexusVA Test Version 1.3.4.6 - UI/UX refinement

Open **Open Nexus VA.cmd**, then visit **http://127.0.0.1:5186/**. This separate local revision refines Client, Virtual assistant and Admin layouts, uses a dedicated request page and contextual drawers, preserves focused confirmation modals, and adds temporary feedback with persistent inline errors.

See [revision notes](REVISION-1.3.4.6.md) and [validation results](VALIDATION-1.3.4.6.md). Earlier copies remain intact. This folder currently reuses the installed dependencies from 1.3.4.5 through a local directory junction. For an independent setup, install Node.js 22.18 or later and run `npm ci` in a copied source folder without that junction.

This is a browser-local demo with simulated payments. Connected privacy-case workflows require a configured backend. No upload or push is included.

## Earlier release history

# Earlier test version: 1.3.4.4 — Neumorphism

Separate local copy with soft raised surfaces, recessed fields, purple action controls, and matching light/dark modes across Admin, VA and Client workspaces. Includes the compact owner dashboard from 1.3.4.3 and working date reports from 1.3.4.2. The original 1.3.4 and revisions 1.3.4.1–1.3.4.3 are preserved.

Open **Open Nexus VA.cmd**, then visit **http://127.0.0.1:5184/** and choose a demo workspace. If extracting the source archive elsewhere, install Node.js 22.18 or later and run `npm ci` in this folder first. The current local folder reuses the installed dependencies from 1.3.4.1 through a directory junction; that junction is excluded from the portable source archive.

See REVISION-1.3.4.4.md for the design changes and VALIDATION-1.3.4.4.md for checks and limits. This remains a browser-local prototype with sample records and simulated payments. The styling does not add server authentication, production attendance verification, or external integrations.

## Earlier revision notes (history)

# Current additive revision: 1.3.4.2

Working owner dashboard with inclusive date filters, dated breakdowns, comparisons and CSV export. Open http://127.0.0.1:5182/ and choose Admin workspace. See REVISION-1.3.4.2.md and VALIDATION-1.3.4.2.md for date definitions, setup and verification. Older revision notes below are retained as history.

# Nexus VA — Prototype 1

## NexusVA Test Version 1.3.4.1 — November 14, 2026

This independent local revision preserves the 1.3.4 base and adds Canopy-inspired work management and task-linked VA time tracking. Start with **Open Nexus VA.cmd** and visit **http://127.0.0.1:5181/**. Version 1.3.4 remains unchanged at its original location and port.

Admin's **Operations watch** automatically summarizes attendance, pending time reviews, overdue requests, and unassigned work. **Time & attendance** includes an assistant roster, automatic time entries, search and review filters, CSV export, review reasons, and approval locking. Assistants can clock in on assigned work, take breaks, resume, and clock out; the tracker also pauses on idle/connection gaps and closes at the planned end. Outside work is flagged for explanation and a separately approved correction. The work board, admin client directory, and client request templates are additive pages.

See [the revision record](REVISION-1.3.4.1.md), [timer research and production plan](docs/TIME-TRACKING-RESEARCH-1.3.4.1.md), and [validation record](VALIDATION-1.3.4.1.md). Tracking is a **local browser prototype**, using sample data, local clock timestamps, and simulated payment records. It cannot observe activity in other apps or prove productivity. No server attendance integration or deployment is included.

The sections below preserve the base version's historical release notes. Their older ports and version labels describe those earlier copies.

## NexusVA Test Version 1.3.4 — November 5, 2026

### Appearance update — November 6, 2026

The local 1.3.4 copy now has a Light Mode / Dark Mode switch in the workspace header, privacy workspace, sign-in page, and Privacy & Review Notice. The first visit follows the device color scheme; choosing a mode saves that preference in this browser. The Nexus palette is shared through semantic appearance tokens in `public/appearance-tokens.css`, including dashboard panels, requests, forms, messages, modals, and the participant calendar. This is a presentation preference only; it does not alter permissions or workspace data.

This local copy starts from the clean Version 1.3.3 commit in `C:\Users\JD\Downloads\NexusVA Test Version 1.3.4`. Its branch is `private-oversight-v1.3.4`, with **no Git remote**. Open it with **Open Nexus VA.cmd** or `npm run start:local`, then visit [http://127.0.0.1:5180/](http://127.0.0.1:5180/). Version 1.3.3 remains at port 5179 for comparison. Nothing in this copy has been pushed to GitHub.

### What changed

- Admin navigation now has **Conversation Review**, **Schedule History**, and **Administrative Audit Logs**. Direct Admin Messages and Appointments pages and request attachment controls were removed. Client and VA conversation and calendar workflows remain available.
- Connected Supabase mode adds roles and explicit permissions for Support Reviewer, Privacy Officer, and Super Admin. Case review requires a documented purpose, independently approved range, assigned reviewer, expiry, and server-side authorization. Attachments require a separate grant and a 60-second signed link. Historical schedule access excludes future slots by server time. Review and permission actions are recorded in a protected administrative audit table.
- Clients and VAs can file a conversation problem report in connected mode. A reviewer is assigned by the server from active, permitted reviewers. The browser demo explains why secure review is unavailable without a backend.
- The calendar uses the attached reference's dark, compact calendar-plus-agenda structure in Nexus purple. Month, week, and day views and appointment creation remain connected to the existing data. Appointment detail supports editing the agenda and notes, rescheduling, marking a past appointment as a no-show, and cancellation.
- [Privacy notice](/privacy-notice.html) is available from sign-in and workspace navigation. The [agreement draft](docs/PRIVACY-AND-REVIEW-AGREEMENT-DRAFT.md) and [Privacy Impact Assessment working record](docs/PRIVACY-IMPACT-ASSESSMENT.md) identify approvals and unresolved decisions. They are not approved legal documents.

### Connected-mode setup

Apply `supabase/migrations/202611050001_privacy_roles.sql` and then `supabase/migrations/202611050002_private_review.sql` **after** the original workspace migration. Do not reset the database. Deploy `supabase/functions/review-attachment` with JWT verification enabled. The service role key belongs only in the function's server environment. A trusted database operator must verify identity and bootstrap the first Super Admin; the migration does not promote anyone automatically. That Super Admin then grants case permissions to selected Support Reviewers and Privacy Officers. See the PIA working record before using real data.

For the initial bootstrap, a trusted operator can run the following in the Supabase SQL editor **after verifying the intended Auth user ID**; replace the example value and do not use this as a client-side action:

```sql
update public.profiles set role = 'super_admin'
where id = 'VERIFIED_SUPER_ADMIN_AUTH_USER_UUID';
```

**Security boundary:** The `demo` mode keeps a complete sample workspace in browser storage, so it cannot protect real private data. Use sample data only. The SQL tests exercise PostgreSQL permissions locally; this copy has **not** been deployed or validated against a live Supabase service. Direct database/API denials are enforced but require platform logging if every rejected probe must be audited. Legal compliance is not claimed.

## NexusVA Test Version 1.3.3 — November 5, 2026

This independent local copy starts from Version 1.3.2 in `C:\Users\JD\Downloads\NexusVA Test Version 1.3.3`. It is on the local `dashboard-ux-v1.3.3` branch with no Git remote. Start it with **Open Nexus VA.cmd** and open [http://127.0.0.1:5179/](http://127.0.0.1:5179/). Version 1.3.2 remains available at [http://127.0.0.1:5178/](http://127.0.0.1:5178/) for comparison.

### Dashboard usability changes

- Grouped sidebar pages into role-appropriate work, coordination, and account or management sections. All existing destinations, role restrictions, and the mobile drawer remain available.
- Kept one role-specific priority action at the center of each dashboard, with quieter summary metrics and less card decoration.
- Made the Admin request-intake bars keyboard-accessible controls. Selecting a bar shows its actual count and opens the Requests page filtered to that date interval. The chart's 7, 30, and 90-day periods still use stored request dates.
- Added a visible request count, one-click reset for search and filters, and Admin-only selection with a CSV summary of selected, currently visible requests. The export contains only the requests already available in that workspace.
- Added readable table sort state and keyboard access to clickable rows. Clicking a table button or checkbox no longer accidentally opens the row.

The application logic, authentication, permissions, payment simulation, and Version 1.3.2 scrolling architecture were retained. This is a local prototype; connected Supabase behavior was not validated in this copy.

**Local validation:** `npm run check` passed 38 tests, TypeScript checking, and the development build. The Client, Assistant, and Admin dashboards were checked at effective CSS widths of 320, 375, 768, and 1440px with no page-level horizontal overflow and a sticky header; Admin was also checked at 1024 and 1920px. The mobile drawer opened and closed with its close control visible. Admin chart selection opened the matching date-filtered Requests view; request search, reset, sorting, selection, CSV download, and the request dialog worked. The browser reported no console errors. These checks used the local demo workspace, not a connected Supabase service.

## NexusVA Test Version 1.3.2 — November 5, 2026

This is a separate local copy of Version 1.3.1 in `C:\Users\JD\Downloads\NexusVA Test Version 1.3.2`. Its branch is `dashboard-scroll-fix-v1.3.2`; it has no Git remote and has not been uploaded. Start it with **Open Nexus VA.cmd** or `npm run start:local`, then open [http://127.0.0.1:5178/](http://127.0.0.1:5178/). Version 1.3.1 remains at [http://127.0.0.1:5177/](http://127.0.0.1:5177/) for comparison.

### Scrollbar and sticky-header fix

In Version 1.3.1, the browser page scrolled the dashboard while the fixed sidebar could scroll separately on shorter screens. The desktop header was positioned normally and moved off-screen with the page. Version 1.3.2 confines page scrolling to the workspace panel and keeps the header sticky inside it. The sidebar now scrolls only its navigation region when the viewport is too short; the Nexus logo and mobile close button stay in the stationary sidebar header. Opening the mobile drawer temporarily pauses the workspace scroll and closing it restores the previous position. Navigation resets the workspace scroll to the top, and dialogs temporarily lock that same scroll region.

The initial scroll fix is limited to the shell structure and scoped styles in `src/App.tsx`, `src/components.tsx`, and `src/command-center.css`. Request cards, charts, forms, tables, role views, and the Version 1.3.1 visual design remain in place.

**Local validation:** All 38 existing tests, TypeScript checks, and the development build pass. Browser checks covered the Admin dashboard at 1440 × 900, 1100 × 700, 768 × 850, 375 × 760, and 320 × 700. At every width, the document stayed stationary, the workspace scrolled, the header remained visible, and there was no horizontal overflow. At 1100 × 700 and 320 × 700, the sidebar navigation scrolled without moving its logo or close button. Mobile drawer open/close, Requests navigation, request dialog scrolling, and access to the dashboard footer were checked. Notifications, account menu, and search worked while the dashboard was scrolled; the browser reported no errors. Client and Assistant demo dashboards also kept the document stationary with no horizontal overflow. The connected Supabase workspace was not exercised.

### Responsive system update

All existing Admin pages were inspected across phone, landscape, tablet, laptop, and large-screen widths. Files now uses readable mobile cards with the same review and download actions as its desktop table. Requests filters wrap at narrow widths, and request, billing, activity, and file tables switch to their compact card layouts before table actions become clipped. On mobile and tablet, Messages uses a conversation selector and one workspace scroll area; the composer stays accessible in portrait and follows the page normally in short landscape viewports. Dialog headers and form actions remain visible while long forms scroll. Short desktop viewports use a compact sidebar so its extra scrollbar appears only when navigation truly exceeds the available height.

The browser audit covered Admin pages at 320, 375, 667, 720, 768, 823, 900, 960, 1024, 1152, 1280, 1309, 1440, 1600, 1800, 1920, 2149, and 2880 CSS pixels. The 720–2880 widths represent the effective layout widths of a 1440px window at the requested 200%–50% browser zoom levels. The headless browser does not change its actual zoom through keyboard shortcuts, so these are layout-equivalent checks, not direct browser-zoom measurements. Client and Assistant pages were also checked at 320, 375, 667 × 375 landscape, 768, 960, 1024, and 1440px. Request and form dialogs were checked for scrolling, close and save access, and scroll restoration; the sign-in screen was checked from 320 to 2880px. These checks found no page-level horizontal overflow or clipped controls. The desktop chat history remains an intentional internal scroll area so the message composer stays in place.

### Zoomed-out background fix

At low browser zoom, the 1600px content limit exposed the workspace's pale background on both sides of the dark dashboard. The workspace now owns the full-width background, while the content stays centered and grows modestly on very wide effective viewports. Detail pages keep the light Nexus atmosphere across their full workspace width. The Client, Assistant, and Admin dashboards were checked at an effective 3193px width (matching the supplied zoomed-out view), plus 320, 768, 1440, 1920, and 3840px. There was no page-level horizontal overflow, and switching to Requests restored the light background.

### Version 1.3.1 baseline

Version 1.3.1 is an **independent local copy** of Version 1.3 in `C:\Users\JD\Downloads\NexusVA Test Version 1.3.1`. Its local branch is `dashboard-futuristic-v1.3.1`; it has no Git remote and has not been uploaded. Version 1.3 remains available at `http://127.0.0.1:5176/`. Open Version 1.3.1 at [http://127.0.0.1:5177/](http://127.0.0.1:5177/).

The [Orbital Systems dashboard reference](https://dribbble.com/shots/27639068-Orbital-Systems-Dashboard-Satellite-Fleet-Command-for-Space-X) informed the dark command-center composition. This copy uses the existing Nexus wordmark, restrained violet/lavender panels, the six original service illustrations from Version 1.3, and real workspace request data. It does not copy the reference's branding, satellite imagery, or content.

- **Client:** The new **Assistants** page searches active assistant profiles and filters by service and availability. Profile details show existing skills, bio, and ratings from _that client's own completed requests_ only. **Book a call** opens the existing appointment form with the selected assistant; request creation and all prior client workflows remain available.
- **Virtual assistant:** The assigned-work dashboard, available-request flow, conversations, upload, delivery, and profile settings are retained. The assistant directory is not shown to this role.
- **Admin:** Overdue requests take priority in the lead panel. The attention list includes other overdue work, unassigned requests, and outstanding payment records, with links to the existing request or Billing workflow. Request intake can be viewed for the last 7, 30, or 90 days. Its bars use actual request creation dates; payment counts use stored test payment dates. Request status and assistant workload charts still open the corresponding Requests filters.
- **Layout:** Dark command-center styling is scoped to navigation and the three dashboards. Detailed pages keep their proven light data-entry surfaces. The existing category illustrations remain attached to actual service categories, and mobile request cards remain accessible at narrow widths.

**Current scope:** Version 1.3 has direct assignment, private messaging after assignment, simulated payments, delivery, approval, and feedback. It has no applicant, agreement, revision, dispute, payout, or external payment-provider records. This copy does not present those absent flows as working. Payment labels and analytics explicitly describe simulated records. Connected Supabase permissions and provider behavior require separate live verification before deployment.

**Local validation:** All 38 existing tests, TypeScript checks, and the development build pass. Browser checks covered the three role dashboards, the client assistant directory and booking path, admin period filter and attention links, VA notification routing, mobile navigation and request cards, scrolling to the dashboard footer, and page overflow at 320, 375, 768, 1100, and 1440 px. A fresh browser session reported zero console errors. The connected Supabase workspace was not exercised.

### Version 1.3 baseline

Version 1.3 was extracted from the Version 1 comparison ZIP and published on the [`dashboard-visual-v1.3` branch](https://github.com/Seperoth/nexus-va-prototype-1/tree/dashboard-visual-v1.3). Open it at `http://127.0.0.1:5176/` to compare it with Version 1 at port 5174 and Test Version 1.2 at port 5175. The supplied Daylier screenshot informed its compact card and side-panel composition; its content and colors were not copied. The GitHub `main` branch remains unchanged.

- The dashboard's lead request and two additional role-visible requests now use original, category-specific SVG illustrations in `public/service-visuals/`. The illustrations are presentation assets; uploaded files and deliverables are unchanged.
- The lead request, summary metrics, upcoming appointments, activity, and admin request pipeline form a denser dashboard grid. On narrow screens, the supporting request cards become compact rows while the lead action remains prominent.
- Card actions open the existing request and simulated payment dialogs. Appointments, charts, request filters, role views, and all other pages keep their existing workflows. Counts and chart lengths continue to use workspace records.
- This is a visual test copy. Connected backend permissions should be validated separately against the configured service before deployment.

Verified locally: all 38 tests, TypeScript checking, and the development build passed. Browser review covered client, assistant, and admin dashboards; 320, 375, 768, and 1440 px layouts; scrolling to the footer; request and simulated payment dialogs; mobile navigation; admin chart filtering; request search; image loading; and zero console errors. The existing connected Supabase backend was not exercised in this demo review.

A local, working prototype for clients, virtual assistants, and administrators. The initial workspace followed the supplied [Nexus VA Figma reference](https://www.figma.com/design/ipg60TMOg3sqIVzvNRwpp3/Nexus-VA-%E2%80%94-Workspace-Redesign?node-id=0-1); the redesign on this branch uses the Nexus branding and dashboard reference described below. [Canopy](https://www.getcanopy.com/) informed the connected service workflow. Payments are **always simulated**.

Current version: **0.2.0**. Daily work happens on **`develop`**; **`main`** holds tested releases. Read the [change log](CHANGELOG.md) for updates and the [short development/release guide](docs/WORKFLOW.md) for environment setup and release commands. The original Prototype 1 release remains preserved.

## Local dashboard comparison copy — November 4, 2026

The Version 1 baseline was a separate local test copy of the Nexus dashboard. It runs on `http://127.0.0.1:5174/` and its Git branch is `dashboard-role-layout-test-2026-11-04`.

- **Client:** The dashboard labels its own request list clearly while retaining the featured delivery or payment action, the remaining response list, appointments, and assigned assistants.
- **Virtual assistant:** The overview request list is ordered by due date, excludes completed assignments, and shows the client on mobile request cards. The next actionable assignment remains the featured item.
- **Admin:** The featured assignment is followed by other assignment and payment items needing a response. A request status bar chart opens the corresponding filtered Requests view. Assistant workload bars use current assigned request counts and open an assistant-filtered Requests view. The redundant admin completion legend is removed.
- **Scope:** Counts and bar lengths come from the existing role-scoped workspace records. Client and assistant views retain their existing data access. Forms, payments, delivery, and request workflows are unchanged.

## Nexus branded redesign — November 4, 2026

This branch redesigns the **0.2.0** interface using the supplied Nexus Virtual Executives logos and the [Building Management System UI](https://dribbble.com/shots/25877529-Building-Management-System-UI) as layout inspiration. The reference's navigation, central work area, and insights panel were adapted to service requests and team operations. Its building imagery and color palette were not copied.

- **Branding:** The supplied logos appear on sign-in and workspace navigation. The original images and transparent display versions are in `public/`; the Nexus mark is also the browser icon. The current interface uses the purple and lavender palette from the supplied Nexus brand post.
- **Workspace layout:** A single dark sidebar replaces the previous rail plus white sidebar. The overview leads with one role-specific request or task, followed by four relevant metrics, request activity, and appointments. Assistant context, recent updates, and request progress share a dark side column.
- **Responsive design:** The sidebar becomes a slide-out menu on small screens. Request cards keep the name, status, due date, budget, and action visible through tablet width; wider screens retain the sortable table.
- **Existing workflows:** Client, virtual assistant, and admin navigation remains available, along with requests, appointments, messages, test billing, files, delivery, feedback, settings, and activity logs. The overview uses existing workspace data for its counts, assistant workload, and completion bar.

The visual changes are in `src/redesign.css`, `src/App.tsx`, `src/Auth.tsx`, and `index.html`. The stylesheet loads after the existing styles, so the underlying forms, tables, and workflow logic remain in place. The earlier design cleanup is documented in [DESIGN.md](DESIGN.md).

Checked on November 4, 2026: `npm run check` passed **38 tests**, TypeScript checking, and the development build. The local browser check covered client, assistant, and admin views, request form opening, mobile navigation at 320 px, and zero console errors. These checks do not claim verification of a deployed Supabase instance.

## Dashboard and Requests refinement — November 4, 2026

- The dashboard's **Waiting on you** list now names each delivery needing review and each outstanding test payment, with a due date and a button into the existing request or payment workflow. The count comes from the same request and payment records.
- **All requests** shows the completed count out of the current request total. Its percentage and progress bar are calculated from those records. The activity panel now fits its content, with the chart directly below recent updates.
- Supporting text and table labels are larger and higher contrast. The Requests page, navigation, breadcrumbs, dashboard headings, and row actions use **Requests** and **View request** consistently.
- The shared request table keeps sorting and pagination. At 320, 375, and 768 px it presents request cards; at desktop width it remains a table. The local browser check found no page-level horizontal overflow at those widths. Review and payment buttons opened their existing dialogs, client, assistant, and admin navigation loaded, and the browser console reported zero errors. `npm run check` passed 38 tests, TypeScript checking, and the development build.

The connected Supabase workspace was not exercised in this local demo check.

## Focused design refinement

The earlier dashboard repeated a review action in a large purple feature banner and in **Waiting on you**, then repeated counts in four equal cards, the request list, and the progress panel. That first cleanup removed those repetitions. The later screenshot-guided layout restores one focused lead panel and four current-data metrics, with the featured action excluded from the remaining attention list.

The assistant panel no longer uses fixed specialty descriptions or a decorative discussion note. It shows each assigned assistant's current request count, next due date, and availability from workspace data. Recent updates and request completion share the same context column without another nested card. Pastel briefcase icons, row-order-based activity icons, and the duplicate request-list footer link were removed because they did not identify a useful state or action.

The workspace guide remains available as a navigation item. The Requests page has one search field; searching from another page moves focus into it. On phones, request cards sit directly on the page instead of inside another card. Tablet width uses two request-card columns, while narrow phones use one.

Billing now uses a compact payment summary instead of another row of matching metric cards. The admin activity page groups payment and delivery counts in a matrix, so the four combinations can be compared at a glance. Billing, request oversight, and audit entries retain their desktop tables and switch to readable mobile layouts; the phone payment and activity entries share a flatter list surface while request oversight keeps distinct actionable cards. Mobile payment entries also show the paid date when available. These views keep their sorting, pagination, and existing actions.

Final local review covered client Billing and admin activity at 320, 375, 768, and 1440 px without page overflow. Payment and request actions opened their existing dialogs, mobile sorting updated the list order, and a fresh browser session reported no console errors. `npm run check` passed 38 tests, TypeScript checking, and the development build. Connected Supabase behavior was not exercised in this review.

## Brand-post palette and mobile layout — November 4, 2026

The supplied Nexus brand post informed the purple-to-violet atmosphere. The management-system reference still guides the dashboard's structure. Nexus keeps requests, payments, assistant workload, and delivery status as its content; no poster graphics or unrelated controls were added.

- **Color:** Deep purple `#2D1B61` anchors navigation and the context column. Accessible violet `#5B2AC5` identifies actions, and lavender `#B697F2` marks attention and progress. Pale lavender surfaces and neutral white data panels keep tables and forms readable. Existing error and availability states retain semantic distinction.
- **Gradients:** `--brand-gradient` is shared by the dashboard lead panel and sign-in brand panel. `--brand-atmosphere` creates a restrained lavender transition behind page content. Cards, tables, forms, and the context column stay solid so the gradient has a clear purpose.
- **Type and spacing:** Poppins Light is the body face and Poppins Bold carries headings and key values. Main layout gaps and padding follow an 8 px rhythm, with smaller subdivisions for controls and alignment.
- **Mobile use:** The phone toolbar stays available while scrolling, request details remain in stacked cards, and buttons have comfortable touch targets. Billing and activity records remain compact lists. The conversation header gives the contact, request, and action separate space at 320 px. The sign-in introduction is shorter so the first account choice is visible without scrolling. Desktop tables and existing role workflows remain intact.

## Role-specific dashboard layout — November 4, 2026

The supplied Nexus dashboard photo guides the lead panel, four-metric row, request activity table, and dark context column. The current purple, lavender, and Poppins system remains in place. The lead panel uses a real request or workflow rather than a decorative promotion.

- **Client:** The lead action opens the next delivery to review or outstanding test payment. The remaining attention list excludes that featured item. Metrics show the client's in-progress requests, response count, paid amount, and next call. The assistant column includes only staff assigned to that client's requests.
- **Virtual assistant:** The lead action opens the next assigned request; available unassigned work remains in the Requests workflow. Dashboard counts, the activity table, and completion progress use assigned requests only. The table identifies the client instead of repeating the assistant's own name, and the context column shows the assistant's own availability.
- **Admin:** The lead action opens an unassigned request for assignment, or a pending payment when no request needs assignment. Metrics summarize all requests, unassigned work, delivery, and outstanding payment; the context column shows team capacity and audit updates.

The local review opened the lead request for all three roles, checked the dashboards at 320, 375, 768, and 1440 px without page-level overflow, and found no browser console errors. `npm run check` passed 38 tests, TypeScript checking, and the development build. Connected Supabase permissions were inspected in the migration but not exercised against a live service.

## Preserved versions

The first version is preserved at Git commit `529c303`, release tag `prototype-1`, and local tag `prototype-1-before-rebrand`. Before any design changes, a source ZIP was saved to `backups/nexus-va-prototype-1-original.zip` (ignored by Git). To run the original, extract that ZIP into a separate folder, install dependencies, and start it there. The ZIP contains the committed source and templates, without credentials or browser-local documents. The original [Prototype 1 release](https://github.com/Seperoth/nexus-va-prototype-1/releases/tag/prototype-1) remains unchanged.

The previous Nexus Virtual Executives rebrand is also preserved at commit `ce0326a` and in `backups/nexus-va-rebrand.zip`.

## Run locally

Requires Node.js 22.18+ and npm.

```powershell
npm ci
npm run dev -- --port 5180 --strictPort
```

Open [http://127.0.0.1:5180](http://127.0.0.1:5180). This is **NexusVA Test Version 1.3.4**. This test copy runs locally and is not deployed to Railway. All payments are simulated.

On Windows, double-click **Open Nexus VA.cmd** in the project folder. It starts the local server if needed and opens the prototype in your default browser. You can also use `npm run start:local` to start the server without opening a browser. The background process runs independently of the calling terminal. Run the launcher again after restarting your PC; simply opening the web address cannot start a stopped server. Server logs are in `.local/local-server.log`, and `.local/local-server.pid` records its process ID. `npm run dev` remains available for development in an open terminal. The prototype remains local and needs this PC to be switched on.

Without Supabase environment variables, the sign-in screen offers three clearly labeled demo accounts:

| Workspace         | Account      | What to try                                                                                                                     |
| ----------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Client            | Alex Morgan  | Request work, book appointments, send messages, upload documents, make test payments, approve delivery, and leave a star rating |
| Virtual assistant | Maya Bennett | Accept matching requests, chat, request and verify payment, upload work, and deliver output                                     |
| Admin             | Jordan Lee   | Review all tickets, assign staff, inspect payment/delivery combinations, and read activity logs                                 |

Use **Account menu → Switch demo account** to follow a service through all roles. Sign out returns to the demo sign-in screen. These are browser-local demo sessions, not real authenticated accounts. Demo data is shared between tabs on this browser and origin; files are stored in IndexedDB. Clearing site data resets the demo and removes uploaded files. Use sample documents only.

## Try one complete service

1. Sign in to **Client workspace**. Open **Settings & profile**, update your information, and save. Upload a sample document under **Files & documents**.
2. In **Appointments**, schedule a future appointment. The calendar uses your device’s local timezone and rejects overlaps.
3. Select **New request**. Enter a service category, a detailed description, a positive USD budget, Easy/Medium/Hard difficulty, and a due date.
4. Choose either assignment path:
   - **Automatic:** Pay the initial budget request in **Billing**. An available assistant who enabled automatic assignment and has the matching service and difficulty level is selected, preferring the lightest active workload.
   - **Manual:** Switch to **Virtual assistant**, open the available request, and select **Accept request**. The assistant must be available and have matching skills and difficulty level. Pay the initial request as the client before delivery.
5. Open **Messages**. Both parties can send messages and share files. After the initial request is paid, the assistant can request an additional payment for negotiated scope, and optionally mark that request Verified. Only one outstanding payment is allowed per ticket.
6. As the client, choose **Pay in test mode → Confirm test payment**. Pending or Verified requests can be paid. The record becomes Paid, a confirmation notification appears, and no real money moves.
7. As the assigned assistant, open **Request details**, upload an output file (or choose **Try sample output** for a built-in test document), and select **Deliver output**. All payment requests must be Paid and at least one output must be uploaded.
8. As the client, download the output, choose **Approve & leave feedback**, select 1–5 stars, optionally leave a note, and close the request.
9. Switch to **Admin → Activity logs** to inspect the outcome and audit events. The four summary groups cover Paid/Delivered, Paid/Not delivered, Pending/Delivered, and Pending/Not delivered. Pending in these groups includes Verified, outstanding, or absent payment records. Normal workflow prevents delivery before payment, so Pending/Delivered should ordinarily stay at zero.

The seeded client workspace includes an already delivered social media content pack, active projects, a verified payment, available requests, appointments, and downloadable text documents. Sample deliverables are text examples, not generated images or PDFs.

## Connect a free Supabase project

The Supabase integration is implemented, but no project or credentials are provisioned by this repository. It is separate from demo data: browser demo records are not uploaded automatically.

1. Create or choose a free Supabase project.
2. Run `supabase/migrations/202610270001_workspace.sql` **once in a new project**, then apply `202611050001_privacy_roles.sql` and `202611050002_private_review.sql` in order. Use the Supabase CLI migration flow or the SQL editor without resetting existing data. The migrations install the schema, role types, row-level security, case review, historical schedule access, administrative audit, and private `documents` storage bucket. Deploy the `review-attachment` Edge Function separately with JWT verification enabled.
3. Copy `.env.development.example` to `.env.development.local` and fill in:

   ```dotenv
   VITE_DATA_MODE=supabase
   VITE_SUPABASE_URL=https://YOUR_DEVELOPMENT_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
   ```

   Only a public anon/publishable key belongs in the frontend. Never put a service-role key or Resend key in a `VITE_` variable. Local env files are ignored by Git. Use `.env.production.example` for a separate production project; do not reuse the development database. Shared browser settings in `.env` or `.env.local` are rejected. See [environment setup](docs/WORKFLOW.md#development-and-production-settings).

4. Restart `npm run dev`. The app uses Supabase email/password login and client signup, with session restoration and logout. Configure the local URL in Supabase Auth URL settings; keep email confirmation enabled as appropriate.
5. Register the test accounts using the app or create them in Supabase Auth. New users always receive the **client** role regardless of supplied metadata.
6. In the Supabase SQL editor, use the actual Auth user IDs to designate your test assistant and admin. Example:

   ```sql
   update public.profiles
   set role = 'staff', available = true, "autoAssign" = true,
       "skillLevel" = 'Hard',
       skills = array['Administrative support','Content & marketing','Design & creative',
                      'Customer support','Research & data','Web & technology']
   where id = 'YOUR_ASSISTANT_AUTH_USER_UUID';

   update public.profiles set role = 'admin'
   where id = 'YOUR_ADMIN_AUTH_USER_UUID';
   ```

7. Sign in using each account to follow the service journey. Use different browser profiles for separate simultaneous users. The app refreshes shared Supabase data every 15 seconds and immediately after its own mutations.

Connected mode deliberately has no role-switch menu. Account roles come from the database. Tables expose role-scoped read access through RLS; mutations run through transactional RPCs that derive the actor from `auth.uid()`. Users cannot change roles, mark arbitrary payments Paid, close another client’s work, or upload output as an unrelated assistant. Ticket files are limited to participants and explicitly approved case reviewers; Admin has no direct attachment access. Account-level files remain with their owner. Uploads are capped at 10 MB, and active web/executable extensions are blocked. The existing VA available-request pool remains part of the assignment workflow; it does not grant conversation or calendar access.

## Optional Resend payment emails

In-app confirmation notifications work in both modes. Sending email requires configuration; no email is sent from the local demo.

1. Create a Resend API key and configure a sender. For initial testing, Resend’s default test sender can only send to authorized test recipients; use your verified domain for other recipients.
2. Deploy `supabase/functions/payment-notification` with the Supabase CLI when you are ready to enable email.
3. Set these **Edge Function secrets**, not frontend variables: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `PAYMENT_WEBHOOK_SECRET`, and `APP_URL`. Supabase provides its project URL and service-role key to deployed functions.
4. Configure a database webhook on `public.payments` UPDATE events targeting the function URL. Add the header `x-webhook-secret` equal to `PAYMENT_WEBHOOK_SECRET`. The function uses this secret instead of JWT verification, which is disabled for this function in `supabase/config.toml`.
5. The function ignores unrelated events, verifies the current Paid record in the database, resolves the client from the ticket, and sends a plain-text confirmation. It supplies a payment-specific Resend idempotency key to prevent duplicate email on webhook retries within Resend’s idempotency window. Monitor webhook delivery and function logs for failures; in-app notifications remain available.

## Technology and checks

React + TypeScript + Vite, Lucide icons, FullCalendar (free plugins), TanStack Table, Supabase Auth/Postgres/Storage, and a Supabase Edge Function for Resend.

```powershell
npm run check
npm audit
```

Tests cover the demo state transitions and run the unmodified Supabase migration in embedded PostgreSQL (PGlite), with minimal mock Supabase-owned Auth and Storage schemas. They verify RLS, unauthorized mutations, signup privilege isolation, automatic assignment, payment guards, document visibility, delivery, feedback, audit access, and scheduling conflicts. They do not replace live verification of Supabase Auth emails, Storage service upload behavior, the deployed Resend webhook, or internet hosting.

`npm run check` runs tests, TypeScript, and a development build. `npm run build` creates the production package in `dist/production` and requires production Supabase settings; `npm run build:dev` creates the demo/development package in `dist/development`. Environment tests also check production guards and configuration isolation. GitHub runs these checks automatically without deploying the app.

The application remains local. Source code is published at [nexus-va-prototype-1](https://github.com/Seperoth/nexus-va-prototype-1). Deployment, production payment processing, password reset UI, antivirus scanning, and email deliverability setup are outside Prototype 1.

