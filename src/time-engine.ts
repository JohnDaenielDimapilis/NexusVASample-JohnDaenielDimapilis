import type { Profile, Workspace } from "./types";

export type SegmentKind = "work" | "break" | "unverified";
export interface TimeSegment {
  from: number;
  to: number;
  kind: SegmentKind;
}
export interface TimeCorrection {
  seconds: number;
  reason: string;
  state: "Pending" | "Approved" | "Declined";
  reviewNote: string;
}
export interface TimeEntry {
  id: string;
  staffId: string;
  ticketId: string;
  startedAt: number;
  endedAt: number | null;
  scheduledEnd: number;
  cursor: number;
  lastActivity: number;
  lastHeartbeat: number;
  status: "Running" | "On break" | "Paused" | "Ended";
  idleMinutes: number;
  segments: TimeSegment[];
  flags: string[];
  note: string;
  review: "Pending" | "Approved" | "Changes requested";
  reviewNote: string;
  correction: TimeCorrection | null;
}
export interface TimeAudit {
  id: string;
  at: number;
  actorId: string;
  entryId: string | null;
  text: string;
}
export interface TimeStore {
  entries: TimeEntry[];
  audit: TimeAudit[];
  idleMinutes: number;
}
export const emptyTimeStore = (): TimeStore => ({
  entries: [],
  audit: [],
  idleMinutes: 5,
});
export const HEARTBEAT_GAP = 90_000;
export type TimeAction =
  | { type: "start"; ticketId: string; scheduledEnd: number }
  | { type: "heartbeat" }
  | { type: "activity" }
  | { type: "break" }
  | { type: "resume" }
  | { type: "stop"; note: string }
  | { type: "offline" }
  | { type: "note"; entryId: string; note: string }
  | { type: "correction"; entryId: string; seconds: number; reason: string }
  | {
      type: "reviewCorrection";
      entryId: string;
      approve: boolean;
      note: string;
    }
  | { type: "review"; entryId: string; approve: boolean; note: string }
  | { type: "policy"; idleMinutes: number };

const log = (
  store: TimeStore,
  at: number,
  actorId: string,
  entryId: string | null,
  text: string,
) =>
  store.audit.unshift({ id: crypto.randomUUID(), at, actorId, entryId, text });
function flag(entry: TimeEntry, text: string) {
  if (!entry.flags.includes(text)) entry.flags.push(text);
}
function segment(entry: TimeEntry, to: number, kind: SegmentKind) {
  if (to <= entry.cursor) return;
  const last = entry.segments.at(-1);
  if (last?.kind === kind && last.to === entry.cursor) last.to = to;
  else entry.segments.push({ from: entry.cursor, to, kind });
  entry.cursor = to;
}

// Reconcile timestamps, never a count of timer ticks. Long silent gaps are uncertain.
// This pure local engine is demo-only; a production server must own its clock and audit.
export function reconcileEntry(entry: TimeEntry, now: number) {
  if (entry.endedAt !== null) return;
  if (now < entry.cursor) {
    entry.status = "Paused";
    flag(entry, "Clock moved backwards");
    return;
  }
  const end = Math.min(now, entry.scheduledEnd);
  if (entry.status === "On break") {
    segment(entry, end, "break");
  } else if (end - entry.lastHeartbeat >= HEARTBEAT_GAP) {
    segment(entry, end, "unverified");
    entry.status = "Paused";
    flag(entry, "Connection or sleep gap");
  } else if (entry.status === "Running") {
    const idleAt = entry.lastActivity + entry.idleMinutes * 60_000;
    segment(entry, Math.min(end, Math.max(entry.cursor, idleAt)), "work");
    if (end >= idleAt) {
      segment(entry, end, "unverified");
      entry.status = "Paused";
      flag(entry, "No recent NexusVA interaction");
    }
  } else segment(entry, end, "unverified");
  if (now >= entry.scheduledEnd) {
    entry.status = "Ended";
    entry.endedAt = entry.scheduledEnd;
    flag(entry, "Automatic scheduled clock-out");
  }
}

export function timeTotals(entry: TimeEntry, now = Date.now()) {
  const settled = structuredClone(entry);
  // A rendered UI clock can lag the latest storage event by one frame.
  // Actual command timestamps still use the strict backwards-clock check above.
  reconcileEntry(settled, Math.max(now, settled.cursor));
  const total = (kind: SegmentKind) =>
    settled.segments
      .filter((s) => s.kind === kind)
      .reduce((sum, s) => sum + s.to - s.from, 0) / 1000;
  const work = total("work"),
    breaks = total("break"),
    unverified = total("unverified");
  const adjustment =
    entry.correction?.state === "Approved" ? entry.correction.seconds : 0;
  return { work, breaks, unverified, adjustment, recorded: work + adjustment };
}

export function entriesForActor(store: TimeStore, actor: Profile) {
  if (actor.status !== "Active") return [];
  if (actor.role === "admin") return store.entries;
  if (actor.role === "staff")
    return store.entries.filter((entry) => entry.staffId === actor.id);
  return [];
}

export function applyTimeAction(
  previous: TimeStore,
  actor: Profile,
  workspace: Workspace,
  action: TimeAction,
  now = Date.now(),
): TimeStore {
  const member = workspace.profiles.find((p) => p.id === actor.id);
  if (
    !member ||
    member.status !== "Active" ||
    member.role !== actor.role ||
    actor.status !== "Active" ||
    !["staff", "admin"].includes(actor.role)
  )
    throw new Error("An active assistant or admin account is required.");
  if (!Number.isFinite(now) || now <= 0)
    throw new Error("Invalid clock reading.");
  const store = structuredClone(previous);
  // An admin observing a stale timer may reconcile it, but does not send a worker's heartbeat.
  const relevant =
    actor.role === "admin"
      ? store.entries
      : store.entries.filter((e) => e.staffId === actor.id);
  for (const entry of relevant) {
    const beforeStatus = entry.status,
      beforeFlags = entry.flags.length;
    const request = workspace.tickets.find(
      (ticket) => ticket.id === entry.ticketId,
    );
    if (
      entry.status === "Running" &&
      (!request ||
        request.assigneeId !== entry.staffId ||
        request.status !== "In progress")
    ) {
      entry.status = "Paused";
      flag(entry, "Request reassigned or no longer in progress");
    }
    reconcileEntry(entry, now);
    if (beforeStatus !== entry.status || beforeFlags !== entry.flags.length)
      log(
        store,
        now,
        "system",
        entry.id,
        `Automatic timer check: ${entry.status}${entry.flags.length ? `; ${entry.flags.at(-1)}` : ""}`,
      );
  }
  const active = store.entries.find(
    (e) => e.staffId === actor.id && e.endedAt === null,
  );
  const requireStaff = () => {
    if (actor.role !== "staff")
      throw new Error("Only assistants can operate their work timer.");
  };
  const ownEntry = (id: string) => {
    const entry = store.entries.find((e) => e.id === id);
    if (!entry || (actor.role !== "admin" && entry.staffId !== actor.id))
      throw new Error("Time entry is not available.");
    return entry;
  };
  const editable = (entry: TimeEntry) => {
    if (entry.review === "Approved")
      throw new Error("Approved entries are locked.");
  };
  switch (action.type) {
    case "heartbeat": {
      if (actor.role === "staff" && active && now >= active.cursor)
        active.lastHeartbeat = now;
      return store;
    }
    case "start": {
      requireStaff();
      if (active)
        throw new Error(
          "Clock out of your current session before starting another.",
        );
      const ticket = workspace.tickets.find((t) => t.id === action.ticketId);
      if (
        !ticket ||
        ticket.assigneeId !== actor.id ||
        ticket.status !== "In progress"
      )
        throw new Error("Choose one of your assigned, in-progress requests.");
      if (
        !Number.isFinite(action.scheduledEnd) ||
        action.scheduledEnd <= now ||
        action.scheduledEnd - now > 12 * 3_600_000
      )
        throw new Error("Set a planned clock-out within the next 12 hours.");
      const id = crypto.randomUUID();
      store.entries.unshift({
        id,
        staffId: actor.id,
        ticketId: ticket.id,
        startedAt: now,
        endedAt: null,
        scheduledEnd: action.scheduledEnd,
        cursor: now,
        lastActivity: now,
        lastHeartbeat: now,
        status: "Running",
        idleMinutes: store.idleMinutes,
        segments: [],
        flags: [],
        note: "",
        review: "Pending",
        reviewNote: "",
        correction: null,
      });
      log(
        store,
        now,
        actor.id,
        id,
        `Clocked in on request #${ticket.number}; planned clock-out ${new Date(action.scheduledEnd).toISOString()}`,
      );
      break;
    }
    case "activity": {
      requireStaff();
      if (active && now >= active.cursor) {
        active.lastActivity = now;
        active.lastHeartbeat = now;
      }
      break;
    }
    case "break": {
      requireStaff();
      if (!active || active.status === "On break")
        throw new Error("No running session is available.");
      active.status = "On break";
      log(store, now, actor.id, active.id, "Started a break");
      break;
    }
    case "resume": {
      requireStaff();
      if (!active || active.status === "Running")
        throw new Error("No paused session is available.");
      if (now < active.cursor)
        throw new Error(
          "The device clock is behind the last saved time. Correct the clock before resuming.",
        );
      const ticket = workspace.tickets.find((t) => t.id === active.ticketId);
      if (
        !ticket ||
        ticket.assigneeId !== actor.id ||
        ticket.status !== "In progress"
      )
        throw new Error(
          "This request is no longer assigned and in progress. Clock out of this session.",
        );
      active.status = "Running";
      active.lastActivity = now;
      active.lastHeartbeat = now;
      log(
        store,
        now,
        actor.id,
        active.id,
        "Resumed work; earlier uncertain time remains flagged",
      );
      break;
    }
    case "offline": {
      requireStaff();
      if (active && active.status !== "On break") {
        active.status = "Paused";
        flag(active, "Offline period");
        log(
          store,
          now,
          actor.id,
          active.id,
          "Paused after connection was lost",
        );
      }
      break;
    }
    case "stop": {
      requireStaff();
      if (!active) throw new Error("You are already clocked out.");
      if (now < active.cursor)
        throw new Error("Correct the device clock before clocking out.");
      active.endedAt = now;
      active.status = "Ended";
      active.note = action.note.trim().slice(0, 2000);
      log(
        store,
        now,
        actor.id,
        active.id,
        "Clocked out; time entry saved for review",
      );
      break;
    }
    case "note": {
      requireStaff();
      const entry = ownEntry(action.entryId);
      editable(entry);
      if (!action.note.trim())
        throw new Error("Add a work summary before saving.");
      entry.note = action.note.trim().slice(0, 2000);
      if (entry.review === "Changes requested") entry.review = "Pending";
      log(store, now, actor.id, entry.id, `Saved work summary: ${entry.note}`);
      break;
    }
    case "correction": {
      if (actor.role !== "admin")
        throw new Error("Admin access is required to manage corrections.");
      const entry = ownEntry(action.entryId);
      editable(entry);
      if (!entry.endedAt)
        throw new Error("Clock out before adding a correction.");
      if (entry.correction && entry.correction.state !== "Declined")
        throw new Error(
          "This entry already has a correction awaiting review or approved.",
        );
      if (
        !Number.isFinite(action.seconds) ||
        action.seconds <= 0 ||
        action.seconds > Math.floor(timeTotals(entry, now).unverified)
      )
        throw new Error(
          "The correction must fit within this entry's unverified time.",
        );
      if (action.reason.trim().length < 15)
        throw new Error("Explain the outside work in at least 15 characters.");
      entry.correction = {
        seconds: action.seconds,
        reason: action.reason.trim().slice(0, 2000),
        state: "Pending",
        reviewNote: "",
      };
      entry.review = "Pending";
      log(
        store,
        now,
        actor.id,
        entry.id,
        `Admin added ${action.seconds} seconds correction: ${entry.correction.reason}`,
      );
      break;
    }
    case "reviewCorrection": {
      if (actor.role !== "admin")
        throw new Error("Admin access is required to review corrections.");
      const entry = ownEntry(action.entryId);
      editable(entry);
      if (!entry.correction || entry.correction.state !== "Pending")
        throw new Error("No pending correction is available.");
      if (action.note.trim().length < 5)
        throw new Error("Add a review reason of at least 5 characters.");
      entry.correction.state = action.approve ? "Approved" : "Declined";
      entry.correction.reviewNote = action.note.trim().slice(0, 2000);
      log(
        store,
        now,
        actor.id,
        entry.id,
        `${entry.correction.state} correction: ${entry.correction.reviewNote}`,
      );
      break;
    }
    case "review": {
      if (actor.role !== "admin")
        throw new Error("Admin access is required to review time entries.");
      const entry = ownEntry(action.entryId);
      editable(entry);
      if (entry.endedAt === null)
        throw new Error("Clock out before the entry can be reviewed.");
      if (entry.correction?.state === "Pending")
        throw new Error("Review the pending correction first.");
      if (!entry.note.trim() && action.approve)
        throw new Error(
          "Ask the assistant to add a work summary before approving.",
        );
      if (action.note.trim().length < 5)
        throw new Error("Add a review reason of at least 5 characters.");
      entry.review = action.approve ? "Approved" : "Changes requested";
      entry.reviewNote = action.note.trim().slice(0, 2000);
      log(
        store,
        now,
        actor.id,
        entry.id,
        `${entry.review} time entry: ${entry.reviewNote}`,
      );
      break;
    }
    case "policy": {
      if (actor.role !== "admin")
        throw new Error("Admin access is required to change timer rules.");
      if (![5, 10, 15].includes(action.idleMinutes))
        throw new Error("Choose a 5, 10, or 15 minute idle threshold.");
      store.idleMinutes = action.idleMinutes;
      log(
        store,
        now,
        actor.id,
        null,
        `Idle threshold changed to ${action.idleMinutes} minutes for new sessions`,
      );
      break;
    }
  }
  return store;
}

export function duration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(value / 3600)).padStart(2, "0")}:${String(Math.floor(value / 60) % 60).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
