import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Download,
  MessageSquare,
  Plus,
  Timer,
  Coffee,
  Play,
  Square,
  ShieldCheck,
} from "lucide-react";
import { Badge, Field, Modal } from "./components";
import {
  RoleDateFilter,
  readRoleSelection,
  roleRangeLabel,
} from "./RoleDateFilter";
import type { RoleSelection } from "./RoleDateFilter";
import { presetRange } from "./owner-report";
import { buildRoleReport, roleReportCsv } from "./role-report";
import type { RoleAction } from "./role-report";
import type { Profile, Ticket, Workspace } from "./types";
import type { TimeTracking } from "./use-time-tracking";
import { duration, timeTotals } from "./time-engine";
import type { TimeAction } from "./time-engine";
import { companyName } from "./brand-config";
import { mode } from "./data";
import "./owner-dashboard.css";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );
const date = (v: string) =>
  new Date(v.length === 10 ? v + "T12:00:00" : v).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const time = (v: string | number) =>
  new Date(v).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
type Detail =
  | "due"
  | "delivered"
  | "payments"
  | "completed"
  | "time"
  | "work"
  | "actions"
  | "waiting"
  | "messages"
  | null;
type Metric = {
  kind: Exclude<Detail, null> | "verification";
  label: string;
  value: string;
  note: string;
};

export function RoleDashboard({
  state,
  actor,
  tracking,
  onRequest,
  onPayment,
  onConversation,
  onAppointment,
  onTime,
  onCreate,
  onBoard,
}: {
  state: Workspace;
  actor: Profile;
  tracking: TimeTracking;
  onRequest: (id: string) => void;
  onPayment: (id: string) => void;
  onConversation: (id: string) => void;
  onAppointment: (id: string) => void;
  onTime: () => void;
  onCreate: () => void;
  onBoard: () => void;
}) {
  const staff = actor.role === "staff";
  const key = `nexusva.role-dashboard.1.3.4.7.${actor.role}.${actor.id}`;
  const [selection, setSelection] = useState<RoleSelection>(() =>
    readRoleSelection(key),
  );
  const [now, setNow] = useState(() => new Date());
  const [detail, setDetail] = useState<Detail>(null);
  const [exported, setExported] = useState("");
  const [stopping, setStopping] = useState(false);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const closeDetail = useCallback(() => setDetail(null), []);
  const closeStop = useCallback(() => setStopping(false), []);
  useEffect(() => {
    if (!exported) return;
    const id = window.setTimeout(() => setExported(""), 5500);
    return () => window.clearTimeout(id);
  }, [exported]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(selection));
    } catch {
      /* Optional preference. */
    }
  }, [selection, key]);
  const range =
    selection.preset === "custom"
      ? selection.range
      : presetRange(selection.preset, now);
  const report = useMemo(
    () => buildRoleReport(state, actor, tracking.store, range, now),
    [state, actor, tracking.store, range.start, range.end, now],
  );
  const available = tracking.enabled && !tracking.error;
  const person = (id: string | null) =>
    state.profiles.find((p) => p.id === id)?.name || "Not assigned";
  const apply = (next: RoleSelection) => {
    setSelection(next);
    setDetail(null);
    setExported("");
  };
  const openRequest = (t: Ticket) => {
    setDetail(null);
    onRequest(t.id);
  };
  const send = async (action: TimeAction) => {
    setBusy(true);
    try {
      await tracking.send(action);
      if (action.type === "stop") {
        setStopping(false);
        setSummary("");
      }
    } catch {
      /* The shared tracker error is displayed below. */
    } finally {
      setBusy(false);
    }
  };
  const exportReport = () => {
    const url = URL.createObjectURL(
      new Blob([roleReportCsv(report, actor, !staff || available)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `NexusVA-${staff ? "VA" : "client"}-${range.start}-to-${range.end}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(`Exported ${roleRangeLabel(range)}.`);
  };
  const ticketRows = (tickets: Ticket[], limit = tickets.length) =>
    tickets.length ? (
      <div className="role-record-list">
        {tickets.slice(0, limit).map((t) => (
          <button
            className="role-record"
            key={t.id}
            onClick={() => openRequest(t)}
          >
            <div>
              <strong>{t.title}</strong>
              <small>
                {staff
                  ? companyName(
                      state.profiles.find((p) => p.id === t.clientId)
                        ?.company || person(t.clientId),
                    )
                  : person(t.assigneeId)}{" "}
                · Due {date(t.dueDate)}
                {detail === "delivered" && t.deliveredAt && (
                  <> · Delivered {date(t.deliveredAt)}</>
                )}
              </small>
            </div>
            <Badge
              tone={
                report.currentOverdue.some((o) => o.id === t.id)
                  ? "pending"
                  : ""
              }
            >
              {report.currentOverdue.some((o) => o.id === t.id)
                ? "Delivery overdue"
                : t.status}
            </Badge>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
    ) : (
      <p className="role-empty">No matching requests.</p>
    );
  const actionRows = (actions: RoleAction[], limit = actions.length) =>
    actions.length ? (
      <div className="role-action-list">
        {actions.slice(0, limit).map((a) => (
          <div className="role-action" key={a.id}>
            <div>
              <span className="role-reason">
                {a.kind === "review"
                  ? "Ready for your review"
                  : a.kind === "payment"
                    ? "Unpaid payment request"
                    : "Delivery overdue"}
              </span>
              <strong>{a.ticket.title}</strong>
              <small>
                {a.payment
                  ? `${money(a.payment.amount)} · Requested ${date(a.payment.createdAt)} · ${a.payment.status}`
                  : `Delivered ${date(a.ticket.deliveredAt || a.ticket.dueDate)} · ${person(a.ticket.assigneeId)}`}
              </small>
            </div>
            <button
              className={`button ${a.kind === "review" ? "primary" : "secondary"} compact`}
              onClick={() => {
                setDetail(null);
                a.payment ? onPayment(a.payment.id) : onRequest(a.ticket.id);
              }}
            >
              {a.payment
                ? "View payment"
                : a.kind === "review"
                  ? "Review delivery"
                  : "Open request"}
            </button>
          </div>
        ))}
      </div>
    ) : (
      <p className="role-empty">
        No delivery reviews or unpaid payment requests.
      </p>
    );
  const messageRows = (limit = report.currentConversations.length) =>
    report.currentConversations.length ? (
      <div className="role-record-list">
        {report.currentConversations.slice(0, limit).map((m) => (
          <button
            className="role-record role-message"
            key={m.id}
            onClick={() => {
              setDetail(null);
              onConversation(m.ticketId);
            }}
          >
            <MessageSquare size={17} />
            <div>
              <strong>
                {report.own.find((t) => t.id === m.ticketId)?.title}
              </strong>
              <span className="role-message-preview">{m.text}</span>
              <small>
                {m.senderId === actor.id ? "You" : person(m.senderId)} ·{" "}
                {date(m.createdAt)} · {time(m.createdAt)}
              </small>
            </div>
            <ArrowUpRight size={15} />
          </button>
        ))}
      </div>
    ) : (
      <p className="role-empty">No conversations yet.</p>
    );
  const next = report.upcoming[0];
  const metrics: Metric[] = staff
    ? [
        {
          kind: "due",
          label: "My work due",
          value: String(report.active.length),
          note: "Due in period · Unfinished assignments",
        },
        {
          kind: "delivered",
          label: "Deliveries submitted",
          value: String(report.delivered.length),
          note: "Submitted in period · Current status on opening",
        },
        {
          kind: "time",
          label: "Recorded work",
          value: available ? duration(report.work) : "Unavailable",
          note: "Within period · Breaks and unverified excluded",
        },
        {
          kind: "verification",
          label: "Awaiting admin verification",
          value: available
            ? String(report.pendingVerification.length)
            : "Unavailable",
          note: "Closed sessions overlapping period · Status only",
        },
      ]
    : [
        {
          kind: "due",
          label: "Requests due",
          value: String(report.active.length),
          note: "Due in period · Completed work excluded",
        },
        {
          kind: "delivered",
          label: "Deliveries received",
          value: String(report.delivered.length),
          note: "Delivered in period · Includes accepted work",
        },
        {
          kind: "payments",
          label: "Unpaid payment requests",
          value: money(report.outstanding),
          note: `${report.payments.length} requested in period · No due date recorded`,
        },
        {
          kind: "completed",
          label: "Completed requests due",
          value: String(report.completed.length),
          note: "Due in period · Currently completed",
        },
      ];
  const titles: Record<Exclude<Detail, null>, string> = {
    due: staff ? "My work due in period" : "Requests due in period",
    delivered: staff
      ? "Deliveries submitted in period"
      : "Deliveries received in period",
    payments: "Unpaid payments requested in period",
    completed: "Currently completed requests due in period",
    time: "Recorded time in period",
    work: staff ? "All active assignments" : "All active work",
    actions: "Current actions · All dates",
    waiting: "Waiting on client · All dates",
    messages: "Current conversations · All dates",
  };
  let detailContent;
  if (detail === "due") detailContent = ticketRows(report.active);
  else if (detail === "delivered") detailContent = ticketRows(report.delivered);
  else if (detail === "completed") detailContent = ticketRows(report.completed);
  else if (detail === "payments")
    detailContent = actionRows(
      report.payments.map((payment) => ({
        id: payment.id,
        ticket: report.own.find((t) => t.id === payment.ticketId)!,
        kind: "payment",
        payment,
      })),
    );
  else if (detail === "work") detailContent = ticketRows(report.currentActive);
  else if (detail === "waiting")
    detailContent = ticketRows(report.currentReview);
  else if (detail === "actions")
    detailContent = actionRows(report.currentActions);
  else if (detail === "messages") detailContent = messageRows();
  else
    detailContent = available ? (
      <>
        <dl className="role-time-totals">
          <div>
            <dt>Recorded work</dt>
            <dd>{duration(report.work)}</dd>
          </div>
          <div>
            <dt>Breaks</dt>
            <dd>{duration(report.breaks)}</dd>
          </div>
          <div>
            <dt>Unverified</dt>
            <dd>{duration(report.unverified)}</dd>
          </div>
        </dl>
        <p className="role-fineprint">
          Only intervals within the selected dates count. Corrections are
          separate and excluded from period hours because their work dates are
          not recorded. Only Admin verifies and manages time entries.
        </p>
        {report.timeRows.map((r) => (
          <div className="role-time-row" key={r.entry.id}>
            <strong>
              {report.own.find((t) => t.id === r.entry.ticketId)?.title ||
                "Previous assignment"}
            </strong>
            <small>
              {date(new Date(r.entry.startedAt).toISOString())} ·{" "}
              {r.entry.review}
            </small>
            <span>
              {duration(r.work)} work · {duration(r.breaks)} break ·{" "}
              {duration(r.unverified)} unverified
            </span>
          </div>
        ))}
        {!report.timeRows.length && (
          <p className="role-empty">No recorded time overlaps these dates.</p>
        )}
      </>
    ) : (
      <p className="role-empty">
        {tracking.error || "Connected attendance is not configured."}
      </p>
    );
  return (
    <div className="owner-dashboard role-dashboard">
      <div className="owner-heading">
        <div>
          <h1>{staff ? "Your work, in focus" : "Your workspace"}</h1>
          <p>
            {staff
              ? "Your next task, recorded time and client handovers."
              : "Your decisions, deliveries and deadlines in one place."}
          </p>
        </div>
        <button
          className="button primary compact"
          onClick={staff ? onBoard : onCreate}
        >
          {staff ? (
            <>
              <ArrowUpRight size={15} /> Work board
            </>
          ) : (
            <>
              <Plus size={15} /> New request
            </>
          )}
        </button>
      </div>
      {staff && (
        <section
          className="role-timer owner-panel"
          aria-label="Current timer status"
        >
          <Timer size={20} />
          <div>
            <strong>
              {!available
                ? "Attendance unavailable"
                : report.current
                  ? report.current.status === "Running"
                    ? "Working"
                    : report.current.status === "On break"
                      ? "On break"
                      : "Paused · Resume when ready"
                  : "Clocked out"}
            </strong>
            <small>
              {report.current
                ? report.own.find((t) => t.id === report.current!.ticketId)
                    ?.title || "Previous assignment"
                : "Choose assigned work to start a session."}
            </small>
          </div>
          {available && report.current ? (
            <>
              <div className="role-current-duration">
                <strong role="timer">
                  {duration(timeTotals(report.current, now.getTime()).work)}
                </strong>
                <small>
                  Live session · Planned out {time(report.current.scheduledEnd)}
                </small>
              </div>
              <button
                className="button secondary compact"
                disabled={busy || !navigator.onLine}
                onClick={() =>
                  void send({
                    type:
                      report.current!.status === "Running" ? "break" : "resume",
                  })
                }
              >
                {report.current.status === "Running" ? (
                  <>
                    <Coffee size={14} />
                    Take a break
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Resume work
                  </>
                )}
              </button>
              <button
                className="button primary compact"
                disabled={busy}
                onClick={() => setStopping(true)}
              >
                <Square size={13} />
                Clock out
              </button>
            </>
          ) : (
            <button className="button secondary compact" onClick={onTime}>
              Open timer <ArrowUpRight size={14} />
            </button>
          )}
        </section>
      )}
      {staff && tracking.error && (
        <p className="time-alert" role="alert">
          {tracking.error}
        </p>
      )}
      <RoleDateFilter
        selection={{ ...selection, range }}
        onChange={apply}
        onExport={exportReport}
        staff={staff}
      />
      <div className="owner-live-status" role="status">
        Summary for {roleRangeLabel(range)} · Current actions and all open work
        stay visible below. {exported}
      </div>
      <section
        className="owner-metrics"
        aria-label={staff ? "VA dashboard summary" : "Client dashboard summary"}
      >
        {metrics.map((m) =>
          m.kind === "verification" ? (
            <div
              className="owner-metric role-readonly-metric"
              key={m.kind}
              data-testid="role-metric-verification"
            >
              <span>{m.label}</span>
              <strong>{m.value}</strong>
              <small>{m.note}</small>
            </div>
          ) : (
            <button
              className="owner-metric"
              key={m.kind}
              data-testid={`role-metric-${m.kind}`}
              onClick={() => setDetail(m.kind as Detail)}
            >
              <span>{m.label}</span>
              <strong>{m.value}</strong>
              <small>{m.note}</small>
              <ArrowUpRight size={14} />
            </button>
          ),
        )}
      </section>
      <div className="role-layout">
        <div className="role-primary">
          {!staff && (
            <section className="owner-panel">
              <div className="owner-panel-head">
                <div>
                  <h2>
                    Needs your action{" "}
                    <span className="owner-count">
                      {report.currentActions.length}
                    </span>
                  </h2>
                  <p>
                    Current delivery reviews and payments · Includes earlier
                    dates.
                  </p>
                </div>
                {report.currentActions.length > 3 && (
                  <button
                    className="text-button"
                    onClick={() => setDetail("actions")}
                  >
                    View all
                  </button>
                )}
              </div>
              {actionRows(report.currentActions, 3)}
            </section>
          )}
          <section className="owner-panel">
            <div className="owner-panel-head">
              <div>
                <h2>{staff ? "Your work queue" : "All active work"}</h2>
                <p>
                  {staff
                    ? `${report.currentOverdue.length} overdue · All open assignments · Overdue work first.`
                    : "Current requests, regardless of the summary dates."}
                </p>
              </div>
              <button className="text-button" onClick={() => setDetail("work")}>
                View all {report.currentActive.length}{" "}
                <ArrowUpRight size={13} />
              </button>
            </div>
            {ticketRows(
              report.currentActive.filter(
                (t) => !staff || t.status !== "In review",
              ),
              5,
            )}
          </section>
          {staff && (
            <section className="owner-panel">
              <div className="owner-panel-head">
                <div>
                  <h2>
                    Waiting on client{" "}
                    <span className="owner-count">
                      {report.currentReview.length}
                    </span>
                  </h2>
                  <p>Submitted work awaiting review · All dates.</p>
                </div>
                {report.currentReview.length > 2 && (
                  <button
                    className="text-button"
                    onClick={() => setDetail("waiting")}
                  >
                    View all
                  </button>
                )}
              </div>
              {ticketRows(report.currentReview, 2)}
            </section>
          )}
        </div>
        <aside className="role-secondary">
          {staff && (
            <section
              className="owner-panel role-attendance-status"
              aria-label="Read-only attendance status"
            >
              <div className="owner-panel-head">
                <h2>Attendance status</h2>
                <ShieldCheck size={18} />
              </div>
              <strong>
                {!available
                  ? "Attendance unavailable"
                  : report.pendingVerification.length
                    ? "Pending admin verification"
                    : "No closed sessions awaiting verification"}
              </strong>
              <p>
                {available
                  ? `${report.pendingVerification.length} closed sessions overlap the summary dates. ${duration(report.unverified)} unverified time is excluded from recorded work.`
                  : "Connected attendance is not configured; no hours are inferred."}
              </p>
              <small>
                Only Admin can verify and manage time entries. This panel is
                read-only.
              </small>
            </section>
          )}
          <section className="owner-panel">
            <div className="owner-panel-head">
              <div>
                <h2>Next appointment</h2>
                <p>
                  {Intl.DateTimeFormat().resolvedOptions().timeZone} ·
                  Independent of summary dates
                </p>
              </div>
            </div>
            {next ? (
              <button
                className="role-record role-meeting"
                onClick={() => onAppointment(next.id)}
              >
                <CalendarDays size={18} />
                <div>
                  <strong>{next.title}</strong>
                  <small>
                    {date(next.start)} · {time(next.start)}–{time(next.end)}
                  </small>
                  <small>
                    With {person(staff ? next.clientId : next.staffId)} ·{" "}
                    {new Date(next.start) <= now ? "In progress" : "Upcoming"}
                  </small>
                </div>
                <ArrowUpRight size={15} />
              </button>
            ) : (
              <p className="role-empty">No upcoming appointments.</p>
            )}
          </section>
          {!staff && (
            <section className="owner-panel">
              <div className="owner-panel-head">
                <div>
                  <h2>Conversations</h2>
                  <p>Latest recorded messages · All dates</p>
                </div>
                {report.currentConversations.length > 2 && (
                  <button
                    className="text-button"
                    onClick={() => setDetail("messages")}
                  >
                    View all
                  </button>
                )}
              </div>
              {messageRows(2)}
            </section>
          )}
        </aside>
      </div>
      <p className="owner-data-note">
        {mode === "demo"
          ? "Sample records · Payments simulated · Browser-local tracking"
          : "Based on your accessible workspace records"}{" "}
        · Dates use {Intl.DateTimeFormat().resolvedOptions().timeZone}.{" "}
        <button className="text-button" onClick={exportReport}>
          <Download size={12} /> Export this period
        </button>
      </p>
      {detail && (
        <Modal
          variant="drawer"
          title={titles[detail]}
          subtitle={
            ["work", "actions", "waiting", "messages"].includes(detail)
              ? "Current records · All dates"
              : `${roleRangeLabel(range)} · Current statuses; see date definitions`
          }
          close={closeDetail}
          wide
        >
          <div className="role-report-detail">{detailContent}</div>
        </Modal>
      )}
      {stopping && (
        <Modal
          title="Clock out & save"
          subtitle="Add a handover for Admin to review. Original time records stay intact."
          close={closeStop}
        >
          <form
            className="role-clockout-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send({ type: "stop", note: summary });
            }}
          >
            <Field label="Work summary">
              <textarea
                rows={3}
                maxLength={2000}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Results, handover and deliverable reference"
              />
            </Field>
            {tracking.error && (
              <p role="alert" className="time-alert">
                {tracking.error}
              </p>
            )}
            <button
              className="button primary"
              disabled={busy || !report.current}
              type="submit"
            >
              Clock out & save
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={closeStop}
            >
              Cancel
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
