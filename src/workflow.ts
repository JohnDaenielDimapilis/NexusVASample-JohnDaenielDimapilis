import type {
  Command,
  Document,
  Payment,
  Profile,
  Ticket,
  Workspace,
} from "./types";
import type {
  Frequency,
  RequestWorkflow,
  WorkflowCommand,
} from "./workflow-types";

export const workflowActions = new Set([
  "reviewRequest",
  "sendAgreement",
  "returnAgreement",
  "readAgreement",
  "approveAgreement",
  "correctAgreement",
  "setServicePrice",
  "submitPayment",
  "confirmPayment",
  "resolvePayment",
  "retryPayment",
  "unsubscribe",
  "issueRenewal",
  "startWork",
]);
export const newWorkflow = (): RequestWorkflow => ({
  version: 1,
  agreement: { status: "Not sent", revision: 0 },
  events: [],
});
export const outstanding = (p: Payment) =>
  ["Pending", "Verified", "Awaiting confirmation"].includes(p.status);
export function billingStatus(t: Ticket, now = new Date()) {
  const b = t.workflow?.billing;
  if (!b) return "Not configured";
  if (b.kind === "One-time") return "One-time";
  if (b.cancelledAt)
    return b.periodEnd && +new Date(b.periodEnd) > +now
      ? "Ends at paid period"
      : "Cancelled";
  if (!b.periodEnd) return "Awaiting first payment";
  return +new Date(b.periodEnd) > +now ? "Active" : "Past due";
}
export function hasPaidAccess(s: Workspace, t: Ticket, now = new Date()) {
  const b = t.workflow?.billing;
  if (!b) return false;
  if (b.kind === "Subscription") {
    return (
      !!b.periodEnd &&
      +new Date(b.periodEnd) > +now &&
      s.payments.some(
        (p) =>
          p.ticketId === t.id &&
          p.billingId === b.id &&
          p.status === "Paid" &&
          !!p.periodEnd &&
          +new Date(p.periodEnd) === +new Date(b.periodEnd!),
      )
    );
  }
  return s.payments.some(
    (p) => p.ticketId === t.id && p.billingId === b.id && p.status === "Paid",
  );
}
export const canAssign = (s: Workspace, t: Ticket, now = new Date()) =>
  t.workflow?.agreement.status === "Approved" &&
  hasPaidAccess(s, t, now) &&
  !t.deliveredAt &&
  t.status !== "Completed";
export function requestStage(s: Workspace, t: Ticket) {
  const f = t.workflow;
  if (!f) return t.assigneeId ? `Existing service · ${t.status}` : "Submitted";
  if (t.status === "Completed") return "Completed";
  if (t.deliveredAt) return "Awaiting client review";
  if (t.assigneeId && f.agreement.status === "Approved" && hasPaidAccess(s, t))
    return f.startedAt ? "In progress" : "Assigned to VA";
  if (hasPaidAccess(s, t)) return "Paid";
  if (f.billing) return "Awaiting payment";
  if (f.agreement.status === "Approved") return "Agreement approved";
  if (f.agreement.status === "Returned") return "Signature under review";
  if (f.agreement.status === "Corrections requested")
    return "Agreement corrections requested";
  if (f.agreement.status === "Awaiting signature")
    return "Awaiting client signature";
  if (f.agreement.status === "Sent") return "Agreement sent";
  return f.reviewedAt ? "Under Admin review" : "Submitted";
}
export function endOfPeriod(start: string, frequency: Frequency) {
  const d = new Date(start);
  if (frequency === "Weekly") d.setUTCDate(d.getUTCDate() + 7);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(
      d.getUTCMonth() + { Monthly: 1, Quarterly: 3, Yearly: 12 }[frequency],
    );
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d.toISOString();
}
export function visibleWorkspace(full: Workspace, actor: Profile): Workspace {
  const tickets = full.tickets.filter(
    (t) =>
      actor.role === "admin" ||
      (actor.role === "client" && t.clientId === actor.id) ||
      (actor.role === "staff" && t.assigneeId === actor.id),
  );
  const ids = new Set(tickets.map((t) => t.id));
  const participant = new Set(
    tickets
      .filter((t) => t.clientId === actor.id || t.assigneeId === actor.id)
      .map((t) => t.id),
  );
  return {
    ...full,
    tickets,
    messages: full.messages.filter((m) => participant.has(m.ticketId)),
    payments: full.payments.filter((p) => ids.has(p.ticketId)),
    documents: full.documents.filter((d) =>
      d.ticketId
        ? d.purpose
          ? ids.has(d.ticketId)
          : participant.has(d.ticketId)
        : d.ownerId === actor.id,
    ),
    notifications: full.notifications.filter((n) => n.userId === actor.id),
    appointments: full.appointments.filter(
      (a) =>
        actor.role !== "admin" &&
        (a.clientId === actor.id || a.staffId === actor.id),
    ),
    appointmentHistory: full.appointmentHistory?.filter(
      (a) =>
        actor.role !== "admin" &&
        (a.clientId === actor.id || a.staffId === actor.id),
    ),
    audit:
      actor.role === "admin"
        ? full.audit.filter(
            (a) =>
              !/^(Scheduled an appointment|Cancelled an appointment|Rescheduled an appointment|Marked an appointment|Updated appointment details|Uploaded |Reviewed )/i.test(
                a.text,
              ),
          )
        : [],
    profiles: full.profiles
      .filter(
        (p) =>
          p.id === actor.id ||
          p.role === "staff" ||
          actor.role === "admin" ||
          tickets.some((t) => t.clientId === p.id),
      )
      .map((p) =>
        actor.role === "admin"
          ? { ...p, available: false, autoAssign: false }
          : p,
      ),
  };
}
export function applyWorkflow(
  s: Workspace,
  actor: Profile,
  command: WorkflowCommand,
  now = new Date().toISOString(),
) {
  const id = () => crypto.randomUUID();
  const c = command;
  const p =
    "paymentId" in c ? s.payments.find((p) => p.id === c.paymentId) : undefined;
  const t = s.tickets.find(
    (t) => t.id === ("ticketId" in c ? c.ticketId : p?.ticketId),
  );
  if (
    !t ||
    !(
      actor.role === "admin" ||
      (actor.role === "client" && t.clientId === actor.id) ||
      (actor.role === "staff" && t.assigneeId === actor.id)
    )
  )
    throw new Error("Request not found.");
  const admin = () => {
    if (actor.role !== "admin")
      throw new Error("Only Admin can perform this action.");
  };
  const client = () => {
    if (actor.role !== "client" || t.clientId !== actor.id)
      throw new Error("Only the request's client can perform this action.");
  };
  const existingAssignment = !t.workflow && !!t.assigneeId;
  const f = (t.workflow ||= newWorkflow());
  const a = f.agreement;
  const event = (text: string) => {
    f.events.push({ id: id(), at: now, actorId: actor.id, text });
    s.audit.unshift({
      id: id(),
      actorId: actor.id,
      ticketId: t.id,
      text,
      createdAt: now,
    });
    const recipients =
      actor.role === "admin"
        ? [t.clientId]
        : s.profiles
            .filter((p) => p.role === "admin" && p.status === "Active")
            .map((p) => p.id);
    if (t.assigneeId && t.assigneeId !== actor.id)
      recipients.push(t.assigneeId);
    for (const userId of new Set(recipients))
      s.notifications.unshift({
        id: id(),
        userId,
        text: `${t.title}: ${text}`,
        createdAt: now,
        read: false,
        target: { kind: "ticket", id: t.id },
      });
  };
  const approved = () => {
    if (a.status !== "Approved")
      throw new Error("Admin must approve the signed agreement first.");
  };
  const mutable = () => {
    if (t.status === "Completed") throw new Error("This service is completed.");
  };
  const bill = () => {
    approved();
    if (!f.billing) throw new Error("Admin must configure pricing first.");
    return f.billing;
  };
  const payment = () => {
    if (!p || (c.type !== "resolvePayment" && p.billingId !== f.billing?.id))
      throw new Error("Payment not found for this billing arrangement.");
    return p;
  };
  const invoice = (start?: string) => {
    const b = bill();
    if (s.payments.some((p) => p.ticketId === t.id && outstanding(p)))
      throw new Error("An invoice is already awaiting payment.");
    const next: Payment = {
      id: id(),
      billingId: b.id,
      ticketId: t.id,
      amount: b.amount,
      description: `${b.kind} service — ${t.title}`,
      status: "Pending",
      createdAt: now,
      paidAt: null,
    };
    if (start) {
      next.periodStart = start;
      next.periodEnd = endOfPeriod(start, b.frequency!);
    }
    s.payments.unshift(next);
  };
  const attach = (d: Document, purpose: Document["purpose"]) => {
    if (
      d.ownerId !== actor.id ||
      d.ticketId !== t.id ||
      d.isOutput ||
      !d.name.toLowerCase().endsWith(".pdf") ||
      d.type !== "application/pdf" ||
      !Number.isInteger(d.size) ||
      d.size <= 0 ||
      d.size > 10485760 ||
      !d.path.startsWith(`${actor.id}/${d.id}/`) ||
      s.documents.some((x) => x.id === d.id || x.path === d.path)
    )
      throw new Error(
        "Upload a new, nonempty PDF up to 10 MB for this request.",
      );
    s.documents.unshift({
      ...d,
      purpose,
      createdAt: now,
      reviewed: false,
      isOutput: false,
    });
  };
  switch (c.type) {
    case "reviewRequest":
      admin();
      mutable();
      if (f.reviewedAt)
        throw new Error("This request is already under review.");
      if (t.assigneeId && !existingAssignment)
        throw new Error("This service is already assigned.");
      if (existingAssignment) f.existingAssignment = true;
      f.reviewedAt = now;
      // Retire only unpaid legacy estimates; paid history is preserved as history.
      s.payments
        .filter((p) => p.ticketId === t.id && outstanding(p))
        .forEach((p) => {
          p.status = "Cancelled";
          p.resolutionReason =
            "Replaced by Admin agreement and pricing workflow.";
        });
      event("Admin started reviewing the request");
      break;
    case "sendAgreement":
      admin();
      mutable();
      if (
        !f.reviewedAt ||
        f.billing ||
        (t.assigneeId && !f.existingAssignment) ||
        a.status === "Approved"
      )
        throw new Error(
          "Review the request before sending an agreement. Approved terms are locked.",
        );
      attach(c.document, "agreement");
      f.agreement = {
        status: "Sent",
        revision: a.revision + 1,
        originalId: c.document.id,
      };
      event(`Agreement revision ${f.agreement.revision} sent to client`);
      break;
    case "readAgreement":
      client();
      if (a.status !== "Sent")
        throw new Error("Agreement is not awaiting review.");
      a.status = "Awaiting signature";
      event("Client opened the agreement for signature");
      break;
    case "returnAgreement":
      client();
      mutable();
      if (
        !["Sent", "Awaiting signature", "Corrections requested"].includes(
          a.status,
        ) ||
        c.acknowledged !== true
      )
        throw new Error(
          "Review and sign the agreement, then confirm you are uploading the signed copy.",
        );
      attach(c.document, "signed-agreement");
      a.signedId = c.document.id;
      a.status = "Returned";
      a.correction = undefined;
      event("Client returned a signed copy for Admin review");
      break;
    case "approveAgreement":
      admin();
      mutable();
      if (a.status !== "Returned" || !a.signedId)
        throw new Error("A returned signed copy is required.");
      a.status = "Approved";
      a.approvedAt = now;
      a.approvedBy = actor.id;
      event("Admin approved the returned agreement");
      break;
    case "correctAgreement":
      admin();
      mutable();
      if (
        a.status !== "Returned" ||
        c.reason.trim().length < 5 ||
        c.reason.length > 2000
      )
        throw new Error(
          "Review a returned copy and explain the requested corrections.",
        );
      a.status = "Corrections requested";
      a.correction = c.reason.trim();
      event(`Agreement corrections requested: ${a.correction}`);
      break;
    case "setServicePrice":
      admin();
      mutable();
      approved();
      if (f.billing)
        throw new Error(
          "The agreed price is locked. It cannot be charged twice.",
        );
      if (
        !Number.isFinite(c.amount) ||
        c.amount <= 0 ||
        c.amount > 1000000 ||
        Math.abs(c.amount * 100 - Math.round(c.amount * 100)) > 0.00001 ||
        !["One-time", "Subscription"].includes(c.kind) ||
        (c.kind === "Subscription" &&
          !["Weekly", "Monthly", "Quarterly", "Yearly"].includes(
            c.frequency || "",
          )) ||
        c.instructions.trim().length < 10 ||
        c.instructions.length > 2000
      )
        throw new Error(
          "Enter a valid price, billing arrangement and payment instructions.",
        );
      f.billing = {
        id: id(),
        kind: c.kind,
        amount: c.amount,
        frequency: c.kind === "Subscription" ? c.frequency : undefined,
        method: "Admin-confirmed payment",
        instructions: c.instructions.trim(),
        configuredAt: now,
      };
      invoice();
      event("Admin set the service price and sent the invoice");
      break;
    case "submitPayment": {
      client();
      const b = bill();
      const pay = payment();
      if (
        b.cancelledAt ||
        !["Pending", "Verified"].includes(pay.status) ||
        c.accepted !== true ||
        c.reference.trim().length < 3 ||
        c.reference.length > 200
      )
        throw new Error(
          "Review the terms and submit an outstanding invoice with your payment reference.",
        );
      pay.reference = c.reference.trim();
      pay.submittedAt = now;
      pay.status = "Awaiting confirmation";
      event("Client submitted a payment reference; confirmation is pending");
      break;
    }
    case "confirmPayment": {
      admin();
      const b = bill();
      const pay = payment();
      if (
        b.cancelledAt ||
        pay.status !== "Awaiting confirmation" ||
        c.reference.trim().length < 3 ||
        c.reference.length > 200
      )
        throw new Error(
          "Only a submitted payment can be confirmed, with an independent transaction reference.",
        );
      const reference = c.reference.trim().toLowerCase();
      if (
        s.payments.some(
          (x) =>
            x.id !== pay.id &&
            x.confirmationReference?.toLowerCase() === reference,
        )
      )
        throw new Error(
          "This transaction reference has already been recorded.",
        );
      if (b.kind === "Subscription") {
        pay.periodStart =
          pay.periodStart && +new Date(pay.periodStart) > +new Date(now)
            ? pay.periodStart
            : now;
        pay.periodEnd = endOfPeriod(pay.periodStart, b.frequency!);
        b.periodStart = pay.periodStart;
        b.periodEnd = pay.periodEnd;
        b.nextBillingDate = pay.periodEnd;
      }
      pay.status = "Paid";
      pay.paidAt = now;
      pay.confirmedBy = actor.id;
      pay.confirmationReference = c.reference.trim();
      pay.receiptNumber = `NX-${pay.id}`;
      event("Admin confirmed receipt of payment");
      break;
    }
    case "resolvePayment": {
      admin();
      const pay = payment();
      if (
        c.reason.trim().length < 5 ||
        c.reason.length > 2000 ||
        !["Failed", "Cancelled", "Refunded"].includes(c.status) ||
        (c.status === "Refunded" ? pay.status !== "Paid" : !outstanding(pay))
      )
        throw new Error(
          "Choose a valid payment transition and provide a reason.",
        );
      pay.status = c.status;
      pay.resolutionReason = c.reason.trim();
      if (
        c.status === "Refunded" &&
        f.billing?.kind === "Subscription" &&
        pay.periodEnd &&
        +new Date(f.billing.periodEnd!) === +new Date(pay.periodEnd)
      ) {
        f.billing.periodEnd = now;
        f.billing.nextBillingDate = undefined;
        f.billing.cancelledAt = now;
        f.billing.cancelAtPeriodEnd = true;
      }
      event(
        `Admin recorded payment ${c.status.toLowerCase()}: ${pay.resolutionReason}`,
      );
      break;
    }
    case "retryPayment":
      client();
      {
        const b = bill();
        const pay = payment();
        if (
          b.cancelledAt ||
          !["Failed", "Cancelled"].includes(pay.status) ||
          s.payments.some(
            (x) =>
              x.ticketId === t.id &&
              x.id !== pay.id &&
              (outstanding(x) ||
                (x.status === "Paid" && x.periodEnd === pay.periodEnd)),
          )
        )
          throw new Error("This invoice cannot be retried.");
        pay.status = "Pending";
        pay.reference = undefined;
        pay.submittedAt = undefined;
        event("Client reopened the invoice for another payment attempt");
      }
      break;
    case "unsubscribe": {
      client();
      const b = bill();
      if (b.kind !== "Subscription" || b.cancelledAt)
        throw new Error("There is no renewing subscription to cancel.");
      b.cancelledAt = now;
      b.cancelAtPeriodEnd = true;
      b.nextBillingDate = undefined;
      s.payments
        .filter((p) => p.ticketId === t.id && outstanding(p))
        .forEach((p) => {
          p.status = "Cancelled";
          p.resolutionReason = "Client cancelled future renewals.";
        });
      event(
        b.periodEnd && +new Date(b.periodEnd) > +new Date(now)
          ? `Client cancelled renewals; paid access ends ${b.periodEnd}`
          : "Client cancelled the subscription; no future renewals",
      );
      break;
    }
    case "issueRenewal": {
      admin();
      const b = bill();
      if (
        b.kind !== "Subscription" ||
        b.cancelledAt ||
        !b.periodEnd ||
        +new Date(b.periodEnd) > +new Date(now) ||
        s.payments.some(
          (p) =>
            p.ticketId === t.id &&
            p.status !== "Paid" &&
            p.status !== "Refunded" &&
            p.periodStart === b.periodEnd,
        )
      )
        throw new Error(
          "A renewal is available only when the current period ends, with no existing renewal invoice. Retry the existing invoice if needed.",
        );
      invoice(b.periodEnd);
      event("Admin issued the next subscription invoice");
      break;
    }
    case "startWork":
      if (
        actor.role !== "staff" ||
        t.assigneeId !== actor.id ||
        f.startedAt ||
        !canAssign(s, t, new Date(now))
      )
        throw new Error("Only the assigned VA can start approved, paid work.");
      f.startedAt = now;
      t.status = "In progress";
      event("Assigned VA started work");
      break;
  }
  return s;
}

// Entry-point restrictions also cover legacy commands and records.
export function guardWorkflow(s: Workspace, actor: Profile, c: Command) {
  if (c.type === "acceptTicket")
    throw new Error(
      "Only Admin can assign requests after agreement approval and payment.",
    );
  if (["pay", "verifyPayment", "createPayment"].includes(c.type))
    throw new Error(
      "Use Admin agreement approval, service pricing and payment confirmation.",
    );
  if (c.type === "assignTicket") {
    const t = s.tickets.find((t) => t.id === c.ticketId);
    if (actor.role !== "admin")
      throw new Error("Only Admin can assign requests.");
    if (!t || !canAssign(s, t))
      throw new Error(
        "Assignment requires an approved agreement and confirmed, current payment.",
      );
    if (t.assigneeId)
      throw new Error(
        "This service is already assigned. Reassignment requires a new reviewed handover.",
      );
  }
  if (c.type === "addDocument" && c.document.purpose)
    throw new Error("Use the agreement upload action.");
  if (c.type === "deliver" || c.type === "closeTicket") {
    const t = s.tickets.find((t) => t.id === c.ticketId);
    if (
      t?.workflow &&
      !canAssign(s, { ...t, deliveredAt: null, status: "In progress" })
    )
      throw new Error(
        "Delivery and completion require the approved agreement and a current paid service period.",
      );
  }
}
