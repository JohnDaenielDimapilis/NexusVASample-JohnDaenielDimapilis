import { describe, expect, it } from "vitest";
import { createSeed, demoIds } from "./seed";
import {
  clientAccounts,
  localDay,
  matchesWorkFilter,
  workForActor,
} from "./operations";
import type { Profile, Ticket } from "./types";

describe("Additive operations access", () => {
  it("keeps other clients' assigned work out of client and assistant boards", () => {
    const state = createSeed();
    const otherClient: Profile = {
      ...state.profiles[0],
      id: "other-client",
      name: "Other client",
    };
    state.profiles.push(otherClient);
    state.tickets.push({
      ...state.tickets[0],
      id: "private-request",
      clientId: otherClient.id,
      assigneeId: demoIds.secondStaff,
    });
    const client = state.profiles.find((p) => p.id === demoIds.client)!;
    const assistant = state.profiles.find((p) => p.id === demoIds.staff)!;
    const admin = state.profiles.find((p) => p.id === demoIds.admin)!;
    expect(
      workForActor(state, client).some((t) => t.id === "private-request"),
    ).toBe(false);
    expect(
      workForActor(state, assistant).some((t) => t.id === "private-request"),
    ).toBe(false);
    expect(
      workForActor(state, admin).some((t) => t.id === "private-request"),
    ).toBe(true);
  });

  it("shows assistants open unassigned work without exposing another assistant's assigned work", () => {
    const state = createSeed();
    const assistant = state.profiles.find((p) => p.id === demoIds.staff)!;
    state.tickets.push({
      ...state.tickets[0],
      id: "available",
      assigneeId: null,
      status: "Open",
    });
    const tickets = workForActor(state, assistant);
    expect(tickets.some((t) => t.id === "available")).toBe(true);
    expect(
      tickets.every(
        (t) =>
          t.assigneeId === assistant.id ||
          (!t.assigneeId && t.status === "Open"),
      ),
    ).toBe(true);
  });

  it("does not grant work or CRM access to privacy roles or inactive accounts", () => {
    const state = createSeed();
    for (const role of [
      "support_reviewer",
      "privacy_officer",
      "super_admin",
    ] as const) {
      const actor = { ...state.profiles[0], role };
      expect(workForActor(state, actor)).toEqual([]);
      expect(clientAccounts(state, actor)).toEqual([]);
    }
    const admin = state.profiles.find((p) => p.id === demoIds.admin)!;
    expect(workForActor(state, { ...admin, status: "Inactive" })).toEqual([]);
    expect(clientAccounts(state, { ...admin, status: "Inactive" })).toEqual([]);
  });

  it("returns client payment totals only to admins, joined through that client's requests", () => {
    const state = createSeed();
    state.payments = [
      {
        id: "paid",
        ticketId: state.tickets[0].id,
        amount: 100,
        description: "Test",
        status: "Paid",
        createdAt: "2026-11-14",
        paidAt: "2026-11-14",
      },
      {
        id: "pending",
        ticketId: state.tickets[0].id,
        amount: 50,
        description: "Test",
        status: "Pending",
        createdAt: "2026-11-14",
        paidAt: null,
      },
      {
        id: "verified",
        ticketId: state.tickets[0].id,
        amount: 30,
        description: "Test",
        status: "Verified",
        createdAt: "2026-11-14",
        paidAt: null,
      },
      {
        id: "unrelated",
        ticketId: "other-request",
        amount: 999,
        description: "Test",
        status: "Paid",
        createdAt: "2026-11-14",
        paidAt: "2026-11-14",
      },
    ];
    const admin = state.profiles.find((p) => p.id === demoIds.admin)!;
    expect(clientAccounts(state, admin)[0]).toMatchObject({
      paid: 100,
      outstanding: 80,
    });
    expect(clientAccounts(state, state.profiles[0])).toEqual([]);
    expect(clientAccounts(state, state.profiles[1])).toEqual([]);
  });
});

describe("Work deadline filters", () => {
  const now = new Date(2026, 10, 14, 23, 59);
  const ticket = (
    dueDate: string,
    status: Ticket["status"] = "In progress",
  ): Ticket => ({ ...createSeed().tickets[0], dueDate, status });
  it("uses local calendar dates and includes today without treating it as overdue", () => {
    expect(localDay(now)).toBe("2026-11-14");
    expect(matchesWorkFilter(ticket("2026-11-14"), "Overdue", now)).toBe(false);
    expect(matchesWorkFilter(ticket("2026-11-13"), "Overdue", now)).toBe(true);
    expect(
      matchesWorkFilter(ticket("2026-11-13", "Completed"), "Overdue", now),
    ).toBe(false);
  });
  it("includes seven calendar dates from today and excludes overdue and completed work", () => {
    expect(matchesWorkFilter(ticket("2026-11-14"), "Next 7 days", now)).toBe(
      true,
    );
    expect(matchesWorkFilter(ticket("2026-11-20"), "Next 7 days", now)).toBe(
      true,
    );
    expect(matchesWorkFilter(ticket("2026-11-21"), "Next 7 days", now)).toBe(
      false,
    );
    expect(matchesWorkFilter(ticket("2026-11-13"), "Next 7 days", now)).toBe(
      false,
    );
    expect(
      matchesWorkFilter(ticket("2026-11-15", "Completed"), "Next 7 days", now),
    ).toBe(false);
  });
});
