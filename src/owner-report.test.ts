import { describe, expect, it } from "vitest";
import {
  buildOwnerReport,
  comparison,
  comparisonRange,
  inRange,
  presetRange,
  previousRange,
  rangeError,
  reportCsv,
} from "./owner-report";
import { createSeed } from "./seed";
import { emptyTimeStore } from "./time-engine";
import type { TimeEntry } from "./time-engine";
import { createReportingDemo } from "./reporting-demo";

const now = new Date("2026-11-14T12:00:00");
const range = { start: "2026-11-01", end: "2026-11-14" };
describe("Owner reporting calendar boundaries", () => {
  it("uses Monday for this week and distinguishes full month from month to date", () => {
    expect(presetRange("week", now)).toEqual({
      start: "2026-11-09",
      end: "2026-11-15",
    });
    expect(presetRange("monthToDate", now)).toEqual(range);
    expect(presetRange("month", now)).toEqual({
      start: "2026-11-01",
      end: "2026-11-30",
    });
    expect(presetRange("next7days", now)).toEqual({
      start: "2026-11-14",
      end: "2026-11-20",
    });
    expect(presetRange("today", now)).toEqual({
      start: "2026-11-14",
      end: "2026-11-14",
    });
    expect(presetRange("7days", now)).toEqual({
      start: "2026-11-08",
      end: "2026-11-14",
    });
  });
  it("handles previous months across leap years and year boundaries", () => {
    expect(presetRange("lastMonth", new Date("2024-03-31T12:00:00"))).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    });
    expect(presetRange("lastMonth", new Date("2027-01-01T12:00:00"))).toEqual({
      start: "2026-12-01",
      end: "2026-12-31",
    });
    expect(previousRange(range)).toEqual({
      start: "2026-10-18",
      end: "2026-10-31",
    });
    expect(comparisonRange(presetRange("month", now), "month")).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(comparisonRange(range, "monthToDate")).toEqual({
      start: "2026-10-01",
      end: "2026-10-14",
    });
    expect(
      comparisonRange(
        { start: "2024-03-01", end: "2024-03-31" },
        "monthToDate",
      ),
    ).toEqual({ start: "2024-02-01", end: "2024-02-29" });
  });
  it("includes the whole final local day and excludes adjacent dates", () => {
    expect(inRange("2026-11-14T23:59:59.999", range)).toBe(true);
    expect(inRange("2026-11-15T00:00:00", range)).toBe(false);
    expect(inRange("2026-11-01T00:00:00", range)).toBe(true);
    expect(inRange(null, range)).toBe(false);
    expect(inRange("not-a-date", range)).toBe(false);
  });
  it("rejects invalid, missing and reversed dates", () => {
    expect(rangeError({ start: "2026-02-30", end: "2026-03-01" })).toBeTruthy();
    expect(rangeError({ start: "", end: "2026-03-01" })).toBeTruthy();
    expect(rangeError({ start: "2026-11-15", end: "2026-11-14" })).toContain(
      "on or after",
    );
    expect(rangeError({ start: "2024-02-29", end: "2024-02-29" })).toBe("");
  });
});
describe("Owner report record selection", () => {
  it("selects payments by paid date, outstanding by creation date, and deliveries by submission date", () => {
    const state = createSeed();
    state.tickets = [
      {
        ...state.tickets[0],
        dueDate: "2026-11-10",
        createdAt: "2026-09-01T10:00:00",
        deliveredAt: "2026-11-11T10:00:00",
        status: "Completed",
      },
    ];
    state.payments = [
      {
        ...state.payments[0],
        ticketId: state.tickets[0].id,
        createdAt: "2026-09-01T10:00:00",
        paidAt: "2026-11-14T23:59:59",
        status: "Paid",
        amount: 10.55,
      },
      {
        ...state.payments[0],
        id: "unpaid",
        ticketId: state.tickets[0].id,
        createdAt: "2026-11-02T10:00:00",
        paidAt: null,
        status: "Verified",
        amount: 20.15,
      },
    ];
    const r = buildOwnerReport(state, emptyTimeStore(), range, now);
    expect(r.collected).toBe(10.55);
    expect(r.outstanding).toBe(20.15);
    expect(r.delivered).toHaveLength(1);
    expect(r.onTimeRate).toBe(0);
    expect(r.due).toHaveLength(1);
    expect(r.overdue).toHaveLength(0);
    expect(r.issues[0].reason).toBe("Payment outstanding");
  });
  it("shows no baseline rather than an infinite percentage, and empty delivery rate is unknown", () => {
    const state = createSeed();
    state.tickets = [];
    state.payments = [];
    const r = buildOwnerReport(state, emptyTimeStore(), range, now);
    expect(r.onTimeRate).toBeNull();
    expect(r.clients).toEqual([]);
    expect(comparison(200, 0)).toBe("No previous-period baseline");
    expect(comparison(0, 0)).toContain("No change");
    expect(comparison(110, 100)).toBe("+10.0% vs previous period");
  });
  it("clips an overnight entry to the chosen dates and excludes unallocated corrections", () => {
    const ms = (v: string) => new Date(v).getTime();
    const start = ms("2026-11-13T23:00:00"),
      end = ms("2026-11-14T02:00:00");
    const entry: TimeEntry = {
      id: "overnight",
      staffId: "staff",
      ticketId: "ticket",
      startedAt: start,
      endedAt: end,
      scheduledEnd: end,
      cursor: end,
      lastActivity: end,
      lastHeartbeat: end,
      status: "Ended",
      idleMinutes: 5,
      segments: [{ from: start, to: end, kind: "work" }],
      flags: [],
      note: "",
      review: "Approved",
      reviewNote: "",
      correction: {
        seconds: 600,
        reason: "correction",
        state: "Approved",
        reviewNote: "Approved",
      },
    };
    const store = { ...emptyTimeStore(), entries: [entry] };
    const r = buildOwnerReport(
      createSeed(),
      store,
      { start: "2026-11-14", end: "2026-11-14" },
      now,
    );
    expect(r.attendance.work).toBe(7200);
    expect(r.attendance.rows).toHaveLength(1);
    expect(
      buildOwnerReport(
        createSeed(),
        store,
        { start: "2026-11-15", end: "2026-11-15" },
        now,
      ).attendance.rows,
    ).toHaveLength(0);
  });
  it("keeps CSV records aligned with the report and neutralizes spreadsheet formulas", () => {
    const state = createSeed();
    state.tickets = [
      {
        ...state.tickets[0],
        dueDate: "2026-11-14",
        title: '=HYPERLINK("bad")',
        deliveredAt: null,
      },
    ];
    state.payments = [];
    const r = buildOwnerReport(state, emptyTimeStore(), range, now);
    const csv = reportCsv(r);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('"2026-11-01","2026-11-14"');
    expect(
      csv.split("\r\n").filter((l) => l.startsWith('"request"')),
    ).toHaveLength(r.due.length);
  });
  it("gives different totals for different periods in the multi-month demo", () => {
    const state = createReportingDemo(now),
      store = emptyTimeStore();
    const recent = buildOwnerReport(
      state,
      store,
      presetRange("7days", now),
      now,
    );
    const older = buildOwnerReport(
      state,
      store,
      presetRange("lastMonth", now),
      now,
    );
    const all = buildOwnerReport(state, store, presetRange("90days", now), now);
    expect(recent.collected).not.toBe(older.collected);
    expect(all.paid.length).toBeGreaterThan(recent.paid.length);
    expect(older.delivered.length).toBeGreaterThan(0);
    expect(
      state.tickets.every(
        (t) =>
          !t.deliveredAt ||
          Date.parse(t.createdAt) <= Date.parse(t.deliveredAt),
      ),
    ).toBe(true);
  });
});
