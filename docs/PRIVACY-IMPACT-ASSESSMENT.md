# Privacy Impact Assessment working record — Version 1.3.4

**Status:** technical draft. This is not a legal compliance finding. The designated Data Protection Officer or qualified Philippine counsel must review it before deployment.

## Data flows

| Flow                 | Data                                                        | Access and safeguard                                                                                         |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Request conversation | Ticket-linked messages and participant IDs                  | Client and assigned VA through server row policies; Admin excluded from direct reads                         |
| Conversation Review  | Case metadata, approved message range                       | Assigned Support Reviewer or Privacy Officer, independent approval, short expiry, read-only RPC, audit entry |
| Attachment review    | Ticket document and storage object                          | Separate case/document grant; verified identity and server authorization; 60-second signed URL               |
| Working calendar     | Appointment title, notes, participants, future slot         | Client and VA participants only; Admin excluded from direct table access and UI                              |
| Schedule History     | Completed, no-show, canceled, and former rescheduled slots  | Case-scoped server function; original slot end must be past by server time; new future slot omitted          |
| Administrative audit | Actor, action, time, case, approval, reason, scope, outcome | Append-only table; Admin or explicitly permitted Privacy Officer; no message body stored by the app          |

## Role permissions

| Role             | Conversations         | Live calendar           | Case metadata                            | Private case content                                                               | Audit and permissions                                                          |
| ---------------- | --------------------- | ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Client           | Own assigned requests | Own/shared appointments | Own requested cases                      | No reviewer access                                                                 | None                                                                           |
| VA               | Assigned requests     | Own/shared appointments | Own requested cases                      | No reviewer access                                                                 | None                                                                           |
| Admin            | No direct reads       | None                    | Case metadata                            | None unless changed to an authorized reviewer role and granted explicit permission | Audit read; no permission changes                                              |
| Support Reviewer | No direct reads       | None                    | Assigned review or second-approval cases | Approved assigned case only, read-only                                             | Case-linked audit; second approval only when explicitly assigned and permitted |
| Privacy Officer  | No direct reads       | None                    | Authorized cases                         | Approved assigned case only, read-only                                             | Audit and approval with explicit permission                                    |
| Super Admin      | No direct reads       | None                    | No content bypass                        | None                                                                               | Role and permission management; explicit audit permission for audit read       |

## Risks and safeguards

- **Guessed IDs or direct API calls:** PostgreSQL row policies and security-definer functions check identity, role, assignment, case scope, expiry, and server time. Tests cover unauthorized reads and command calls.
- **Excessive review scope:** request and independent approval carry time ranges; the assigned second reviewer or authorized Privacy Officer can narrow or deny the request; expiry is capped at 24 hours. Emergency access lasts 15 minutes and is reviewed afterward.
- **Attachment leakage:** document rows and storage objects deny Admin reads; case download uses a separate grant and short-lived signed URL. A URL issued before case closure may remain valid for up to 60 seconds.
- **Future schedule leakage:** Admin appointment SELECT and availability fields are denied; historical query rejects original slots whose end is in the future. Notifications and general operational audit suppress appointment details for Admin.
- **Historical coverage:** cancellations deleted before the new history migration cannot be reconstructed from the current database. The organization must determine whether a trusted external record exists and whether backfill is appropriate.
- **Browser caching and local demo:** the demo stores a complete sample workspace in browser storage and is **not a security boundary**. Use synthetic data only. The connected browser may temporarily hold authorized data in memory until it is cleared or the page closes. Production cache headers and deployment settings require validation.
- **Audit limits:** the application audit records case RPC decisions and views. Direct database denials are enforced by grants/RLS but are not captured in this app audit; database/API gateway logging must be configured if every denied probe must be retained. Database owners or service credentials must be tightly controlled.

## Decisions required before production

1. Confirm the personal information controller/processor roles, lawful bases, and the organization's privacy contact and rights-request process.
2. Approve a retention schedule for messages, appointments, case records, signed-link access logs, and audit records. **No retention period is invented here.**
3. Define case categories, who may request or approve a case, reviewer training, emergency criteria, and oversight cadence.
4. Decide whether clients and VAs must acknowledge updated agreements or receive a separate notice.
5. Review Philippine Data Privacy Act of 2012 and applicable National Privacy Commission guidance with the Data Protection Officer or qualified counsel. Test a live Supabase project, function deployment, session settings, storage policies, cache headers, backup access, and incident procedures before use with real personal data.
