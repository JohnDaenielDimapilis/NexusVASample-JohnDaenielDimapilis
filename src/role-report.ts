import type { Payment, Profile, Ticket, Workspace } from "./types";
import type { TimeStore } from "./time-engine";
import { reconcileEntry } from "./time-engine";
import { inRange, rangeError, shiftDay } from "./owner-report";
import type { ReportRange } from "./owner-report";
import { localDay } from "./operations";

export type RoleAction = {
  id: string;
  ticket: Ticket;
  kind: "review" | "payment" | "overdue";
  payment?: Payment;
};

// Apply participant ownership before selecting dates, computing totals or exporting.
// This supplements the existing backend policies; it is not server authorization.
export function buildRoleReport(
  state: Workspace,
  actor: Profile,
  store: TimeStore,
  range: ReportRange,
  now = new Date(),
) {
  if (rangeError(range)) throw new Error(rangeError(range));
  const client = actor.role === "client";
  const enabled =
    actor.status === "Active" && (client || actor.role === "staff");
  const own = enabled
    ? state.tickets.filter((t) =>
        client ? t.clientId === actor.id : t.assigneeId === actor.id,
      )
    : [];
  const owned = new Map(own.map((t) => [t.id, t]));
  const today = localDay(now);
  const overdueDelivery = (t: Ticket) =>
    t.status !== "Completed" &&
    t.status !== "In review" &&
    !t.deliveredAt &&
    t.dueDate < today;
  const due = own
    .filter((t) => inRange(t.dueDate, range))
    .sort(
      (a, b) =>
        Number(overdueDelivery(b)) - Number(overdueDelivery(a)) ||
        Number(a.status === "Completed") - Number(b.status === "Completed") ||
        a.dueDate.localeCompare(b.dueDate) ||
        a.number - b.number,
    );
  const active = due.filter((t) => t.status !== "Completed");
  const delivered = own.filter(
    (t) => !!t.deliveredAt && inRange(t.deliveredAt, range),
  );
  const review = delivered.filter((t) => t.status === "In review");
  const completed = due.filter((t) => t.status === "Completed");
  const overdue = due.filter(overdueDelivery);
  const allPayments =
    enabled && client
      ? state.payments.filter(
          (p) => owned.has(p.ticketId) && p.status !== "Paid",
        )
      : [];
  const payments = allPayments
    .filter((p) => inRange(p.createdAt, range))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const appointments = enabled
    ? state.appointments
        .filter(
          (a) =>
            (client ? a.clientId === actor.id : a.staffId === actor.id) &&
            inRange(a.start, range),
        )
        .sort((a, b) => a.start.localeCompare(b.start))
    : [];
  const messages = enabled
    ? state.messages
        .filter(
          (m) =>
            !m.system &&
            owned.has(m.ticketId) &&
            !!owned.get(m.ticketId)!.assigneeId &&
            inRange(m.createdAt, range),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const latestMessages = [
    ...new Map(
      messages
        .map((m) => m.ticketId)
        .map((id) => [id, messages.find((m) => m.ticketId === id)!]),
    ).values(),
  ];
  const actions: RoleAction[] = client
    ? [
        ...review.map((ticket) => ({
          id: `review-${ticket.id}`,
          ticket,
          kind: "review" as const,
        })),
        ...payments.map((payment) => ({
          id: `payment-${payment.id}`,
          ticket: owned.get(payment.ticketId)!,
          kind: "payment" as const,
          payment,
        })),
      ]
    : overdue.map((ticket) => ({
        id: `overdue-${ticket.id}`,
        ticket,
        kind: "overdue" as const,
      }));
  const outside: RoleAction[] = client
    ? [
        ...own
          .filter(
            (t) =>
              t.status === "In review" &&
              !!t.deliveredAt &&
              !inRange(t.deliveredAt, range),
          )
          .map((ticket) => ({
            id: `review-${ticket.id}`,
            ticket,
            kind: "review" as const,
          })),
        ...allPayments
          .filter((p) => !inRange(p.createdAt, range))
          .map((payment) => ({
            id: `payment-${payment.id}`,
            ticket: owned.get(payment.ticketId)!,
            kind: "payment" as const,
            payment,
          })),
        ...own
          .filter((t) => overdueDelivery(t) && !inRange(t.dueDate, range))
          .map((ticket) => ({
            id: `overdue-${ticket.id}`,
            ticket,
            kind: "overdue" as const,
          })),
      ]
    : own
        .filter((t) => overdueDelivery(t) && !inRange(t.dueDate, range))
        .map((ticket) => ({
          id: `overdue-${ticket.id}`,
          ticket,
          kind: "overdue" as const,
        }));
  const currentActive = own
    .filter((t) => t.status !== "Completed")
    .sort(
      (a, b) =>
        Number(overdueDelivery(b)) - Number(overdueDelivery(a)) ||
        a.dueDate.localeCompare(b.dueDate),
    );
  const currentReview = own.filter(
    (t) => t.status === "In review" && !!t.deliveredAt,
  );
  const currentOverdue = own.filter(overdueDelivery);
  const currentActions: RoleAction[] = client
    ? [
        ...currentReview.map((ticket) => ({
          id: `review-${ticket.id}`,
          ticket,
          kind: "review" as const,
        })),
        ...allPayments.map((payment) => ({
          id: `payment-${payment.id}`,
          ticket: owned.get(payment.ticketId)!,
          kind: "payment" as const,
          payment,
        })),
      ]
    : currentOverdue.map((ticket) => ({
        id: `overdue-${ticket.id}`,
        ticket,
        kind: "overdue" as const,
      }));
  const upcoming = enabled
    ? state.appointments
        .filter(
          (a) =>
            (client ? a.clientId === actor.id : a.staffId === actor.id) &&
            a.status !== "No-show" &&
            new Date(a.end).getTime() > now.getTime(),
        )
        .sort((a, b) => a.start.localeCompare(b.start))
    : [];
  const currentMessages = enabled
    ? state.messages
        .filter(
          (m) =>
            !m.system &&
            owned.has(m.ticketId) &&
            !!owned.get(m.ticketId)!.assigneeId,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const currentConversations = [
    ...new Map(
      currentMessages
        .map((m) => m.ticketId)
        .map((id) => [id, currentMessages.find((m) => m.ticketId === id)!]),
    ).values(),
  ];
  const start = new Date(range.start + "T00:00:00").getTime();
  const end = new Date(shiftDay(range.end, 1) + "T00:00:00").getTime();
  const entries =
    enabled && !client
      ? store.entries.filter((e) => e.staffId === actor.id)
      : [];
  const timeRows = entries
    .filter(
      (e) =>
        e.startedAt < end &&
        (e.endedAt ?? now.getTime()) > start &&
        e.startedAt <= now.getTime(),
    )
    .map((source) => {
      const entry = structuredClone(source);
      reconcileEntry(entry, Math.max(now.getTime(), entry.cursor));
      const seconds = (kind: "work" | "break" | "unverified") =>
        entry.segments
          .filter((s) => s.kind === kind)
          .reduce(
            (total, s) =>
              total +
              Math.max(
                0,
                Math.min(s.to, end, now.getTime()) - Math.max(s.from, start),
              ),
            0,
          ) / 1000;
      return {
        entry,
        work: seconds("work"),
        breaks: seconds("break"),
        unverified: seconds("unverified"),
      };
    });
  const currentSource = entries.find((e) => e.endedAt === null);
  const current = currentSource ? structuredClone(currentSource) : null;
  if (current) reconcileEntry(current, Math.max(now.getTime(), current.cursor));
  return {
    range,
    own,
    due,
    active,
    review,
    delivered,
    completed,
    overdue,
    payments,
    appointments,
    latestMessages,
    actions,
    outside,
    currentActive,
    currentReview,
    currentOverdue,
    currentActions,
    upcoming,
    currentConversations,
    pendingVerification: timeRows.filter(
      (r) => r.entry.endedAt !== null && r.entry.review !== "Approved",
    ),
    outstanding: payments.reduce((n, p) => n + p.amount, 0),
    timeRows,
    work: timeRows.reduce((n, r) => n + r.work, 0),
    breaks: timeRows.reduce((n, r) => n + r.breaks, 0),
    unverified: timeRows.reduce((n, r) => n + r.unverified, 0),
    current: current?.endedAt === null ? current : null,
  };
}
export type RoleReport = ReturnType<typeof buildRoleReport>;

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return (
    '"' +
    (/^[\s]*[=+@-]/.test(text) ? "'" : "") +
    text.replaceAll('"', '""') +
    '"'
  );
}
export function roleReportCsv(
  report: RoleReport,
  actor: Profile,
  attendanceAvailable = true,
) {
  const rows: unknown[][] = [
    [
      "NexusVA role dashboard",
      actor.role,
      report.range.start,
      report.range.end,
    ],
    [
      "Current statuses; requests by due date, deliveries by delivered timestamp, payments/messages by creation date, meetings by start, recorded time clipped to period. No historical status snapshot. Outstanding outside-date alerts excluded.",
    ],
    ...(actor.role === "staff" && !attendanceAvailable
      ? [["Attendance unavailable; no hours are inferred or exported."]]
      : []),
    [
      "type",
      "id",
      "title",
      "date basis",
      "date",
      "current status",
      "amount USD / seconds",
    ],
    ...report.due.map((t) => [
      "request",
      t.id,
      t.title,
      "due date",
      t.dueDate,
      t.status,
      "",
    ]),
    ...report.delivered.map((t) => [
      "delivery",
      t.id,
      t.title,
      "delivery timestamp",
      t.deliveredAt,
      t.status,
      "",
    ]),
    ...report.payments.map((p) => [
      "payment",
      p.id,
      p.description,
      "created date",
      p.createdAt,
      p.status,
      p.amount,
    ]),
    ...report.appointments.map((a) => [
      "appointment",
      a.id,
      a.title,
      "start",
      a.start,
      a.status || "Scheduled",
      "",
    ]),
    ...report.latestMessages.map((m) => [
      "conversation",
      m.ticketId,
      report.own.find((t) => t.id === m.ticketId)?.title,
      "message date",
      m.createdAt,
      "Latest message in period",
      "",
    ]),
    ...(attendanceAvailable ? report.timeRows : []).flatMap((r) => [
      [
        "work",
        r.entry.id,
        "Recorded work",
        "overlapping segments",
        report.range.start,
        r.entry.review,
        r.work,
      ],
      [
        "break",
        r.entry.id,
        "Breaks",
        "overlapping segments",
        report.range.start,
        r.entry.review,
        r.breaks,
      ],
      [
        "unverified",
        r.entry.id,
        "Unverified time",
        "overlapping segments",
        report.range.start,
        r.entry.review,
        r.unverified,
      ],
    ]),
  ];
  return "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
