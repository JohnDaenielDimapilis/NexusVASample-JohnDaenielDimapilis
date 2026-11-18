import type { RequestWorkflow, WorkflowCommand } from "./workflow-types";
export type Role =
  | "client"
  | "staff"
  | "admin"
  | "support_reviewer"
  | "privacy_officer"
  | "super_admin";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type TicketStatus = "Open" | "In progress" | "In review" | "Completed";
export type PaymentStatus =
  | "Pending"
  | "Verified"
  | "Awaiting confirmation"
  | "Paid"
  | "Failed"
  | "Refunded"
  | "Cancelled";
export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  company: string;
  bio: string;
  status: string;
  available: boolean;
  autoAssign: boolean;
  skillLevel: Difficulty;
  skills: string[];
}
export interface Ticket {
  workflow?: RequestWorkflow;
  id: string;
  number: number;
  clientId: string;
  assigneeId: string | null;
  title: string;
  description: string;
  category: string;
  budget: number;
  difficulty: Difficulty;
  status: TicketStatus;
  dueDate: string;
  createdAt: string;
  deliveredAt: string | null;
  rating: number | null;
  feedback: string;
}
export interface Message {
  id: string;
  ticketId: string;
  senderId: string;
  text: string;
  createdAt: string;
  system: boolean;
}
export interface Payment {
  billingId?: string;
  reference?: string;
  confirmedBy?: string;
  confirmationReference?: string;
  receiptNumber?: string;
  periodStart?: string;
  periodEnd?: string;
  submittedAt?: string;
  resolutionReason?: string;
  simulated?: boolean;
  id: string;
  ticketId: string;
  amount: number;
  description: string;
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
}
export interface Appointment {
  id: string;
  clientId: string;
  staffId: string;
  title: string;
  start: string;
  end: string;
  notes: string;
  status?: "Scheduled" | "No-show";
}
export interface AppointmentHistory {
  id: string;
  appointmentId: string;
  clientId: string;
  staffId: string;
  title: string;
  originalStart: string;
  originalEnd: string;
  outcome: "Cancelled" | "Rescheduled";
  changedAt: string;
}
export interface Document {
  purpose?: "agreement" | "signed-agreement";
  id: string;
  ownerId: string;
  ticketId: string | null;
  name: string;
  size: number;
  type: string;
  path: string;
  createdAt: string;
  reviewed: boolean;
  isOutput: boolean;
}
export type NotificationTarget = {
  kind: "ticket" | "conversation" | "payment" | "appointment" | "document";
  id: string;
};
export interface Notification {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  read: boolean;
  target?: NotificationTarget | null;
  dismissed?: boolean;
}
export interface Audit {
  id: string;
  actorId: string;
  ticketId: string | null;
  text: string;
  createdAt: string;
}
export interface Workspace {
  profiles: Profile[];
  tickets: Ticket[];
  messages: Message[];
  payments: Payment[];
  appointments: Appointment[];
  appointmentHistory?: AppointmentHistory[];
  documents: Document[];
  notifications: Notification[];
  audit: Audit[];
}
export type Command =
  | WorkflowCommand
  | {
      type: "createTicket";
      title: string;
      description: string;
      category: string;
      budget: number;
      difficulty: Difficulty;
      dueDate: string;
    }
  | { type: "acceptTicket"; ticketId: string }
  | { type: "assignTicket"; ticketId: string; staffId: string }
  | { type: "sendMessage"; ticketId: string; text: string }
  | {
      type: "createPayment";
      ticketId: string;
      amount: number;
      description: string;
    }
  | { type: "verifyPayment"; paymentId: string }
  | { type: "pay"; paymentId: string }
  | { type: "deliver"; ticketId: string }
  | { type: "closeTicket"; ticketId: string; rating: number; feedback: string }
  | {
      type: "saveProfile";
      name: string;
      company: string;
      bio: string;
      available: boolean;
      autoAssign: boolean;
      skillLevel: Difficulty;
      skills: string[];
    }
  | {
      type: "createAppointment";
      title: string;
      staffId: string;
      start: string;
      end: string;
      notes: string;
    }
  | { type: "cancelAppointment"; appointmentId: string }
  | {
      type: "editAppointment";
      appointmentId: string;
      title: string;
      notes: string;
    }
  | {
      type: "rescheduleAppointment";
      appointmentId: string;
      start: string;
      end: string;
    }
  | { type: "markNoShow"; appointmentId: string }
  | { type: "addDocument"; document: Document }
  | { type: "reviewDocument"; documentId: string }
  | { type: "readNotifications"; notificationIds?: string[] }
  | { type: "setNotificationRead"; notificationId: string; read: boolean }
  | { type: "dismissNotification"; notificationId: string; dismissed: boolean };
export const categories = [
  "Administrative support",
  "Content & marketing",
  "Design & creative",
  "Customer support",
  "Research & data",
  "Web & technology",
];
export const difficulties: Difficulty[] = ["Easy", "Medium", "Hard"];
export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
export const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export function paymentSummary(state: Workspace, ticketId: string) {
  const b = state.tickets.find((t) => t.id === ticketId)?.workflow?.billing;
  const rows = state.payments.filter(
    (p) => p.ticketId === ticketId && (!b || p.billingId === b.id),
  );
  if (b) {
    const latest = [...rows].sort((a, c) =>
      c.createdAt.localeCompare(a.createdAt),
    )[0];
    if (
      latest?.status === "Paid" &&
      b.kind === "Subscription" &&
      b.periodEnd &&
      +new Date(b.periodEnd) <= Date.now()
    )
      return b.cancelledAt ? "Cancelled" : "Past due";
    return latest?.status || "Pending";
  }
  const active = rows.filter((p) => p.status !== "Cancelled");
  return active.length && active.every((p) => p.status === "Paid")
    ? "Paid"
    : rows.some((p) => p.status === "Verified")
      ? "Verified"
      : "Pending";
}
