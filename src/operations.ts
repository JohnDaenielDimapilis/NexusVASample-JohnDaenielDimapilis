import type { Difficulty, Profile, Ticket, Workspace } from "./types";

export const workStatuses = [
  "Open",
  "In progress",
  "In review",
  "Completed",
] as const;
export const workFilters = [
  "All work",
  "Overdue",
  "Next 7 days",
  "Unassigned",
  "Client review",
  "Completed",
] as const;
export type WorkFilter = (typeof workFilters)[number];

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isOverdue(ticket: Ticket, today = localDay()) {
  return ticket.status !== "Completed" && ticket.dueDate < today;
}

// Apply the existing participant rules even when called with an unfiltered workspace.
// This is a UI boundary; connected data remains governed by the existing server policies.
export function workForActor(state: Workspace, actor: Profile): Ticket[] {
  if (actor.status !== "Active") return [];
  return state.tickets.filter((ticket) => {
    if (actor.role === "admin") return true;
    if (actor.role === "client") return ticket.clientId === actor.id;
    if (actor.role === "staff") return ticket.assigneeId === actor.id;
    return false;
  });
}

export function matchesWorkFilter(
  ticket: Ticket,
  filter: WorkFilter,
  now = new Date(),
) {
  const today = localDay(now);
  if (filter === "Overdue") return isOverdue(ticket, today);
  if (filter === "Unassigned")
    return !ticket.assigneeId && ticket.status !== "Completed";
  if (filter === "Client review") return ticket.status === "In review";
  if (filter === "Completed") return ticket.status === "Completed";
  if (filter === "Next 7 days") {
    const end = new Date(now);
    end.setDate(end.getDate() + 6);
    return (
      ticket.status !== "Completed" &&
      ticket.dueDate >= today &&
      ticket.dueDate <= localDay(end)
    );
  }
  return true;
}

export function clientAccounts(state: Workspace, actor: Profile) {
  if (actor.role !== "admin" || actor.status !== "Active") return [];
  return state.profiles
    .filter((profile) => profile.role === "client")
    .map((profile) => {
      const tickets = state.tickets.filter(
        (ticket) => ticket.clientId === profile.id,
      );
      const ticketIds = new Set(tickets.map((ticket) => ticket.id));
      const payments = state.payments.filter((payment) =>
        ticketIds.has(payment.ticketId),
      );
      return {
        profile,
        tickets,
        active: tickets.filter((ticket) => ticket.status !== "Completed")
          .length,
        overdue: tickets.filter((ticket) => isOverdue(ticket)).length,
        review: tickets.filter((ticket) => ticket.status === "In review")
          .length,
        unassigned: tickets.filter(
          (ticket) => !ticket.assigneeId && ticket.status !== "Completed",
        ).length,
        outstanding: payments
          .filter((payment) =>
            ["Pending", "Verified", "Awaiting confirmation"].includes(
              payment.status,
            ),
          )
          .reduce((total, payment) => total + payment.amount, 0),
        paid: payments
          .filter((payment) => payment.status === "Paid")
          .reduce((total, payment) => total + payment.amount, 0),
      };
    })
    .sort(
      (a, b) =>
        b.overdue - a.overdue ||
        b.active - a.active ||
        a.profile.name.localeCompare(b.profile.name),
    );
}

export interface RequestTemplate {
  id: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  summary: string;
  deliverables: string[];
  description: string;
}

export const requestTemplates: RequestTemplate[] = [
  {
    id: "admin-setup",
    title: "Inbox and calendar setup",
    category: "Administrative support",
    difficulty: "Medium",
    summary: "Bring order to incoming work and the week ahead.",
    deliverables: [
      "Inbox labels and triage guide",
      "Calendar organization plan",
      "Handover checklist",
    ],
    description:
      "Help organize our inbox and calendar.\n\nDeliverables:\n- Recommend inbox labels, priorities, and response rules.\n- Prepare a calendar organization plan with working hours and meeting buffers.\n- Provide a short handover checklist.\n\nContext to add: current tools, time zone, preferred working hours, and priorities. Use approved access methods; do not include passwords in this brief.",
  },
  {
    id: "social-pack",
    title: "Weekly social media pack",
    category: "Content & marketing",
    difficulty: "Medium",
    summary: "Plan a consistent week of content for your brand.",
    deliverables: [
      "Five post concepts and captions",
      "Posting calendar",
      "Editable creative files",
    ],
    description:
      "Create a weekly social media content pack for our business.\n\nDeliverables:\n- Five post concepts with captions and suggested calls to action.\n- A proposed posting calendar.\n- Editable creative files and export-ready images.\n\nContext to add: platforms, audience, brand guide, campaign goal, and reference posts. Submit drafts for review before anything is published.",
  },
  {
    id: "design-kit",
    title: "Campaign design kit",
    category: "Design & creative",
    difficulty: "Hard",
    summary: "Keep campaign visuals consistent across channels.",
    deliverables: [
      "Three visual concepts",
      "Final assets in agreed sizes",
      "Editable source files",
    ],
    description:
      "Design a visual kit for our upcoming campaign.\n\nDeliverables:\n- Three initial visual concepts for review.\n- Final approved assets in the agreed channel sizes.\n- Organized, editable source files.\n\nContext to add: campaign message, asset sizes, brand colors, fonts, approved images, and reference designs. Confirm the asset list before starting.",
  },
  {
    id: "support-handover",
    title: "Customer support handover",
    category: "Customer support",
    difficulty: "Medium",
    summary: "Give your support team a clear starting point.",
    deliverables: [
      "FAQ and response drafts",
      "Escalation guide",
      "Open-issue handover",
    ],
    description:
      "Prepare a customer support handover for our team.\n\nDeliverables:\n- Draft responses for common customer questions.\n- An escalation guide for issues requiring approval.\n- A summary of open issues and recommended next actions.\n\nContext to add: product information, response tone, support hours, approved policies, and escalation contacts. Use anonymized examples where possible.",
  },
  {
    id: "research-brief",
    title: "Competitor research brief",
    category: "Research & data",
    difficulty: "Medium",
    summary: "Turn competitor information into useful decisions.",
    deliverables: [
      "Five-competitor comparison",
      "Sources and research dates",
      "Findings and recommendations",
    ],
    description:
      "Research five relevant competitors and summarize the findings.\n\nDeliverables:\n- A comparison of offers, public pricing, audiences, and positioning.\n- Source links and the date each source was checked.\n- A concise summary of opportunities, limitations, and recommended next steps.\n\nContext to add: our business, target market, competitors to include, and the decision this research should support.",
  },
  {
    id: "web-update",
    title: "Website content update",
    category: "Web & technology",
    difficulty: "Medium",
    summary: "Prepare a focused update with a reviewable handover.",
    deliverables: [
      "Updates on the agreed pages",
      "Mobile and link checks",
      "Change summary",
    ],
    description:
      "Update the agreed website pages using our approved content.\n\nDeliverables:\n- Implement the supplied copy and image updates in a preview or staging environment.\n- Check the updated pages on mobile and verify their links.\n- Provide a change summary and review link.\n\nContext to add: page URLs, platform, approved copy, image assets, and acceptance criteria. Request approval before publishing changes to the live website.",
  },
];
