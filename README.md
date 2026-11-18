# NexusVA - Test Version 1.3.5

Admin-controlled requests, signed agreements, service pricing, payments, subscriptions and VA assignment, integrated into the existing dashboards, Requests, Work board, Billing and private conversations. Based on Seperoth/main at `d9a552b` (1.3.4.9). Previous copies and histories are preserved.

## Run locally

Requires Node.js 22.18+ and npm.

```sh
npm ci
npm run start:local
```

Open **http://127.0.0.1:5190/**, or double-click **Open Nexus VA.cmd** on Windows after installing dependencies. Version 1.3.4.9 can remain available on port 5189.

Without Supabase configuration, choose a demo Client, VA or Admin account; switch roles from Account. Demo data/PDFs stay in this browser. Demo role switching and local storage are not a security boundary. Use sample information.

## Request to payment

1. Client submits a request and estimated budget. Only Admin receives it; no invoice, VA assignment or conversation is created yet.
2. Admin opens it, selects **Start Admin review** and uploads the agreement PDF (up to 10 MB).
3. Client views/downloads the PDF, signs it outside the app, acknowledges the signed copy and uploads it. No signature/approval is inferred. The integrated viewer supports page navigation and accessible page text.
4. Admin reviews the returned file, requests corrections if needed and explicitly approves it. File revisions and workflow events are retained.
5. Admin sets the final price, one-time/subscription arrangement, frequency and configured payment instructions. The agreed price is locked and one invoice is created. Client reviews the terms before submitting a payment reference.
6. Payment stays **Awaiting confirmation** until Admin independently checks the payment account and records a transaction reference. Client confirmation cannot mark it paid. A receipt becomes downloadable after confirmation.
7. Admin assigns an active VA only after agreement approval and confirmed, current payment. Assignment creates the private request conversation. The VA sees the task, deadline, agreements, payment status, files and work details on Work board. Client delivery review/rating completes the service.

Progress includes submission, Admin review, agreement sent/signature/review/corrections/approval, payment, assignment, work, delivery review and completion. Operational work status and subscription billing status remain separate.

## Subscriptions and payment results

Subscriptions display amount, frequency, next billing and paid-through date. They use recurring invoices with the configured method. This release does **not** store cards, collect charges or automatically debit renewals. After a period ends, Admin can issue one renewal invoice. A new paid period begins only on confirmed payment. Month ends are clamped in UTC.

The client's **Unsubscribe** control explains the end date, asks for confirmation, cancels pending renewals and retains access until the paid period ends. It remains available in request details and Billing after task completion. An authorized current-period refund ends subscription entitlement. No renewal invoice can be issued after cancellation.

Failed/cancelled invoices can be retried without creating another invoice. Submitted, failed, cancelled, refunded and paid outcomes remain separate. Admin records external refunds; the app does not execute them. Unique transaction references, serialized changes, one outstanding invoice and locked pricing guard duplicate records. Legacy paid estimates do not satisfy a new billing arrangement.

## Existing services and privacy

Earlier records remain history; no agreement or payment is manufactured. Admin can explicitly begin agreement review for an unfinished existing service while retaining its VA/conversation. Unpaid estimates are cancelled when replaced; paid history is preserved and scoped separately. Delivery is gated once the new workflow begins. Reassignment is blocked to protect the earlier private conversation.

Only the client, Admin and assigned VA can access a request's agreements/billing. Other VAs cannot browse unassigned requests. Admin oversees every request/agreement/invoice/subscription/assignment, while conversation contents, ordinary private files and historical calendars retain case-review controls. Connected mode enforces these rules through the RPC and row/storage policies.

## Connected setup

Apply only unapplied migrations in order, including **supabase/migrations/202611180001_request_agreement_billing.sql**, after the four earlier migrations listed in [the previous README](docs/README-1.3.4.9.md). Follow [environment setup](docs/WORKFLOW.md). Deploy the matching frontend/migration together. No live migration, Supabase project, gateway, email or production deployment was configured by this change.

The supported path is a configured external payment method plus authorized Admin confirmation. Automatic gateway collection requires a separate server-side integration with signed provider webhooks and provider idempotency. The optional payment-email function distinguishes legacy simulated records from Admin-confirmed receipts; delivery requires its existing configuration.

## Validation

`npm run check` passes **120 tests across 9 files**, TypeScript and the development build. Coverage includes the complete migration chain in local PostgreSQL/PGlite, RLS/storage access, correction/resubmission, assignment gates, duplicate references, retry/refund, subscription expiry/cancellation/renewal and legacy transitions. Browser checks covered all three roles, PDF rendering/download, receipts, Work board, conversation and mobile navigation. The main bundle retains a nonfatal size advisory; PDF viewer/worker load on demand.

See [revision notes](REVISION-1.3.5.md), [validation details](VALIDATION-1.3.5.md) and [the previous release](docs/README-1.3.4.9.md).
