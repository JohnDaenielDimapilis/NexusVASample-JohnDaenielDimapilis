import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock3,
  Coffee,
  Download,
  Pause,
  Play,
  ShieldCheck,
  Square,
  Timer,
} from "lucide-react";
import { Avatar, Badge, Empty, Field, Modal, SectionHead } from "./components";
import { companyName } from "./brand-config";
import { mode } from "./data";
import type { Profile, Workspace } from "./types";
import type { TimeTracking } from "./use-time-tracking";
import {
  duration,
  entriesForActor,
  reconcileEntry,
  timeTotals,
} from "./time-engine";
import type { TimeAction, TimeEntry } from "./time-engine";
import { isOverdue, localDay } from "./operations";

function useNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
const timeText = (value: number) =>
  new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
const dateText = (value: number) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const dateInput = (value: number) => {
  const date = new Date(value);
  return `${localDay(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
const settledEntry = (entry: TimeEntry, now: number) => {
  const copy = structuredClone(entry);
  reconcileEntry(copy, Math.max(now, copy.cursor));
  return copy;
};

export function ClockWidget({
  tracking,
  actor,
  onOpen,
}: {
  tracking: TimeTracking;
  actor: Profile;
  onOpen: () => void;
}) {
  const now = useNow();
  if (actor.role !== "staff" || !tracking.enabled) return null;
  const entry = tracking.store.entries.find(
    (e) => e.staffId === actor.id && e.endedAt === null,
  );
  const current = entry && settledEntry(entry, now);
  return (
    <button
      className={`time-widget ${current?.status === "Running" ? "running" : ""}`}
      onClick={onOpen}
      aria-label="Open time tracker"
    >
      <Timer size={16} />
      <span>
        {current && current.status !== "Ended"
          ? duration(timeTotals(current, now).work)
          : "Start work"}
      </span>
    </button>
  );
}

export function AdminAutomationPanel({
  state,
  tracking,
  onTime,
  onRequest,
}: {
  state: Workspace;
  tracking: TimeTracking;
  onTime: () => void;
  onRequest: (id: string) => void;
}) {
  const now = useNow();
  const entries = tracking.store.entries.map((e) => settledEntry(e, now));
  const active = entries.filter((e) => e.status === "Running");
  const pending = entries.filter(
    (e) => e.endedAt !== null && e.review !== "Approved",
  );
  const exceptions = entries.filter(
    (e) =>
      (e.status === "Paused" ||
        e.flags.some((f) => f !== "Automatic scheduled clock-out")) &&
      e.review !== "Approved",
  );
  const overdue = state.tickets.filter((t) => isOverdue(t));
  const unassigned = state.tickets.filter(
    (t) => !t.assigneeId && t.status !== "Completed",
  );
  return (
    <section
      className="time-admin-watch"
      aria-label="Automated operations watch"
    >
      <header>
        <div>
          <span className="time-watch-icon">
            <Timer size={18} />
          </span>
          <div>
            <h2>Operations watch</h2>
            <p>Requests and time exceptions, brought together automatically.</p>
          </div>
        </div>
        <button className="button secondary" onClick={onTime}>
          Time & attendance
          <ArrowUpRight size={15} />
        </button>
      </header>
      <div className="time-watch-metrics">
        <div>
          <strong>{tracking.enabled ? active.length : "—"}</strong>
          <span>Running work timers</span>
        </div>
        <div>
          <strong>{tracking.enabled ? pending.length : "—"}</strong>
          <span>Time entries to review</span>
        </div>
        <div>
          <strong>{overdue.length}</strong>
          <span>Overdue requests</span>
        </div>
        <div>
          <strong>{unassigned.length}</strong>
          <span>Unassigned requests</span>
        </div>
      </div>
      <div className="time-watch-actions">
        {exceptions.length > 0 && (
          <button onClick={onTime}>
            <AlertTriangle size={16} />
            <span>
              {exceptions.length} time{" "}
              {exceptions.length === 1 ? "entry has" : "entries have"} gaps or
              pauses to review
            </span>
            <ArrowUpRight size={15} />
          </button>
        )}
        {overdue.slice(0, 2).map((ticket) => (
          <button key={ticket.id} onClick={() => onRequest(ticket.id)}>
            <Clock3 size={16} />
            <span>Overdue: {ticket.title}</span>
            <ArrowUpRight size={15} />
          </button>
        ))}
        {!exceptions.length && !overdue.length && (
          <p>No overdue requests or flagged time entries in this workspace.</p>
        )}
      </div>
      <p className="time-watch-note">
        {mode === "demo"
          ? "Local demo records"
          : "Time tracking needs a connected backend"}
        . Timer status is an attendance signal; completed work still needs
        review.
      </p>
    </section>
  );
}

function TimerControls({
  tracking,
  state,
  actor,
  now,
}: {
  tracking: TimeTracking;
  state: Workspace;
  actor: Profile;
  now: number;
}) {
  const own = entriesForActor(tracking.store, actor);
  const active = own.find((e) => e.endedAt === null);
  const entry = active && settledEntry(active, now);
  const assigned = state.tickets.filter(
    (t) => t.assigneeId === actor.id && t.status === "In progress",
  );
  const [ticketId, setTicketId] = useState("");
  const [plannedEnd, setPlannedEnd] = useState(() =>
    dateInput(Date.now() + 8 * 3_600_000),
  );
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (action: TimeAction) => {
    setBusy(true);
    try {
      await tracking.send(action);
      if (action.type === "stop") setSummary("");
    } catch {
      /* Visible in the shared error panel. */
    } finally {
      setBusy(false);
    }
  };
  if (entry && entry.status !== "Ended") {
    const ticket = state.tickets.find((t) => t.id === entry.ticketId);
    const total = timeTotals(entry, now);
    return (
      <section
        className="time-clock-panel"
        aria-label="Your active work session"
      >
        <div className="time-clock-top">
          <Badge>{entry.status}</Badge>
          <span>
            Clocked in {timeText(entry.startedAt)} · Planned out{" "}
            {timeText(entry.scheduledEnd)}
          </span>
        </div>
        <div className="time-clock-body">
          <div>
            <h2>{ticket?.title || "Assigned request"}</h2>
            <p>
              {ticket?.category} · #{ticket?.number}
            </p>
            <span
              className="time-big-clock"
              role="timer"
              aria-label="Recorded work time"
            >
              {duration(total.work)}
            </span>
            <small>
              Recorded work time, excluding breaks and unverified gaps
            </small>
          </div>
          <dl>
            <div>
              <dt>Breaks</dt>
              <dd>{duration(total.breaks)}</dd>
            </div>
            <div>
              <dt>Unverified time</dt>
              <dd>{duration(total.unverified)}</dd>
            </div>
            <div>
              <dt>Automatic clock-out</dt>
              <dd>{timeText(entry.scheduledEnd)}</dd>
            </div>
          </dl>
        </div>
        {entry.status === "Paused" && (
          <p className="time-alert">
            <AlertTriangle size={17} />
            Tracking paused because recent NexusVA activity or connection could
            not be confirmed. Resume when ready; outside work can be explained
            after clock-out.
          </p>
        )}
        <Field label="Work summary">
          <textarea
            rows={2}
            maxLength={2000}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What did you work on? Add results, a handover, or a reference to the deliverable."
          />
        </Field>
        <div className="time-controls">
          {entry.status === "Running" ? (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void send({ type: "break" })}
            >
              <Coffee size={16} />
              Take a break
            </button>
          ) : (
            <button
              className="button primary"
              disabled={busy || !navigator.onLine}
              onClick={() => void send({ type: "resume" })}
            >
              <Play size={16} />
              Resume work
            </button>
          )}
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void send({ type: "stop", note: summary })}
          >
            <Square size={15} />
            Clock out & save
          </button>
        </div>
        <p className="time-policy-note">
          No NexusVA interaction for {entry.idleMinutes} minutes pauses the
          timer. Hidden tabs, sleep, or lost connection can produce unverified
          gaps. Resuming does not erase them.
        </p>
      </section>
    );
  }
  return (
    <section className="time-start-panel" aria-label="Start a work session">
      <div className="time-start-copy">
        <span className="time-start-icon">
          <Timer size={26} />
        </span>
        <h2>Start with the work you’re doing.</h2>
        <p>
          Choose an assigned request. NexusVA records the clock-in time, saves
          the time entry, and clocks out at the planned end.
        </p>
      </div>
      <form
        className="time-start-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send({
            type: "start",
            ticketId: ticketId || assigned[0]?.id || "",
            scheduledEnd: new Date(plannedEnd).getTime(),
          });
        }}
      >
        <Field label="Request">
          <select
            required
            value={ticketId || assigned[0]?.id || ""}
            onChange={(e) => setTicketId(e.target.value)}
            aria-label="Timer request"
          >
            <option value="" disabled>
              Choose assigned work
            </option>
            {assigned.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.number} · {t.title}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Planned clock-out"
          hint="Your local time. Maximum 12 hours; breaks and uncertain time are separate."
        >
          <input
            type="datetime-local"
            required
            value={plannedEnd}
            min={dateInput(now + 60_000)}
            max={dateInput(now + 12 * 3_600_000)}
            onChange={(e) => setPlannedEnd(e.target.value)}
            aria-label="Planned clock-out"
          />
        </Field>
        <label className="time-consent">
          <input type="checkbox" required />
          <span>
            I understand this records time and interaction timestamps inside
            NexusVA. It cannot observe work in other apps.
          </span>
        </label>
        <button
          className="button primary"
          disabled={busy || !assigned.length || !navigator.onLine}
          type="submit"
        >
          <Play size={15} />
          Clock in
        </button>
        {!assigned.length && (
          <p className="time-policy-note">
            You need an assigned request marked In progress before starting a
            timer.
          </p>
        )}
      </form>
    </section>
  );
}

function EntryDetails({
  entry,
  tracking,
  actor,
  state,
  now,
}: {
  entry: TimeEntry;
  tracking: TimeTracking;
  actor: Profile;
  state: Workspace;
  now: number;
}) {
  const [note, setNote] = useState(entry.note);
  const [reviewNote, setReviewNote] = useState("");
  const [reason, setReason] = useState("");
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const total = timeTotals(entry, now);
  const ticket = state.tickets.find((t) => t.id === entry.ticketId);
  const canEdit = entry.review !== "Approved";
  const run = async (action: TimeAction, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      await tracking.send(action);
      setMessage(success);
    } catch {
      /* Shared visible error. */
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="time-entry-details">
      <h3>
        #{ticket?.number} · {ticket?.title || "Request"}
      </h3>
      <p>
        {dateText(entry.startedAt)} · {timeText(entry.startedAt)} —{" "}
        {entry.endedAt ? timeText(entry.endedAt) : "Still open"}
      </p>
      <div className="time-detail-totals">
        <div>
          <strong>{duration(total.work)}</strong>
          <span>Recorded work</span>
        </div>
        <div>
          <strong>{duration(total.breaks)}</strong>
          <span>Breaks</span>
        </div>
        <div>
          <strong>{duration(total.unverified)}</strong>
          <span>Unverified</span>
        </div>
        <div>
          <strong>{duration(total.adjustment)}</strong>
          <span>Approved adjustment</span>
        </div>
      </div>
      {entry.flags.length > 0 && (
        <div className="time-flags">
          <h4>Automatic flags</h4>
          {entry.flags.map((flag) => (
            <span key={flag}>{flag}</span>
          ))}
        </div>
      )}
      <Badge>{entry.review}</Badge>
      {entry.reviewNote && (
        <p className="time-review-note">
          <strong>Admin review:</strong> {entry.reviewNote}
        </p>
      )}
      {tracking.error && (
        <p className="time-alert" role="alert">
          {tracking.error}
        </p>
      )}
      {message && (
        <p className="time-success" role="status">
          {message}
        </p>
      )}
      {actor.role === "staff" ? (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                { type: "note", entryId: entry.id, note },
                "Work summary saved.",
              );
            }}
          >
            <Field label="Work summary">
              <textarea
                rows={3}
                required
                maxLength={2000}
                value={note}
                disabled={!canEdit}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            {canEdit && (
              <button className="button secondary" disabled={busy}>
                Save summary
              </button>
            )}
          </form>
          <p className="time-policy-note">
            Verification and time corrections are managed by Admin only. You can
            add work context in your summary.
          </p>
        </>
      ) : actor.role === "admin" ? (
        <>
          {canEdit &&
          entry.endedAt &&
          total.unverified >= 6 &&
          (!entry.correction || entry.correction.state === "Declined") ? (
            <form
              className="time-correction-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  {
                    type: "correction",
                    entryId: entry.id,
                    seconds: Math.round(Number(minutes) * 60),
                    reason,
                  },
                  "Correction added for Admin review. The original timer record stays unchanged.",
                );
              }}
            >
              <h4>Admin time correction</h4>
              <p>
                Add a correction for up to{" "}
                {Math.floor(total.unverified / 6) / 10} unverified minutes.
                Record the work evidence and review reason. Original segments
                remain unchanged.
              </p>
              <Field label="Minutes to review">
                <input
                  type="number"
                  required
                  min="0.1"
                  step="0.1"
                  max={Math.floor(total.unverified / 6) / 10}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </Field>
              <Field label="Explanation and work reference">
                <textarea
                  required
                  minLength={15}
                  maxLength={2000}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              <button className="button secondary" disabled={busy}>
                Add correction for review
              </button>
            </form>
          ) : null}
          <div className="time-work-summary">
            <h4>Assistant’s work summary</h4>
            <p>
              {entry.note ||
                "No summary yet. Ask the assistant to add one before approval."}
            </p>
          </div>
          {canEdit && entry.endedAt !== null && (
            <form
              className="time-review-form"
              onSubmit={(e) => e.preventDefault()}
            >
              <Field label="Review reason">
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Record what was reviewed and explain your decision."
                />
              </Field>
              {entry.correction?.state === "Pending" ? (
                <div className="time-controls">
                  <button
                    type="button"
                    className="button primary"
                    disabled={busy || reviewNote.trim().length < 5}
                    onClick={() =>
                      void run(
                        {
                          type: "reviewCorrection",
                          entryId: entry.id,
                          approve: true,
                          note: reviewNote,
                        },
                        "Correction approved separately from the original record.",
                      )
                    }
                  >
                    Approve correction
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || reviewNote.trim().length < 5}
                    onClick={() =>
                      void run(
                        {
                          type: "reviewCorrection",
                          entryId: entry.id,
                          approve: false,
                          note: reviewNote,
                        },
                        "Correction declined with a recorded reason.",
                      )
                    }
                  >
                    Decline correction
                  </button>
                </div>
              ) : (
                <div className="time-controls">
                  <button
                    type="button"
                    className="button primary"
                    disabled={
                      busy || reviewNote.trim().length < 5 || !entry.note.trim()
                    }
                    onClick={() =>
                      void run(
                        {
                          type: "review",
                          entryId: entry.id,
                          approve: true,
                          note: reviewNote,
                        },
                        "Time entry approved and locked.",
                      )
                    }
                  >
                    <ShieldCheck size={15} />
                    Approve & lock
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || reviewNote.trim().length < 5}
                    onClick={() =>
                      void run(
                        {
                          type: "review",
                          entryId: entry.id,
                          approve: false,
                          note: reviewNote,
                        },
                        "Changes requested.",
                      )
                    }
                  >
                    Request changes
                  </button>
                </div>
              )}
            </form>
          )}
        </>
      ) : null}
      {entry.correction && (
        <div className="time-correction-record">
          <h4>Correction request · {entry.correction.state}</h4>
          <p>
            <strong>{duration(entry.correction.seconds)}</strong> ·{" "}
            {entry.correction.reason}
          </p>
          {entry.correction.reviewNote && (
            <p>Review: {entry.correction.reviewNote}</p>
          )}
        </div>
      )}
      <details className="time-event-history">
        <summary>Time-entry history</summary>
        <ul>
          {tracking.store.audit
            .filter((a) => a.entryId === entry.id)
            .slice(0, 30)
            .map((a) => (
              <li key={a.id}>
                <span>
                  {dateText(a.at)} {timeText(a.at)}
                </span>
                <p>{a.text}</p>
              </li>
            ))}
        </ul>
      </details>
      <p className="time-policy-note">
        Recorded time and interaction signals are not proof of productivity.
        Approved adjustments are retained separately; original timer segments
        stay intact.
      </p>
    </div>
  );
}

function exportEntries(entries: TimeEntry[], state: Workspace, now: number) {
  const rows: (string | number)[][] = [
    [
      "Assistant",
      "Client",
      "Request",
      "Clock in (UTC)",
      "Clock out (UTC)",
      "Recorded seconds",
      "Break seconds",
      "Unverified seconds",
      "Approved adjustment seconds",
      "Review",
      "Flags",
      "Work summary",
    ],
  ];
  for (const entry of entries) {
    const ticket = state.tickets.find((t) => t.id === entry.ticketId);
    const client = state.profiles.find((p) => p.id === ticket?.clientId);
    const total = timeTotals(entry, now);
    rows.push([
      state.profiles.find((p) => p.id === entry.staffId)?.name || "Assistant",
      client?.company || client?.name || "",
      ticket?.title || "",
      new Date(entry.startedAt).toISOString(),
      entry.endedAt ? new Date(entry.endedAt).toISOString() : "",
      Math.floor(total.work),
      Math.floor(total.breaks),
      Math.floor(total.unverified),
      total.adjustment,
      entry.review,
      entry.flags.join("; "),
      entry.note,
    ]);
  }
  const cell = (value: string | number) => {
    const text = String(value);
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `nexusva-time-${localDay()}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TimeWorkspace({
  tracking,
  state,
  actor,
}: {
  tracking: TimeTracking;
  state: Workspace;
  actor: Profile;
}) {
  const now = useNow();
  const [tab, setTab] = useState("This month");
  const [query, setQuery] = useState("");
  const [staffId, setStaffId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const close = useCallback(() => setSelectedId(null), []);
  const [policyBusy, setPolicyBusy] = useState(false);
  if (!["staff", "admin"].includes(actor.role)) return null;
  const entries = entriesForActor(tracking.store, actor).map((e) =>
    settledEntry(e, now),
  );
  const filtered = entries.filter((entry) => {
    const ticket = state.tickets.find((t) => t.id === entry.ticketId);
    const staff = state.profiles.find((p) => p.id === entry.staffId);
    const client = state.profiles.find((p) => p.id === ticket?.clientId);
    return (
      (!staffId || entry.staffId === staffId) &&
      `${staff?.name} ${client?.name} ${client?.company} ${ticket?.title} ${ticket?.number}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (tab === "All time" || tab === "This month"
        ? tab === "All time" ||
          localDay(new Date(entry.startedAt)).slice(0, 7) ===
            localDay(new Date(now)).slice(0, 7)
        : tab === "Needs review"
          ? entry.endedAt !== null && entry.review !== "Approved"
          : tab === "Flagged"
            ? entry.flags.some((f) => f !== "Automatic scheduled clock-out")
            : entry.review === "Approved")
    );
  });
  const totals = filtered.reduce(
    (sum, entry) => {
      const t = timeTotals(entry, now);
      return {
        work: sum.work + t.work,
        breaks: sum.breaks + t.breaks,
        unverified: sum.unverified + t.unverified,
        approved: sum.approved + (entry.review === "Approved" ? t.recorded : 0),
      };
    },
    { work: 0, breaks: 0, unverified: 0, approved: 0 },
  );
  const selected = entries.find((e) => e.id === selectedId);
  const staff = state.profiles.filter(
    (p) => p.role === "staff" && p.status === "Active",
  );
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="ops-page time-page">
      <SectionHead
        title="Time & attendance"
        description={
          actor.role === "admin"
            ? "Attendance, task-linked time, and exceptions ready for review."
            : "Track your assigned work, record breaks, and keep a clear handover."
        }
        action={
          actor.role === "admin" &&
          tracking.enabled && (
            <button
              className="button secondary"
              disabled={!filtered.length}
              onClick={() => exportEntries(filtered, state, now)}
            >
              <Download size={16} />
              Export visible entries
            </button>
          )
        }
      />
      {!tracking.enabled ? (
        <div className="ops-empty-panel">
          <Empty
            icon={<Timer size={28} />}
            title="Time tracking is available in the local demo"
            text="This revision does not connect attendance data to Supabase yet. The research and implementation plan describes the server controls needed before real use."
          />
        </div>
      ) : (
        <>
          {tracking.error && (
            <p className="time-alert" role="alert">
              {tracking.error}
              <button className="text-button" onClick={tracking.dismissError}>
                Dismiss
              </button>
            </p>
          )}
          {actor.role === "staff" && (
            <TimerControls
              tracking={tracking}
              state={state}
              actor={actor}
              now={now}
            />
          )}
          {actor.role === "admin" && (
            <section
              className="time-roster"
              aria-label="Current assistant attendance"
            >
              <div className="ops-subheading">
                <h2>Team attendance</h2>
                <p>Local demo status · {zone}</p>
              </div>
              <div className="time-roster-grid">
                {staff.map((profile) => {
                  const entry = entries.find(
                    (e) => e.staffId === profile.id && e.endedAt === null,
                  );
                  const ticket = state.tickets.find(
                    (t) => t.id === entry?.ticketId,
                  );
                  return (
                    <article key={profile.id}>
                      <div className="time-roster-person">
                        <Avatar name={profile.name} />
                        <div>
                          <strong>{profile.name}</strong>
                          <span>{entry?.status || "Clocked out"}</span>
                        </div>
                        <span
                          className={`time-presence ${entry?.status === "Running" ? "running" : entry ? "paused" : ""}`}
                        />
                      </div>
                      <p>
                        {ticket
                          ? `#${ticket.number} · ${ticket.title}`
                          : "No open work session"}
                      </p>
                      {entry && (
                        <div className="time-roster-bottom">
                          <span>
                            {duration(timeTotals(entry, now).work)} recorded
                          </span>
                          <button
                            className="text-button"
                            onClick={() => setSelectedId(entry.id)}
                          >
                            View session
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          <div
            className="time-tabs"
            role="group"
            aria-label="Time entry period and status"
          >
            {[
              "This month",
              "All time",
              "Needs review",
              "Flagged",
              "Approved",
            ].map((item) => (
              <button
                key={item}
                aria-pressed={tab === item}
                className={tab === item ? "active" : ""}
                onClick={() => setTab(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="ops-toolbar">
            <label className="ops-search">
              <Clock3 size={16} />
              <input
                type="search"
                aria-label="Search time entries"
                placeholder="Search assistant, client, or request"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {actor.role === "admin" && (
              <label className="ops-select">
                <span>Assistant</span>
                <select
                  aria-label="Time entry assistant"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                >
                  <option value="">All assistants</option>
                  {staff.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div
            className="ops-summary time-summary"
            aria-label="Filtered time summary"
          >
            <div>
              <Clock3 size={18} />
              <span>
                <strong>{duration(totals.work)}</strong>Recorded work
              </span>
            </div>
            <div>
              <Coffee size={18} />
              <span>
                <strong>{duration(totals.breaks)}</strong>Breaks
              </span>
            </div>
            <div>
              <Pause size={18} />
              <span>
                <strong>{duration(totals.unverified)}</strong>Unverified time
              </span>
            </div>
            <div>
              <Check size={18} />
              <span>
                <strong>{duration(totals.approved)}</strong>Approved work &
                adjustments
              </span>
            </div>
          </div>
          <div className="ops-board-caption">
            <span>
              {filtered.length} time{" "}
              {filtered.length === 1 ? "entry" : "entries"}
            </span>
            <span>Times shown in {zone}</span>
          </div>
          {filtered.length ? (
            <div className="time-entries">
              {filtered.map((entry) => {
                const ticket = state.tickets.find(
                  (t) => t.id === entry.ticketId,
                );
                const client = state.profiles.find(
                  (p) => p.id === ticket?.clientId,
                );
                const staffMember = state.profiles.find(
                  (p) => p.id === entry.staffId,
                );
                const total = timeTotals(entry, now);
                return (
                  <button
                    className="time-entry-row"
                    key={entry.id}
                    onClick={() => setSelectedId(entry.id)}
                    aria-label={`${actor.role === "admin" ? "Review" : "View"} ${staffMember?.name} time entry for ${ticket?.title}`}
                  >
                    <span className="time-entry-request">
                      <strong>{ticket?.title || "Request"}</strong>
                      <small>
                        {companyName(client?.company || "") || client?.name} ·{" "}
                        {staffMember?.name}
                      </small>
                      <span>
                        {dateText(entry.startedAt)} ·{" "}
                        {timeText(entry.startedAt)} —{" "}
                        {entry.endedAt ? timeText(entry.endedAt) : entry.status}
                      </span>
                    </span>
                    <span className="time-entry-duration">
                      <strong>{duration(total.work)}</strong>
                      <small>Recorded work</small>
                    </span>
                    <span className="time-entry-duration">
                      <strong>{duration(total.unverified)}</strong>
                      <small>Unverified</small>
                    </span>
                    <Badge>
                      {entry.endedAt === null ? entry.status : entry.review}
                    </Badge>
                    <ArrowUpRight size={17} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="ops-empty-panel">
              <Empty
                icon={<Clock3 size={28} />}
                title="No time entries in this view"
                text={
                  actor.role === "admin"
                    ? "Time entries appear automatically when an assistant uses their work timer in this demo."
                    : "Clock in on an assigned request to create your first entry, or try another filter."
                }
              />
            </div>
          )}
          {actor.role === "admin" && (
            <details className="time-rules">
              <summary>
                <ShieldCheck size={17} />
                Automatic tracking rules
              </summary>
              <div>
                <Field label="Idle pause threshold for new sessions">
                  <select
                    aria-label="Idle pause threshold"
                    disabled={policyBusy}
                    value={tracking.store.idleMinutes}
                    onChange={async (e) => {
                      setPolicyBusy(true);
                      try {
                        await tracking.send({
                          type: "policy",
                          idleMinutes: Number(e.target.value),
                        });
                      } catch {
                        /* Shared visible error. */
                      } finally {
                        setPolicyBusy(false);
                      }
                    }}
                  >
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                  </select>
                </Field>
                <ul>
                  <li>
                    Only one open timer per assistant, linked to an assigned
                    request.
                  </li>
                  <li>
                    Every session has a planned clock-out, up to 12 hours from
                    its start.
                  </li>
                  <li>
                    Idle time and missing heartbeats are flagged and separated
                    from recorded work.
                  </li>
                  <li>
                    Breaks are excluded. Corrections require an explanation and
                    admin review.
                  </li>
                  <li>
                    Approved entries are locked, with a separate history of
                    review actions.
                  </li>
                </ul>
                <p>
                  No screenshots, key contents, other apps, or private messages
                  are captured by this tracker. Browser storage and the device
                  clock can be changed, so this demo is unsuitable as payroll
                  evidence.
                </p>
              </div>
            </details>
          )}
          <p className="ops-footnote">
            Recorded hours measure timer intervals, not work quality. Review
            task progress and deliverables alongside any attendance exceptions.
            The browser cannot verify activity in Excel, calls, or other apps.
          </p>
          {selected && (
            <Modal
              variant="drawer"
              title={
                actor.role === "admin" ? "Review time entry" : "Your time entry"
              }
              subtitle="Original time, explanations, and review history"
              close={close}
              wide
            >
              <EntryDetails
                key={selected.id}
                entry={selected}
                tracking={tracking}
                actor={actor}
                state={state}
                now={now}
              />
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
