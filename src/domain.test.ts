import { beforeEach, describe, expect, it } from "vitest";
import { applyCommand } from "./domain";
import { createSeed, demoIds } from "./seed";
import { categories } from "./types";
import type { Command, Workspace } from "./types";
let s: Workspace;
const act = (who: keyof typeof demoIds, c: Command) => {
  s = applyCommand(s, demoIds[who], c);
};
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA");
};
const create = () => {
  act("client", {
    type: "createTicket",
    title: "Build a client onboarding guide",
    description:
      "Create a clear guide for our team to help new clients get started.",
    category: categories[1],
    budget: 125,
    difficulty: "Medium",
    dueDate: tomorrow(),
  });
  return s.tickets[0];
};
beforeEach(() => {
  s = createSeed();
});
describe("Scheduling and data validation", () => {
  it("rejects appointment overlaps, permits adjacent appointments, and enforces cancellation ownership", () => {
    const a = s.appointments[0];
    expect(() =>
      act("client", {
        type: "createAppointment",
        title: "Overlap",
        staffId: a.staffId,
        start: a.start,
        end: a.end,
        notes: "",
      }),
    ).toThrow("overlaps");
    act("client", {
      type: "createAppointment",
      title: "Adjacent call",
      staffId: a.staffId,
      start: a.end,
      end: new Date(+new Date(a.end) + 1800000).toISOString(),
      notes: "",
    });
    const booked = s.appointments.at(-1)!;
    expect(() =>
      act("secondStaff", {
        type: "cancelAppointment",
        appointmentId: booked.id,
      }),
    ).toThrow();
    act("client", { type: "cancelAppointment", appointmentId: booked.id });
    expect(s.appointments.find((a) => a.id === booked.id)).toBeUndefined();
  });
  it("rejects invalid budgets and prevents duplicate outstanding payment requests", () => {
    expect(() =>
      act("client", {
        type: "createTicket",
        title: "A valid title",
        description: "This is a valid description for testing.",
        category: categories[0],
        budget: NaN,
        difficulty: "Easy",
        dueDate: tomorrow(),
      }),
    ).toThrow("budget");
    const t = create();
    expect(() =>
      act("staff", { type: "acceptTicket", ticketId: t.id }),
    ).toThrow("Only Admin");
    expect(() =>
      act("staff", {
        type: "createPayment",
        ticketId: t.id,
        amount: 100,
        description: "Duplicate",
      }),
    ).toThrow("Admin");
  });
  it("keeps the previous state immutable when a mutation fails", () => {
    const previous = structuredClone(s);
    expect(() =>
      act("client", { type: "acceptTicket", ticketId: s.tickets[3].id }),
    ).toThrow();
    expect(s).toEqual(previous);
  });
});
