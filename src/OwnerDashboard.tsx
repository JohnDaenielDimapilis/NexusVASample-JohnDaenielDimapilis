import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Info,
  Timer,
  Users,
} from "lucide-react";
import { Avatar, Badge, Modal, InlinePanel } from "./components";
import {
  buildOwnerReport,
  comparison,
  comparisonRange,
  presetRange,
  rangeError,
  reportCsv,
  reportPresets,
} from "./owner-report";
import type { Preset, ReportRange } from "./owner-report";
import type { TimeTracking } from "./use-time-tracking";
import type { Ticket, Workspace } from "./types";
import { localDay } from "./operations";
import { mode } from "./data";
import "./owner-dashboard.css";

type Selection = { preset: Preset; range: ReportRange };
type Detail = {
  kind:
    | "paid"
    | "unpaid"
    | "delivery"
    | "due"
    | "issues"
    | "client"
    | "team"
    | "attendance";
  id?: string;
} | null;
const FILTER_KEY = "nexusva.owner-report.v1.3.4.2";
function initialSelection(): Selection {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTER_KEY) || "null");
    if (
      saved &&
      reportPresets.some(([p]) => p === saved.preset) &&
      !rangeError(saved.range)
    )
      return {
        preset: saved.preset,
        range:
          saved.preset === "custom" ? saved.range : presetRange(saved.preset),
      };
  } catch {
    /* A blocked or expired preference does not prevent opening the dashboard. */
  }
  return { preset: "month", range: presetRange("month") };
}
const formatDay = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const rangeLabel = (range: ReportRange) =>
  `${formatDay(range.start)} – ${formatDay(range.end)}`;
const compactRangeLabel = (range: ReportRange) => {
  const from = new Date(range.start + "T12:00:00"),
    to = new Date(range.end + "T12:00:00");
  if (range.start === range.end) return formatDay(range.start);
  if (
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth()
  )
    return `${from.toLocaleDateString("en-US", { month: "short" })} ${from.getDate()}–${to.getDate()}, ${from.getFullYear()}`;
  return rangeLabel(range);
};
const decimalMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

export function OwnerDashboard({
  state,
  tracking,
  onRequest,
  onTime,
  onBilling,
  onClients,
}: {
  state: Workspace;
  tracking: TimeTracking;
  onRequest: (id: string) => void;
  onTime: () => void;
  onBilling: () => void;
  onClients: () => void;
}) {
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [draft, setDraft] = useState<ReportRange>(selection.range);
  const [custom, setCustom] = useState(false);
  const [dateInfo, setDateInfo] = useState(false);
  const [compare, setCompare] = useState(true);
  const [detail, setDetail] = useState<Detail>(null);
  const [now, setNow] = useState(() => new Date());
  const [exported, setExported] = useState("");
  useEffect(() => { if (!exported) return; const timer = window.setTimeout(() => setExported(""), 5500); return () => window.clearTimeout(timer); }, [exported]);
  const closeDetail = useCallback(() => setDetail(null), []);
  const closeDates = useCallback(() => {
    setCustom(false);
    setDraft(selection.range);
  }, [selection.range]);
  const closeDateInfo = useCallback(() => setDateInfo(false), []);
  const editDates = () => {
    setDraft(selection.range);
    setCustom(true);
  };
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(selection));
    } catch {
      /* Reporting remains usable without saved preferences. */
    }
  }, [selection]);
  const report = useMemo(
    () => buildOwnerReport(state, tracking.store, selection.range, now),
    [state, tracking.store, selection.range, now],
  );
  const priorRange = comparisonRange(selection.range, selection.preset);
  const previous = useMemo(
    () =>
      buildOwnerReport(
        state,
        tracking.store,
        comparisonRange(selection.range, selection.preset),
        now,
      ),
    [state, tracking.store, selection.range, selection.preset, now],
  );
  const person = (id: string | null) => state.profiles.find((p) => p.id === id);
  const error = custom ? rangeError(draft) : "";
  const apply = (range: ReportRange, preset: Preset) => {
    if (rangeError(range)) return;
    setCustom(false);
    setSelection({ range, preset });
    setDraft(range);
    setDetail(null);
    setExported("");
  };
  const choosePreset = (preset: Preset) => {
    if (preset === "custom") editDates();
    else apply(presetRange(preset), preset);
  };
  const openTicket = (ticket: Ticket) => {
    setDetail(null);
    onRequest(ticket.id);
  };
  const exportReport = () => {
    const url = URL.createObjectURL(
      new Blob([reportCsv(report)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `NexusVA-owner-${selection.range.start}-to-${selection.range.end}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported("Report downloaded for " + rangeLabel(selection.range) + ".");
  };
  const showTickets = (
    tickets: Ticket[],
    empty = "No requests match these dates.",
  ) =>
    tickets.length ? (
      <div className="owner-detail-list">
        {tickets.map((t) => (
          <button
            key={t.id}
            className="owner-detail-row"
            onClick={() => openTicket(t)}
          >
            <div>
              <strong>
                NX-{t.number} · {t.title}
              </strong>
              <small>
                {person(t.clientId)?.company || person(t.clientId)?.name} · Due{" "}
                {formatDay(t.dueDate)} ·{" "}
                {person(t.assigneeId)?.name || "Unassigned"}
              </small>
            </div>
            <Badge>{t.status}</Badge>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
    ) : (
      <p className="owner-empty">{empty}</p>
    );
  const issueRows = (all = false) =>
    (all ? report.issues : report.issues.slice(0, 3)).map((issue) => (
      <div className="owner-decision" key={issue.id}>
        <span
          className={`owner-dot ${issue.severity === 0 ? "danger" : "warning"}`}
          aria-hidden="true"
        />
        <div>
          <span className="owner-reason">{issue.reason}</span>
          <strong>{issue.ticket.title}</strong>
          <small>
            {person(issue.ticket.clientId)?.company ||
              person(issue.ticket.clientId)?.name}{" "}
            · {issue.payment ? decimalMoney(issue.payment.amount) + " · " : ""}
            {issue.detail}
          </small>
        </div>
        <button
          className={`button ${issue.severity === 0 ? "primary" : "secondary"} compact`}
          onClick={() =>
            issue.payment
              ? setDetail({ kind: "unpaid" })
              : openTicket(issue.ticket)
          }
        >
          {issue.action}
        </button>
      </div>
    ));
  const metrics = [
    {
      kind: "paid" as const,
      label: mode === "demo" ? "Payments marked paid" : "Collections recorded",
      value: decimalMoney(report.collected),
      note: compare
        ? comparison(report.collected, previous.collected)
        : `${report.paid.length} payments · By paid date`,
      count: report.paid.length,
    },
    {
      kind: "unpaid" as const,
      label: "Outstanding payments",
      value: decimalMoney(report.outstanding),
      note: `${report.unpaid.length} unpaid records created in period`,
      count: report.unpaid.length,
    },
    {
      kind: "delivery" as const,
      label: "On-time delivery",
      value: report.onTimeRate === null ? "—" : report.onTimeRate + "%",
      note: report.delivered.length
        ? `${report.onTime.length} of ${report.delivered.length} deliveries on time${compare && previous.onTimeRate !== null ? ` · ${report.onTimeRate! - previous.onTimeRate >= 0 ? "+" : ""}${report.onTimeRate! - previous.onTimeRate} pts` : ""}`
        : "No deliveries recorded in period",
      count: report.delivered.length,
    },
    {
      kind: "client" as const,
      label: "Clients needing attention",
      value: String(report.clients.length),
      note: "Assignment, delivery, review or payment issues",
      count: report.clients.length,
    },
  ];
  let detailTitle = "Report details";
  let detailContent;
  if (detail?.kind === "paid" || detail?.kind === "unpaid") {
    const paid = detail.kind === "paid",
      rows = paid ? report.paid : report.unpaid;
    detailTitle = paid ? "Payments marked paid" : "Outstanding payments";
    detailContent = (
      <>
        <p className="owner-detail-explainer">
          {paid
            ? "Includes Paid records by paid date."
            : "Includes current unpaid records by creation date. Invoice due dates are not stored, so these are not classified as overdue."}{" "}
          {mode === "demo" && "Demo payment statuses are simulated."}
        </p>
        <strong className="owner-detail-total">
          {decimalMoney(paid ? report.collected : report.outstanding)}
        </strong>
        {rows.length ? (
          <div className="owner-detail-list">
            {rows.map((p) => {
              const t = state.tickets.find((t) => t.id === p.ticketId)!;
              return (
                <button
                  className="owner-detail-row"
                  key={p.id}
                  onClick={() => openTicket(t)}
                >
                  <div>
                    <strong>{p.description}</strong>
                    <small>
                      NX-{t.number} ·{" "}
                      {formatDay(
                        localDay(new Date(paid ? p.paidAt! : p.createdAt)),
                      )}
                    </small>
                  </div>
                  <span>{decimalMoney(p.amount)}</span>
                  <Badge>{p.status}</Badge>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="owner-empty">No matching payment records.</p>
        )}
        <button
          className="button secondary"
          onClick={() => {
            closeDetail();
            onBilling();
          }}
        >
          Open full billing workspace <ArrowUpRight size={15} />
        </button>
      </>
    );
  } else if (detail?.kind === "delivery") {
    detailTitle = "Delivery performance";
    detailContent = (
      <>
        <p className="owner-detail-explainer">
          Deliveries submitted in this period, compared with each request’s due
          date. Submission is separate from client acceptance.
        </p>
        {report.delivered.length ? (
          <div className="owner-detail-list">
            {report.delivered.map((t) => (
              <button
                key={t.id}
                className="owner-detail-row"
                onClick={() => openTicket(t)}
              >
                <div>
                  <strong>{t.title}</strong>
                  <small>
                    Due {formatDay(t.dueDate)} · Delivered{" "}
                    {new Date(t.deliveredAt!).toLocaleDateString("en-US")}
                  </small>
                </div>
                <Badge
                  tone={report.onTime.includes(t) ? "completed" : "pending"}
                >
                  {report.onTime.includes(t) ? "On time" : "Late"}
                </Badge>
              </button>
            ))}
          </div>
        ) : (
          <p className="owner-empty">No deliveries recorded in these dates.</p>
        )}
      </>
    );
  } else if (detail?.kind === "issues") {
    detailTitle = "Needs your decision";
    detailContent = report.issues.length ? (
      <div>{issueRows(true)}</div>
    ) : (
      <p className="owner-empty">No flagged issues in this period.</p>
    );
  } else if (detail?.kind === "client") {
    const clients = detail.id
      ? report.clients.filter((c) => c.profile.id === detail.id)
      : report.clients;
    detailTitle = "Clients needing attention";
    detailContent = (
      <>
        {clients.length ? (
          clients.map((c) => (
            <section key={c.profile.id} className="owner-client-detail">
              <h3>{c.profile.company || c.profile.name}</h3>
              <p>
                {c.profile.name} · {c.reasons.join(" · ")}
              </p>
              {showTickets([
                ...new Map(
                  c.issues.map((i) => [i.ticket.id, i.ticket]),
                ).values(),
              ])}
            </section>
          ))
        ) : (
          <p className="owner-empty">No client issues match this period.</p>
        )}
        <button
          className="button secondary"
          onClick={() => {
            closeDetail();
            onClients();
          }}
        >
          Open full client directory <ArrowUpRight size={15} />
        </button>
      </>
    );
  } else if (detail?.kind === "team") {
    const member = report.team.find((m) => m.profile.id === detail.id);
    detailTitle = member
      ? `${member.profile.name} · Assigned workload`
      : "Assigned workload";
    detailContent = (
      <>
        <p className="owner-detail-explainer">
          Current unfinished assignments due in the selected period. Request
          counts do not measure effort or available working hours.
        </p>
        {showTickets(member?.tickets || report.team.flatMap((m) => m.tickets))}
      </>
    );
  } else if (detail?.kind === "due") {
    detailTitle = "Requests due in period";
    detailContent = showTickets(report.due);
  } else if (detail?.kind === "attendance") {
    detailTitle = "Attendance in period";
    detailContent = (
      <>
        <p className="owner-detail-explainer">
          Includes entries overlapping these dates. Hours count only NexusVA
          work segments inside the period; corrections are excluded. Activity is
          an attendance signal, and completed work still needs review.
        </p>
        {!tracking.enabled ? (
          <p className="owner-empty">
            Attendance is available in the local demo only.
          </p>
        ) : tracking.error ? (
          <p role="alert">{tracking.error}</p>
        ) : report.attendance.rows.length ? (
          <div className="owner-detail-list">
            {report.attendance.rows.map((r) => (
              <div className="owner-detail-row" key={r.entry.id}>
                <div>
                  <strong>
                    {person(r.entry.staffId)?.name || "VA"} ·{" "}
                    {(r.work / 3600).toFixed(2)}h recorded
                  </strong>
                  <small>
                    {new Date(r.entry.startedAt).toLocaleString()} ·{" "}
                    {r.entry.flags.join(" · ") || "No flags"}
                  </small>
                </div>
                <Badge>{r.entry.review}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="owner-empty">No time entries overlap this period.</p>
        )}
        <button
          className="button secondary"
          onClick={() => {
            closeDetail();
            onTime();
          }}
        >
          Open time & attendance <ArrowUpRight size={15} />
        </button>
      </>
    );
  }
  return (
    <div className="owner-dashboard">
      <div className="owner-heading">
        <div>
          <h1>Business overview</h1>
          <p>Business health and decisions that need you.</p>
        </div>
        <span className="owner-mode">
          {mode === "demo" ? "Demo workspace" : "Connected workspace"}
        </span>
      </div>
      <section className="owner-filters" aria-label="Dashboard date filters">
        <div className="owner-filter-controls">
          <label className="owner-preset">
            <CalendarDays size={16} aria-hidden="true" />
            <select
              aria-label="Dashboard reporting period"
              value={selection.preset}
              onChange={(e) => choosePreset(e.target.value as Preset)}
            >
              {reportPresets.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="owner-active-range"
            aria-label="Edit date range"

            aria-expanded={custom}
            title={rangeLabel(selection.range)}
            onClick={editDates}
          >
            <strong data-testid="report-range">
              {compactRangeLabel(selection.range)}
            </strong>
            <CalendarDays size={14} aria-hidden="true" />
          </button>
          <label className="owner-compare">
            <input
              aria-label="Compare previous period"
              type="checkbox"
              checked={compare}
              onChange={(e) => setCompare(e.target.checked)}
            />{" "}
            Compare
          </label>
          <button className="button secondary compact" onClick={exportReport}>
            <Download size={15} /> Export CSV
          </button>
          <button
            className="owner-date-info"
            aria-label="Report date details"
            title="Time zone, comparison dates and report definitions"

            aria-expanded={dateInfo} onClick={() => setDateInfo(!dateInfo)}
          >
            <Info size={17} />
          </button>
        </div>
      </section>
      {custom && (
        <InlinePanel
          title="Custom report dates"
          subtitle="Both dates are included. Changes apply only when you select Apply dates."
          close={closeDates}
        >
          <form
            className="owner-custom-range owner-date-editor"
            onSubmit={(e) => {
              e.preventDefault();
              if (!error) apply(draft, "custom");
            }}
          >
            <label>
              Start date
              <input
                type="date"
                aria-label="Report start date"
                required
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                aria-label="Report end date"
                required
                value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </label>
            <button
              className="button primary compact"
              type="submit"
              disabled={!!error}
            >
              Apply dates
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => setDraft(selection.range)}
            >
              Revert dates
            </button>
            <button
              className="button secondary compact"
              type="button"
              onClick={closeDates}
            >
              Cancel
            </button>
            {error && (
              <p role="alert" className="owner-date-error">
                {error}
              </p>
            )}
            {!error &&
              (draft.start !== selection.range.start ||
                draft.end !== selection.range.end) && (
                <p className="owner-draft-note">
                  Apply dates to update the dashboard.
                </p>
              )}
          </form>
        </InlinePanel>
      )}
      {dateInfo && (
        <InlinePanel
          title="Report dates & definitions"
          subtitle={
            Intl.DateTimeFormat().resolvedOptions().timeZone +
            " · Both dates included"
          }
          close={closeDateInfo}
        >
          <div className="owner-date-definitions">
            <h3>Selected period</h3>
            <p>{rangeLabel(selection.range)}</p>
            <h3>Comparison</h3>
            <p>{compare ? rangeLabel(priorRange) : "Comparison hidden"}</p>
            <h3>How dates work</h3>
            <p>
              Payments: paid date; outstanding payments: creation date. Delivery
              rate: submission date. Decisions, delivery list and workload: due
              date; payment issues: payment creation date. Attendance:
              overlapping time segments.
            </p>
            <p>
              Statuses reflect current records, not a historical snapshot.
              Capacity hours, client renewals, missing shifts and profit require
              additional records.
            </p>
          </div>
        </InlinePanel>
      )}

      <div role="status" className="owner-live-status">
        Showing {report.due.length} requests due, {report.paid.length} payments
        marked paid and {report.delivered.length} deliveries in this period.
        {exported && " " + exported}
      </div>
      <div className="owner-metrics">
        {metrics.map((m) => (
          <button
            key={m.kind}
            className="owner-metric"
            onClick={() => setDetail({ kind: m.kind })}
            data-testid={`metric-${m.kind}`}
          >
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <small>{m.note}</small>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
      <div className="owner-top-grid">
        <section className="owner-panel">
          <div className="owner-panel-head">
            <div>
              <h2>
                Needs your decision{" "}
                <span className="owner-count">{report.issues.length}</span>
              </h2>
              <p>Prioritized by urgency and client impact</p>
            </div>
            <button
              className="text-button"
              onClick={() => setDetail({ kind: "issues" })}
            >
              View all <ArrowUpRight size={14} />
            </button>
          </div>
          <div>
            {report.issues.length ? (
              issueRows()
            ) : (
              <div className="owner-clear">
                <CheckCircle2 size={25} />
                <strong>No flagged issues for these dates</strong>
                <p>Use another period to review other work.</p>
              </div>
            )}
          </div>
        </section>
        <section className="owner-panel">
          <div className="owner-panel-head">
            <div>
              <h2>Clients to check in with</h2>
              <p>Reasons you can act on</p>
            </div>
          </div>
          {report.clients.length ? (
            report.clients.slice(0, 3).map((c, i) => (
              <button
                className="owner-client"
                key={c.profile.id}
                onClick={() => setDetail({ kind: "client", id: c.profile.id })}
              >
                <Avatar name={c.profile.company || c.profile.name} color={i} />
                <div>
                  <strong>{c.profile.company || c.profile.name}</strong>
                  <small>{c.reasons.join(" · ")}</small>
                </div>
                <ArrowUpRight size={16} />
              </button>
            ))
          ) : (
            <p className="owner-empty">No client issues in this period.</p>
          )}
        </section>
      </div>
      <div className="owner-bottom-grid">
        <section className="owner-panel">
          <div className="owner-panel-head">
            <div>
              <h2>Delivery in period</h2>
              <p>Requests grouped by due date</p>
            </div>
            <button
              className="text-button"
              onClick={() => setDetail({ kind: "due" })}
            >
              View requests <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="owner-delivery-total">
            <strong>{report.due.length}</strong>
            <span>requests due</span>
          </div>
          <div
            className="owner-delivery-bar"
            aria-label={`${report.due.filter((t) => t.status === "Completed").length} completed, ${report.overdue.length} overdue, ${report.due.length - report.overdue.length - report.due.filter((t) => t.status === "Completed").length} other requests`}
          >
            {report.due.length ? (
              [
                report.due.filter((t) => t.status === "Completed").length,
                report.due.length -
                  report.overdue.length -
                  report.due.filter((t) => t.status === "Completed").length,
                report.overdue.length,
              ].map((n, i) => (
                <span
                  key={i}
                  className={`part-${i}`}
                  style={{ width: `${(n / report.due.length) * 100}%` }}
                />
              ))
            ) : (
              <span className="part-empty" />
            )}
          </div>
          <div className="owner-delivery-legend">
            <span>
              <i />
              {report.due.filter((t) => t.status === "Completed").length}{" "}
              Completed
            </span>
            <span>
              <i />
              {report.due.length -
                report.overdue.length -
                report.due.filter((t) => t.status === "Completed").length}{" "}
              Other open work
            </span>
            <span>
              <i />
              {report.overdue.length} Overdue
            </span>
          </div>
          <p className="owner-panel-note">
            Overdue means past due with no recorded delivery. Other open work
            includes upcoming work and client review.
          </p>
        </section>
        <section className="owner-panel">
          <div className="owner-panel-head">
            <div>
              <h2>Team workload</h2>
              <p>Current assignments due in this period</p>
            </div>
            <Users size={19} />
          </div>
          {report.team.length ? (
            report.team.map((m, i) => (
              <button
                className="owner-team"
                key={m.profile.id}
                onClick={() => setDetail({ kind: "team", id: m.profile.id })}
              >
                <Avatar name={m.profile.name} color={i} />
                <div className="owner-team-name">
                  <strong>{m.profile.name}</strong>
                  <small>
                    {m.tickets.length} unfinished request
                    {m.tickets.length === 1 ? "" : "s"}
                  </small>
                </div>
                <span className="owner-workload-track" aria-hidden="true">
                  <span
                    style={{
                      width: `${(m.tickets.length / Math.max(1, ...report.team.map((t) => t.tickets.length))) * 100}%`,
                    }}
                  />
                </span>
                <strong>{m.tickets.length}</strong>
                <ArrowUpRight size={15} />
              </button>
            ))
          ) : (
            <p className="owner-empty">No active VAs in this workspace.</p>
          )}
          <p className="owner-panel-note">
            Capacity in hours is not configured. Request counts show workload,
            not available hours or productivity.
          </p>
        </section>
      </div>
      <section className="owner-panel owner-attendance">
        <Timer size={24} />
        <div>
          <h2>Attendance exceptions</h2>
          <p>
            {tracking.error
              ? "Attendance records could not be read. Open attendance to review the error."
              : !tracking.enabled
                ? "Local demo attendance is not connected in this workspace."
                : `${report.attendance.pending.length} entries awaiting review · ${report.attendance.flagged.length} entries with flags · ${(report.attendance.work / 3600).toFixed(2)}h recorded inside this period`}
          </p>
          <small>
            NexusVA activity is an attendance signal. Review deliverables to
            assess completed work.
          </small>
        </div>
        <button
          className="button secondary compact"
          onClick={() => setDetail({ kind: "attendance" })}
        >
          <Clock3 size={15} /> Review attendance
        </button>
      </section>
      <p className="owner-data-note">
        {mode === "demo"
          ? "Local demo records · Payments are simulated · No live payment provider connected"
          : "Based on accessible workspace records"}{" "}
        · Data through {formatDay(localDay(now))} · Current periods are
        incomplete · Statuses checked{" "}
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </p>
      {detail && (
        <Modal variant="drawer"
          title={detailTitle}
          subtitle={rangeLabel(selection.range)}
          close={closeDetail}
          wide
        >
          <div className="owner-report-detail">{detailContent}</div>
        </Modal>
      )}
    </div>
  );
}
