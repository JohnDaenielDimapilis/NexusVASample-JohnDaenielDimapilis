import { beforeEach, describe, expect, it } from "vitest";
import { createSeed, demoIds } from "./seed";
import { buildRoleReport, roleReportCsv } from "./role-report";
import { emptyTimeStore } from "./time-engine";
import type { TimeEntry } from "./time-engine";
import type { Profile, Workspace } from "./types";

const range = { start: "2026-11-14", end: "2026-11-14" };
const now = new Date("2026-11-14T13:00:00");
let state: Workspace, client: Profile, staff: Profile;
const stamp = (value: string) => new Date(value).getTime();
beforeEach(() => {
  state = createSeed();
  client = state.profiles.find((p) => p.id === demoIds.client)!;
  staff = state.profiles.find((p) => p.id === demoIds.staff)!;
  const first = {
    ...state.tickets[0],
    id: "mine",
    clientId: client.id,
    assigneeId: staff.id,
    dueDate: range.start,
    status: "In progress" as const,
    deliveredAt: null,
  };
  state.tickets = [
    first,
    {
      ...first,
      id: "completed",
      status: "Completed",
      deliveredAt: "2026-11-13T12:00:00",
    },
    {
      ...first,
      id: "review",
      status: "In review",
      dueDate: "2026-11-13",
      deliveredAt: "2026-11-13T12:00:00",
    },
    { ...first, id: "old", dueDate: "2026-11-12" },
    {
      ...first,
      id: "foreign",
      title: "PRIVATE FOREIGN REQUEST",
      clientId: "other-client",
      assigneeId: "other-va",
    },
    {
      ...first,
      id: "available",
      clientId: "other-client",
      assigneeId: null,
      status: "Open",
    },
  ];
  state.payments = [
    {
      id: "pay-mine",
      ticketId: "mine",
      amount: 100,
      description: "My payment",
      status: "Pending",
      createdAt: "2026-11-14T12:00:00",
      paidAt: null,
    },
    {
      id: "paid",
      ticketId: "mine",
      amount: 200,
      status: "Paid",
      description: "Paid",
      createdAt: "2026-11-14T12:00:00",
      paidAt: "2026-11-14T12:30:00",
    },
    {
      id: "old-payment",
      ticketId: "mine",
      amount: 50,
      status: "Verified",
      description: "Older request",
      createdAt: "2026-11-13T12:00:00",
      paidAt: null,
    },
    {
      id: "closed-payment",
      ticketId: "completed",
      amount: 400,
      status: "Pending",
      description: "Closed request",
      createdAt: "2026-11-14T12:00:00",
      paidAt: null,
    },
    {
      id: "foreign-payment",
      ticketId: "foreign",
      amount: 900,
      status: "Pending",
      description: "PRIVATE FOREIGN PAYMENT",
      createdAt: "2026-11-14T12:00:00",
      paidAt: null,
    },
  ];
  state.appointments = [];
  state.messages = [];
});
describe("Role-scoped dashboard reports", () => {
  it("keeps current actions and assignments visible while historical summary cards are empty", () => {
    const past = { start: "2025-01-01", end: "2025-01-02" };
    const c = buildRoleReport(state, client, emptyTimeStore(), past, now);
    const v = buildRoleReport(state, staff, emptyTimeStore(), past, now);
    expect([
      c.active.length,
      c.delivered.length,
      c.outstanding,
      c.completed.length,
    ]).toEqual([0, 0, 0, 0]);
    expect(c.currentActions.map((a) => a.id)).toContain("review-review");
    expect(c.currentActions.map((a) => a.id)).toContain(
      "payment-closed-payment",
    );
    expect(v.currentActive[0].id).toBe("old");
    expect(v.currentReview.map((t) => t.id)).toEqual(["review"]);
    expect(
      v.currentActive.some((t) => t.id === "foreign" || t.id === "available"),
    ).toBe(false);
  });
  it("uses delivery timestamps independently of request due dates and current completion state", () => {
    state.tickets[1].deliveredAt = "2026-11-14T09:00:00";
    state.tickets[1].dueDate = "2026-11-10";
    const result = buildRoleReport(state, client, emptyTimeStore(), range, now);
    expect(result.delivered.map((t) => t.id)).toEqual(["completed"]);
    expect(result.completed).toEqual([]);
    expect(result.active.map((t) => t.id)).toEqual(["mine"]);
  });
  it("shows the next participant meeting even outside the selected summary dates", () => {
    const a = {
      id: "next",
      clientId: client.id,
      staffId: staff.id,
      title: "Next catch-up",
      start: "2026-11-16T14:00:00",
      end: "2026-11-16T14:30:00",
      notes: "",
    };
    state.appointments = [
      a,
      { ...a, id: "foreign", clientId: "foreign", staffId: "foreign" },
      {
        ...a,
        id: "past",
        start: "2026-11-13T14:00:00",
        end: "2026-11-13T14:30:00",
      },
      { ...a, id: "missed", status: "No-show" },
    ];
    const result = buildRoleReport(state, staff, emptyTimeStore(), range, now);
    expect(result.appointments).toEqual([]);
    expect(result.upcoming.map((a) => a.id)).toEqual(["next"]);
  });
  it("excludes completed work from active counts and available jobs from VA assignments", () => {
    const result = buildRoleReport(state, staff, emptyTimeStore(), range, now);
    expect(result.active.map((t) => t.id)).toEqual(["mine"]);
    expect(result.due.map((t) => t.id)).toEqual(["mine", "completed"]);
    expect(
      result.own.some((t) => t.id === "available" || t.id === "foreign"),
    ).toBe(false);
    expect(result.payments).toEqual([]);
  });
  it("counts only the client's unpaid requests created in period, without reclassifying them as overdue", () => {
    const result = buildRoleReport(state, client, emptyTimeStore(), range, now);
    expect(result.payments.map((p) => p.id)).toEqual([
      "pay-mine",
      "closed-payment",
    ]);
    expect(result.outstanding).toBe(500);
    expect(result.actions.map((a) => a.id)).toEqual([
      "payment-pay-mine",
      "payment-closed-payment",
    ]);
  });
  it("keeps older unpaid requests, delivery reviews and overdue work visible as outside-period alerts", () => {
    const result = buildRoleReport(state, client, emptyTimeStore(), range, now);
    expect(result.outside.map((a) => a.id).sort()).toEqual([
      "overdue-old",
      "payment-old-payment",
      "review-review",
    ]);
    const va = buildRoleReport(state, staff, emptyTimeStore(), range, now);
    expect(va.outside.map((a) => a.id)).toEqual(["overdue-old"]);
    expect(va.outside.some((a) => a.ticket.id === "review")).toBe(false);
  });
  it("does not treat submitted work awaiting review as an overdue delivery", () => {
    const result = buildRoleReport(
      state,
      staff,
      emptyTimeStore(),
      { start: "2026-11-12", end: "2026-11-14" },
      now,
    );
    expect(result.review.map((t) => t.id)).toEqual(["review"]);
    expect(result.overdue.map((t) => t.id)).toEqual(["old"]);
  });
  it("includes both boundary dates, rejects invalid ranges, and yields no stale counts for empty periods", () => {
    const result = buildRoleReport(
      state,
      staff,
      emptyTimeStore(),
      { start: "2026-11-12", end: "2026-11-13" },
      now,
    );
    expect(result.due.map((t) => t.id)).toEqual(["old", "review"]);
    expect(
      buildRoleReport(
        state,
        client,
        emptyTimeStore(),
        { start: "2026-10-01", end: "2026-10-31" },
        now,
      ).active,
    ).toEqual([]);
    expect(() =>
      buildRoleReport(
        state,
        client,
        emptyTimeStore(),
        { start: range.end, end: "2026-11-13" },
        now,
      ),
    ).toThrow();
  });
  it("restricts meetings and conversation previews to the participant and message date", () => {
    const a = {
      id: "meeting",
      clientId: client.id,
      staffId: staff.id,
      title: "My meeting",
      start: "2026-11-14T14:00:00",
      end: "2026-11-14T14:30:00",
      notes: "",
    };
    state.appointments = [
      a,
      { ...a, id: "other", clientId: "foreign", staffId: "foreign" },
      { ...a, id: "tomorrow", start: "2026-11-15T14:00:00" },
    ];
    const m = {
      id: "message",
      ticketId: "mine",
      senderId: client.id,
      text: "My message",
      system: false,
      createdAt: "2026-11-14T10:00:00",
    };
    state.messages = [
      m,
      { ...m, id: "later", text: "Latest", createdAt: "2026-11-14T11:00:00" },
      { ...m, id: "old-message", createdAt: "2026-11-13T11:00:00" },
      { ...m, id: "secret", ticketId: "foreign" },
      { ...m, id: "system", system: true, createdAt: "2026-11-14T12:00:00" },
    ];
    const result = buildRoleReport(state, staff, emptyTimeStore(), range, now);
    expect(result.appointments.map((a) => a.id)).toEqual(["meeting"]);
    expect(result.latestMessages.map((m) => m.id)).toEqual(["later"]);
  });
  it("returns no records for inactive or unrelated roles even with a complete workspace", () => {
    for (const actor of [
      { ...client, status: "Inactive" },
      { ...staff, role: "admin" as const },
      { ...staff, role: "support_reviewer" as const },
    ]) {
      const result = buildRoleReport(
        state,
        actor,
        emptyTimeStore(),
        range,
        now,
      );
      expect([
        result.own.length,
        result.actions.length,
        result.outside.length,
        result.timeRows.length,
      ]).toEqual([0, 0, 0, 0]);
    }
  });
  it("clips overnight work at midnight, keeps breaks and unverified time separate, and excludes corrections", () => {
    const entry: TimeEntry = {
      id: "overnight",
      staffId: staff.id,
      ticketId: "mine",
      startedAt: stamp("2026-11-13T23:50:00"),
      endedAt: stamp("2026-11-14T00:30:00"),
      scheduledEnd: stamp("2026-11-14T00:30:00"),
      cursor: stamp("2026-11-14T00:30:00"),
      lastActivity: 0,
      lastHeartbeat: 0,
      status: "Ended",
      idleMinutes: 5,
      segments: [
        {
          from: stamp("2026-11-13T23:50:00"),
          to: stamp("2026-11-14T00:10:00"),
          kind: "work",
        },
        {
          from: stamp("2026-11-14T00:10:00"),
          to: stamp("2026-11-14T00:20:00"),
          kind: "break",
        },
        {
          from: stamp("2026-11-14T00:20:00"),
          to: stamp("2026-11-14T00:30:00"),
          kind: "unverified",
        },
      ],
      flags: [],
      note: "",
      review: "Pending",
      reviewNote: "",
      correction: {
        seconds: 3600,
        state: "Approved",
        reason: "External work",
        reviewNote: "Approved",
      },
    };
    const store = {
      ...emptyTimeStore(),
      entries: [entry, { ...entry, id: "foreign-time", staffId: "other-va" }],
    };
    const before = JSON.stringify(store);
    const result = buildRoleReport(state, staff, store, range, now);
    expect([
      result.work,
      result.breaks,
      result.unverified,
      result.timeRows.length,
    ]).toEqual([600, 600, 600, 1]);
    expect(buildRoleReport(state, client, store, range, now).timeRows).toEqual(
      [],
    );
    expect(JSON.stringify(store)).toBe(before);
  });
  it("exports only selected participant records and protects spreadsheet formula cells", () => {
    state.tickets[0].title = "=SUM(A1:A2)";
    const result = buildRoleReport(state, client, emptyTimeStore(), range, now);
    const csv = roleReportCsv(result, client);
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).not.toContain("PRIVATE FOREIGN");
    expect(csv).not.toContain('"old-payment"');
    expect(roleReportCsv(result, staff, false)).toContain(
      "Attendance unavailable",
    );
  });
});
