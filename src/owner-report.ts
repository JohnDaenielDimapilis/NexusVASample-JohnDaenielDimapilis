import { outstanding } from "./workflow";
import type { Payment, Ticket, Workspace } from "./types";
import type { TimeStore } from "./time-engine";
import { reconcileEntry } from "./time-engine";
import { localDay } from "./operations";

export interface ReportRange {
  start: string;
  end: string;
}
export type Preset =
  | "today"
  | "week"
  | "7days"
  | "next7days"
  | "month"
  | "monthToDate"
  | "lastMonth"
  | "30days"
  | "90days"
  | "custom";
export const reportPresets: [Preset, string][] = [
  ["today", "Today"],
  ["week", "This week"],
  ["7days", "Last 7 days"],
  ["next7days", "Next 7 days"],
  ["month", "This month"],
  ["monthToDate", "Month to date"],
  ["lastMonth", "Last month"],
  ["30days", "Last 30 days"],
  ["90days", "Last 90 days"],
  ["custom", "Custom dates"],
];
export function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDay(date) === value
    ? date
    : null;
}
export function rangeError(range: ReportRange) {
  if (!parseDay(range.start) || !parseDay(range.end))
    return "Choose a valid start and end date.";
  if (range.start > range.end)
    return "The end date must be on or after the start date.";
  return "";
}
export function shiftDay(day: string, amount: number) {
  const d = parseDay(day);
  if (!d) throw new Error("Invalid calendar date.");
  d.setDate(d.getDate() + amount);
  return localDay(d);
}
export function rangeDays(range: ReportRange) {
  return (
    Math.round(
      (Date.parse(range.end + "T00:00:00Z") -
        Date.parse(range.start + "T00:00:00Z")) /
        86_400_000,
    ) + 1
  );
}
export function presetRange(
  preset: Exclude<Preset, "custom">,
  now = new Date(),
): ReportRange {
  const end = localDay(now);
  if (preset === "today") return { start: end, end };
  if (preset === "week") {
    const start = shiftDay(end, -((now.getDay() + 6) % 7));
    return { start, end: shiftDay(start, 6) };
  }
  if (preset === "next7days") return { start: end, end: shiftDay(end, 6) };
  if (preset === "monthToDate")
    return {
      start: localDay(new Date(now.getFullYear(), now.getMonth(), 1)),
      end,
    };
  if (preset === "month")
    return {
      start: localDay(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: localDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  if (preset === "lastMonth")
    return {
      start: localDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      end: localDay(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  return {
    start: shiftDay(
      end,
      -(preset === "7days" ? 6 : preset === "90days" ? 89 : 29),
    ),
    end,
  };
}
export function previousRange(range: ReportRange): ReportRange {
  const end = shiftDay(range.start, -1);
  return { start: shiftDay(end, 1 - rangeDays(range)), end };
}
export function comparisonRange(
  range: ReportRange,
  preset: Preset,
): ReportRange {
  const start = parseDay(range.start)!;
  if (
    preset === "month" ||
    preset === "lastMonth" ||
    preset === "monthToDate"
  ) {
    const lastDay = new Date(start.getFullYear(), start.getMonth(), 0);
    return {
      start: localDay(new Date(start.getFullYear(), start.getMonth() - 1, 1)),
      end: localDay(
        preset === "monthToDate"
          ? new Date(
              lastDay.getFullYear(),
              lastDay.getMonth(),
              Math.min(parseDay(range.end)!.getDate(), lastDay.getDate()),
            )
          : lastDay,
      ),
    };
  }
  return previousRange(range);
}
export function inRange(value: string | number | null, range: ReportRange) {
  if (value === null || value === "") return false;
  const day =
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? parseDay(value)
        ? value
        : ""
      : localDay(new Date(value));
  return !!day && day >= range.start && day <= range.end;
}
export const sumPayments = (rows: Payment[]) =>
  rows.reduce((sum, p) => sum + p.amount, 0);
export function comparison(current: number, previous: number) {
  if (previous === 0)
    return current === 0
      ? "No change from previous period"
      : "No previous-period baseline";
  const pct = ((current - previous) / previous) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs previous period`;
}
export interface OwnerIssue {
  id: string;
  ticket: Ticket;
  reason: string;
  detail: string;
  action: string;
  severity: number;
  payment?: Payment;
}

export function buildOwnerReport(
  state: Workspace,
  store: TimeStore,
  range: ReportRange,
  now = new Date(),
) {
  if (rangeError(range)) throw new Error(rangeError(range));
  const today = localDay(now);
  const ticketById = new Map(state.tickets.map((t) => [t.id, t]));
  const due = state.tickets
    .filter((t) => inRange(t.dueDate, range))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const delivered = state.tickets.filter((t) => inRange(t.deliveredAt, range));
  const onTime = delivered.filter(
    (t) => localDay(new Date(t.deliveredAt!)) <= t.dueDate,
  );
  const paid = state.payments.filter(
    (p) =>
      ticketById.has(p.ticketId) &&
      p.status === "Paid" &&
      inRange(p.paidAt, range),
  );
  const unpaid = state.payments.filter(
    (p) =>
      ticketById.has(p.ticketId) &&
      outstanding(p) &&
      inRange(p.createdAt, range),
  );
  const overdue = due.filter(
    (t) => t.status !== "Completed" && !t.deliveredAt && t.dueDate < today,
  );
  const unassigned = due.filter(
    (t) => t.status !== "Completed" && !t.assigneeId && !overdue.includes(t),
  );
  const awaitingReview = due.filter(
    (t) =>
      t.status === "In review" &&
      !!t.deliveredAt &&
      now.getTime() - Date.parse(t.deliveredAt) >= 72 * 3_600_000,
  );
  const issues: OwnerIssue[] = [
    ...overdue.map((ticket) => ({
      id: `late-${ticket.id}`,
      ticket,
      reason: "Delivery overdue",
      detail: `Due ${ticket.dueDate} · No delivery recorded`,
      action: ticket.assigneeId ? "Review request" : "Assign VA",
      severity: 0,
    })),
    ...unassigned.map((ticket) => ({
      id: `assign-${ticket.id}`,
      ticket,
      reason: "Needs assignment",
      detail: `Due ${ticket.dueDate} · No VA assigned`,
      action: "Assign VA",
      severity: 1,
    })),
    ...awaitingReview.map((ticket) => ({
      id: `review-${ticket.id}`,
      ticket,
      reason: "Client review waiting",
      detail: `Delivered ${localDay(new Date(ticket.deliveredAt!))} · Waiting at least 3 days`,
      action: "Review request",
      severity: 2,
    })),
    ...unpaid.map((payment) => ({
      id: `pay-${payment.id}`,
      ticket: ticketById.get(payment.ticketId)!,
      payment,
      reason: "Payment outstanding",
      detail: `${payment.status} · Created ${localDay(new Date(payment.createdAt))}`,
      action: "View payment",
      severity: 3,
    })),
  ].sort(
    (a, b) =>
      a.severity - b.severity ||
      a.ticket.dueDate.localeCompare(b.ticket.dueDate) ||
      a.id.localeCompare(b.id),
  );
  const clients = state.profiles
    .filter((p) => p.role === "client")
    .map((profile) => {
      const clientIssues = issues.filter(
        (i) => i.ticket.clientId === profile.id,
      );
      return {
        profile,
        issues: clientIssues,
        reasons: [...new Set(clientIssues.map((i) => i.reason))],
        tickets: state.tickets.filter(
          (t) => t.clientId === profile.id && due.includes(t),
        ),
      };
    })
    .filter((c) => c.issues.length)
    .sort(
      (a, b) =>
        a.issues[0].severity - b.issues[0].severity ||
        b.issues.length - a.issues.length,
    );
  const team = state.profiles
    .filter((p) => p.role === "staff" && p.status === "Active")
    .map((profile) => ({
      profile,
      tickets: due.filter(
        (t) => t.assigneeId === profile.id && t.status !== "Completed",
      ),
    }))
    .sort(
      (a, b) =>
        b.tickets.length - a.tickets.length ||
        a.profile.name.localeCompare(b.profile.name),
    );
  const start = new Date(range.start + "T00:00:00").getTime();
  const end = new Date(shiftDay(range.end, 1) + "T00:00:00").getTime();
  const entries = store.entries.filter(
    (e) =>
      e.startedAt < end &&
      (e.endedAt ?? now.getTime()) > start &&
      e.startedAt <= now.getTime(),
  );
  const clipped = entries.map((e) => {
    const entry = structuredClone(e);
    reconcileEntry(entry, Math.max(now.getTime(), entry.cursor));
    const seconds = (kind: "work" | "unverified" | "break") =>
      entry.segments
        .filter((s) => s.kind === kind)
        .reduce(
          (sum, s) =>
            sum +
            Math.max(
              0,
              Math.min(s.to, end, now.getTime()) - Math.max(s.from, start),
            ),
          0,
        ) / 1000;
    return {
      entry,
      work: seconds("work"),
      unverified: seconds("unverified"),
      breaks: seconds("break"),
    };
  });
  return {
    range,
    due,
    delivered,
    onTime,
    paid,
    unpaid,
    overdue,
    unassigned,
    issues,
    clients,
    team,
    onTimeRate: delivered.length
      ? Math.round((onTime.length / delivered.length) * 100)
      : null,
    collected: sumPayments(paid),
    outstanding: sumPayments(unpaid),
    attendance: {
      rows: clipped,
      pending: entries.filter(
        (e) => e.endedAt !== null && e.review !== "Approved",
      ),
      flagged: entries.filter((e) => e.flags.length > 0),
      work: clipped.reduce((n, e) => n + e.work, 0),
      unverified: clipped.reduce((n, e) => n + e.unverified, 0),
    },
  };
}
export type OwnerReport = ReturnType<typeof buildOwnerReport>;
function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
}
export function reportCsv(report: OwnerReport) {
  const rows: unknown[][] = [
    ["NexusVA owner report", report.range.start, report.range.end],
    [
      "Status reflects current records; demo payments are simulated; attendance is local; corrections excluded from period hours",
    ],
    [
      "type",
      "id",
      "description",
      "date",
      "status",
      "amount USD / hours",
      "date basis",
    ],
    ...report.paid.map((p) => [
      "payment",
      p.id,
      p.description,
      p.paidAt,
      p.status,
      p.amount,
      "paid date",
    ]),
    ...report.unpaid.map((p) => [
      "outstanding",
      p.id,
      p.description,
      p.createdAt,
      p.status,
      p.amount,
      "created date",
    ]),
    ...report.delivered.map((t) => [
      "delivery",
      t.id,
      t.title,
      t.deliveredAt,
      report.onTime.includes(t) ? "On time" : "Late",
      "",
      "delivered date",
    ]),
    ...report.due.map((t) => [
      "request",
      t.id,
      t.title,
      t.dueDate,
      t.status,
      t.budget,
      "due date",
    ]),
    ...report.attendance.rows.map((r) => [
      "attendance",
      r.entry.id,
      r.entry.staffId,
      new Date(r.entry.startedAt).toISOString(),
      r.entry.review,
      (r.work / 3600).toFixed(4),
      "work segments overlapping period; adjustments excluded",
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
