import { useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Clock3,
  Columns3,
  FileText,
  Layers3,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { Avatar, Badge, Empty, SectionHead } from "./components";
import { companyName } from "./brand-config";
import { mode } from "./data";
import { money, paymentSummary } from "./types";
import { requestStage } from "./workflow";
import type { Profile, Ticket, Workspace } from "./types";
import {
  clientAccounts,
  isOverdue,
  matchesWorkFilter,
  requestTemplates,
  workFilters,
  workForActor,
  workStatuses,
} from "./operations";
import type { WorkFilter } from "./operations";
type WorkspaceProps = {
  state: Workspace;
  actor: Profile;
  onOpenTicket: (id: string) => void;
};
const shortDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
const statusLabel = (status: string) =>
  status === "In review" ? "Client review" : status;
const statusClass = (status: string) =>
  status.toLowerCase().replaceAll(" ", "-");
function WorkCard({
  ticket,
  state,
  onOpen,
}: {
  ticket: Ticket;
  state: Workspace;
  onOpen: () => void;
}) {
  const client = state.profiles.find((p) => p.id === ticket.clientId);
  const assistant = state.profiles.find((p) => p.id === ticket.assigneeId);
  return (
    <button
      className="ops-work-card"
      onClick={onOpen}
      aria-label={`Open request #${ticket.number}: ${ticket.title}`}
    >
      <span className="ops-card-reference">
        #{ticket.number}
        <span>{ticket.category}</span>
      </span>
      <strong className="ops-work-title">{ticket.title}</strong>
      <span className="ops-work-client">
        {companyName(client?.company || "") || client?.name || "Client"}
      </span>
      <span className="wf-card-status">
        <Badge>{requestStage(state, ticket)}</Badge>
        <span>
          {ticket.workflow?.agreement.status || "Existing agreement record"} ·{" "}
          {paymentSummary(state, ticket.id)}
        </span>
      </span>
      <span className="ops-card-footer">
        <span className={isOverdue(ticket) ? "ops-due overdue" : "ops-due"}>
          <Clock3 size={13} />
          {isOverdue(ticket) ? "Overdue · " : "Due "}
          {shortDate(ticket.dueDate)}
        </span>
        <span className="ops-budget">{money(ticket.budget)}</span>
      </span>
      <span className="ops-card-assignee">
        {assistant ? (
          <>
            <Avatar name={assistant.name} size="small" />
            <span>{assistant.name}</span>
          </>
        ) : (
          <>
            <span className="ops-unassigned">
              <Users size={13} />
            </span>
            <span>Unassigned</span>
          </>
        )}
        <ArrowUpRight size={15} />
      </span>
    </button>
  );
}
export function WorkBoard({
  state,
  actor,
  onOpenTicket,
  onCreate,
}: WorkspaceProps & { onCreate?: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WorkFilter>("All work");
  const [clientId, setClientId] = useState("");
  const [assignment, setAssignment] = useState("");
  const tickets = workForActor(state, actor);
  const clients = state.profiles.filter(
    (p) => p.role === "client" && tickets.some((t) => t.clientId === p.id),
  );
  const filtered = tickets
    .filter((ticket) => {
      const client = state.profiles.find((p) => p.id === ticket.clientId);
      const assistant = state.profiles.find((p) => p.id === ticket.assigneeId);
      const text = [
        ticket.number,
        ticket.title,
        ticket.category,
        client?.name,
        client?.company,
        assistant?.name,
      ]
        .join(" ")
        .toLowerCase();
      return (
        text.includes(query.trim().toLowerCase()) &&
        matchesWorkFilter(ticket, filter) &&
        (!clientId || ticket.clientId === clientId) &&
        (!assignment ||
          (assignment === "mine"
            ? ticket.assigneeId === actor.id
            : !ticket.assigneeId))
      );
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.number - a.number);
  const hasFilters =
    !!query || filter !== "All work" || !!clientId || !!assignment;
  const reset = () => {
    setQuery("");
    setFilter("All work");
    setClientId("");
    setAssignment("");
  };
  return (
    <div className="ops-page">
      <SectionHead
        title="Work board"
        description={
          actor.role === "admin"
            ? "See the handoffs, deadlines, and people behind every request."
            : actor.role === "staff"
              ? "Your Admin-assigned services, agreements, payments and delivery details."
              : "Follow your requests from the first brief to the final delivery."
        }
        action={
          onCreate && (
            <button className="button primary" onClick={onCreate}>
              <Plus size={16} />
              New request
            </button>
          )
        }
      />
      <div className="ops-summary" aria-label="Workspace work summary">
        <div>
          <BriefcaseBusiness size={18} />
          <span>
            <strong>
              {tickets.filter((t) => t.status !== "Completed").length}
            </strong>
            Active requests
          </span>
        </div>
        <div>
          <Clock3 size={18} />
          <span>
            <strong>{tickets.filter((t) => isOverdue(t)).length}</strong>Overdue
          </span>
        </div>
        <div>
          <FileText size={18} />
          <span>
            <strong>
              {tickets.filter((t) => t.status === "In review").length}
            </strong>
            With client for review
          </span>
        </div>
        <div>
          <Check size={18} />
          <span>
            <strong>
              {tickets.filter((t) => t.status === "Completed").length}
            </strong>
            Completed
          </span>
        </div>
      </div>
      <div className="ops-toolbar" role="search" aria-label="Filter work board">
        <label className="ops-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search work board"
            placeholder="Search requests, clients, or assistants"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="ops-select">
          <span>Show</span>
          <select
            aria-label="Work filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as WorkFilter)}
          >
            {workFilters.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        {actor.role === "admin" && (
          <label className="ops-select">
            <span>Client</span>
            <select
              aria-label="Filter by client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">All clients</option>
              {clients.map((p) => (
                <option key={p.id} value={p.id}>
                  {companyName(p.company) || p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {actor.role === "staff" && (
          <label className="ops-select">
            <span>Assignment</span>
            <select
              aria-label="Filter by assignment"
              value={assignment}
              onChange={(e) => setAssignment(e.target.value)}
            >
              <option value="">All visible requests</option>
              <option value="mine">Assigned to me</option>
            </select>
          </label>
        )}
        {hasFilters && (
          <button className="text-button ops-reset" onClick={reset}>
            <X size={14} />
            Reset filters
          </button>
        )}
      </div>
      <div className="ops-board-caption">
        <span>
          {filtered.length} {filtered.length === 1 ? "request" : "requests"}
          {hasFilters ? " matching your filters" : " in view"}
        </span>
        <span>Open a request to take its next step.</span>
      </div>
      {filtered.length === 0 ? (
        <div className="ops-empty-panel">
          <Empty
            icon={<Columns3 size={27} />}
            title="No matching requests"
            text={
              hasFilters
                ? "Try another search or reset your filters."
                : "Your requests will appear here as work gets started."
            }
            action={
              hasFilters && (
                <button className="button secondary" onClick={reset}>
                  Reset filters
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="ops-board">
          {workStatuses.map((status) => {
            const rows = filtered.filter((t) => t.status === status);
            return (
              <section
                className={`ops-lane ${statusClass(status)}`}
                key={status}
                aria-label={`${statusLabel(status)} requests`}
              >
                <header className="ops-lane-head">
                  <span className="ops-status-dot" />
                  <h2>{statusLabel(status)}</h2>
                  <span className="ops-lane-count">{rows.length}</span>
                </header>
                <div className="ops-lane-body">
                  {rows.length ? (
                    rows.map((ticket) => (
                      <WorkCard
                        key={ticket.id}
                        ticket={ticket}
                        state={state}
                        onOpen={() => onOpenTicket(ticket.id)}
                      />
                    ))
                  ) : (
                    <p className="ops-lane-empty">No requests in this stage.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {actor.role === "admin" && (
        <section className="ops-team-section" aria-label="Assistant workload">
          <div className="ops-subheading">
            <h2>Assistant workload</h2>
            <p>
              Active assigned requests, including work with clients for review.
            </p>
          </div>
          <div className="ops-team-list">
            {state.profiles
              .filter((p) => p.role === "staff" && p.status === "Active")
              .map((profile) => {
                const assigned = tickets.filter(
                  (t) =>
                    t.assigneeId === profile.id && t.status !== "Completed",
                );
                return (
                  <article className="ops-team-member" key={profile.id}>
                    <Avatar name={profile.name} />
                    <div>
                      <strong>{profile.name}</strong>
                      <small>
                        {
                          assigned.filter((t) => t.status === "In review")
                            .length
                        }{" "}
                        with client for review
                      </small>
                    </div>
                    <span className="ops-team-count">
                      {assigned.length}
                      <small>active</small>
                    </span>
                  </article>
                );
              })}
          </div>
        </section>
      )}
      <p className="ops-footnote">
        This board uses the existing request workflow. Status changes happen
        through the request’s assigned actions.
      </p>
    </div>
  );
}
export function ClientDirectory({
  state,
  actor,
  onOpenTicket,
}: WorkspaceProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All clients");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (actor.role !== "admin") return null;
  const accounts = clientAccounts(state, actor);
  const visible = accounts.filter(
    (account) =>
      [account.profile.name, account.profile.company, account.profile.email]
        .join(" ")
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (filter === "All clients" ||
        (filter === "With active work"
          ? account.active > 0
          : filter === "Needs attention"
            ? account.overdue > 0 ||
              account.review > 0 ||
              account.outstanding > 0 ||
              account.unassigned > 0
            : account.active === 0)),
  );
  const selected =
    visible.find((account) => account.profile.id === selectedId) || visible[0];
  const assistants = selected
    ? state.profiles.filter(
        (p) =>
          p.role === "staff" &&
          selected.tickets.some(
            (t) => t.assigneeId === p.id && t.status !== "Completed",
          ),
      )
    : [];
  return (
    <div className="ops-page">
      <SectionHead
        title="Clients"
        description="Client records, active work, and payment records in one place."
      />
      <div
        className="ops-summary ops-client-summary"
        aria-label="Client directory summary"
      >
        <div>
          <Users size={18} />
          <span>
            <strong>{accounts.length}</strong>Clients
          </span>
        </div>
        <div>
          <BriefcaseBusiness size={18} />
          <span>
            <strong>{accounts.filter((a) => a.active > 0).length}</strong>With
            active work
          </span>
        </div>
        <div>
          <Clock3 size={18} />
          <span>
            <strong>{accounts.reduce((n, a) => n + a.overdue, 0)}</strong>
            Overdue requests
          </span>
        </div>
      </div>
      <div className="ops-toolbar" role="search" aria-label="Find clients">
        <label className="ops-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search clients"
            placeholder="Search name, company, or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="ops-select">
          <span>Show</span>
          <select
            aria-label="Client filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "All clients",
              "With active work",
              "Needs attention",
              "No active work",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        {(query || filter !== "All clients") && (
          <button
            className="text-button ops-reset"
            onClick={() => {
              setQuery("");
              setFilter("All clients");
            }}
          >
            <X size={14} />
            Reset filters
          </button>
        )}
      </div>
      {selected ? (
        <div className="ops-directory">
          <aside className="ops-client-list" aria-label="Client accounts">
            <div className="ops-list-title">
              {visible.length} {visible.length === 1 ? "client" : "clients"}
            </div>
            {visible.map((account) => (
              <button
                key={account.profile.id}
                aria-pressed={selected.profile.id === account.profile.id}
                className={`ops-client-row ${selected.profile.id === account.profile.id ? "selected" : ""}`}
                onClick={() => setSelectedId(account.profile.id)}
              >
                <Avatar name={account.profile.name} />
                <span>
                  <strong>
                    {companyName(account.profile.company) ||
                      account.profile.name}
                  </strong>
                  <small>{account.profile.name}</small>
                  <span className="ops-client-meta">
                    {account.active} active
                    {account.overdue > 0 ? ` · ${account.overdue} overdue` : ""}
                  </span>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </aside>
          <section
            className="ops-client-detail"
            aria-label="Selected client account"
          >
            <header className="ops-client-heading">
              <Avatar name={selected.profile.name} color={2} />
              <div>
                <h2>
                  {companyName(selected.profile.company) ||
                    selected.profile.name}
                </h2>
                <p>{selected.profile.name}</p>
              </div>
              <Badge>{selected.profile.status}</Badge>
            </header>
            <dl className="ops-contact">
              <div>
                <dt>Contact email</dt>
                <dd>{selected.profile.email || "No email on record"}</dd>
              </div>
              <div>
                <dt>Assigned assistants</dt>
                <dd>
                  {assistants.map((p) => p.name).join(", ") ||
                    "No active assignments"}
                </dd>
              </div>
            </dl>
            <div className="ops-account-metrics">
              <div>
                <strong>{selected.active}</strong>
                <span>Active requests</span>
              </div>
              <div>
                <strong>{selected.review}</strong>
                <span>For client review</span>
              </div>
              <div>
                <strong>{money(selected.outstanding)}</strong>
                <span>
                  {mode === "demo"
                    ? "Outstanding test payments"
                    : "Outstanding payment records"}
                </span>
              </div>
              <div>
                <strong>{money(selected.paid)}</strong>
                <span>
                  {mode === "demo"
                    ? "Paid test payments"
                    : "Recorded paid payments"}
                </span>
              </div>
            </div>
            {selected.overdue > 0 && (
              <p className="ops-attention">
                <Clock3 size={16} />
                {selected.overdue} overdue{" "}
                {selected.overdue === 1 ? "request needs" : "requests need"}{" "}
                attention.
              </p>
            )}
            <div className="ops-detail-section-head">
              <h3>Request history</h3>
              <span>{selected.tickets.length} total</span>
            </div>
            <div className="ops-account-requests">
              {selected.tickets.length ? (
                [...selected.tickets]
                  .sort(
                    (a, b) =>
                      b.createdAt.localeCompare(a.createdAt) ||
                      b.number - a.number,
                  )
                  .map((ticket) => (
                    <button
                      key={ticket.id}
                      className="ops-account-request"
                      onClick={() => onOpenTicket(ticket.id)}
                    >
                      <span className="ops-account-request-title">
                        <small>#{ticket.number}</small>
                        <strong>{ticket.title}</strong>
                        <span>Due {shortDate(ticket.dueDate)}</span>
                      </span>
                      <Badge>{ticket.status}</Badge>
                      <ArrowUpRight size={16} />
                    </button>
                  ))
              ) : (
                <p className="ops-inline-empty">
                  This client has no requests yet.
                </p>
              )}
            </div>
            <p className="ops-footnote">
              {mode === "demo"
                ? "Payment figures are simulated records in this local demo."
                : "Payment figures summarize stored records; they do not independently confirm provider settlement."}{" "}
              Private messages, files, and calendar details stay in their
              existing permitted workflows.
            </p>
          </section>
        </div>
      ) : (
        <div className="ops-empty-panel">
          <Empty
            icon={<Users size={27} />}
            title="No matching clients"
            text="Try a different name or change the client filter."
            action={
              (query || filter !== "All clients") && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setQuery("");
                    setFilter("All clients");
                  }}
                >
                  Reset filters
                </button>
              )
            }
          />
        </div>
      )}
    </div>
  );
}
export function ServiceTemplates({ onUse }: { onUse: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const filtered = requestTemplates.filter(
    (template) =>
      `${template.title} ${template.category} ${template.summary}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (!category || template.category === category),
  );
  return (
    <div className="ops-page">
      <SectionHead
        title="Request templates"
        description="Start with a useful brief. Add your budget, deadline, and the details that make it yours."
      />
      <div className="ops-template-intro">
        <div className="ops-template-icon">
          <Layers3 size={24} />
        </div>
        <div>
          <h2>A clearer brief. A smoother handoff.</h2>
          <p>
            Each template includes a suggested scope and deliverables. Review it
            before creating your request.
          </p>
        </div>
      </div>
      <div
        className="ops-toolbar"
        role="search"
        aria-label="Find request templates"
      >
        <label className="ops-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Search templates"
            placeholder="Find a starting point for your next request"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="ops-select">
          <span>Service</span>
          <select
            aria-label="Template service"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All services</option>
            {requestTemplates.map((t) => (
              <option key={t.id}>{t.category}</option>
            ))}
          </select>
        </label>
        {(query || category) && (
          <button
            className="text-button ops-reset"
            onClick={() => {
              setQuery("");
              setCategory("");
            }}
          >
            <X size={14} />
            Reset filters
          </button>
        )}
      </div>
      <div className="ops-board-caption">
        <span>
          {filtered.length} {filtered.length === 1 ? "template" : "templates"}
        </span>
        <span>No request is created until you submit the form.</span>
      </div>
      {filtered.length ? (
        <div className="ops-template-grid">
          {filtered.map((template, index) => (
            <article className="ops-template-card" key={template.id}>
              <img
                src={`/service-visuals/${["administrative", "marketing", "design", "support", "research", "workspace"][requestTemplates.indexOf(template)]}.svg`}
                alt=""
                className="ops-template-visual"
              />
              <span className="ops-template-category">{template.category}</span>
              <h2>{template.title}</h2>
              <p>{template.summary}</p>
              <h3>Suggested deliverables</h3>
              <ul>
                {template.deliverables.map((item) => (
                  <li key={item}>
                    <Check size={14} />
                    {item}
                  </li>
                ))}
              </ul>
              <button
                className="button secondary"
                onClick={() => onUse(template.id)}
                aria-label={`Use ${template.title} template`}
              >
                Use template
                <ArrowUpRight size={15} />
              </button>
              <span className="ops-sr-only">
                Template {index + 1} of {filtered.length}
              </span>
            </article>
          ))}
        </div>
      ) : (
        <div className="ops-empty-panel">
          <Empty
            icon={<Layers3 size={27} />}
            title="No matching templates"
            text="Try another search or choose a different service."
            action={
              <button
                className="button secondary"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                }}
              >
                Reset filters
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
