import type { Document } from "./types";

export type Frequency = "Weekly" | "Monthly" | "Quarterly" | "Yearly";
export interface Agreement {
  status:
    | "Not sent"
    | "Sent"
    | "Awaiting signature"
    | "Returned"
    | "Corrections requested"
    | "Approved";
  revision: number;
  originalId?: string;
  signedId?: string;
  correction?: string;
  approvedAt?: string;
  approvedBy?: string;
}
export interface BillingArrangement {
  id: string;
  kind: "One-time" | "Subscription";
  amount: number;
  frequency?: Frequency;
  method: "Admin-confirmed payment";
  instructions: string;
  configuredAt: string;
  periodStart?: string;
  periodEnd?: string;
  nextBillingDate?: string;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string;
}
export interface RequestWorkflow {
  version: 1;
  reviewedAt?: string;
  existingAssignment?: boolean;
  assignedAt?: string;
  startedAt?: string;
  agreement: Agreement;
  billing?: BillingArrangement;
  events: { id: string; at: string; actorId: string; text: string }[];
}
export type WorkflowCommand =
  | { type: "reviewRequest"; ticketId: string }
  | {
      type: "sendAgreement" | "returnAgreement";
      ticketId: string;
      document: Document;
      acknowledged?: boolean;
    }
  | { type: "readAgreement"; ticketId: string }
  | { type: "approveAgreement"; ticketId: string }
  | { type: "correctAgreement"; ticketId: string; reason: string }
  | {
      type: "setServicePrice";
      ticketId: string;
      amount: number;
      kind: BillingArrangement["kind"];
      frequency?: Frequency;
      instructions: string;
    }
  | {
      type: "submitPayment";
      paymentId: string;
      reference: string;
      accepted: boolean;
    }
  | { type: "confirmPayment"; paymentId: string; reference: string }
  | {
      type: "resolvePayment";
      paymentId: string;
      status: "Failed" | "Cancelled" | "Refunded";
      reason: string;
    }
  | { type: "retryPayment"; paymentId: string }
  | { type: "unsubscribe" | "issueRenewal" | "startWork"; ticketId: string };
