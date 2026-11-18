# Validation - NexusVA 1.3.5

Completed November 19, 2026 (Asia/Manila).

## Automated

`npm run check`: **120 tests / 9 files pass**; TypeScript and development build pass.

Coverage retains reporting, scheduling, privacy/case review, notification and attendance regressions, and adds:

- Requests notify only Admin without creating invoices/assignments.
- Review, stored PDF metadata, explicit signed return, correction/resubmission and approval order.
- Rejection of client/VA approval, pricing, paid confirmation, old pay/accept commands and direct database writes.
- Assignment requires approved/current paid service; older billing history cannot bypass the gate.
- Duplicate confirmations, price setup/invoices and transaction references fail atomically.
- Failure/cancellation, invoice retry, refund and receipt provenance.
- Subscription start/expiry, month/leap-day dates, single renewals, prepayment cancellation and paid-through access.
- Legacy VA/conversation retention without inventing signatures or payment.
- Complete migration chain in local PGlite/PostgreSQL, VA visibility restrictions, agreement/file/storage RLS and existing conversation-review controls.

The build retains a nonfatal main-bundle advisory (about 537 KB minified). PDF.js loads as a separate on-demand chunk/worker.

## Browser

Local demo at http://127.0.0.1:5190/:

1. Client submitted monthly support. Admin received it without an invoice or VA assignment.
2. Admin uploaded a valid fixture PDF. Client viewed it, acknowledged a sample signed copy and uploaded it; Admin explicitly approved it.
3. Admin set USD 250/month and sample instructions. Client submitted DEMO-250. Payment stayed awaiting confirmation; assignment stayed disabled.
4. Admin recorded an independent demo reference. Receipt and paid-through/next-billing dates appeared, without automatic assignment.
5. Admin assigned Maya. Her board showed the request, agreement, paid status and deadline. She started work and opened the created private conversation.
6. Client confirmed Unsubscribe. Future renewals stopped; paid access remained through December 18. Downloaded the signed PDF and receipt.
7. Inspected 390 x 844 mobile and 1440 x 1000 desktop layouts; navigation worked and page width matched the viewport. The integrated viewer rendered the fixture page and accessible text.

Evidence: [desktop agreement](docs/ui-review/v135-desktop-agreement.jpg), [mobile subscription](docs/ui-review/v135-mobile-subscription.jpg), [desktop billing](docs/ui-review/v135-desktop-billing.jpg).

## Limits

No live migration, provider/webhook, email delivery, deployment, real payment or cryptographic signature certification was exercised. Browser data on port 5189 was not migrated/reset. Connected methods require accurate Admin instructions and independent verification. Renewals use explicit invoices, without a background charging scheduler. This was not a full device/accessibility audit.
