# Revision 1.3.5 - request, agreement and billing workflow

Created separately November 18, 2026; completed/validated November 19 (Asia/Manila). Base: upstream main `d9a552b`, version 1.3.4.9. Launcher port: 5190. Earlier copies and the 5189 server are preserved.

- Requests enter Admin's queue. VA self-acceptance, automatic assignment and client-side paid confirmation are removed.
- Admin sends a PDF; client signs externally and uploads it. Admin approves or requests corrections. Revisions and approval provenance are retained.
- Approval unlocks final pricing, one-time/subscription terms and configured payment instructions. Only Admin confirms receipt and assigns a VA.
- Integrated PDF.js viewer, restricted downloads, payment history, text receipts, pending/failed/refunded/cancelled results and invoice retries.
- Subscription frequencies, period boundaries, manual renewals, Unsubscribe and paid-through access. Payments link to a specific billing arrangement.
- Existing dashboards, Requests, Work board, Billing, notifications and conversations are reused. Existing services can enter agreement review without replacing their VA/message history.
- Additive migration provides matching transitions, serialized changes, unique references/invoices and row/storage controls. Registered files cannot be removed through failed-upload cleanup.

This release supports external methods plus Admin confirmation. It does not add an automatic charge gateway, cryptographic signature certification, automatic renewal collection or a live deployment. Signature approval is a human review decision. Demo roles/storage remain test facilities.
