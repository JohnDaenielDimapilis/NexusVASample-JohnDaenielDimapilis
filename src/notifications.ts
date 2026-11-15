import type {
  Command,
  Notification,
  Profile,
  Ticket,
  Workspace,
} from "./types";

export type NotificationCommand = Extract<
  Command,
  { type: "readNotifications" | "setNotificationRead" | "dismissNotification" }
>;
export const isNotificationCommand = (
  command: Command,
): command is NotificationCommand =>
  ["readNotifications", "setNotificationRead", "dismissNotification"].includes(
    command.type,
  );

// Notification state only; all other workspace data is retained by reference.
// Used for the optimistic UI and by the demo command engine after authorization.
export function updateNotifications(
  state: Workspace,
  actorId: string,
  command: NotificationCommand,
): Workspace {
  if (command.type !== "readNotifications") {
    if (
      !state.notifications.some(
        (n) => n.id === command.notificationId && n.userId === actorId,
      )
    )
      throw new Error("Notification not found.");
    if (
      typeof (command.type === "setNotificationRead"
        ? command.read
        : command.dismissed) !== "boolean"
    )
      throw new Error("Choose a valid notification status.");
  } else if (
    command.notificationIds !== undefined &&
    (!Array.isArray(command.notificationIds) ||
      command.notificationIds.some(
        (id) =>
          typeof id !== "string" ||
          !state.notifications.some((n) => n.id === id && n.userId === actorId),
      ))
  )
    throw new Error("Notification not found.");
  return {
    ...state,
    notifications: state.notifications.map((n) => {
      if (n.userId !== actorId) return n;
      if (command.type === "readNotifications")
        return !n.dismissed &&
          (!command.notificationIds || command.notificationIds.includes(n.id))
          ? { ...n, read: true }
          : n;
      if (n.id !== command.notificationId) return n;
      return command.type === "setNotificationRead"
        ? { ...n, read: command.read }
        : { ...n, dismissed: command.dismissed };
    }),
  };
}

export function ownedNotifications(
  notes: Notification[],
  actorId: string,
  dismissed = false,
) {
  const ids = new Set<string>();
  return notes
    .filter((n) => n.userId === actorId && !!n.dismissed === dismissed)
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
    )
    .filter((n) => {
      if (ids.has(n.id)) return false;
      ids.add(n.id);
      return true;
    });
}
export type NotificationDestination =
  | {
      type: "ticket" | "conversation" | "appointment";
      id: string;
      label: string;
    }
  | {
      type: "page";
      page:
        | "Requests"
        | "Messages"
        | "Appointments"
        | "Billing"
        | "Files & documents";
      label: string;
      search?: string;
      available?: boolean;
    }
  | { type: "details"; label: string; reason?: string };
const details = (reason?: string): NotificationDestination => ({
  type: "details",
  label: "View details",
  reason,
});
const unavailable = () =>
  details(
    "The linked item is no longer available to this account. It may have been removed, cancelled or reassigned.",
  );

export function notificationDestination(
  note: Notification,
  state: Workspace,
  actor: Profile,
): NotificationDestination {
  if (note.userId !== actor.id || actor.status !== "Active")
    return unavailable();
  const canTicket = (t: Ticket) =>
    actor.role === "admin" ||
    (actor.role === "client" && t.clientId === actor.id) ||
    (actor.role === "staff" && (t.assigneeId === actor.id || !t.assigneeId));
  const tickets = state.tickets.filter(canTicket);
  const participant = (t: Ticket) =>
    !!t.assigneeId &&
    ((actor.role === "client" && t.clientId === actor.id) ||
      (actor.role === "staff" && t.assigneeId === actor.id));
  const ticketDestination = (
    id: string,
    label = "View request",
  ): NotificationDestination =>
    tickets.some((t) => t.id === id)
      ? { type: "ticket", id, label }
      : unavailable();
  const conversationDestination = (id: string): NotificationDestination =>
    tickets.some((t) => t.id === id && participant(t))
      ? { type: "conversation", id, label: "Open conversation" }
      : unavailable();
  const appointments = state.appointments.filter(
    (a) =>
      (actor.role === "client" && a.clientId === actor.id) ||
      (actor.role === "staff" && a.staffId === actor.id),
  );
  const documents = state.documents.filter(
    (d) =>
      d.ownerId === actor.id ||
      tickets.some((t) => t.id === d.ticketId && participant(t)),
  );
  if (note.target) {
    const { kind, id } = note.target;
    if (typeof id !== "string" || !id.trim()) return unavailable();
    if (kind === "ticket") return ticketDestination(id);
    if (kind === "conversation") return conversationDestination(id);
    if (kind === "payment") {
      const payment = state.payments.find((p) => p.id === id);
      return payment
        ? ticketDestination(payment.ticketId, "View payment details")
        : unavailable();
    }
    if (kind === "appointment")
      return appointments.some((a) => a.id === id)
        ? { type: "appointment", id, label: "View appointment" }
        : unavailable();
    if (kind === "document") {
      const document = documents.find((d) => d.id === id);
      return document
        ? {
            type: "page",
            page: "Files & documents",
            search: document.name,
            label: "View document",
          }
        : unavailable();
    }
    return unavailable();
  }
  // Older records have no IDs. Exact, unique title/name matches are safe;
  // ambiguous records open the relevant list rather than guessing a record.
  const text = note.text.toLocaleLowerCase();
  const matching = tickets.filter((t) =>
    text.includes(t.title.toLocaleLowerCase()),
  );
  if (/message|conversation/i.test(text)) {
    if (matching.length === 1) return conversationDestination(matching[0].id);
    return actor.role === "client" || actor.role === "staff"
      ? { type: "page", page: "Messages", label: "Open messages" }
      : details();
  }
  if (/appointment/i.test(text)) {
    if (actor.role !== "client" && actor.role !== "staff") return unavailable();
    const match = appointments.filter((a) =>
      text.includes(a.title.toLocaleLowerCase()),
    );
    return match.length === 1
      ? { type: "appointment", id: match[0].id, label: "View appointment" }
      : { type: "page", page: "Appointments", label: "Open appointments" };
  }
  if (/payment|invoice/i.test(text))
    return matching.length === 1
      ? ticketDestination(matching[0].id, "View payment details")
      : { type: "page", page: "Billing", label: "Open billing" };
  const docs = documents.filter((d) =>
    text.includes(d.name.toLocaleLowerCase()),
  );
  if (docs.length === 1)
    return {
      type: "page",
      page: "Files & documents",
      search: docs[0].name,
      label: "View document",
    };
  if (matching.length === 1) return ticketDestination(matching[0].id);
  if (/request|delivery|assignment|assigned|review/i.test(text))
    return {
      type: "page",
      page: "Requests",
      label:
        actor.role === "staff" && /available/i.test(text)
          ? "Explore available requests"
          : "Open requests",
      available: actor.role === "staff" && /available/i.test(text),
    };
  return details();
}
