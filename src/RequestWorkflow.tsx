import { lazy, Suspense, useEffect, useState } from "react";
import {
  Check,
  Download,
  FileCheck2,
  FileText,
  LockKeyhole,
} from "lucide-react";
import { Badge, Field, Form, Submit } from "./components";
import { documentPreviewUrl, downloadFile, mode } from "./data";
import {
  billingStatus,
  canAssign,
  hasPaidAccess,
  requestStage,
} from "./workflow";
import { money } from "./types";
import type {
  Command,
  Document,
  Payment,
  Profile,
  Ticket,
  Workspace,
} from "./types";
import type { BillingArrangement, Frequency } from "./workflow-types";
const AgreementPreview = lazy(() => import("./AgreementPreview"));

type Execute = (command: Command, message: string) => Promise<boolean>;
type Props = {
  state: Workspace;
  ticket: Ticket;
  actor: Profile;
  busy: boolean;
  execute: Execute;
};
const text = (f: FormData, key: string) => String(f.get(key) || "");
const date = (v?: string) =>
  v
    ? new Date(v).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not yet available";

function AgreementFile({ document }: { document: Document }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return (
    <div className="wf-file">
      <div className="wf-file-line">
        <FileText size={19} />
        <strong>{document.name}</strong>
        <span>{Math.ceil(document.size / 1024)} KB</span>
      </div>
      <div className="wf-actions">
        <button
          type="button"
          className="button secondary small"
          onClick={async () => {
            try {
              setError("");
              setUrl(await documentPreviewUrl(document));
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          View PDF
        </button>
        <button
          type="button"
          className="button secondary small"
          onClick={async () => {
            try {
              setError("");
              await downloadFile(document);
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          <Download size={15} />
          Download PDF
        </button>
        {url && (
          <button
            type="button"
            className="text-button"
            onClick={() => setUrl("")}
          >
            Close preview
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {url && (
        <Suspense fallback={<p role="status">Opening PDF viewer…</p>}>
          <AgreementPreview url={url} name={document.name} />
        </Suspense>
      )}
    </div>
  );
}
function receipt(p: Payment, t: Ticket, s: Workspace) {
  const body = `NEXUS VA — PAYMENT RECEIPT\n${mode === "demo" ? "DEMO RECORD — not proof of a real-world transaction\n" : "Admin-confirmed payment record\n"}Receipt: ${p.receiptNumber || p.id}\nRequest: NX-${t.number} ${t.title}\nAmount: ${money(p.amount)} USD\nStatus: ${p.status}\nReceived: ${date(p.paidAt || undefined)}\nConfirmed by: ${s.profiles.find((x) => x.id === p.confirmedBy)?.name || "Existing record"}\nTransaction reference: ${p.confirmationReference || "Not recorded"}\n${p.periodEnd ? `Service period: ${date(p.periodStart)} – ${date(p.periodEnd)}\n` : ""}${p.resolutionReason ? `Resolution: ${p.resolutionReason}\n` : ""}`;
  const url = URL.createObjectURL(
    new Blob([body], { type: "text/plain;charset=utf-8" }),
  );
  const a = window.document.createElement("a");
  a.href = url;
  a.download = `${p.receiptNumber || p.id}-receipt.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PaymentReview({
  payment: p,
  ...props
}: Props & { payment: Payment }) {
  const { state, actor, ticket: t, busy, execute } = props;
  const [resolve, setResolve] = useState(false);
  const b = t.workflow?.billing;
  return (
    <section className="wf-payment" aria-label={`Invoice ${p.description}`}>
      <div className="wf-heading">
        <div>
          <strong>{money(p.amount)}</strong>
          <p>{p.description}</p>
        </div>
        <Badge>{p.status}</Badge>
      </div>
      {b && (
        <p>
          {b.kind === "Subscription"
            ? `${b.frequency} subscription`
            : "One-time upfront service"}{" "}
          · {b.method}
        </p>
      )}
      {p.periodEnd && (
        <p>
          Service period: {date(p.periodStart)} – {date(p.periodEnd)}
        </p>
      )}
      {p.reference && (
        <p>
          Client reference: <strong>{p.reference}</strong>
        </p>
      )}
      {p.paidAt && (
        <p>
          Confirmed {date(p.paidAt)}
          {p.confirmedBy
            ? ` by ${state.profiles.find((x) => x.id === p.confirmedBy)?.name || "Admin"}`
            : " (existing record)"}
        </p>
      )}
      {p.resolutionReason && <p className="wf-note">{p.resolutionReason}</p>}
      {(p.status === "Paid" || p.status === "Refunded") && (
        <button
          className="button secondary small"
          onClick={() => receipt(p, t, state)}
        >
          <Download size={15} />
          Download receipt
        </button>
      )}
      {actor.role === "client" &&
        b &&
        !b.cancelledAt &&
        ["Pending", "Verified"].includes(p.status) && (
          <Form
            onSubmit={async (f) => {
              await execute(
                {
                  type: "submitPayment",
                  paymentId: p.id,
                  reference: text(f, "reference"),
                  accepted: f.get("accepted") === "on",
                },
                "Payment reference submitted. Awaiting Admin confirmation.",
              );
            }}
          >
            <div className="wf-note">
              <strong>Payment instructions</strong>
              <p className="wf-preserve">{b.instructions}</p>
              <p>
                {mode === "demo"
                  ? "Demo workspace: use a sample reference. No money is collected."
                  : "Pay using the configured method above, then submit your reference. Admin will independently verify receipt."}
              </p>
            </div>
            <Field label="Payment reference">
              <input
                name="reference"
                required
                minLength={3}
                maxLength={200}
                autoComplete="off"
              />
            </Field>
            <label className="wf-checkbox">
              <input type="checkbox" name="accepted" required />
              <span>
                I have reviewed the {money(b.amount)}{" "}
                {b.kind === "Subscription"
                  ? `${b.frequency?.toLowerCase()} subscription, renewal terms and Unsubscribe option`
                  : "one-time service price"}{" "}
                and submitted payment using these instructions.
              </span>
            </label>
            <Submit busy={busy}>Submit payment for confirmation</Submit>
          </Form>
        )}
      {p.status === "Awaiting confirmation" && (
        <p className="wf-note" role="status">
          Payment submitted. Admin must verify receipt before this service can
          be assigned. Do not send a second payment while confirmation is
          pending.
        </p>
      )}
      {actor.role === "admin" && b && p.status === "Awaiting confirmation" && (
        <Form
          onSubmit={async (f) => {
            await execute(
              {
                type: "confirmPayment",
                paymentId: p.id,
                reference: text(f, "confirmedReference"),
              },
              "Receipt of payment confirmed. The service is ready for Admin assignment.",
            );
          }}
        >
          <Field
            label="Verified transaction reference"
            hint="Check the configured payment account independently before confirming."
          >
            <input
              required
              name="confirmedReference"
              minLength={3}
              maxLength={200}
              autoComplete="off"
            />
          </Field>
          <label className="wf-checkbox">
            <input type="checkbox" required />
            <span>
              I verified receipt of {money(p.amount)}
              {mode === "demo"
                ? " in this demo scenario"
                : " in the payment account"}
              .
            </span>
          </label>
          <Submit busy={busy}>Confirm receipt of payment</Submit>
        </Form>
      )}
      {actor.role === "admin" &&
        ["Pending", "Verified", "Awaiting confirmation", "Paid"].includes(
          p.status,
        ) && (
          <>
            <button
              className="text-button"
              onClick={() => setResolve(!resolve)}
              aria-expanded={resolve}
            >
              Record{" "}
              {p.status === "Paid"
                ? "a refund"
                : "a failed or cancelled payment"}
            </button>
            {resolve && (
              <Form
                onSubmit={async (f) => {
                  if (
                    await execute(
                      {
                        type: "resolvePayment",
                        paymentId: p.id,
                        status: text(f, "resolution") as
                          "Failed" | "Cancelled" | "Refunded",
                        reason: text(f, "reason"),
                      },
                      "Payment resolution recorded.",
                    )
                  )
                    setResolve(false);
                }}
              >
                <Field label="Payment result">
                  <select name="resolution">
                    {(p.status === "Paid"
                      ? ["Refunded"]
                      : ["Failed", "Cancelled"]
                    ).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Reason and external reference">
                  <textarea
                    required
                    name="reason"
                    minLength={5}
                    maxLength={2000}
                  />
                </Field>
                <p className="muted">
                  Record a confirmed external result here. This action does not
                  move money.
                </p>
                <Submit busy={busy}>Record payment result</Submit>
              </Form>
            )}
          </>
        )}
      {actor.role === "client" &&
        b &&
        !b.cancelledAt &&
        ["Failed", "Cancelled"].includes(p.status) && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void execute(
                { type: "retryPayment", paymentId: p.id },
                "Invoice reopened. Review the instructions before trying again.",
              )
            }
          >
            Retry this invoice
          </button>
        )}
    </section>
  );
}
export function SubscriptionSummary({
  ticket: t,
  actor,
  busy,
  execute,
}: Props) {
  const [confirm, setConfirm] = useState(false);
  const b = t.workflow?.billing;
  if (b?.kind !== "Subscription") return null;
  return (
    <section className="wf-subscription" aria-label="Subscription details">
      <div className="wf-heading">
        <h3>
          {money(b.amount)} / {b.frequency?.toLowerCase()}
        </h3>
        <Badge>{billingStatus(t)}</Badge>
      </div>
      <dl className="wf-facts">
        <div>
          <dt>Paid through</dt>
          <dd>{date(b.periodEnd)}</dd>
        </div>
        <div>
          <dt>Next billing</dt>
          <dd>
            {b.cancelledAt ? "No future renewals" : date(b.nextBillingDate)}
          </dd>
        </div>
      </dl>
      <p>
        {b.cancelledAt
          ? b.periodEnd && +new Date(b.periodEnd) > Date.now()
            ? `Renewals are cancelled. You retain service access until ${date(b.periodEnd)}. Cancellation does not refund this period.`
            : "This subscription has ended. No future renewals are scheduled."
          : "Renewal requires a new invoice and confirmed payment. Cancel future renewals at any time using Unsubscribe."}
      </p>
      {actor.role === "client" && !b.cancelledAt && (
        <>
          <button
            type="button"
            className="button secondary"
            onClick={() => setConfirm(true)}
            aria-expanded={confirm}
          >
            Unsubscribe
          </button>
          {confirm && (
            <div
              className="wf-note"
              role="region"
              aria-label="Confirm unsubscribe"
            >
              <p>
                {b.periodEnd
                  ? `End future renewals and keep paid access until ${date(b.periodEnd)}?`
                  : "Cancel this subscription before the first payment?"}{" "}
                Pending renewal invoices will be cancelled.
              </p>
              <div className="wf-actions">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      await execute(
                        { type: "unsubscribe", ticketId: t.id },
                        "Future renewals cancelled.",
                      )
                    )
                      setConfirm(false);
                  }}
                >
                  Confirm unsubscribe
                </button>
                <button
                  className="button secondary"
                  onClick={() => setConfirm(false)}
                >
                  Keep subscription
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {actor.role === "admin" &&
        !b.cancelledAt &&
        b.periodEnd &&
        +new Date(b.periodEnd) <= Date.now() && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void execute(
                { type: "issueRenewal", ticketId: t.id },
                "Renewal invoice issued. No payment was charged.",
              )
            }
          >
            Issue renewal invoice
          </button>
        )}
    </section>
  );
}
export function RequestWorkflowPanel(
  props: Props & {
    upload: (
      file: File,
      signed: boolean,
      acknowledged: boolean,
    ) => Promise<void>;
  },
) {
  const { state, ticket: t, actor, busy, execute, upload } = props;
  const [kind, setKind] = useState<BillingArrangement["kind"]>("One-time");
  const [signature, setSignature] = useState(false);
  const f = t.workflow;
  const a = f?.agreement;
  const admin = actor.role === "admin";
  const client = actor.role === "client";
  const agreementDocs = state.documents.filter(
    (d) => d.ticketId === t.id && d.purpose,
  );
  const files = (signed: boolean) => (
    <Field
      label={
        signed ? "Upload signed agreement PDF" : "Upload service agreement PDF"
      }
      hint="PDF only, up to 10 MB."
    >
      <input
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy || (signed && !signature)}
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) await upload(file, signed, signature);
        }}
      />
    </Field>
  );
  return (
    <div className="request-workflow">
      <div className="wf-stage">
        <FileCheck2 size={22} />
        <div>
          <span>Request progress</span>
          <strong>{requestStage(state, t)}</strong>
        </div>
      </div>
      <ol className="wf-progress" aria-label="Request workflow">
        {[
          ["Admin review", !!f?.reviewedAt],
          ["Agreement", a?.status === "Approved"],
          ["Payment", hasPaidAccess(state, t)],
          ["VA assignment", !!t.assigneeId],
        ].map(([label, done]) => (
          <li key={String(label)} className={done ? "done" : ""}>
            {done ? <Check size={14} /> : <LockKeyhole size={13} />}
            <span>{label}</span>
          </li>
        ))}
      </ol>
      {!f && (
        <p className="wf-note">
          Existing service record. Earlier history is preserved; no signed
          agreement has been inferred.
        </p>
      )}
      {admin &&
        !f?.reviewedAt &&
        (!t.assigneeId || !f) &&
        t.status !== "Completed" && (
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void execute(
                { type: "reviewRequest", ticketId: t.id },
                "Request is under Admin review.",
              )
            }
          >
            {t.assigneeId
              ? "Begin agreement review for existing service"
              : "Start Admin review"}
          </button>
        )}
      {f?.existingAssignment && !hasPaidAccess(state, t) && (
        <p className="wf-note">
          The existing VA and conversation are retained. Further delivery is
          paused until the new agreement and payment are approved.
        </p>
      )}
      <section className="wf-section" aria-label="Service agreement">
        <div className="wf-heading">
          <h3>Service agreement</h3>
          <Badge>{a?.status || "Not sent"}</Badge>
        </div>
        {!a?.originalId && (
          <p>
            Admin reviews the request and sends a PDF. Pricing and assignment
            remain locked until Admin approves the returned signed copy.
          </p>
        )}
        {agreementDocs
          .filter((d) => d.id === a?.originalId || d.id === a?.signedId)
          .map((d) => (
            <div key={d.id}>
              <p className="wf-file-label">
                {d.purpose === "agreement"
                  ? `Agreement · revision ${a?.revision}`
                  : "Returned signed copy"}
              </p>
              <AgreementFile document={d} />
            </div>
          ))}
        {admin &&
          f?.reviewedAt &&
          !f.billing &&
          (!t.assigneeId || f.existingAssignment) &&
          a?.status !== "Approved" &&
          files(false)}
        {client && a?.status === "Sent" && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void execute(
                { type: "readAgreement", ticketId: t.id },
                "Agreement is awaiting your signed copy.",
              )
            }
          >
            Review agreement for signature
          </button>
        )}
        {a?.correction && (
          <p className="wf-note" role="status">
            <strong>Corrections requested</strong>
            <br />
            {a.correction}
          </p>
        )}
        {client &&
          a &&
          ["Sent", "Awaiting signature", "Corrections requested"].includes(
            a.status,
          ) && (
            <div className="wf-upload">
              <p>
                Download the agreement, sign it outside the app, then upload the
                signed PDF for Admin review.
              </p>
              <label className="wf-checkbox">
                <input
                  type="checkbox"
                  checked={signature}
                  onChange={(e) => setSignature(e.target.checked)}
                />
                <span>
                  I reviewed and signed the agreement, and this upload is my
                  signed copy.
                </span>
              </label>
              {files(true)}
            </div>
          )}
        {admin && a?.status === "Returned" && (
          <>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void execute(
                  { type: "approveAgreement", ticketId: t.id },
                  "Agreement approved. You can now set the price.",
                )
              }
            >
              Approve returned agreement
            </button>
            <Form
              onSubmit={async (f) => {
                await execute(
                  {
                    type: "correctAgreement",
                    ticketId: t.id,
                    reason: text(f, "correction"),
                  },
                  "Corrections sent to client.",
                );
              }}
            >
              <Field label="Corrections for the client">
                <textarea
                  name="correction"
                  required
                  minLength={5}
                  maxLength={2000}
                />
              </Field>
              <Submit busy={busy}>Request corrections</Submit>
            </Form>
          </>
        )}
        {a?.approvedAt && (
          <p className="muted">
            Approved by{" "}
            {state.profiles.find((p) => p.id === a.approvedBy)?.name || "Admin"}{" "}
            on {date(a.approvedAt)}.
          </p>
        )}
        {agreementDocs.length > 2 && (
          <details>
            <summary>Agreement file history ({agreementDocs.length})</summary>
            {agreementDocs.map((d) => (
              <AgreementFile key={d.id} document={d} />
            ))}
          </details>
        )}
      </section>
      <section className="wf-section" aria-label="Service pricing and payments">
        <div className="wf-heading">
          <h3>Price & payment</h3>
          {f?.billing && <Badge>{f.billing.kind}</Badge>}
        </div>
        {!f?.billing && (
          <p>
            {a?.status === "Approved"
              ? "Admin can now set the agreed service price and payment method."
              : "The client’s budget is an estimate. Admin sets the final price after agreement approval."}
          </p>
        )}
        {admin && a?.status === "Approved" && !f?.billing && (
          <Form
            onSubmit={async (form) => {
              await execute(
                {
                  type: "setServicePrice",
                  ticketId: t.id,
                  amount: Number(form.get("amount")),
                  kind,
                  frequency:
                    kind === "Subscription"
                      ? (text(form, "frequency") as Frequency)
                      : undefined,
                  instructions: text(form, "instructions"),
                },
                "Price and payment arrangement sent to client.",
              );
            }}
          >
            <Field label="Agreed price (USD)">
              <input
                type="number"
                name="amount"
                min="0.01"
                max="1000000"
                step="0.01"
                required
                defaultValue={t.budget}
              />
            </Field>
            <Field label="Payment arrangement">
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as BillingArrangement["kind"])
                }
              >
                <option>One-time</option>
                <option>Subscription</option>
              </select>
            </Field>
            {kind === "Subscription" && (
              <Field label="Billing frequency">
                <select name="frequency" defaultValue="Monthly">
                  {["Weekly", "Monthly", "Quarterly", "Yearly"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field
              label="Payment instructions"
              hint={
                mode === "demo"
                  ? "Demo only: enter sample instructions, not real bank details."
                  : "Specify your configured payment method and how the client should identify the transaction."
              }
            >
              <textarea
                name="instructions"
                required
                minLength={10}
                maxLength={2000}
              />
            </Field>
            <p className="muted">
              This locks the agreed price and creates one invoice.{" "}
              {kind === "Subscription" &&
                "The first paid period begins when Admin confirms receipt. Renewal invoices require separate confirmation."}
            </p>
            <Submit busy={busy}>Set price & send invoice</Submit>
          </Form>
        )}
        <SubscriptionSummary {...props} />
        {f?.billing?.kind === "One-time" && (
          <p>
            Agreed upfront price: <strong>{money(f.billing.amount)}</strong>.
            Applies to this service only.
          </p>
        )}
        {state.payments
          .filter((p) => p.ticketId === t.id)
          .map((p) => (
            <PaymentReview key={p.id} {...props} payment={p} />
          ))}
      </section>
      <section className="wf-section" aria-label="VA assignment">
        <div className="wf-heading">
          <h3>VA assignment</h3>
          <Badge>{t.assigneeId ? "Assigned" : "Admin managed"}</Badge>
        </div>
        {t.assigneeId ? (
          <p>
            {state.profiles.find((p) => p.id === t.assigneeId)?.name} is
            assigned. The client and assigned VA share a private request
            conversation.
          </p>
        ) : (
          <p>
            {canAssign(state, t)
              ? "Agreement approved and payment confirmed. Ready for Admin to assign a VA."
              : "Assignment unlocks after agreement approval and confirmed, current payment."}
          </p>
        )}
        {admin && !t.assigneeId && (
          <Form
            onSubmit={async (f) => {
              await execute(
                {
                  type: "assignTicket",
                  ticketId: t.id,
                  staffId: text(f, "staffId"),
                },
                "VA assigned and private client conversation created.",
              );
            }}
          >
            <Field label="Assign a VA">
              <select
                name="staffId"
                required
                disabled={!canAssign(state, t) || busy}
                defaultValue=""
              >
                <option value="" disabled>
                  Choose an active VA
                </option>
                {state.profiles
                  .filter((p) => p.role === "staff" && p.status === "Active")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </Field>
            <button
              type="submit"
              className="button primary"
              disabled={busy || !canAssign(state, t)}
            >
              Assign VA
            </button>
          </Form>
        )}
        {actor.role === "staff" &&
          f &&
          !f.startedAt &&
          t.assigneeId === actor.id && (
            <button
              className="button primary"
              disabled={busy || !canAssign(state, t)}
              onClick={() =>
                void execute(
                  { type: "startWork", ticketId: t.id },
                  "Work started.",
                )
              }
            >
              Start work
            </button>
          )}
      </section>
      {!!f?.events.length && (
        <details className="wf-timeline">
          <summary>Workflow history ({f.events.length})</summary>
          <ol>
            {[...f.events].reverse().map((e) => (
              <li key={e.id}>
                <strong>{e.text}</strong>
                <span>
                  {date(e.at)} ·{" "}
                  {state.profiles.find((p) => p.id === e.actorId)?.name ||
                    "Workspace account"}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
export function WorkflowOverview({
  state,
  actor,
  onOpen,
}: {
  state: Workspace;
  actor: Profile;
  onOpen: (id: string) => void;
}) {
  const tickets = state.tickets.filter(
    (t) =>
      actor.role === "admin" ||
      (actor.role === "client" && t.clientId === actor.id) ||
      (actor.role === "staff" && t.assigneeId === actor.id),
  );
  const pending = tickets.filter(
    (t) => t.status !== "Completed" && (actor.role === "admin" || t.workflow),
  );
  if (!pending.length) return null;
  return (
    <section
      className="panel wf-overview"
      aria-label="Request workflow overview"
    >
      <div className="panel-head">
        <div>
          <h2>
            {actor.role === "admin"
              ? "Request approval queue"
              : "Service progress"}
          </h2>
          <p>
            {actor.role === "admin"
              ? "Review agreements, billing and VA assignments in each request."
              : "Your agreement, payment and service status in one place."}
          </p>
        </div>
        <Badge>{pending.length} active</Badge>
      </div>
      <div className="wf-queue">
        {pending.slice(0, 8).map((t) => (
          <button key={t.id} onClick={() => onOpen(t.id)}>
            <span>
              <small>NX-{t.number}</small>
              <strong>{t.title}</strong>
            </span>
            <span>
              <Badge>{requestStage(state, t)}</Badge>
              {t.workflow?.billing?.kind === "Subscription" && (
                <small>{billingStatus(t)}</small>
              )}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
