import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { applyCommand } from "./domain";
import { createSeed, demoIds } from "./seed";
import {
  billingStatus,
  canAssign,
  endOfPeriod,
  hasPaidAccess,
  requestStage,
  visibleWorkspace,
} from "./workflow";
import type { Command, Document, Workspace } from "./types";

let s: Workspace, tid: string;
const act = (who: keyof typeof demoIds, c: Command) => {
  s = applyCommand(s, demoIds[who], c);
};
const ticket = () => s.tickets.find((t) => t.id === tid)!;
const invoice = () => s.payments.find((p) => p.ticketId === tid)!;
const pdf = (who: "client" | "admin", name = "agreement.pdf"): Document => {
  const id = crypto.randomUUID();
  return {
    id,
    ownerId: demoIds[who],
    ticketId: tid,
    name,
    size: 100,
    type: "application/pdf",
    path: `${demoIds[who]}/${id}/${name}`,
    createdAt: "",
    reviewed: false,
    isOutput: false,
  };
};
function approve() {
  act("admin", { type: "reviewRequest", ticketId: tid });
  act("admin", {
    type: "sendAgreement",
    ticketId: tid,
    document: pdf("admin"),
  });
  act("client", {
    type: "returnAgreement",
    ticketId: tid,
    document: pdf("client"),
    acknowledged: true,
  });
  act("admin", { type: "approveAgreement", ticketId: tid });
}
function price(subscription = false) {
  act("admin", {
    type: "setServicePrice",
    ticketId: tid,
    amount: 125.5,
    kind: subscription ? "Subscription" : "One-time",
    frequency: "Monthly",
    instructions: "Demo manual payment instructions",
  });
}
function pay(reference = "independent-txn-123") {
  act("client", {
    type: "submitPayment",
    paymentId: invoice().id,
    reference: "client-ref-123",
    accepted: true,
  });
  act("admin", { type: "confirmPayment", paymentId: invoice().id, reference });
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T06:00:00Z"));
  s = createSeed();
  act("client", {
    type: "createTicket",
    title: "New service request",
    description: "Prepare a clear service request and review workflow.",
    category: "Content & marketing",
    budget: 200,
    difficulty: "Medium",
    dueDate: "2099-01-01",
  });
  tid = s.tickets[0].id;
});
afterEach(() => vi.useRealTimers());
describe("Admin-controlled request lifecycle", () => {
  it("submits to Admin only without creating an invoice or exposing the request to VAs", () => {
    expect(requestStage(s, ticket())).toBe("Submitted");
    expect(s.payments.filter((p) => p.ticketId === tid)).toHaveLength(0);
    const notices = s.notifications.filter((n) => n.target?.id === tid);
    expect(notices.map((n) => n.userId)).toEqual([demoIds.admin]);
    expect(
      visibleWorkspace(
        s,
        s.profiles.find((p) => p.id === demoIds.staff)!,
      ).tickets.some((t) => t.id === tid),
    ).toBe(false);
  });
  it("requires review, returned signature, approval and payment in that order", () => {
    expect(() => price()).toThrow("approve");
    expect(() =>
      act("admin", {
        type: "sendAgreement",
        ticketId: tid,
        document: pdf("admin"),
      }),
    ).toThrow("Review");
    expect(() =>
      act("admin", { type: "approveAgreement", ticketId: tid }),
    ).toThrow("returned");
    expect(() =>
      act("admin", {
        type: "assignTicket",
        ticketId: tid,
        staffId: demoIds.staff,
      }),
    ).toThrow("approved");
    approve();
    expect(ticket().workflow?.agreement.approvedBy).toBe(demoIds.admin);
    expect(requestStage(s, ticket())).toBe("Agreement approved");
    price();
    expect(requestStage(s, ticket())).toBe("Awaiting payment");
    expect(() =>
      act("admin", {
        type: "assignTicket",
        ticketId: tid,
        staffId: demoIds.staff,
      }),
    ).toThrow("payment");
  });
  it("supports correction and revised signed upload without auto-approving either file", () => {
    act("admin", { type: "reviewRequest", ticketId: tid });
    act("admin", {
      type: "sendAgreement",
      ticketId: tid,
      document: pdf("admin"),
    });
    expect(ticket().workflow?.agreement.status).toBe("Sent");
    act("client", { type: "readAgreement", ticketId: tid });
    expect(requestStage(s, ticket())).toBe("Awaiting client signature");
    expect(() =>
      act("client", {
        type: "returnAgreement",
        ticketId: tid,
        document: pdf("client"),
        acknowledged: false,
      }),
    ).toThrow("confirm");
    act("client", {
      type: "returnAgreement",
      ticketId: tid,
      document: pdf("client"),
      acknowledged: true,
    });
    act("admin", {
      type: "correctAgreement",
      ticketId: tid,
      reason: "Please sign the final page.",
    });
    expect(() => price()).toThrow("approve");
    act("client", {
      type: "returnAgreement",
      ticketId: tid,
      document: pdf("client", "revised.pdf"),
      acknowledged: true,
    });
    expect(ticket().workflow?.agreement.status).toBe("Returned");
    act("admin", { type: "approveAgreement", ticketId: tid });
    expect(s.documents.filter((d) => d.ticketId === tid)).toHaveLength(3);
  });
  it("invalidates an older returned signature when Admin sends a new revision", () => {
    act("admin", { type: "reviewRequest", ticketId: tid });
    act("admin", {
      type: "sendAgreement",
      ticketId: tid,
      document: pdf("admin"),
    });
    act("client", {
      type: "returnAgreement",
      ticketId: tid,
      document: pdf("client"),
      acknowledged: true,
    });
    act("admin", {
      type: "sendAgreement",
      ticketId: tid,
      document: pdf("admin", "new-terms.pdf"),
    });
    expect(ticket().workflow?.agreement.signedId).toBeUndefined();
    expect(ticket().workflow?.agreement.revision).toBe(2);
    expect(() =>
      act("admin", { type: "approveAgreement", ticketId: tid }),
    ).toThrow("returned");
  });
  it("blocks all old client-paid, VA acceptance and VA billing commands", () => {
    for (const who of ["client", "staff", "secondStaff"] as const) {
      expect(() => act(who, { type: "acceptTicket", ticketId: tid })).toThrow(
        "Only Admin",
      );
      expect(() =>
        act(who, { type: "pay", paymentId: s.payments[0].id }),
      ).toThrow("Admin");
      expect(() =>
        act(who, { type: "verifyPayment", paymentId: s.payments[0].id }),
      ).toThrow("Admin");
      expect(() =>
        act(who, {
          type: "assignTicket",
          ticketId: tid,
          staffId: demoIds.staff,
        }),
      ).toThrow("Admin");
    }
  });
  it("rejects invalid or cross-request agreement metadata and regular-upload bypasses", () => {
    act("admin", { type: "reviewRequest", ticketId: tid });
    for (const change of [
      { name: "bad.txt" },
      { size: 0 },
      { type: "text/html" },
      { path: "other/file.pdf" },
      { ownerId: demoIds.client },
      { ticketId: s.tickets[1].id },
      { isOutput: true },
    ])
      expect(() =>
        act("admin", {
          type: "sendAgreement",
          ticketId: tid,
          document: { ...pdf("admin"), ...change },
        }),
      ).toThrow("PDF");
    expect(() =>
      act("client", {
        type: "addDocument",
        document: { ...pdf("client"), purpose: "signed-agreement" },
      }),
    ).toThrow("agreement upload");
  });
  it("does not let a client mark an agreement approved, confirm payment, or change price", () => {
    approve();
    price();
    for (const c of [
      { type: "approveAgreement", ticketId: tid },
      { type: "confirmPayment", paymentId: invoice().id, reference: "forged" },
      {
        type: "setServicePrice",
        ticketId: tid,
        amount: 1,
        kind: "One-time",
        instructions: "Forged instructions",
      },
    ] as Command[])
      expect(() => act("client", c)).toThrow("Admin");
  });
  it("requires a submitted payment and Admin confirmation; never auto-assigns", () => {
    approve();
    price();
    expect(() =>
      act("admin", {
        type: "confirmPayment",
        paymentId: invoice().id,
        reference: "txn-123",
      }),
    ).toThrow("submitted");
    act("client", {
      type: "submitPayment",
      paymentId: invoice().id,
      reference: "client-ref",
      accepted: true,
    });
    expect(invoice().status).toBe("Awaiting confirmation");
    expect(canAssign(s, ticket())).toBe(false);
    act("admin", {
      type: "confirmPayment",
      paymentId: invoice().id,
      reference: "txn-123",
    });
    expect(invoice().receiptNumber).toBeTruthy();
    expect(ticket().assigneeId).toBeNull();
    expect(requestStage(s, ticket())).toBe("Paid");
    expect(() =>
      act("admin", {
        type: "confirmPayment",
        paymentId: invoice().id,
        reference: "txn-123",
      }),
    ).toThrow("submitted");
    expect(() => price()).toThrow("locked");
  });
  it("prevents duplicate transaction references across invoices, including refunded records", () => {
    approve();
    price();
    s.payments[1].confirmationReference = "Used-Reference";
    act("client", {
      type: "submitPayment",
      paymentId: invoice().id,
      reference: "client-ref",
      accepted: true,
    });
    expect(() =>
      act("admin", {
        type: "confirmPayment",
        paymentId: invoice().id,
        reference: " used-reference ",
      }),
    ).toThrow("already");
    expect(invoice().status).toBe("Awaiting confirmation");
  });
  it("supports failed payments, retries, cancellation and refunds without duplicating invoices", () => {
    approve();
    price();
    const id = invoice().id;
    act("admin", {
      type: "resolvePayment",
      paymentId: id,
      status: "Failed",
      reason: "Transfer was rejected",
    });
    expect(canAssign(s, ticket())).toBe(false);
    act("client", { type: "retryPayment", paymentId: id });
    pay();
    expect(invoice().id).toBe(id);
    act("admin", {
      type: "resolvePayment",
      paymentId: id,
      status: "Refunded",
      reason: "External refund transaction R123",
    });
    expect(hasPaidAccess(s, ticket())).toBe(false);
    expect(() =>
      act("client", { type: "retryPayment", paymentId: id }),
    ).toThrow("cannot");
  });
  it("assigns only once, opens a participant-only conversation, and retains the delivery flow", () => {
    approve();
    price();
    pay();
    act("admin", {
      type: "assignTicket",
      ticketId: tid,
      staffId: demoIds.staff,
    });
    expect(requestStage(s, ticket())).toBe("Assigned to VA");
    expect(s.messages.some((m) => m.ticketId === tid && m.system)).toBe(true);
    expect(() =>
      act("admin", {
        type: "assignTicket",
        ticketId: tid,
        staffId: demoIds.secondStaff,
      }),
    ).toThrow("already");
    expect(() =>
      act("secondStaff", {
        type: "sendMessage",
        ticketId: tid,
        text: "Unrelated message",
      }),
    ).toThrow("participant");
    expect(() =>
      act("admin", {
        type: "sendMessage",
        ticketId: tid,
        text: "Unapproved access",
      }),
    ).toThrow("participant");
    act("staff", { type: "startWork", ticketId: tid });
    expect(requestStage(s, ticket())).toBe("In progress");
    act("staff", {
      type: "sendMessage",
      ticketId: tid,
      text: "Starting your approved service.",
    });
    expect(() => act("staff", { type: "deliver", ticketId: tid })).toThrow(
      "Upload",
    );
    act("staff", {
      type: "addDocument",
      document: {
        ...pdf("client"),
        ownerId: demoIds.staff,
        name: "output.txt",
        type: "text/plain",
        path: "output.txt",
        isOutput: true,
      },
    });
    act("staff", { type: "deliver", ticketId: tid });
    expect(requestStage(s, ticket())).toBe("Awaiting client review");
    act("client", {
      type: "closeTicket",
      ticketId: tid,
      rating: 5,
      feedback: "Thanks",
    });
    expect(requestStage(s, ticket())).toBe("Completed");
  });
  it("restricts agreement, payment, file and conversation reads per role", () => {
    approve();
    price();
    pay();
    act("admin", {
      type: "assignTicket",
      ticketId: tid,
      staffId: demoIds.staff,
    });
    for (const who of ["client", "admin", "staff"] as const) {
      const visible = visibleWorkspace(
        s,
        s.profiles.find((p) => p.id === demoIds[who])!,
      );
      expect(
        visible.documents.some((d) => d.ticketId === tid && d.purpose),
      ).toBe(true);
      expect(visible.payments.some((p) => p.ticketId === tid)).toBe(true);
      if (who === "admin") expect(visible.messages).toHaveLength(0);
    }
    const visible = visibleWorkspace(
      s,
      s.profiles.find((p) => p.id === demoIds.secondStaff)!,
    );
    expect(visible.tickets.some((t) => t.id === tid)).toBe(false);
    expect(visible.documents.some((d) => d.ticketId === tid)).toBe(false);
    expect(visible.payments.some((p) => p.ticketId === tid)).toBe(false);
  });
  it("preserves prior state when an approval fails and rejects suspended users", () => {
    const before = structuredClone(s);
    expect(() =>
      act("admin", { type: "approveAgreement", ticketId: tid }),
    ).toThrow();
    expect(s).toEqual(before);
    s.profiles.find((p) => p.id === demoIds.client)!.status = "Suspended";
    expect(() =>
      act("client", { type: "readAgreement", ticketId: tid }),
    ).toThrow("active");
  });
});
describe("Subscription lifecycle separate from service status", () => {
  it("starts a paid period only on confirmation and cancels renewals while retaining paid access", () => {
    approve();
    price(true);
    expect(billingStatus(ticket())).toBe("Awaiting first payment");
    pay();
    expect(ticket().workflow?.billing?.periodEnd).toBe(
      "2026-12-18T06:00:00.000Z",
    );
    act("client", { type: "unsubscribe", ticketId: tid });
    expect(billingStatus(ticket())).toBe("Ends at paid period");
    expect(hasPaidAccess(s, ticket())).toBe(true);
    expect(ticket().workflow?.billing?.nextBillingDate).toBeUndefined();
    vi.setSystemTime(new Date("2026-12-18T06:00:00Z"));
    expect(hasPaidAccess(s, ticket())).toBe(false);
    expect(billingStatus(ticket())).toBe("Cancelled");
    expect(() => act("admin", { type: "issueRenewal", ticketId: tid })).toThrow(
      "renewal",
    );
  });
  it("cancels before first payment and cannot confirm a cancelled pending invoice", () => {
    approve();
    price(true);
    act("client", {
      type: "submitPayment",
      paymentId: invoice().id,
      reference: "pending-ref",
      accepted: true,
    });
    act("client", { type: "unsubscribe", ticketId: tid });
    expect(invoice().status).toBe("Cancelled");
    expect(billingStatus(ticket())).toBe("Cancelled");
    expect(() =>
      act("admin", {
        type: "confirmPayment",
        paymentId: invoice().id,
        reference: "txn-123",
      }),
    ).toThrow("submitted");
    expect(() =>
      act("client", { type: "retryPayment", paymentId: invoice().id }),
    ).toThrow("cannot");
  });
  it("issues one renewal only when due and does not charge or renew without confirmed payment", () => {
    approve();
    price(true);
    pay();
    expect(() => act("admin", { type: "issueRenewal", ticketId: tid })).toThrow(
      "renewal",
    );
    vi.setSystemTime(new Date("2026-12-19T06:00:00Z"));
    expect(billingStatus(ticket())).toBe("Past due");
    act("admin", { type: "issueRenewal", ticketId: tid });
    expect(invoice().status).toBe("Pending");
    expect(hasPaidAccess(s, ticket())).toBe(false);
    expect(() => act("admin", { type: "issueRenewal", ticketId: tid })).toThrow(
      "renewal",
    );
    pay("renewal-txn-456");
    expect(ticket().workflow?.billing?.periodEnd).toBe(
      "2027-01-19T06:00:00.000Z",
    );
    expect(s.payments.filter((p) => p.ticketId === tid)).toHaveLength(2);
  });
  it("revokes the current paid period on an authorized refund", () => {
    approve();
    price(true);
    pay();
    act("admin", {
      type: "resolvePayment",
      paymentId: invoice().id,
      status: "Refunded",
      reason: "Refund completed externally R999",
    });
    expect(hasPaidAccess(s, ticket())).toBe(false);
    expect(billingStatus(ticket())).toBe("Cancelled");
  });
  it("clamps month-end and leap-day dates consistently", () => {
    expect(endOfPeriod("2028-01-31T10:00:00Z", "Monthly")).toBe(
      "2028-02-29T10:00:00.000Z",
    );
    expect(endOfPeriod("2028-02-29T10:00:00Z", "Yearly")).toBe(
      "2029-02-28T10:00:00.000Z",
    );
  });
});

describe("Existing service transition", () => {
  it("retains the assigned VA and conversation while collecting a new agreement without inferring payment", () => {
    const existing = s.tickets.find(
      (t) =>
        t.assigneeId === demoIds.staff &&
        !t.deliveredAt &&
        t.status !== "Completed",
    )!;
    tid = existing.id;
    const oldMessages = s.messages.filter((m) => m.ticketId === tid);
    approve();
    price();
    expect(ticket().assigneeId).toBe(demoIds.staff);
    expect(ticket().workflow?.existingAssignment).toBe(true);
    expect(hasPaidAccess(s, ticket())).toBe(false);
    expect(() => act("staff", { type: "deliver", ticketId: tid })).toThrow(
      "approved agreement",
    );
    expect(s.messages.filter((m) => m.ticketId === tid)).toEqual(oldMessages);
    pay();
    expect(hasPaidAccess(s, ticket())).toBe(true);
  });
});
