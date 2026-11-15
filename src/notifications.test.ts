import { beforeEach, describe, expect, it } from "vitest";
import { createSeed, demoIds } from "./seed";
import { applyCommand } from "./domain";
import {
  notificationDestination,
  ownedNotifications,
  updateNotifications,
} from "./notifications";
import type { Notification, Profile, Workspace } from "./types";
let state: Workspace, client: Profile, staff: Profile;
const note = (data: Partial<Notification> = {}): Notification => ({
  id: "notice",
  userId: demoIds.client,
  text: "An actual workflow event",
  createdAt: new Date().toISOString(),
  read: false,
  ...data,
});
beforeEach(() => {
  state = createSeed();
  client = state.profiles.find((p) => p.id === demoIds.client)!;
  staff = state.profiles.find((p) => p.id === demoIds.staff)!;
});
describe("Notification navigation", () => {
  it("opens the exact conversation and request by ID even after a title changes", () => {
    const t = state.tickets.find((t) => t.assigneeId === staff.id)!;
    const n = note({ target: { kind: "conversation", id: t.id } });
    t.title = "A completely renamed assignment";
    expect(notificationDestination(n, state, client)).toEqual({
      type: "conversation",
      id: t.id,
      label: "Open conversation",
    });
    expect(
      notificationDestination(
        { ...n, target: { kind: "ticket", id: t.id } },
        state,
        client,
      ).type,
    ).toBe("ticket");
  });
  it("links payment notices to their request details without executing a payment", () => {
    const p = state.payments.find((p) =>
      state.tickets.some(
        (t) => t.id === p.ticketId && t.clientId === client.id,
      ),
    )!;
    const before = structuredClone(state);
    expect(
      notificationDestination(
        note({ target: { kind: "payment", id: p.id } }),
        state,
        client,
      ),
    ).toEqual({
      type: "ticket",
      id: p.ticketId,
      label: "View payment details",
    });
    expect(state).toEqual(before);
  });
  it("opens only participant appointments and accessible file views", () => {
    const a = state.appointments.find((a) => a.clientId === client.id)!;
    expect(
      notificationDestination(
        note({ target: { kind: "appointment", id: a.id } }),
        state,
        client,
      ),
    ).toMatchObject({ type: "appointment", id: a.id });
    const d = state.documents.find((d) => d.ownerId === client.id)!;
    expect(
      notificationDestination(
        note({ target: { kind: "document", id: d.id } }),
        state,
        client,
      ),
    ).toMatchObject({
      type: "page",
      page: "Files & documents",
      search: d.name,
    });
    const admin = state.profiles.find((p) => p.id === demoIds.admin)!;
    expect(
      notificationDestination(
        note({ userId: admin.id, target: { kind: "appointment", id: a.id } }),
        state,
        admin,
      ).type,
    ).toBe("details");
  });
  it("does not guess a missing, private, malformed or reassigned target", () => {
    const t = state.tickets.find((t) => t.assigneeId === staff.id)!;
    t.assigneeId = demoIds.secondStaff;
    expect(
      notificationDestination(
        note({ userId: staff.id, target: { kind: "conversation", id: t.id } }),
        state,
        staff,
      ).type,
    ).toBe("details");
    expect(
      notificationDestination(
        note({ target: { kind: "ticket", id: "missing" } }),
        state,
        client,
      ),
    ).toHaveProperty("reason");
    expect(notificationDestination(note(), state, staff).type).toBe("details");
    expect(
      notificationDestination(
        note({ target: { kind: "url", id: "javascript:alert(1)" } as never }),
        state,
        client,
      ).type,
    ).toBe("details");
  });
  it("supports legacy notifications with safe list fallbacks and case-insensitive unique titles", () => {
    const t = state.tickets.find((t) => t.assigneeId === staff.id)!;
    expect(
      notificationDestination(
        note({ text: `NEW MESSAGE ON ${t.title.toUpperCase()}` }),
        state,
        client,
      ),
    ).toMatchObject({ type: "conversation", id: t.id });
    state.tickets.push({ ...t, id: "duplicate-title" });
    expect(
      notificationDestination(
        note({ text: `New message on ${t.title}` }),
        state,
        client,
      ),
    ).toMatchObject({ type: "page", page: "Messages" });
    expect(
      notificationDestination(
        note({
          userId: staff.id,
          text: "A new research request is available.",
        }),
        state,
        staff,
      ),
    ).toMatchObject({ page: "Requests", available: true });
    expect(
      notificationDestination(note({ text: "Account update" }), state, client),
    ).toMatchObject({ type: "details" });
  });
});
describe("Persisted notification actions", () => {
  it("persists individual read/unread and reversible dismissal without touching other data", () => {
    state.notifications = [note()];
    const before = structuredClone(state);
    state = applyCommand(state, client.id, {
      type: "setNotificationRead",
      notificationId: "notice",
      read: true,
    });
    expect(state.notifications[0].read).toBe(true);
    state = applyCommand(state, client.id, {
      type: "setNotificationRead",
      notificationId: "notice",
      read: false,
    });
    state = applyCommand(state, client.id, {
      type: "dismissNotification",
      notificationId: "notice",
      dismissed: true,
    });
    expect(ownedNotifications(state.notifications, client.id)).toHaveLength(0);
    state = applyCommand(state, client.id, {
      type: "dismissNotification",
      notificationId: "notice",
      dismissed: false,
    });
    expect(state.notifications[0]).toMatchObject({
      read: false,
      dismissed: false,
    });
    expect({ ...state, notifications: [] }).toEqual({
      ...before,
      notifications: [],
    });
  });
  it("keeps bulk read scoped to the clicked snapshot, preserving later arrivals, dismissed and other users", () => {
    state.notifications = [
      note(),
      note({ id: "new-arrival" }),
      note({ id: "hidden", dismissed: true }),
      note({ id: "foreign", userId: staff.id }),
    ];
    state = applyCommand(state, client.id, {
      type: "readNotifications",
      notificationIds: ["notice"],
    });
    expect(state.notifications.map((n) => n.read)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    state = applyCommand(state, client.id, { type: "readNotifications" });
    expect(state.notifications.map((n) => n.read)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
  it("rejects other owners, missing records, invalid booleans and mixed bulk ownership atomically", () => {
    state.notifications = [note(), note({ id: "foreign", userId: staff.id })];
    const before = structuredClone(state);
    for (const action of [
      { type: "setNotificationRead", notificationId: "foreign", read: true },
      {
        type: "dismissNotification",
        notificationId: "missing",
        dismissed: true,
      },
      { type: "readNotifications", notificationIds: ["notice", "foreign"] },
      { type: "setNotificationRead", notificationId: "notice", read: "false" },
    ] as const)
      expect(() => applyCommand(state, client.id, action as never)).toThrow();
    expect(state).toEqual(before);
  });
  it("sorts all notices newest first, deduplicates records and isolates actor/dismissed views", () => {
    const old = note({ createdAt: "2026-01-01" }),
      recent = note({ id: "latest", createdAt: "2026-02-01" });
    expect(
      ownedNotifications(
        [old, recent, old, note({ id: "secret", userId: staff.id })],
        client.id,
      ).map((n) => n.id),
    ).toEqual(["latest", "notice"]);
    expect(
      updateNotifications({ ...state, notifications: [old] }, client.id, {
        type: "setNotificationRead",
        notificationId: old.id,
        read: true,
      }).tickets,
    ).toBe(state.tickets);
  });
  it("creates real message and appointment targets from workflow results", () => {
    const t = state.tickets.find(
      (t) => t.assigneeId === staff.id && t.status !== "Completed",
    )!;
    state = applyCommand(state, staff.id, {
      type: "sendMessage",
      ticketId: t.id,
      text: "Notification integration test",
    });
    expect(state.notifications[0].target).toEqual({
      kind: "conversation",
      id: t.id,
    });
    state = applyCommand(state, client.id, {
      type: "createAppointment",
      title: "Workflow appointment",
      staffId: staff.id,
      start: "2099-02-01T10:00:00Z",
      end: "2099-02-01T10:30:00Z",
      notes: "",
    });
    expect(state.notifications[0].target).toEqual({
      kind: "appointment",
      id: state.appointments.at(-1)!.id,
    });
  });
});
