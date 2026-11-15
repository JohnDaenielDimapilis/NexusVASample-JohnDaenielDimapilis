import { describe, expect, it } from "vitest";
import { createSeed, demoIds } from "./seed";
import {
  applyTimeAction,
  emptyTimeStore,
  entriesForActor,
  timeTotals,
} from "./time-engine";
import type { TimeAction, TimeStore } from "./time-engine";

const startAt = new Date(2026, 10, 14, 9).getTime();
function fixture() {
  const workspace = createSeed();
  const staff = workspace.profiles.find((p) => p.id === demoIds.staff)!;
  const admin = workspace.profiles.find((p) => p.id === demoIds.admin)!;
  const ticket = workspace.tickets.find(
    (t) => t.status === "In progress" && t.assigneeId === staff.id,
  )!;
  const act = (
    store: TimeStore,
    action: TimeAction,
    seconds: number,
    actor = staff,
  ) =>
    applyTimeAction(store, actor, workspace, action, startAt + seconds * 1000);
  const start = (endSeconds = 3600) =>
    act(
      emptyTimeStore(),
      {
        type: "start",
        ticketId: ticket.id,
        scheduledEnd: startAt + endSeconds * 1000,
      },
      0,
    );
  return { workspace, staff, admin, ticket, act, start };
}

describe("Attendance access and task boundaries", () => {
  it("requires assigned in-progress work, a valid deadline, and only one open timer", () => {
    const { act, start, workspace, ticket } = fixture();
    expect(() =>
      act(
        start(),
        { type: "start", ticketId: ticket.id, scheduledEnd: startAt + 1000 },
        0,
      ),
    ).toThrow("current session");
    expect(() =>
      act(
        emptyTimeStore(),
        {
          type: "start",
          ticketId: workspace.tickets[0].id,
          scheduledEnd: startAt + 1000,
        },
        0,
      ),
    ).toThrow("in-progress");
    expect(() =>
      act(
        emptyTimeStore(),
        {
          type: "start",
          ticketId: ticket.id,
          scheduledEnd: startAt + 13 * 3600_000,
        },
        0,
      ),
    ).toThrow("12 hours");
    expect(() =>
      act(
        emptyTimeStore(),
        { type: "start", ticketId: ticket.id, scheduledEnd: NaN },
        0,
      ),
    ).toThrow("12 hours");
  });
  it("denies client, privacy-role, inactive, and another assistant's entry access", () => {
    const { start, workspace, act } = fixture();
    const store = start();
    for (const role of [
      "client",
      "privacy_officer",
      "support_reviewer",
      "super_admin",
    ] as const) {
      const actor = { ...workspace.profiles[0], role };
      expect(entriesForActor(store, actor)).toEqual([]);
      expect(() =>
        applyTimeAction(
          store,
          actor,
          workspace,
          { type: "heartbeat" },
          startAt + 1000,
        ),
      ).toThrow("active assistant or admin");
    }
    const other = workspace.profiles.find((p) => p.id === demoIds.secondStaff)!;
    expect(entriesForActor(store, other)).toEqual([]);
    expect(() =>
      act(
        store,
        { type: "note", entryId: store.entries[0].id, note: "Forged update" },
        1,
        other,
      ),
    ).toThrow("not available");
    expect(
      entriesForActor(store, { ...workspace.profiles[1], status: "Inactive" }),
    ).toEqual([]);
  });
});

describe("Automatic time accounting", () => {
  it("renders a slightly stale UI clock without falsely pausing or changing saved data", () => {
    const { start, act } = fixture();
    const store = act(start(), { type: "heartbeat" }, 30);
    expect(timeTotals(store.entries[0], startAt + 29_500).work).toBe(30);
    expect(store.entries[0].status).toBe("Running");
    expect(store.entries[0].flags).toEqual([]);
  });
  it("pauses at the idle threshold despite regular heartbeats", () => {
    const { start, act } = fixture();
    let store = start();
    for (let seconds = 30; seconds <= 330; seconds += 30)
      store = act(store, { type: "heartbeat" }, seconds);
    expect(store.entries[0].status).toBe("Paused");
    expect(timeTotals(store.entries[0], startAt + 330_000)).toMatchObject({
      work: 300,
      unverified: 30,
    });
    expect(store.entries[0].flags).toContain("No recent NexusVA interaction");
  });
  it("does not treat admin observation as a worker heartbeat", () => {
    const { start, act, admin } = fixture();
    let store = start();
    for (let seconds = 15; seconds <= 180; seconds += 15)
      store = act(store, { type: "heartbeat" }, seconds, admin);
    expect(store.entries[0].lastHeartbeat).toBe(startAt);
    expect(store.entries[0].status).toBe("Paused");
    expect(timeTotals(store.entries[0], startAt + 180_000).work).toBeLessThan(
      90,
    );
    expect(store.entries[0].flags).toContain("Connection or sleep gap");
  });
  it("keeps long sleep gaps unverified after the user returns", () => {
    const { start, act } = fixture();
    let store = act(start(), { type: "heartbeat" }, 30);
    store = act(store, { type: "activity" }, 630);
    expect(store.entries[0].status).toBe("Paused");
    expect(timeTotals(store.entries[0], startAt + 630_000)).toMatchObject({
      work: 30,
      unverified: 600,
    });
    store = act(store, { type: "resume" }, 631);
    expect(timeTotals(store.entries[0], startAt + 631_000).unverified).toBe(
      601,
    );
  });
  it("excludes deliberate breaks even when no callbacks run during the break", () => {
    const { start, act } = fixture();
    let store = act(start(), { type: "heartbeat" }, 30);
    store = act(store, { type: "break" }, 60);
    store = act(store, { type: "resume" }, 600);
    store = act(
      store,
      { type: "stop", note: "Completed the first video cut." },
      630,
    );
    expect(timeTotals(store.entries[0])).toMatchObject({
      work: 90,
      breaks: 540,
      unverified: 0,
    });
  });
  it("closes at the planned end even after browser sleep", () => {
    const { start, act } = fixture();
    const store = act(start(120), { type: "heartbeat" }, 3600);
    expect(store.entries[0].endedAt).toBe(startAt + 120_000);
    expect(store.entries[0].status).toBe("Ended");
    expect(timeTotals(store.entries[0])).toMatchObject({
      work: 0,
      unverified: 120,
    });
  });
  it("pauses after reassignment and disallows resuming another person's request", () => {
    const { start, act, ticket } = fixture();
    const store = start();
    ticket.assigneeId = demoIds.secondStaff;
    const next = act(store, { type: "heartbeat" }, 15);
    expect(next.entries[0].status).toBe("Paused");
    expect(() => act(next, { type: "resume" }, 20)).toThrow(
      "no longer assigned",
    );
  });
  it("flags a backwards clock without negative or duplicate time", () => {
    const { start, act } = fixture();
    const store = act(start(), { type: "heartbeat" }, 30);
    const next = act(store, { type: "activity" }, 10);
    expect(next.entries[0].status).toBe("Paused");
    expect(next.entries[0].cursor).toBe(startAt + 30_000);
    expect(next.entries[0].flags).toContain("Clock moved backwards");
    expect(() => act(next, { type: "resume" }, 11)).toThrow("device clock");
  });
});

describe("Time review and corrections", () => {
  it("bounds corrections, retains raw segments, and locks approved entries", () => {
    const { start, act, admin } = fixture();
    let store = act(start(), { type: "heartbeat" }, 30);
    store = act(
      store,
      {
        type: "stop",
        note: "Finished a client call outside NexusVA; see request handover.",
      },
      630,
    );
    const id = store.entries[0].id,
      raw = structuredClone(store.entries[0].segments);
    expect(() =>
      act(
        store,
        {
          type: "correction",
          entryId: id,
          seconds: 601,
          reason: "Completed a client call and wrote the handover.",
        },
        631,
        admin,
      ),
    ).toThrow("fit within");
    store = act(
      store,
      {
        type: "correction",
        entryId: id,
        seconds: 300,
        reason: "Completed a client call and wrote the handover.",
      },
      631,
      admin,
    );
    expect(() =>
      act(
        store,
        {
          type: "review",
          entryId: id,
          approve: true,
          note: "Reviewed handover.",
        },
        632,
        admin,
      ),
    ).toThrow("correction first");
    store = act(
      store,
      {
        type: "reviewCorrection",
        entryId: id,
        approve: true,
        note: "Reviewed the call handover.",
      },
      633,
      admin,
    );
    store = act(
      store,
      {
        type: "review",
        entryId: id,
        approve: true,
        note: "Reviewed work and approved the adjustment.",
      },
      634,
      admin,
    );
    expect(store.entries[0].segments).toEqual(raw);
    expect(timeTotals(store.entries[0])).toMatchObject({
      work: 30,
      unverified: 600,
      adjustment: 300,
      recorded: 330,
    });
    expect(() =>
      act(
        store,
        { type: "note", entryId: id, note: "Changed after approval" },
        635,
      ),
    ).toThrow("locked");
    expect(
      store.audit.some((a) => a.text.includes("Approved time entry")),
    ).toBe(true);
  });
  it("requires ended sessions, work summaries, and admin-only review", () => {
    const { start, act, admin } = fixture();
    let store = start();
    const id = store.entries[0].id;
    expect(() =>
      act(
        store,
        { type: "review", entryId: id, approve: true, note: "Looks good." },
        1,
        admin,
      ),
    ).toThrow("Clock out");
    store = act(store, { type: "stop", note: "" }, 20);
    expect(() =>
      act(
        store,
        { type: "review", entryId: id, approve: true, note: "Looks good." },
        21,
      ),
    ).toThrow("Admin access");
    expect(() =>
      act(
        store,
        { type: "review", entryId: id, approve: true, note: "Looks good." },
        21,
        admin,
      ),
    ).toThrow("work summary");
  });
  it("audits policy changes without changing existing sessions", () => {
    const { start, act, admin } = fixture();
    const store = act(start(), { type: "policy", idleMinutes: 10 }, 10, admin);
    expect(store.idleMinutes).toBe(10);
    expect(store.entries[0].idleMinutes).toBe(5);
    expect(() =>
      act(store, { type: "policy", idleMinutes: 0 }, 11, admin),
    ).toThrow("5, 10, or 15");
    expect(() => act(store, { type: "policy", idleMinutes: 10 }, 11)).toThrow(
      "Admin access",
    );
  });
});

describe("Admin-only attendance management", () => {
  it("denies direct correction, verification and policy commands from every non-admin role", () => {
    const { start, act, workspace, staff, admin } = fixture();
    let store = act(
      start(),
      { type: "stop", note: "Handover linked to the completed client call." },
      630,
    );
    const id = store.entries[0].id;
    const before = structuredClone(store);
    const actions: TimeAction[] = [
      {
        type: "correction",
        entryId: id,
        seconds: 60,
        reason: "Evidence checked against client call handover.",
      },
      {
        type: "reviewCorrection",
        entryId: id,
        approve: true,
        note: "Evidence reviewed.",
      },
      {
        type: "review",
        entryId: id,
        approve: true,
        note: "Evidence reviewed.",
      },
      { type: "policy", idleMinutes: 10 },
    ];
    for (const actor of workspace.profiles.filter((p) => p.role !== "admin")) {
      for (const action of actions)
        expect(() => act(store, action, 631, actor)).toThrow();
    }
    expect(() =>
      act(store, actions[0], 631, { ...staff, role: "admin" }),
    ).toThrow();
    expect(store).toEqual(before);
    store = act(store, actions[0], 631, admin);
    expect(store.entries[0].correction?.state).toBe("Pending");
    expect(store.audit[0].actorId).toBe(admin.id);
  });
});
