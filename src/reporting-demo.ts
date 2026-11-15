import { createSeed, demoIds } from "./seed";
import { localDay } from "./operations";
import type { Ticket, Workspace } from "./types";

// A fresh demo gets dates across three months so filters have meaningful records.
// Saved workspaces are never reset or enriched automatically.
export function createReportingDemo(now = new Date()): Workspace {
  const state = createSeed();
  const at = (offset: number, hour = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const day = (offset: number) => localDay(new Date(at(offset)));
  const clients = [
    {
      ...state.profiles[0],
      id: "55555555-5555-4555-8555-555555555555",
      name: "Jamie Santos",
      company: "Brightwell Co.",
      email: "jamie@demo.nexusva.test",
    },
    {
      ...state.profiles[0],
      id: "66666666-6666-4666-8666-666666666666",
      name: "Taylor Reed",
      company: "Northstar Co.",
      email: "taylor@demo.nexusva.test",
    },
  ];
  state.profiles.push(...clients);
  const clientIds = [demoIds.client, ...clients.map((c) => c.id)];
  const offsets = [
    -1, 2, -2, -7, -5, -8, -11, -15, -19, -23, -27, -31, -35, -39, -43, -47,
    -51, -57, -63, -69, -75, -81, -87,
  ];
  const titles = [
    "Campaign landing page",
    "Monthly research brief",
    "Customer onboarding kit",
    "Inbox process update",
    "Social content calendar",
    "Brand asset handover",
  ];
  offsets.forEach((offset, i) => {
    const id = `report-demo-${i}`;
    const completed = i >= 4;
    const status: Ticket["status"] = completed
      ? "Completed"
      : i === 1
        ? "Open"
        : i === 2
          ? "In review"
          : "In progress";
    const ticket: Ticket = {
      id,
      number: 2000 + i,
      clientId: clientIds[i % 3],
      assigneeId: i === 1 ? null : i % 2 ? demoIds.secondStaff : demoIds.staff,
      title: `${titles[i % titles.length]} · ${new Date(at(offset)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      description:
        "Illustrative reporting sample. Review the brief, deliver the agreed output and request client acceptance.",
      category: i % 2 ? "Research & data" : "Content & marketing",
      budget: 180 + (i % 6) * 65,
      difficulty: "Medium",
      status,
      dueDate: day(offset),
      createdAt: at(offset - 6),
      deliveredAt: completed
        ? at(offset + (i % 4 === 0 ? 1 : -1), 15)
        : i === 2
          ? at(-4, 14)
          : null,
      rating: completed ? 5 : null,
      feedback: completed
        ? "Sample client acceptance for reporting demonstration."
        : "",
    };
    state.tickets.push(ticket);
    if (i !== 1)
      state.payments.push({
        id: `report-payment-${i}`,
        ticketId: id,
        amount: ticket.budget,
        description: ticket.title,
        status: completed || i === 2 ? "Paid" : "Verified",
        createdAt: at(offset - 5),
        paidAt: completed || i === 2 ? at(offset - 3) : null,
      });
  });
  return state;
}
