# Revision 1.3.4.9

November 15, 2026. Local additive revision of 1.3.4.8, port 5189.

Removed only three elements from the shared header in src/App.tsx: the Workspace label, separator chevron and current-page breadcrumb label. The existing wrapper is retained to preserve header alignment and the mobile navigation toggle. Actual page headings and sidebar navigation remain. No styling, state, handlers, permissions, notification code, integration or migration behavior changed.

Runtime version labels, launcher port and release documentation identify the new revision. Prior versions remain unchanged. Existing demo limitations and the connected-backend migration instructions from 1.3.4.8 still apply; no deployment or external database update was performed.
