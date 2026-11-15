import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Clock3,
  Timer,
  CreditCard,
  Download,
  FileLock2,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Columns3,
  ContactRound,
  Layers3,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  History,
  ScrollText,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  Users,
  Video,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { ColumnDef } from "@tanstack/react-table";
import Auth from "./Auth";
import { NotificationCenter } from "./NotificationCenter";
import { ownedNotifications, updateNotifications } from "./notifications";
import type { NotificationCommand, NotificationDestination } from "./notifications";
import { OwnerDashboard } from "./OwnerDashboard";
import { RoleDashboard } from "./RoleDashboard";
import { WorkBoard, ClientDirectory, ServiceTemplates } from "./OperationsWorkspace";
import { requestTemplates } from "./operations";
import { useTimeTracking } from "./use-time-tracking";
import { ClockWidget, TimeWorkspace } from "./TimeWorkspace";
import { AppearanceSwitch } from "./AppearanceSwitch";
import { initialAppearance, saveAppearance, savedAppearance, systemAppearance } from "./appearance";
import type { Appearance } from "./appearance";
import { PrivacyDesk, PrivacyWorkspace } from "./PrivacyDesk";
import { brand, companyName } from "./brand-config";
import {
  buildLabel,
  environmentLabel,
  environmentShortLabel,
  versionLabel,
} from "./app-config";
import sampleOutput from "../docs/sample-output.txt?raw";
import {
  Avatar,
  Badge,
  DataTable,
  Empty,
  Field,
  Form,
  Modal,
  SearchBox,
  SectionHead,
  Submit,
} from "./components";
import {
  downloadFile,
  enterDemo,
  getDemoIdentity,
  identityFromSession,
  loadWorkspace,
  logout,
  mode,
  runCommand,
  subscribe,
  supabase,
  uploadFile,
} from "./data";
import type { Identity } from "./data";
import { categories, difficulties, money, paymentSummary } from "./types";
import type {
  Appointment,
  Audit,
  Command,
  Difficulty,
  Document,
  Payment,
  Ticket,
  Workspace,
} from "./types";

type Page =
  | "Overview"
  | "Work board"
  | "Clients"
  | "Request templates"
  | "Time & attendance"
  | "Requests"
  | "Assistants"
  | "Appointments"
  | "Messages"
  | "Billing"
  | "Files & documents"
  | "Tools & software"
  | "Profile"
  | "Activity logs"
  | "Conversation Review"
  | "Schedule History"
  | "Administrative Audit Logs";
type Dialog = {
  type:
    | "request"
    | "ticket"
    | "appointment"
    | "reschedule"
    | "editAppointment"
    | "report"
    | "payment"
    | "pay"
    | "feedback"
    | "help"
    | "cancel"
    | "assistant"
    | "confirmCancel";
  id?: string;
  date?: string;
  staffId?: string;
  templateId?: string;
} | null;
const serviceVisuals: Record<string, string> = {
  "Administrative support": "/service-visuals/administrative.svg",
  "Content & marketing": "/service-visuals/marketing.svg",
  "Design & creative": "/service-visuals/design.svg",
  "Customer support": "/service-visuals/support.svg",
  "Research & data": "/service-visuals/research.svg",
  "Web & technology": "/service-visuals/workspace.svg",
};
const serviceVisual = (category?: string) =>
  serviceVisuals[category || ""] || serviceVisuals["Web & technology"];
const nav: { page: Page; icon: LucideIcon }[] = [
  { page: "Overview", icon: LayoutDashboard },
  { page: "Work board", icon: Columns3 },
  { page: "Clients", icon: ContactRound },
  { page: "Request templates", icon: Layers3 },
  { page: "Time & attendance", icon: Timer },
  { page: "Requests", icon: BriefcaseBusiness },
  { page: "Assistants", icon: Users },
  { page: "Appointments", icon: CalendarDays },
  { page: "Messages", icon: MessageSquare },
  { page: "Billing", icon: CreditCard },
  { page: "Files & documents", icon: FolderOpen },
  { page: "Activity logs", icon: ShieldCheck },
  { page: "Conversation Review", icon: FileLock2 },
  { page: "Schedule History", icon: History },
  { page: "Administrative Audit Logs", icon: ScrollText },
];
const dateText = (
  date: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) =>
  new Date(date.length === 10 ? date + "T12:00:00" : date).toLocaleDateString(
    "en-US",
    options,
  );
const timeText = (date: string) =>
  new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
const dateInput = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const str = (form: FormData, key: string) => String(form.get(key) || "");

export default function App() {
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const [identity, setIdentity] = useState<Identity | null>(getDemoIdentity);
  const [state, setState] = useState<Workspace | null>(null);
  const [page, setPage] = useState<Page>("Overview");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!supabase);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [toastPaused, setToastPaused] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notifications, setNotifications] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All requests");
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [assistantSearch, setAssistantSearch] = useState("");
  const [assistantCategory, setAssistantCategory] = useState("All services");
  const [assistantAvailability, setAssistantAvailability] =
    useState("All assistants");
  const adminRange = 30;
  const [createdWindow, setCreatedWindow] = useState<{
    start: string;
    end: string;
    label: string;
  } | null>(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [conversation, setConversation] = useState<string | null>(null);
  const [calendarDate, setCalendarDate] = useState(dateInput());
  const toggleAppearance = () => {
    const next = appearance === "dark" ? "light" : "dark";
    saveAppearance(next);
    setAppearance(next);
  };
  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    document.documentElement.style.colorScheme = appearance;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      appearance === "dark" ? "#15101F" : "#2D1B61",
    );
  }, [appearance]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const onSystemChange = () => {
      if (!savedAppearance()) setAppearance(systemAppearance());
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);
  const chatBottom = useRef<HTMLDivElement>(null);
  const lastMessageCount = useRef<number | null>(null);
  const lock = useRef(false);
  const notificationRevision = useRef(0);
  const notificationPending = useRef(false);
  const notificationRefreshQueued = useRef(false);
  const notificationIdentity = useRef(identity?.id);
  notificationIdentity.current = identity?.id;
  const showToast = useCallback(
    (text: string, error = false) => { setToastPaused(false); setToast({ text, error }); },
    [],
  );
  const refresh = useCallback(async function refreshWorkspace() {
    const revision = notificationRevision.current;
    const actorId = notificationIdentity.current;
    try {
      const next = await loadWorkspace();
      if (actorId !== notificationIdentity.current) return;
      const staleNotifications = notificationPending.current || revision !== notificationRevision.current;
      setState(current => current && staleNotifications ? {...next,notifications:current.notifications} : next);
      // Preserve optimistic status while saving, then reconcile any incoming
      // records skipped by a refresh that crossed the notification change.
      if (staleNotifications) {
        if (notificationPending.current) notificationRefreshQueued.current = true;
        else void refreshWorkspace();
      }
      setLoadError("");
    } catch (e) {
      if (actorId !== notificationIdentity.current) return;
      setLoadError(
        e instanceof Error ? e.message : "Could not load your workspace.",
      );
    }
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(async ({ data, error }) => {
      try {
        if (error) throw error;
        const id = await identityFromSession(data.session);
        if (active) setIdentity(id);
      } catch (e) {
        if (active)
          setLoadError(
            e instanceof Error ? e.message : "Could not restore your session.",
          );
      } finally {
        if (active) setLoading(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setIdentity(null);
        setState(null);
      } else if (event === "SIGNED_IN" && session) {
        setTimeout(() => {
          void identityFromSession(session)
            .then((id) => {
              if (active) setIdentity(id);
            })
            .catch((e) => setLoadError(String(e)));
        }, 0);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!identity) return;
    void refresh();
    return subscribe(() => {
      void refresh();
    });
  }, [identity, refresh]);
  useEffect(() => {
    if (!toast || toastPaused) return;
    const timer = setTimeout(() => setToast(null), toast.error ? 9000 : 5500);
    return () => clearTimeout(timer);
  }, [toast, toastPaused]);
  useEffect(() => {
    setActionError("");
  }, [dialog]);
  useEffect(() => {
    setSelectedRequestIds([]);
  }, [filter, search, assigneeFilter, createdWindow, page, identity?.id]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPage("Requests");
        setTimeout(
          () =>
            document
              .querySelector<HTMLInputElement>(
                '[aria-label="Search requests…"]',
              )
              ?.focus(),
          0,
        );
      }
      if (event.key === "Escape") {
        setAccountMenu(false);
        setNotifications(false);
        setMobile(false);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (
        !(event.target as Element).closest(".account-wrap,.notification-wrap")
      ) {
        setAccountMenu(false);
        setNotifications(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);
  useEffect(() => {
    const count = state?.messages.length ?? 0;
    const hasNewMessage =
      lastMessageCount.current !== null && count > lastMessageCount.current;
    lastMessageCount.current = count;
    const chatBody = chatBottom.current?.closest<HTMLElement>(".chat-body");
    if (!chatBody) return;
    if (getComputedStyle(chatBody).overflowY !== "visible") {
      chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    } else if (hasNewMessage && page === "Messages") {
      chatBottom.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [conversation, page, state?.messages.length]);
  const actor = state?.profiles.find((p) => p.id === identity?.id);
  const tracking = useTimeTracking(actor, state, showToast);
  const mine = useMemo(
    () =>
      state?.tickets.filter(
        (t) =>
          actor?.role === "admin" ||
          (actor?.role === "client"
            ? t.clientId === actor.id
            : t.assigneeId === actor?.id || !t.assigneeId),
      ) || [],
    [state, actor],
  );
  const myAppointments =
    state?.appointments
      .filter(
        (a) =>
          (actor?.role === "client" && a.clientId === actor.id) ||
          (actor?.role === "staff" && a.staffId === actor.id),
      )
      .sort((a, b) => a.start.localeCompare(b.start)) || [];
  const upcoming = myAppointments.filter((a) => new Date(a.end) > new Date());
  const selectedAppointments = myAppointments.filter(
    (a) => dateInput(new Date(a.start)) === calendarDate,
  );
  const myNotes = state && actor ? ownedNotifications(state.notifications, actor.id) : [];
  const messageUnread = myNotes.filter(
    (n) => !n.read && /message/i.test(n.text),
  ).length;
  useEffect(() => { setActionError(""); }, [dialog?.type, dialog?.id]);
  const closeDialog = useCallback(() => {
    if (!lock.current) setDialog(null);
  }, []);
  const perform = async (command: Command, success: string, close = true) => {
    if (!actor || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setActionError("");
    try {
      setState(await runCommand(actor.id, command));
      showToast(success);
      if (close) setDialog(null);
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setActionError(message);
      showToast(message, true);
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const upload = async (
    file: File,
    ticketId: string | null = null,
    isOutput = false,
  ) => {
    if (!actor || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      setState(await uploadFile(file, actor, ticketId, isOutput));
      setActionError("");
      showToast(
        isOutput
          ? "Output uploaded. You can now deliver the work."
          : "File uploaded successfully.",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed.";
      setActionError(message);
      showToast(message, true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const download = async (doc: Document) => {
    try {
      await downloadFile(doc);
      showToast("Your download is ready.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Download failed.", true);
    }
  };
  const navigate = (next: Page) => {
    if (
      actor?.role === "admin" &&
      (next === "Messages" || next === "Appointments")
    )
      next = "Conversation Review";
    setDialog(null);
    setActionError("");
    setPage(next);
    setSearch("");
    setAssigneeFilter(null);
    setCreatedWindow(null);
    setMobile(false);
    setNotifications(false);
    setAccountMenu(false);
    document
      .querySelector<HTMLElement>(".workspace-main")
      ?.scrollTo({ top: 0 });
  };
  const person = (id: string | null | undefined) =>
    state?.profiles.find((p) => p.id === id);
  const openConversation = (id: string) => {
    if (actor?.role !== "client" && actor?.role !== "staff") {
      navigate("Conversation Review");
      return;
    }
    setConversation(id);
    navigate("Messages");
    setDialog(null);
  };
  const updateNotification = async (command: NotificationCommand) => {
    if (!actor || !state || lock.current) throw new Error("Another action is still saving. Please try again.");
    const actorId = actor.id;
    const previousNotes = state.notifications;
    const affected = new Set(command.type === "readNotifications" ? command.notificationIds || myNotes.map(n=>n.id) : [command.notificationId]);
    lock.current = true;
    notificationPending.current = true;
    notificationRevision.current++;
    setBusy(true);
    setState(current => {
      if (!current) return current;
      try { return updateNotifications(current, actorId, command); }
      catch { return current; } // A refresh or account switch may have removed this row.
    });
    try {
      const next = await runCommand(actorId, command);
      notificationRevision.current++;
      if (notificationIdentity.current !== actorId) return;
      setState(next);
      if (command.type === "dismissNotification") showToast(command.dismissed ? "Notification dismissed." : "Notification restored.");
      else if (command.type === "readNotifications") showToast("Notifications marked as read.");
    } catch (e) {
      notificationRevision.current++;
      if (notificationIdentity.current !== actorId) return;
      const before = new Map(previousNotes.map(n=>[n.id,n]));
      setState(current => current ? {...current,notifications:current.notifications.map(n=>{
        const old = before.get(n.id);
        if (n.userId !== actorId || !affected.has(n.id) || !old) return n;
        return command.type === "dismissNotification" ? {...n,dismissed:old.dismissed} : {...n,read:old.read};
      })} : current);
      const message = e instanceof Error ? e.message : "Please try again.";
      showToast(`Could not confirm notification update. ${message}`,true);
      void refresh();
      throw new Error(`Could not confirm notification update. ${message}`);
    } finally {
      notificationPending.current = false;
      lock.current = false;
      setBusy(false);
      if (notificationRefreshQueued.current) {
        notificationRefreshQueued.current = false;
        void refresh();
      }
    }
  };
  const openNotificationDestination = (destination: Exclude<NotificationDestination,{type:"details"}>) => {
    if (destination.type === "conversation") openConversation(destination.id);
    else if (destination.type === "ticket") {
      navigate("Requests");
      setFilter("All requests");
      setDialog({type:"ticket",id:destination.id});
    } else if (destination.type === "appointment") {
      const appointment = state?.appointments.find(a=>a.id===destination.id);
      if (!appointment) { showToast("This appointment is no longer available.",true); return; }
      navigate("Appointments");
      setCalendarDate(dateInput(new Date(appointment.start)));
      setDialog({type:"cancel",id:appointment.id});
    } else if (destination.type === "page") {
      navigate(destination.page);
      if (destination.page === "Requests") setFilter(destination.available ? "Available" : "All requests");
      if (destination.search) setSearch(destination.search);
    }
  };
  const signout = async () => {
    try {
      await logout();
      setIdentity(null);
      setState(null);
      setAccountMenu(false);
      setPage("Overview");
      setDialog(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sign out failed.", true);
    }
  };
  if (loading)
    return (
      <div className="loading-screen">
        <strong>Nexus VA</strong>
        <span className="spinner" />
        Opening your workspace…
      </div>
    );
  if (!identity)
    return (
      <>
        <Auth
          appearance={appearance}
          onToggleAppearance={toggleAppearance}
          onLogin={(id) => {
            setIdentity(id);
            setLoadError("");
          }}
        />
        {loadError && (
          <div className="toast error" role="alert">
            {loadError}
            <button onClick={() => setLoadError("")} aria-label="Dismiss error">
              <X size={16} />
            </button>
          </div>
        )}
      </>
    );
  if (!state || !actor)
    return (
      <div className="loading-screen">
        <strong>Nexus VA</strong>
        {loadError ? (
          <>
            <p>{loadError}</p>
            <button className="button primary" onClick={() => void refresh()}>
              Try again
            </button>
            <button className="text-button" onClick={() => void signout()}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <span className="spinner" />
            <p>Getting everything ready…</p>
          </>
        )}
      </div>
    );
  if (
    actor.role === "support_reviewer" ||
    actor.role === "privacy_officer" ||
    actor.role === "super_admin"
  )
    return (
      <PrivacyWorkspace
        actor={actor}
        profiles={state.profiles}
        tickets={state.tickets}
        appearance={appearance}
        onToggleAppearance={toggleAppearance}
        onSignout={() => void signout()}
      />
    );
  const overviewTickets =
    actor.role === "staff"
      ? mine.filter((ticket) => ticket.assigneeId === actor.id)
      : mine;
  const totalPaid = state.payments
    .filter((p) => p.status === "Paid" && mine.some((t) => t.id === p.ticketId))
    .reduce((sum, p) => sum + p.amount, 0);
  const outstandingTotal = state.payments
    .filter(
      (payment) =>
        payment.status !== "Paid" &&
        mine.some((ticket) => ticket.id === payment.ticketId),
    )
    .reduce((sum, payment) => sum + payment.amount, 0);
  const analyticsStart = new Date();
  analyticsStart.setHours(0, 0, 0, 0);
  analyticsStart.setDate(analyticsStart.getDate() - adminRange + 1);
  const availableAssistants = state.profiles.filter(
    (profile) =>
      profile.role === "staff" &&
      profile.status === "Active" &&
      (assistantAvailability === "All assistants" || profile.available) &&
      (assistantCategory === "All services" ||
        profile.skills.includes(assistantCategory)) &&
      `${profile.name} ${profile.bio} ${profile.skills.join(" ")}`
        .toLowerCase()
        .includes(assistantSearch.toLowerCase()),
  );
  const paymentRequestCount = state.payments.filter((payment) =>
    mine.some((ticket) => ticket.id === payment.ticketId),
  ).length;
  const requestStatusCount = (paid: boolean, delivered: boolean) =>
    mine.filter(
      (ticket) =>
        (paymentSummary(state, ticket.id) === "Paid") === paid &&
        !!ticket.deliveredAt === delivered,
    ).length;
  const currentChat =
    mine.find((t) => t.id === conversation && t.assigneeId) ||
    mine.find((t) => t.assigneeId);
  const assignedRequestScope =
    actor.role === "admin" && assigneeFilter
      ? mine.filter((ticket) => ticket.assigneeId === assigneeFilter)
      : mine;
  const requestScope = createdWindow
    ? assignedRequestScope.filter(
        (ticket) =>
          new Date(ticket.createdAt) >= new Date(createdWindow.start) &&
          new Date(ticket.createdAt) < new Date(createdWindow.end),
      )
    : assignedRequestScope;
  const filtered = requestScope.filter(
    (t) =>
      (filter === "All requests" ||
        t.status === filter ||
        (filter === "Available" && !t.assigneeId)) &&
      `${t.title} ${t.number} ${t.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const selectedVisibleRequests = filtered.filter((ticket) =>
    selectedRequestIds.includes(ticket.id),
  );
  const toggleRequestSelection = (id: string) =>
    setSelectedRequestIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  const exportSelectedRequests = () => {
    if (!selectedVisibleRequests.length) return;
    const csvCell = (value: string | number) => {
      const raw = String(value);
      const safe =
        typeof value === "string" && /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = [
      [
        "Request number",
        "Request",
        "Client",
        "Assistant",
        "Status",
        "Due date",
        "Budget",
      ],
      ...selectedVisibleRequests.map((ticket) => [
        `NX-${ticket.number}`,
        ticket.title,
        person(ticket.clientId)?.name || "",
        person(ticket.assigneeId)?.name || "Unassigned",
        ticket.status,
        ticket.dueDate,
        ticket.budget,
      ]),
    ];
    const blob = new Blob(
      ["\uFEFF", rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nexus-requests.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(
      `${selectedVisibleRequests.length} request summaries downloaded.`,
    );
  };
  const titleCell = (t: Ticket) => (
    <div className="project-cell">
      <span>
        <button
          className="table-title"
          onClick={(e) => {
            e.stopPropagation();
            setDialog({ type: "ticket", id: t.id });
          }}
        >
          {t.title}
        </button>
        <small>
          NX-{t.number} <span>·</span> {t.category}
        </small>
      </span>
    </div>
  );
  const columns: ColumnDef<Ticket, unknown>[] = [
    ...(actor.role === "admin" && page === "Requests"
      ? [
          {
            id: "select",
            header: () => (
              <input
                type="checkbox"
                aria-label="Select all filtered requests"
                checked={
                  filtered.length > 0 &&
                  selectedVisibleRequests.length === filtered.length
                }
                onChange={(event) =>
                  setSelectedRequestIds(
                    event.target.checked
                      ? filtered.map((ticket) => ticket.id)
                      : [],
                  )
                }
              />
            ),
            enableSorting: false,
            cell: ({ row }: { row: { original: Ticket } }) => (
              <input
                type="checkbox"
                aria-label={`Select ${row.original.title}`}
                checked={selectedRequestIds.includes(row.original.id)}
                onClick={(event) => event.stopPropagation()}
                onChange={() => toggleRequestSelection(row.original.id)}
              />
            ),
          },
        ]
      : []),
    {
      accessorKey: "title",
      header: "Request",
      cell: ({ row }) => titleCell(row.original),
    },
    {
      accessorKey: "assigneeId",
      header: "Assistant",
      cell: ({ row }) => {
        const p = person(row.original.assigneeId);
        return p ? (
          <div className="person-inline">
            <Avatar
              name={p.name}
              size="small"
              color={p.name.startsWith("Luis") ? 1 : 0}
            />
            <span>{p.name.split(" ")[0]}</span>
          </div>
        ) : (
          <span className="muted">Finding a match</span>
        );
      },
    },
    {
      accessorKey: "dueDate",
      header: "Due date",
      cell: ({ row }) => (
        <span className="subtle">{dateText(row.original.dueDate)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge>{row.original.status}</Badge>,
    },
    ...(page === "Requests"
      ? [
          {
            accessorKey: "budget",
            header: "Budget",
            cell: ({ row }: { row: { original: Ticket } }) => (
              <strong>{money(row.original.budget)}</strong>
            ),
          },
          {
            id: "open",
            header: "",
            enableSorting: false,
            cell: ({ row }: { row: { original: Ticket } }) => (
              <button
                className="button secondary compact view-request-button"
                onClick={(event) => {
                  event.stopPropagation();
                  setDialog({ type: "ticket", id: row.original.id });
                }}
              >
                View request
              </button>
            ),
          },
        ]
      : []),
  ];
  const requestCard = (ticket: Ticket) => (
    <>
      <div className="mobile-request-heading">
        {actor.role === "admin" && page === "Requests" && (
          <input
            type="checkbox"
            aria-label={`Select ${ticket.title}`}
            checked={selectedRequestIds.includes(ticket.id)}
            onChange={() => toggleRequestSelection(ticket.id)}
          />
        )}
        <div>
          <strong>{ticket.title}</strong>
          <small>
            NX-{ticket.number} · {ticket.category}
          </small>
          {actor.role === "staff" && (
            <small>
              Client:{" "}
              {person(ticket.clientId)?.company ||
                person(ticket.clientId)?.name ||
                "Client"}
            </small>
          )}
        </div>
        <Badge>{ticket.status}</Badge>
      </div>
      <dl className="mobile-request-facts">
        <div>
          <dt>Due date</dt>
          <dd>{dateText(ticket.dueDate)}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>{money(ticket.budget)}</dd>
        </div>
      </dl>
      <button
        className="button secondary compact view-request-button"
        onClick={() => setDialog({ type: "ticket", id: ticket.id })}
      >
        View request
      </button>
    </>
  );
  const paymentAction = (payment: Payment, showPaidLabel = true) => {
    if (payment.status === "Paid")
      return showPaidLabel ? (
        <span className="paid-label">
          <CheckCheck size={14} /> Paid{" "}
          {payment.paidAt && dateText(payment.paidAt)}
        </span>
      ) : null;
    if (actor.role === "client")
      return (
        <button
          className="button primary compact"
          onClick={() => setDialog({ type: "pay", id: payment.id })}
        >
          Pay in test mode
        </button>
      );
    if (payment.status === "Pending")
      return (
        <button
          className="button secondary compact"
          disabled={busy}
          onClick={() =>
            void perform(
              { type: "verifyPayment", paymentId: payment.id },
              "Payment request verified.",
              false,
            )
          }
        >
          Verify request
        </button>
      );
    return <span className="muted">Awaiting client</span>;
  };
  const paymentCard = (payment: Payment) => {
    const ticket = mine.find((item) => item.id === payment.ticketId);
    const action = paymentAction(payment, false);
    return (
      <>
        <div className="mobile-request-heading">
          <div>
            <strong>{payment.description}</strong>
            <small>
              {ticket ? `NX-${ticket.number} · ` : ""}
              {dateText(payment.createdAt)}
            </small>
          </div>
          <Badge>{payment.status}</Badge>
        </div>
        <dl className="mobile-request-facts">
          <div>
            <dt>Amount</dt>
            <dd>{money(payment.amount)}</dd>
          </div>
          {payment.paidAt && (
            <div>
              <dt>Paid on</dt>
              <dd>{dateText(payment.paidAt)}</dd>
            </div>
          )}
        </dl>
        {action && <div className="mobile-payment-action">{action}</div>}
      </>
    );
  };
  const oversightCard = (ticket: Ticket) => (
    <>
      <div className="mobile-request-heading">
        <div>
          <strong>{ticket.title}</strong>
          <small>
            NX-{ticket.number} · {ticket.category}
          </small>
        </div>
        <Badge>{ticket.status}</Badge>
      </div>
      <dl className="mobile-request-facts mobile-oversight-facts">
        <div>
          <dt>Client</dt>
          <dd>{person(ticket.clientId)?.name || "Client"}</dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>{paymentSummary(state, ticket.id)}</dd>
        </div>
        <div>
          <dt>Output</dt>
          <dd>{ticket.deliveredAt ? "Delivered" : "Not delivered"}</dd>
        </div>
      </dl>
      <button
        className="button secondary compact view-request-button"
        onClick={() => setDialog({ type: "ticket", id: ticket.id })}
      >
        View request
      </button>
    </>
  );
  const auditCard = (entry: Audit) => {
    const ticket = mine.find((item) => item.id === entry.ticketId);
    return (
      <>
        <div className="mobile-request-heading">
          <div>
            <strong>{entry.text}</strong>
            <small>
              {dateText(entry.createdAt)} · {timeText(entry.createdAt)}
            </small>
          </div>
        </div>
        <dl className="mobile-request-facts">
          <div>
            <dt>Account</dt>
            <dd>{person(entry.actorId)?.name || "Team"}</dd>
          </div>
          <div>
            <dt>Request</dt>
            <dd>{ticket ? `NX-${ticket.number}` : "—"}</dd>
          </div>
        </dl>
        {ticket && (
          <button
            className="button secondary compact view-request-button"
            onClick={() => setDialog({ type: "ticket", id: ticket.id })}
          >
            View request
          </button>
        )}
      </>
    );
  };
  const requestButton =
    actor.role === "client" ? (
      <button
        className="button primary"
        onClick={() => setDialog({ type: "request" })}
      >
        <Plus size={17} />
        New request
      </button>
    ) : (
      <button
        className="button secondary"
        onClick={() =>
          navigate(actor.role === "admin" ? "Activity logs" : "Requests")
        }
      >
        {actor.role === "admin" ? "View activity logs" : "Explore requests"}
        <ArrowUpRight size={16} />
      </button>
    );
  const fileUpload = (ticketId: string | null = null, output = false) => (
    <div className="upload-controls">
      <label
        className={`button ${output ? "primary" : "secondary"} upload-button ${busy ? "disabled" : ""}`}
      >
        <Upload size={15} />
        {busy ? "Uploading…" : output ? "Upload output" : "Upload file"}
        <input
          aria-label={output ? "Upload output file" : "Upload file"}
          type="file"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file, ticketId, output);
            e.target.value = "";
          }}
        />
      </label>
      {output && (
        <button
          className="text-button"
          disabled={busy}
          onClick={() =>
            void upload(
              new File([sampleOutput], "sample-output.txt", {
                type: "text/plain",
              }),
              ticketId,
              true,
            )
          }
        >
          Try sample output
        </button>
      )}
    </div>
  );
  const documentActions = (doc: Document, mobileCard = false) => (
    <div className={mobileCard ? "file-card-actions" : "row-actions"}>
      {actor.role !== "client" && !doc.reviewed && (
        <button
          className={mobileCard ? "button secondary" : "icon-button"}
          title="Mark reviewed"
          aria-label={`Review ${doc.name}`}
          disabled={busy}
          onClick={() =>
            void perform(
              { type: "reviewDocument", documentId: doc.id },
              "Document marked as reviewed.",
              false,
            )
          }
        >
          <FileCheck2 size={17} />
          {mobileCard && "Mark reviewed"}
        </button>
      )}
      <button
        className={mobileCard ? "button secondary" : "icon-button"}
        aria-label={`Download ${doc.name}`}
        onClick={() => void download(doc)}
      >
        <Download size={17} />
        {mobileCard && "Download"}
      </button>
    </div>
  );
  const appointmentCard = (a: Appointment) => (
    <div className="appointment-row" key={a.id}>
      <div className="date-tile">
        <span>{dateText(a.start, { month: "short" })}</span>
        <strong>{new Date(a.start).getDate()}</strong>
      </div>
      <div className="appointment-info">
        <strong>{a.title}</strong>
        {a.status === "No-show" && (
          <span className="calendar-status">No-show</span>
        )}
        <span>
          <Clock3 size={12} />
          {timeText(a.start)} – {timeText(a.end)}
        </span>
        <small>
          with {person(actor.role === "client" ? a.staffId : a.clientId)?.name}
        </small>
      </div>
      <button
        className="icon-button"
        aria-label={`View ${a.title}`}
        onClick={() => setDialog({ type: "cancel", id: a.id })}
      >
        <ArrowUpRight size={17} />
      </button>
    </div>
  );

  const sidebarGroups: { label: string; pages: Page[] }[] = [
    {
      label: actor.role === "staff" ? "My work" : "Operations",
      pages: [
        "Overview",
        "Work board",
        "Requests",
        ...(actor.role === "admin" ? (["Clients"] as Page[]) : []),
        ...(actor.role === "client" ? (["Request templates"] as Page[]) : []),
        ...(actor.role === "admin" || actor.role === "staff" ? (["Time & attendance"] as Page[]) : []),
        ...(actor.role === "client" ? (["Assistants"] as Page[]) : []),
      ],
    },
    {
      label: "Coordinate",
      pages:
        actor.role === "admin"
          ? []
          : ["Messages", "Appointments", "Files & documents"],
    },
    {
      label: actor.role === "admin" ? "Manage" : "Account",
      pages: [
        "Billing",
        ...(actor.role === "admin" ? (["Activity logs"] as Page[]) : []),
      ],
    },
    ...(actor.role === "admin"
      ? [
          {
            label: "Privacy oversight",
            pages: [
              "Conversation Review",
              "Schedule History",
              "Administrative Audit Logs",
            ] as Page[],
          },
        ]
      : []),
  ];

  return (
    <div
      className={`app-shell command-v131 scroll-layout-v132 revision-v1341 revision-v1346 ${mobile ? "nav-open" : ""}`}
    >
      <aside className="rail" aria-label="Quick navigation">
        <a
          className="rail-brand"
          href="#"
          aria-label="Nexus VA home"
          onClick={(e) => {
            e.preventDefault();
            navigate("Overview");
          }}
        >
          <img src="/nexus-mark.png" alt="" />
        </a>
        <div className="rail-divider" />
        {nav
          .filter(
            ({ page: next }) =>
              (next !== "Assistants" || actor.role === "client") &&
              (next !== "Clients" || actor.role === "admin") &&
              (next !== "Request templates" || actor.role === "client") &&
              (next !== "Time & attendance" || actor.role === "staff" || actor.role === "admin") &&
              (next !== "Activity logs" || actor.role === "admin") &&
              (actor.role !== "admin" ||
                (next !== "Messages" && next !== "Appointments")) &&
              (actor.role === "admin" ||
                ![
                  "Conversation Review",
                  "Schedule History",
                  "Administrative Audit Logs",
                ].includes(next)),
          )
          .map(({ page: next, icon: Icon }) => (
            <button
              key={next}
              className={`rail-link ${page === next ? "selected" : ""}`}
              aria-current={page === next ? "page" : undefined}
              aria-label={next}
              title={next}
              onClick={() => navigate(next)}
            >
              <Icon size={20} />
            </button>
          ))}
        <div className="rail-bottom">
          <button
            className="rail-link"
            aria-label="Help"
            onClick={() => { setMobile(false); setDialog({ type: "help" }); }}
          >
            <CircleHelp size={20} />
          </button>
          <button
            className="rail-avatar"
            title="Your profile"
            onClick={() => navigate("Profile")}
          >
            <Avatar name={actor.name} color={2} />
          </button>
        </div>
      </aside>
      <aside
        className="sidebar"
        id="workspace-navigation"
        aria-label="Workspace navigation"
      >
        <div className="sidebar-brand">
          <div className="sidebar-logo" aria-label="Nexus Virtual Executives">
            <img src="/nexus-wordmark-white.png" alt="Nexus" />
            <span>VIRTUAL EXECUTIVES</span>
          </div>
          <button
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-scroll-region">
          <div className="workspace-chip">
            <span className="workspace-letter">
              {actor.company.charAt(0) || "N"}
            </span>
            <span>
              <strong>{companyName(actor.company) || "My workspace"}</strong>
              <small>
                {actor.role === "client"
                  ? "Client workspace"
                  : actor.role === "staff"
                    ? "Assistant workspace"
                    : "Admin workspace"}
              </small>
            </span>
          </div>
          <nav aria-label="Main navigation">
            {sidebarGroups
              .filter((group) => group.pages.length)
              .map((group) => (
                <div className="sidebar-nav-group" key={group.label}>
                  <span className="nav-label">{group.label}</span>
                  {group.pages.map((next) => {
                    const Icon = nav.find((item) => item.page === next)!.icon;
                    return (
                      <button
                        key={next}
                        className={`nav-link ${page === next ? "active" : ""}`}
                        aria-current={page === next ? "page" : undefined}
                        onClick={() => navigate(next)}
                      >
                        <Icon size={17} />
                        {next}
                        {next === "Messages" && messageUnread > 0 && (
                          <span className="nav-count">{messageUnread}</span>
                        )}
                        {next === "Requests" && (
                          <span className="nav-count neutral">
                            {
                              mine.filter((t) => t.status !== "Completed")
                                .length
                            }
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
          </nav>
          <span className="nav-label resources-label">Resources</span>
          <button
            className={`nav-link ${page === "Tools & software" ? "active" : ""}`}
            onClick={() => navigate("Tools & software")}
          >
            <Sparkles size={17} />
            Tools & software
            <ArrowUpRight className="nav-arrow" size={13} />
          </button>
          <button
            className="nav-link"
            onClick={() => { setMobile(false); setDialog({ type: "help" }); }}
          >
            <CircleHelp size={17} />
            Workspace guide
          </button>
          <a
            className="nav-link"
            href="/privacy-notice.html"
            target="_blank"
            rel="noreferrer"
          >
            <LockKeyhole size={17} />
            Privacy & review notice
          </a>
          <div className="sidebar-bottom">
            <button
              className={`nav-link ${page === "Profile" ? "active" : ""}`}
              onClick={() => navigate("Profile")}
            >
              <Settings2 size={17} />
              Settings & profile
            </button>
            <div className="sidebar-foot" title={buildLabel}>
              <span className="online-dot" />
              {environmentShortLabel} · {mode === "demo" ? "Demo" : "Connected"}
              <span title={buildLabel}>Test Version 1.3.4.9</span>
            </div>
          </div>
        </div>
      </aside>
      {mobile && (
        <div className="mobile-shade" onClick={() => setMobile(false)} />
      )}
      <div
        className={`workspace-main ${page === "Overview" ? "overview-workspace" : ""}`}
      >
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-controls="workspace-navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
          </div>
          <div className="topbar-right">
            <ClockWidget tracking={tracking} actor={actor} onOpen={() => navigate("Time & attendance")} />
            <AppearanceSwitch appearance={appearance} onToggle={toggleAppearance} />
            {page !== "Requests" && (
              <div className="global-search">
                <Search size={15} />
                <input
                  aria-label="Search workspace"
                  placeholder="Search requests…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage("Requests");
                    setTimeout(
                      () =>
                        document
                          .querySelector<HTMLInputElement>(
                            '[aria-label="Search requests…"]',
                          )
                          ?.focus(),
                      0,
                    );
                  }}
                />
                <kbd>
                  {navigator.userAgent.includes("Mac") ? "⌘ K" : "Ctrl K"}
                </kbd>
              </div>
            )}
            <span className="mode-label">
              <span />
              {mode === "demo" ? "Demo workspace" : "Connected"}
            </span>
            <NotificationCenter
              key={actor.id} state={state} actor={actor} open={notifications} busy={busy}
              onToggle={()=>{setNotifications(current=>!current);setAccountMenu(false);}}
              onClose={()=>setNotifications(false)} onUpdate={updateNotification}
              onNavigate={openNotificationDestination} syncError={loadError} onRetry={()=>void refresh()}
            />
            <div className="account-wrap">
              <button
                className="account-button"
                onClick={() => {
                  setAccountMenu(!accountMenu);
                  setNotifications(false);
                }}
                aria-label="Account menu"
                aria-expanded={accountMenu}
              >
                <Avatar name={actor.name} size="small" color={2} />
                <span>{actor.name.split(" ")[0]}</span>
                <ChevronDown size={12} />
              </button>
              {accountMenu && (
                <div className="popover account-popover">
                  <div className="account-details">
                    <strong>{actor.name}</strong>
                    <small>{actor.email}</small>
                    <Badge>
                      {actor.role === "staff"
                        ? "Virtual assistant"
                        : actor.role}
                    </Badge>
                  </div>
                  <button onClick={() => navigate("Profile")}>
                    <Settings2 size={15} />
                    Your profile
                  </button>
                  {mode === "demo" && (
                    <>
                      <span className="menu-label">SWITCH DEMO ACCOUNT</span>
                      {(["client", "staff", "admin"] as const).map((role) => (
                        <button
                          key={role}
                          onClick={() => {
                            setState(null);
                            setToast(null);
                            setIdentity(enterDemo(role));
                            navigate("Overview");
                          }}
                        >
                          {role === "staff" ? (
                            <Users size={15} />
                          ) : role === "admin" ? (
                            <ShieldCheck size={15} />
                          ) : (
                            <BriefcaseBusiness size={15} />
                          )}
                          <span>
                            {role === "staff"
                              ? "Virtual assistant"
                              : role === "admin"
                                ? "Admin"
                                : "Client"}
                          </span>
                          {actor.role === role && <Check size={14} />}
                        </button>
                      ))}
                    </>
                  )}
                  <button className="signout" onClick={() => void signout()}>
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main
          className={`content ${dialog?.type === "request" ? "creating-request" : ""} ${page === "Overview" ? `overview-content ${actor.role === "client" ? "has-attention" : ""}` : ""}`}
          key={page}
        >
          <div id="workflow-page" />
          <div className="workspace-page-content" hidden={dialog?.type === "request"}>
          {actionError && !dialog && <div className="inline-action-error" role="alert"><CircleHelp size={18} /><span>{actionError}</span><button className="text-button" onClick={() => setActionError("")}>Dismiss</button></div>}
          {loadError && (
            <div className="banner error-banner" role="alert">
              {loadError}
              <button className="text-button" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          )}
          {page === "Overview" && actor.role === "admin" && (
            <>
              <OwnerDashboard state={state} tracking={tracking}
                onRequest={(id) => setDialog({ type: "ticket", id })}
                onTime={() => navigate("Time & attendance")}
                onBilling={() => navigate("Billing")}
                onClients={() => navigate("Clients")} />
              <div className="workspace-footer"><span>{brand.name}</span><span title={buildLabel}>Test Version 1.3.4.9 · {versionLabel} · {environmentLabel}</span></div>
            </>
          )}
          {page === "Overview" && ["client", "staff"].includes(actor.role) && (
            <>
              <RoleDashboard key={actor.id} state={state} actor={actor} tracking={tracking}
                onRequest={(id) => setDialog({ type: "ticket", id })}
                onPayment={(id) => setDialog({ type: "pay", id })}
                onConversation={openConversation}
                onAppointment={(id) => setDialog({ type: "cancel", id })}
                onTime={() => navigate("Time & attendance")}
                onCreate={() => setDialog({ type: "request" })}
                onBoard={() => navigate("Work board")} />
              <div className="workspace-footer"><span>{brand.name}</span><span title={buildLabel}>Test Version 1.3.4.9 · {versionLabel} · {environmentLabel}</span></div>
            </>
          )}

          {page === "Work board" && (
            <WorkBoard state={state} actor={actor}
              onOpenTicket={(id) => setDialog({ type: "ticket", id })}
              onCreate={actor.role === "client" ? () => setDialog({ type: "request" }) : undefined} />
          )}
          {page === "Time & attendance" && (actor.role === "admin" || actor.role === "staff") && (
            <TimeWorkspace tracking={tracking} state={state} actor={actor} />
          )}
          {page === "Clients" && actor.role === "admin" && (
            <ClientDirectory state={state} actor={actor}
              onOpenTicket={(id) => setDialog({ type: "ticket", id })} />
          )}
          {page === "Request templates" && actor.role === "client" && (
            <ServiceTemplates onUse={(templateId) => setDialog({ type: "request", templateId })} />
          )}

          {page === "Assistants" && actor.role === "client" && (
            <>
              <SectionHead
                title="Find an assistant"
                description="Explore active Nexus assistants by service and availability. Open a profile to learn more or book a call."
                action={requestButton}
              />
              <div
                className="assistant-directory-controls"
                role="search"
                aria-label="Find assistants"
              >
                <label>
                  <span>Search</span>
                  <input
                    type="search"
                    placeholder="Name or skill"
                    value={assistantSearch}
                    onChange={(event) => setAssistantSearch(event.target.value)}
                  />
                </label>
                <label>
                  <span>Service</span>
                  <select
                    value={assistantCategory}
                    onChange={(event) =>
                      setAssistantCategory(event.target.value)
                    }
                  >
                    <option>All services</option>
                    {categories.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Availability</span>
                  <select
                    value={assistantAvailability}
                    onChange={(event) =>
                      setAssistantAvailability(event.target.value)
                    }
                  >
                    <option>All assistants</option>
                    <option>Available now</option>
                  </select>
                </label>
              </div>
              <p className="assistant-result-count" role="status">
                {availableAssistants.length}{" "}
                {availableAssistants.length === 1 ? "assistant" : "assistants"}{" "}
                found
              </p>
              {availableAssistants.length ? (
                <div className="assistant-directory-grid">
                  {availableAssistants.map((profile) => {
                    const pastRatings = overviewTickets.filter(
                      (ticket) =>
                        ticket.assigneeId === profile.id && ticket.rating,
                    );
                    const visualCategory =
                      profile.skills.find(
                        (skill) => skill === assistantCategory,
                      ) ||
                      profile.skills.find(
                        (skill) => skill !== "Administrative support",
                      ) ||
                      profile.skills[0];
                    return (
                      <article
                        className="assistant-directory-card"
                        key={profile.id}
                      >
                        <img
                          src={serviceVisual(visualCategory)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="assistant-directory-body">
                          <div className="assistant-directory-identity">
                            <Avatar name={profile.name} />
                            <div>
                              <h2>{profile.name}</h2>
                              <span>
                                {profile.available
                                  ? "Available for calls"
                                  : "Currently away"}
                              </span>
                            </div>
                          </div>
                          <p>{profile.bio || "Nexus virtual assistant"}</p>
                          <div
                            className="assistant-skill-list"
                            aria-label={`${profile.name}'s services`}
                          >
                            {profile.skills.slice(0, 3).map((skill) => (
                              <span key={skill}>{skill}</span>
                            ))}
                            {profile.skills.length > 3 && (
                              <small>+{profile.skills.length - 3} more</small>
                            )}
                          </div>
                          <div className="assistant-directory-foot">
                            <span>
                              {pastRatings.length
                                ? `${(pastRatings.reduce((sum, ticket) => sum + (ticket.rating || 0), 0) / pastRatings.length).toFixed(1)} ★ from your requests`
                                : "No feedback from your requests"}
                            </span>
                            <button
                              className="button secondary compact"
                              onClick={() =>
                                setDialog({ type: "assistant", id: profile.id })
                              }
                            >
                              View profile
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <Empty
                  icon={<Users size={24} />}
                  title="No assistants match these filters"
                  text="Try a different service or include assistants who are currently away."
                />
              )}
            </>
          )}

          {page === "Requests" && (
            <>
              <SectionHead
                title="Requests"
                description="Manage the brief, budget, assignment, and status of each service."
                action={requestButton}
              />
              {actor.role === "admin" && assigneeFilter && (
                <div className="request-scope-note">
                  <span>
                    Showing requests assigned to{" "}
                    <strong>
                      {person(assigneeFilter)?.name || "this assistant"}
                    </strong>
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setAssigneeFilter(null)}
                  >
                    Clear filter
                  </button>
                </div>
              )}
              {createdWindow && (
                <div className="request-scope-note">
                  <span>
                    Opened during <strong>{createdWindow.label}</strong>
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setCreatedWindow(null)}
                  >
                    Clear date filter
                  </button>
                </div>
              )}
              <div className="page-tabs">
                {[
                  "All requests",
                  "Open",
                  "In progress",
                  "In review",
                  "Completed",
                  ...(actor.role === "staff" ? ["Available"] : []),
                ].map((f) => (
                  <button
                    key={f}
                    className={filter === f ? "active" : ""}
                    onClick={() => setFilter(f)}
                  >
                    {f}
                    <span>
                      {f === "All requests"
                        ? requestScope.length
                        : requestScope.filter((t) =>
                            f === "Available" ? !t.assigneeId : t.status === f,
                          ).length}
                    </span>
                  </button>
                ))}
              </div>
              <section className="panel requests-panel">
                <div className="table-toolbar">
                  <SearchBox value={search} onChange={setSearch} />
                  <div className="request-toolbar-meta">
                    <span className="muted" role="status">
                      {filtered.length} request
                      {filtered.length !== 1 ? "s" : ""}
                    </span>
                    {(search ||
                      filter !== "All requests" ||
                      createdWindow ||
                      assigneeFilter) && (
                      <button
                        className="text-button"
                        onClick={() => {
                          setSearch("");
                          setFilter("All requests");
                          setAssigneeFilter(null);
                          setCreatedWindow(null);
                        }}
                      >
                        Reset view
                      </button>
                    )}
                  </div>
                </div>
                {actor.role === "admin" &&
                  selectedVisibleRequests.length > 0 && (
                    <div className="request-selection-bar" role="status">
                      <strong>{selectedVisibleRequests.length} selected</strong>
                      <div>
                        <button
                          className="button secondary compact"
                          onClick={exportSelectedRequests}
                        >
                          <Download size={15} /> Download summary
                        </button>
                        <button
                          className="text-button"
                          onClick={() => setSelectedRequestIds([])}
                        >
                          Clear selection
                        </button>
                      </div>
                    </div>
                  )}
                <DataTable
                  data={filtered}
                  columns={columns}
                  mobileCard={requestCard}
                  onRow={(t) => setDialog({ type: "ticket", id: t.id })}
                  empty="No requests match this view. Try another filter or create a new request."
                  pageSize={8}
                />
              </section>
              {actor.role === "staff" && (
                <div className="info-note">
                  <Sparkles size={18} />
                  <span>
                    Automatic matching uses your availability, service skills,
                    and difficulty level. Update them in{" "}
                    <button
                      className="text-button"
                      onClick={() => navigate("Profile")}
                    >
                      your profile
                    </button>
                    .
                  </span>
                </div>
              )}
            </>
          )}

          {page === "Appointments" && actor.role !== "admin" && (
            <>
              <SectionHead
                title="Appointments"
                description={`Coordinate your authorized appointments. Times shown in ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`}
                action={
                  actor.role === "client" && (
                    <button
                      className="button primary"
                      onClick={() => setDialog({ type: "appointment" })}
                    >
                      <Plus size={16} />
                      Schedule appointment
                    </button>
                  )
                }
              />
              <div className="calendar-layout nexus-calendar">
                <section className="panel calendar-panel">
                  <div className="calendar-intro">
                    <div>
                      <span>My schedule</span>
                      <h2>Plan your time</h2>
                    </div>
                    <p>
                      Select a date to{" "}
                      {actor.role === "client"
                        ? "book a call"
                        : "see your assigned meetings"}
                      .
                    </p>
                  </div>
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "dayGridMonth,timeGridWeek,timeGridDay",
                    }}
                    height="auto"
                    events={myAppointments.map((a) => ({
                      id: a.id,
                      title:
                        a.status === "No-show"
                          ? `No-show · ${a.title}`
                          : a.title,
                      start: a.start,
                      end: a.end,
                      classNames: [
                        a.status === "No-show"
                          ? "event-no-show"
                          : "event-scheduled",
                      ],
                      backgroundColor:
                        a.status === "No-show" ? "#523b61" : "#6f54ac",
                      borderColor:
                        a.status === "No-show" ? "#745581" : "#8f72ce",
                      textColor: "#ffffff",
                    }))}
                    dateClick={(info) => {
                      setCalendarDate(info.dateStr.slice(0, 10));
                      if (
                        actor.role === "client" &&
                        info.dateStr.slice(0, 10) >= dateInput()
                      )
                        setDialog({
                          type: "appointment",
                          date: info.dateStr.slice(0, 10),
                        });
                    }}
                    eventClick={(info) => {
                      setCalendarDate(
                        dateInput(info.event.start || new Date()),
                      );
                      setDialog({ type: "cancel", id: info.event.id });
                    }}
                    dayMaxEvents={2}
                    nowIndicator
                  />
                </section>
                <section className="panel calendar-upcoming">
                  <div className="panel-head">
                    <div>
                      <span className="calendar-day-label">
                        {dateText(calendarDate, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                      <h2>Schedule</h2>
                      <p>
                        {selectedAppointments.length}{" "}
                        {selectedAppointments.length === 1
                          ? "appointment"
                          : "appointments"}{" "}
                        on this day
                      </p>
                    </div>
                    <CalendarDays size={18} />
                  </div>
                  {selectedAppointments.length ? (
                    selectedAppointments.map(appointmentCard)
                  ) : (
                    <Empty
                      icon={<CalendarDays size={26} />}
                      title="No appointments on this day"
                      text={
                        actor.role === "client"
                          ? "Select a day in the calendar or schedule a call."
                          : "Your assigned meetings will appear here."
                      }
                    />
                  )}
                  {upcoming.length > 0 && (
                    <div className="calendar-next">
                      <h3>Coming up next</h3>
                      {upcoming.slice(0, 3).map(appointmentCard)}
                    </div>
                  )}
                  <div className="calendar-note">
                    <Clock3 size={17} />
                    <p>
                      Appointments can last up to 4 hours. We’ll check for
                      overlaps so everyone has room to focus.
                    </p>
                  </div>
                </section>
              </div>
            </>
          )}

          {page === "Messages" && actor.role !== "admin" && (
            <>
              <SectionHead
                title="Request conversations"
                description="One shared conversation for every request."
                action={
                  currentChat && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        setDialog({ type: "report", id: currentChat.id })
                      }
                    >
                      Report a problem
                    </button>
                  )
                }
              />
              <section className="panel messages-layout">
                <label className="conversation-picker">
                  Conversation
                  <select
                    aria-label="Choose conversation"
                    value={currentChat?.id || ""}
                    onChange={(event) => setConversation(event.target.value)}
                    disabled={!currentChat}
                  >
                    {!currentChat && (
                      <option value="">No conversations yet</option>
                    )}
                    {mine
                      .filter((ticket) => ticket.assigneeId)
                      .map((ticket) => (
                        <option key={ticket.id} value={ticket.id}>
                          {ticket.title} · NX-{ticket.number}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="conversation-list">
                  <div className="conversation-heading">
                    <h2>Conversations</h2>
                    <span className="count-pill">
                      {mine.filter((t) => t.assigneeId).length}
                    </span>
                  </div>
                  {mine
                    .filter((t) => t.assigneeId)
                    .map((t) => {
                      const counterpart = person(
                        actor.role === "client" ? t.assigneeId : t.clientId,
                      )!;
                      const last = state.messages
                        .filter((m) => m.ticketId === t.id)
                        .at(-1);
                      return (
                        <button
                          className={`conversation-item ${currentChat?.id === t.id ? "selected" : ""}`}
                          key={t.id}
                          onClick={() => setConversation(t.id)}
                        >
                          <Avatar
                            name={counterpart.name}
                            color={t.number % 4}
                          />
                          <span>
                            <strong>{t.title}</strong>
                            <small>
                              {counterpart.name} · NX-{t.number}
                            </small>
                            <p>{last?.text || "Start a conversation…"}</p>
                          </span>
                          <ChevronRight size={14} />
                        </button>
                      );
                    })}
                </div>
                {currentChat ? (
                  <div className="chat">
                    <header className="chat-head">
                      <div className="person-inline">
                        <Avatar
                          name={
                            person(
                              actor.role === "client"
                                ? currentChat.assigneeId
                                : currentChat.clientId,
                            )?.name || "Team"
                          }
                        />
                        <div>
                          <strong>
                            {
                              person(
                                actor.role === "client"
                                  ? currentChat.assigneeId
                                  : currentChat.clientId,
                              )?.name
                            }
                          </strong>
                          <small>
                            <span className="online-dot" />
                            {currentChat.title}
                          </small>
                        </div>
                      </div>
                      <button
                        className="button secondary compact"
                        onClick={() =>
                          setDialog({ type: "ticket", id: currentChat.id })
                        }
                      >
                        Request details
                        <ArrowUpRight size={14} />
                      </button>
                    </header>
                    <div className="chat-project-strip">
                      <span>NX-{currentChat.number}</span>
                      <Badge>{currentChat.status}</Badge>
                      <span className="chat-strip-spacer" />
                      {actor.role !== "client" &&
                        currentChat.status !== "Completed" && (
                          <button
                            className="text-button"
                            onClick={() =>
                              setDialog({ type: "payment", id: currentChat.id })
                            }
                          >
                            <CreditCard size={14} />
                            Request payment
                          </button>
                        )}
                      {actor.role === "client" && (
                        <button
                          className="text-button"
                          onClick={() => navigate("Billing")}
                        >
                          <CreditCard size={14} />
                          View billing
                        </button>
                      )}
                    </div>
                    <div className="chat-body">
                      <div className="chat-start">
                        <ShieldCheck size={13} />A shared space for you and your
                        request team.
                      </div>
                      {state.messages
                        .filter((m) => m.ticketId === currentChat.id)
                        .map((m) =>
                          m.system ? (
                            <div className="system-message" key={m.id}>
                              <CircleCheck size={12} />
                              {m.text}
                            </div>
                          ) : (
                            <div
                              className={`message-row ${m.senderId === actor.id ? "own" : ""}`}
                              key={m.id}
                            >
                              {m.senderId !== actor.id && (
                                <Avatar
                                  name={person(m.senderId)?.name || "Team"}
                                  size="small"
                                />
                              )}
                              <div className="message-block">
                                <div className="message-meta">
                                  {person(m.senderId)?.name.split(" ")[0]}
                                  <span>
                                    {dateText(m.createdAt)} ·{" "}
                                    {timeText(m.createdAt)}
                                  </span>
                                </div>
                                <div className="message-bubble">{m.text}</div>
                              </div>
                            </div>
                          ),
                        )}
                      {state.documents
                        .filter((d) => d.ticketId === currentChat.id)
                        .map((d) => (
                          <div className="chat-file" key={d.id}>
                            <span className="file-icon">
                              <FileText size={21} />
                            </span>
                            <div>
                              <strong>{d.name}</strong>
                              <small>
                                {d.isOutput ? "Request output" : "Shared file"}{" "}
                                · {dateText(d.createdAt)}
                              </small>
                            </div>
                            <button
                              className="icon-button"
                              aria-label={`Download ${d.name}`}
                              onClick={() => void download(d)}
                            >
                              <Download size={17} />
                            </button>
                          </div>
                        ))}
                      <div ref={chatBottom} />
                    </div>
                    {currentChat.status === "Completed" ? (
                      <div className="chat-closed">
                        <CircleCheck size={17} />
                        This request is complete. Thank you for making good
                        things happen.
                      </div>
                    ) : (
                      <form
                        className="chat-composer"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const text = String(
                            new FormData(form).get("message") || "",
                          );
                          if (
                            await perform(
                              {
                                type: "sendMessage",
                                ticketId: currentChat.id,
                                text,
                              },
                              "Message sent.",
                              false,
                            )
                          )
                            form.reset();
                        }}
                      >
                        <textarea
                          name="message"
                          aria-label="Your message"
                          placeholder="Write a message about this request…"
                          required
                          maxLength={5000}
                          rows={2}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              e.currentTarget.form?.requestSubmit();
                            }
                          }}
                        />
                        <div className="composer-actions">
                          {fileUpload(currentChat.id)}
                          <span>
                            Enter to send · Shift + Enter for a new line
                          </span>
                          <button
                            className="button primary compact"
                            disabled={busy}
                            type="submit"
                          >
                            Send
                            <Send size={14} />
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  <Empty
                    icon={<MessageSquare size={32} />}
                    title="Your next conversation starts here"
                    text="Once an assistant accepts your request, you can connect right here."
                  />
                )}
              </section>
            </>
          )}

          {page === "Billing" && (
            <>
              <SectionHead
                title="Billing & payments"
                description="Payment requests, confirmations, and history in one place."
              />
              <div className="billing-demo-banner">
                <ShieldCheck size={18} />
                <p>
                  <strong>Test payments only.</strong> No card details or real
                  charges.
                </p>
              </div>
              <dl
                className="dashboard-summary billing-summary"
                aria-label="Payment summary"
              >
                <div>
                  <dt>Total paid</dt>
                  <dd>{money(totalPaid)}</dd>
                </div>
                <div>
                  <dt>Awaiting payment</dt>
                  <dd>{money(outstandingTotal)}</dd>
                </div>
                <div>
                  <dt>Payment requests</dt>
                  <dd>{paymentRequestCount}</dd>
                </div>
              </dl>
              <section className="panel billing-panel">
                <div className="panel-head">
                  <div>
                    <h2>Payment activity</h2>
                  </div>
                </div>
                <DataTable
                  data={state.payments
                    .filter((p) => mine.some((t) => t.id === p.ticketId))
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
                  mobileCard={paymentCard}
                  mobileSortLabel="Sort payments"
                  columns={[
                    {
                      accessorKey: "description",
                      header: "Payment request",
                      cell: ({ row }) => (
                        <div className="payment-cell">
                          <div>
                            <strong>{row.original.description}</strong>
                            <small>
                              NX-
                              {
                                mine.find((t) => t.id === row.original.ticketId)
                                  ?.number
                              }{" "}
                              · {dateText(row.original.createdAt)}
                            </small>
                          </div>
                        </div>
                      ),
                    },
                    {
                      accessorKey: "amount",
                      header: "Amount",
                      cell: ({ row }) => (
                        <strong>{money(row.original.amount)}</strong>
                      ),
                    },
                    {
                      accessorKey: "status",
                      header: "Status",
                      cell: ({ row }) => <Badge>{row.original.status}</Badge>,
                    },
                    {
                      id: "action",
                      header: "",
                      enableSorting: false,
                      cell: ({ row }) => paymentAction(row.original),
                    },
                  ]}
                  empty="Payment requests will appear here when a service is requested."
                />
              </section>
            </>
          )}

          {page === "Files & documents" && (
            <>
              <SectionHead
                title="Files & documents"
                description="Your documents, shared resources, and finished work. All together."
                action={fileUpload()}
              />
              <div className="document-summary">
                <FolderOpen size={25} />
                <div>
                  <strong>Your shared workspace</strong>
                  <p>
                    Upload documents up to 10 MB. Request files can also be
                    shared directly in conversations.
                  </p>
                </div>
                <Badge tone="purple">
                  {
                    state.documents.filter(
                      (d) =>
                        actor.role !== "client" ||
                        d.ownerId === actor.id ||
                        mine.some((t) => t.id === d.ticketId),
                    ).length
                  }{" "}
                  files
                </Badge>
              </div>
              <section className="panel files-panel">
                <div className="table-toolbar">
                  <SearchBox
                    value={search}
                    onChange={setSearch}
                    placeholder="Search files…"
                  />
                  <span className="muted">
                    {mode === "demo"
                      ? "Stored in this browser"
                      : "Private Supabase storage"}
                  </span>
                </div>
                <DataTable
                  data={state.documents.filter(
                    (d) =>
                      (actor.role !== "client" ||
                        d.ownerId === actor.id ||
                        mine.some((t) => t.id === d.ticketId)) &&
                      d.name.toLowerCase().includes(search.toLowerCase()),
                  )}
                  mobileSortLabel="Sort files"
                  mobileCard={(doc) => (
                    <>
                      <div className="mobile-request-heading file-card-heading">
                        <div className="payment-cell">
                          <span
                            className={`file-icon ${doc.isOutput ? "output" : ""}`}
                          >
                            <FileText size={21} />
                          </span>
                          <div>
                            <strong>{doc.name}</strong>
                            <small>
                              {doc.isOutput
                                ? "Request output"
                                : "Shared document"}{" "}
                              ·{" "}
                              {doc.size < 1024 * 1024
                                ? `${Math.max(1, Math.round(doc.size / 1024))} KB`
                                : `${(doc.size / 1024 / 1024).toFixed(1)} MB`}
                            </small>
                          </div>
                        </div>
                        <Badge tone={doc.reviewed ? "paid" : "pending"}>
                          {doc.reviewed ? "Reviewed" : "To review"}
                        </Badge>
                      </div>
                      <dl className="mobile-request-facts">
                        <div>
                          <dt>Shared by</dt>
                          <dd>{person(doc.ownerId)?.name || "Team"}</dd>
                        </div>
                        <div>
                          <dt>Uploaded</dt>
                          <dd>{dateText(doc.createdAt)}</dd>
                        </div>
                      </dl>
                      {documentActions(doc, true)}
                    </>
                  )}
                  columns={[
                    {
                      accessorKey: "name",
                      header: "File name",
                      cell: ({ row }) => (
                        <div className="payment-cell">
                          <span
                            className={`file-icon ${row.original.isOutput ? "output" : ""}`}
                          >
                            <FileText size={21} />
                          </span>
                          <div>
                            <strong>{row.original.name}</strong>
                            <small>
                              {row.original.isOutput
                                ? "Request output"
                                : "Shared document"}{" "}
                              ·{" "}
                              {row.original.size < 1024 * 1024
                                ? `${Math.max(1, Math.round(row.original.size / 1024))} KB`
                                : `${(row.original.size / 1024 / 1024).toFixed(1)} MB`}
                            </small>
                          </div>
                        </div>
                      ),
                    },
                    {
                      id: "owner",
                      header: "Shared by",
                      cell: ({ row }) =>
                        person(row.original.ownerId)?.name || "Team",
                    },
                    {
                      accessorKey: "createdAt",
                      header: "Uploaded",
                      cell: ({ row }) => dateText(row.original.createdAt),
                    },
                    {
                      accessorKey: "reviewed",
                      header: "Status",
                      cell: ({ row }) => (
                        <Badge
                          tone={row.original.reviewed ? "paid" : "pending"}
                        >
                          {row.original.reviewed ? "Reviewed" : "To review"}
                        </Badge>
                      ),
                    },
                    {
                      id: "actions",
                      header: "",
                      enableSorting: false,
                      cell: ({ row }) => documentActions(row.original),
                    },
                  ]}
                  empty="A fresh folder. Upload your first document to get started."
                />
              </section>
            </>
          )}

          {page === "Profile" && (
            <>
              <SectionHead
                title="Your profile"
                description="Your profile, account details, and work preferences."
              />
              <div className="profile-layout">
                <aside className="panel profile-card">
                  <Avatar name={actor.name} size="large" color={2} />
                  <h2>{actor.name}</h2>
                  <p>{companyName(actor.company)}</p>
                  <Badge>
                    {actor.role === "staff" ? "Virtual assistant" : actor.role}
                  </Badge>
                  <div className="profile-status">
                    <span className="online-dot" />
                    {actor.status} account
                    <ShieldCheck size={16} />
                  </div>
                  <div className="profile-detail">
                    <span>Email address</span>
                    <strong>{actor.email}</strong>
                  </div>
                  <div className="profile-detail">
                    <span>Workspace</span>
                    <strong>
                      {mode === "demo"
                        ? "Prototype demo"
                        : "Supabase connected"}
                    </strong>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => navigate("Files & documents")}
                  >
                    <FolderOpen size={16} />
                    View my documents
                  </button>
                  <button
                    className="text-button signout"
                    onClick={() => void signout()}
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </aside>
                <section className="panel profile-form">
                  <div className="panel-head">
                    <div>
                      <h2>Profile information</h2>
                      <p>
                        Keep your contact and workspace information current.
                      </p>
                    </div>
                  </div>
                  <Form
                    key={actor.id}
                    onSubmit={async (form) => {
                      await perform(
                        {
                          type: "saveProfile",
                          name: str(form, "name"),
                          company: str(form, "company"),
                          bio: str(form, "bio"),
                          available: form.get("available") === "on",
                          autoAssign: form.get("autoAssign") === "on",
                          skillLevel: (str(form, "skillLevel") ||
                            actor.skillLevel) as Difficulty,
                          skills:
                            actor.role === "staff"
                              ? form.getAll("skills").map(String)
                              : actor.skills,
                        },
                        "Profile updated.",
                        false,
                      );
                    }}
                  >
                    <div className="form-row">
                      <Field label="Full name">
                        <input
                          name="name"
                          defaultValue={actor.name}
                          required
                          minLength={2}
                        />
                      </Field>
                      <Field label="Company / organization">
                        <input name="company" defaultValue={actor.company} />
                      </Field>
                    </div>
                    <Field label="About you">
                      <textarea
                        name="bio"
                        defaultValue={actor.bio}
                        rows={4}
                        maxLength={1000}
                      />
                    </Field>
                    {actor.role === "staff" && (
                      <>
                        <div className="form-section-title">
                          <h3>Your work, your way</h3>
                          <p>
                            Tell us what you’re available for. We’ll use these
                            details to match you with new work.
                          </p>
                        </div>
                        <label className="toggle-row">
                          <span>
                            <strong>Available for new requests</strong>
                            <small>
                              Let clients and your team know you have room.
                            </small>
                          </span>
                          <input
                            type="checkbox"
                            name="available"
                            defaultChecked={actor.available}
                          />
                        </label>
                        <label className="toggle-row">
                          <span>
                            <strong>Automatic assignment</strong>
                            <small>
                              Accept matching requests automatically after
                              payment.
                            </small>
                          </span>
                          <input
                            type="checkbox"
                            name="autoAssign"
                            defaultChecked={actor.autoAssign}
                          />
                        </label>
                        <Field label="Maximum service difficulty">
                          <select
                            name="skillLevel"
                            defaultValue={actor.skillLevel}
                          >
                            {difficulties.map((d) => (
                              <option key={d}>{d}</option>
                            ))}
                          </select>
                        </Field>
                        <div className="field">
                          <span>Your service skills</span>
                          <div className="skills-options">
                            {categories.map((c) => (
                              <label key={c}>
                                <input
                                  type="checkbox"
                                  name="skills"
                                  value={c}
                                  defaultChecked={actor.skills.includes(c)}
                                />
                                {c}
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    <div className="form-actions">
                      <span className="muted">
                        Changes apply to your workspace profile.
                      </span>
                      <Submit busy={busy}>
                        Save changes
                        <Check size={15} />
                      </Submit>
                    </div>
                  </Form>
                </section>
              </div>
            </>
          )}

          {(
            [
              "Conversation Review",
              "Schedule History",
              "Administrative Audit Logs",
            ] as Page[]
          ).includes(page) &&
            actor.role === "admin" && (
              <PrivacyDesk
                view={
                  page as
                    | "Conversation Review"
                    | "Schedule History"
                    | "Administrative Audit Logs"
                }
                actor={actor}
                profiles={state.profiles}
                tickets={state.tickets}
              />
            )}
          {page === "Activity logs" && actor.role === "admin" && (
            <>
              <SectionHead
                title="Operations & activity"
                description="Track payments and output delivery across your entire workspace."
              />
              <section className="panel operations-matrix">
                <div className="panel-head">
                  <div>
                    <h2>Payment and delivery status</h2>
                    <p>All client requests</p>
                  </div>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Payment</th>
                      <th scope="col">Output delivered</th>
                      <th scope="col">Awaiting output</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Fully paid</th>
                      <td>
                        <strong>{requestStatusCount(true, true)}</strong>
                      </td>
                      <td>
                        <strong>{requestStatusCount(true, false)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Not fully paid</th>
                      <td>
                        <strong>{requestStatusCount(false, true)}</strong>
                      </td>
                      <td>
                        <strong>{requestStatusCount(false, false)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="matrix-note">
                  Not fully paid includes pending, verified, or no payment
                  record.
                </p>
              </section>
              <section className="panel oversight-panel">
                <div className="panel-head">
                  <div>
                    <h2>Request oversight</h2>
                    <p>Payment and delivery for each request.</p>
                  </div>
                </div>
                <DataTable
                  data={mine}
                  mobileCard={oversightCard}
                  columns={[
                    {
                      accessorKey: "title",
                      header: "Request",
                      cell: ({ row }) => titleCell(row.original),
                    },
                    {
                      id: "client",
                      header: "Client",
                      cell: ({ row }) => person(row.original.clientId)?.name,
                    },
                    {
                      id: "payment",
                      header: "Payment",
                      cell: ({ row }) => (
                        <Badge>{paymentSummary(state, row.original.id)}</Badge>
                      ),
                    },
                    {
                      id: "output",
                      header: "Output",
                      cell: ({ row }) => (
                        <Badge
                          tone={row.original.deliveredAt ? "paid" : "pending"}
                        >
                          {row.original.deliveredAt
                            ? "Delivered"
                            : "Not delivered"}
                        </Badge>
                      ),
                    },
                    {
                      accessorKey: "status",
                      header: "Request status",
                      cell: ({ row }) => <Badge>{row.original.status}</Badge>,
                    },
                  ]}
                  onRow={(t) => setDialog({ type: "ticket", id: t.id })}
                />
              </section>
              <section className="panel audit-panel">
                <div className="panel-head">
                  <div>
                    <h2>Workspace activity log</h2>
                    <p>Changes made across the workspace.</p>
                  </div>
                </div>
                <DataTable
                  data={state.audit}
                  mobileCard={auditCard}
                  mobileSortLabel="Sort activity"
                  columns={[
                    {
                      accessorKey: "createdAt",
                      header: "Time",
                      cell: ({ row }) =>
                        `${dateText(row.original.createdAt)} · ${timeText(row.original.createdAt)}`,
                    },
                    {
                      id: "actor",
                      header: "Account",
                      cell: ({ row }) =>
                        person(row.original.actorId)?.name || "Team",
                    },
                    { accessorKey: "text", header: "Activity" },
                    {
                      id: "ticket",
                      header: "Request",
                      cell: ({ row }) => {
                        const t = mine.find(
                          (t) => t.id === row.original.ticketId,
                        );
                        return t ? (
                          <button
                            className="text-button"
                            onClick={() =>
                              setDialog({ type: "ticket", id: t.id })
                            }
                          >
                            NX-{t.number}
                            <ArrowUpRight size={12} />
                          </button>
                        ) : (
                          "—"
                        );
                      },
                    },
                  ]}
                  pageSize={8}
                />
              </section>
            </>
          )}

          {page === "Tools & software" && (
            <>
              <SectionHead
                title="Tools & integrations"
                description="The tools behind your workspace. Simple, connected, and ready to grow."
              />
              <div className="tools-grid">
                {[
                  {
                    name: "Supabase",
                    label: "DATABASE · AUTH · FILES",
                    text: "Your accounts, workspace data, and private documents, connected in one place.",
                    letter: "S",
                    color: "mint",
                    url: "https://supabase.com/docs",
                    status:
                      mode === "demo"
                        ? "Integration ready · setup required"
                        : "Connected",
                  },
                  {
                    name: "FullCalendar",
                    label: "SCHEDULING",
                    text: "Schedule appointments and review upcoming meetings with your assistant.",
                    letter: "F",
                    color: "purple",
                    url: "https://fullcalendar.io/docs",
                    status: "Active",
                  },
                  {
                    name: "TanStack Table",
                    label: "YOUR WORK, ORGANIZED",
                    text: "Sortable, paginated tables that make the details easier to find.",
                    letter: "T",
                    color: "peach",
                    url: "https://tanstack.com/table/latest",
                    status: "Active",
                  },
                  {
                    name: "Resend",
                    label: "EMAIL NOTIFICATIONS",
                    text: "A server-side email function for confirmed payments. Requires your API key and a verified sender.",
                    letter: "R",
                    color: "gold",
                    url: "https://resend.com/docs",
                    status: "Integration ready · setup required",
                  },
                  {
                    name: "Git + GitHub",
                    label: "SOURCE CONTROL",
                    text: "Prototype 1 source code and its preserved release are available in the public repository.",
                    letter: "G",
                    color: "purple",
                    url: "https://github.com/Seperoth/nexus-va-prototype-1",
                    status: "Prototype 1 repository",
                  },
                  {
                    name: "Railway",
                    label: "WHEN YOU’RE READY TO LAUNCH",
                    text: "Hosting comes later. This prototype runs locally until you decide to deploy.",
                    letter: "R",
                    color: "mint",
                    url: "https://docs.railway.com/",
                    status: "Not deployed",
                  },
                ].map((tool) => (
                  <a
                    className="panel tool-card"
                    key={tool.name}
                    href={tool.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <div>
                      <span className={`tool-letter ${tool.color}`}>
                        {tool.letter}
                      </span>
                      <ExternalLink size={16} />
                    </div>
                    <span className="eyebrow">{tool.label}</span>
                    <h2>{tool.name}</h2>
                    <p>{tool.text}</p>
                    <small>
                      <span className="online-dot" />
                      {tool.status}
                    </small>
                  </a>
                ))}
              </div>
            </>
          )}
          </div>
        </main>
      </div>

      {dialog && (
        <Modal
          key={`${dialog.type}-${dialog.id || dialog.templateId || "new"}`}
          variant={dialog.type === "request" ? "page" : ["pay", "feedback", "confirmCancel"].includes(dialog.type) ? "modal" : "drawer"}
          title={
            dialog.type === "confirmCancel"
              ? "Cancel this appointment?"
              : dialog.type === "request"
              ? "Create a request"
              : dialog.type === "appointment"
                ? "Schedule an appointment"
                : dialog.type === "reschedule"
                  ? "Reschedule appointment"
                  : dialog.type === "editAppointment"
                    ? "Edit appointment details"
                    : dialog.type === "report"
                      ? "Report a conversation problem"
                      : dialog.type === "payment"
                        ? "Create a payment request"
                        : dialog.type === "pay"
                          ? "Confirm test payment"
                          : dialog.type === "feedback"
                            ? "How did we do?"
                            : dialog.type === "help"
                              ? "Workspace guide"
                              : dialog.type === "assistant"
                                ? "Assistant profile"
                                : dialog.type === "cancel"
                                  ? "Appointment details"
                                  : "Request details"
          }
          subtitle={
            dialog.type === "request"
              ? "Define the work, budget, difficulty, and delivery date."
              : undefined
          }
          close={closeDialog}
          wide={dialog.type === "ticket"}
        >
          {actionError && <div className="inline-action-error" role="alert"><CircleHelp size={18} /><span>{actionError}</span></div>}
          {dialog.type === "confirmCancel" && <div className="confirmation-content">
            <p><strong>{myAppointments.find(a => a.id === dialog.id)?.title || "This appointment"}</strong> will be removed from the schedule. The other participant will be notified.</p>
            <div className="form-actions">
              <button className="button secondary" disabled={busy} onClick={() => setDialog({type:"cancel", id:dialog.id})}>Keep appointment</button>
              <button className="button danger-secondary" disabled={busy} onClick={() => void perform({type:"cancelAppointment", appointmentId:dialog.id!}, "Appointment cancelled.")}>{busy ? "Cancelling…" : "Cancel appointment"}</button>
            </div>
          </div>}
          {dialog.type === "assistant" &&
            (() => {
              const profile = state.profiles.find(
                (item) =>
                  item.id === dialog.id &&
                  item.role === "staff" &&
                  item.status === "Active",
              );
              if (!profile || actor.role !== "client")
                return (
                  <p className="muted">
                    This assistant profile is unavailable.
                  </p>
                );
              const pastRatings = overviewTickets.filter(
                (ticket) => ticket.assigneeId === profile.id && ticket.rating,
              );
              return (
                <div className="assistant-profile-detail">
                  <div className="assistant-profile-top">
                    <Avatar name={profile.name} />
                    <div>
                      <h2>{profile.name}</h2>
                      <p>
                        {profile.available
                          ? "Available for calls"
                          : "Currently away"}
                      </p>
                    </div>
                  </div>
                  <p>{profile.bio || "Nexus virtual assistant"}</p>
                  <h3>Services</h3>
                  <div className="assistant-skill-list">
                    {profile.skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                  <p className="assistant-rating-note">
                    {pastRatings.length
                      ? `Your requests: ${(pastRatings.reduce((sum, ticket) => sum + (ticket.rating || 0), 0) / pastRatings.length).toFixed(1)} out of 5 across ${pastRatings.length} completed ${pastRatings.length === 1 ? "request" : "requests"}.`
                      : "No completed requests with this assistant in your workspace yet."}
                  </p>
                  <div className="form-actions">
                    <button className="button secondary" onClick={closeDialog}>
                      Close
                    </button>
                    <button
                      className="button primary"
                      disabled={!profile.available}
                      onClick={() =>
                        setDialog({ type: "appointment", staffId: profile.id })
                      }
                    >
                      Book a call
                    </button>
                  </div>
                </div>
              );
            })()}
          {dialog.type === "request" && (
            <Form
              onSubmit={async (form) => {
                await perform(
                  {
                    type: "createTicket",
                    title: str(form, "title"),
                    description: str(form, "description"),
                    category: str(form, "category"),
                    budget: Number(form.get("budget")),
                    difficulty: str(form, "difficulty") as Difficulty,
                    dueDate: str(form, "dueDate"),
                  },
                  "Your request is live. Your test payment is ready in Billing.",
                );
              }}
            >
              <Field label="Give your request a name">
                <input
                  name="title"
                  placeholder="e.g. A fresh set of social media posts"
                  defaultValue={requestTemplates.find((t) => t.id === dialog.templateId)?.title}
                  required
                  minLength={5}
                  maxLength={150}
                />
              </Field>
              <Field label="What would you like help with?">
                <select name="category" required defaultValue={requestTemplates.find((t) => t.id === dialog.templateId)?.category || ""}>
                  <option value="" disabled>
                    Choose a service
                  </option>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field
                label="The details make the difference"
                hint="Include your goals, deliverables, and anything your assistant should know."
              >
                <textarea
                  name="description"
                  placeholder="Describe the expected output, requirements, and reference material."
                  defaultValue={requestTemplates.find((t) => t.id === dialog.templateId)?.description}
                  rows={4}
                  required
                  minLength={15}
                  maxLength={5000}
                />
              </Field>
              <div className="form-row">
                <Field label="Your budget (USD)">
                  <div className="input-prefix">
                    <span>$</span>
                    <input
                      name="budget"
                      type="number"
                      min={1}
                      max={1000000}
                      step="0.01"
                      placeholder="250"
                      required
                    />
                  </div>
                </Field>
                <Field label="When do you need it?">
                  <input
                    name="dueDate"
                    type="date"
                    required
                    min={dateInput()}
                  />
                </Field>
              </div>
              <div className="field">
                <span>How much is involved?</span>
                <div className="difficulty-options">
                  {difficulties.map((d, i) => (
                    <label key={d}>
                      <input
                        type="radio"
                        name="difficulty"
                        value={d}
                        defaultChecked={d === (requestTemplates.find((t) => t.id === dialog.templateId)?.difficulty || "Medium")}
                      />
                      <span className={`difficulty-bars difficulty-${i}`}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <strong>{d}</strong>
                      <small>
                        {
                          [
                            "A straightforward task",
                            "A few moving parts",
                            "A bigger challenge",
                          ][i]
                        }
                      </small>
                    </label>
                  ))}
                </div>
              </div>
              <div className="info-note">
                <ShieldCheck size={17} />
                <p>
                  Submitting creates a test payment for your budget. Pay it in
                  Billing to match with an available assistant, or let an
                  assistant accept the request first.
                </p>
              </div>
              <div className="form-actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={closeDialog}
                >
                  Cancel
                </button>
                <Submit busy={busy}>
                  Create request
                  <ArrowUpRight size={15} />
                </Submit>
              </div>
            </Form>
          )}
          {dialog.type === "ticket" &&
            (() => {
              const t = mine.find((t) => t.id === dialog.id);
              if (!t) return <p>Request not found.</p>;
              const assistant = person(t.assigneeId);
              const docs = state.documents.filter((d) => d.ticketId === t.id);
              const payments = state.payments.filter(
                (p) => p.ticketId === t.id,
              );
              return (
                <div className="ticket-detail">
                  <div className="ticket-topline">
                    <span>NX-{t.number}</span>
                    <Badge>{t.status}</Badge>
                    <Badge
                      tone={`difficulty-badge ${t.difficulty.toLowerCase()}`}
                    >
                      {t.difficulty}
                    </Badge>
                  </div>
                  <h2>{t.title}</h2>
                  <span className="ticket-category">{t.category}</span>
                  <div className="ticket-description">{t.description}</div>
                  <div className="ticket-facts">
                    <div>
                      <span>Request budget</span>
                      <strong>{money(t.budget)}</strong>
                    </div>
                    <div>
                      <span>Due date</span>
                      <strong>{dateText(t.dueDate)}</strong>
                    </div>
                    <div>
                      <span>Your assistant</span>
                      <strong>
                        {assistant ? (
                          <>
                            <Avatar name={assistant.name} size="tiny" />
                            {assistant.name}
                          </>
                        ) : (
                          "Finding the right match"
                        )}
                      </strong>
                    </div>
                  </div>
                  {actor.role === "admin" &&
                    t.status !== "Completed" &&
                    !t.deliveredAt && (
                      <Form
                        className="assignment-form"
                        onSubmit={async (form) => {
                          await perform(
                            {
                              type: "assignTicket",
                              ticketId: t.id,
                              staffId: str(form, "staffId"),
                            },
                            "Assistant assigned.",
                            false,
                          );
                        }}
                      >
                        <Field label="Assign an assistant">
                          <select
                            name="staffId"
                            defaultValue={t.assigneeId || ""}
                            required
                          >
                            <option value="" disabled>
                              Choose an assistant
                            </option>
                            {state.profiles
                              .filter((p) => p.role === "staff")
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </Field>
                        <Submit busy={busy}>Assign</Submit>
                      </Form>
                    )}
                  <div className="ticket-section">
                    <div className="ticket-section-head">
                      <h3>Payment tracking</h3>
                      {actor.role !== "client" &&
                        t.assigneeId &&
                        t.status !== "Completed" && (
                          <button
                            className="text-button"
                            onClick={() =>
                              setDialog({ type: "payment", id: t.id })
                            }
                          >
                            <Plus size={14} />
                            Request payment
                          </button>
                        )}
                    </div>
                    {payments.length ? (
                      payments.map((p) => (
                        <div className="ticket-payment" key={p.id}>
                          <span className="payment-icon">
                            <CreditCard size={18} />
                          </span>
                          <div>
                            <strong>{p.description}</strong>
                            <small>{money(p.amount)} · Simulated payment</small>
                          </div>
                          <Badge>{p.status}</Badge>
                          {actor.role === "client" && p.status !== "Paid" && (
                            <button
                              className="button primary compact"
                              onClick={() =>
                                setDialog({ type: "pay", id: p.id })
                              }
                            >
                              Pay
                            </button>
                          )}
                          {actor.role !== "client" &&
                            p.status === "Pending" && (
                              <button
                                className="button secondary compact"
                                disabled={busy}
                                onClick={() =>
                                  void perform(
                                    { type: "verifyPayment", paymentId: p.id },
                                    "Payment request verified.",
                                    false,
                                  )
                                }
                              >
                                Verify
                              </button>
                            )}
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        Your assistant will set up payment tracking after you
                        agree on the details.
                      </p>
                    )}
                  </div>
                  <div className="ticket-section">
                    <div className="ticket-section-head">
                      <h3>Files & final output</h3>
                      {t.status !== "Completed" &&
                        actor.role !== "admin" &&
                        (actor.id === t.assigneeId
                          ? fileUpload(t.id, true)
                          : fileUpload(t.id))}
                    </div>
                    {actor.role === "admin" ? (
                      <p className="muted">
                        Request attachments are private. Use an approved
                        Conversation Review case for justified, read-only
                        access.
                      </p>
                    ) : docs.length ? (
                      docs.map((d) => (
                        <div className="ticket-file" key={d.id}>
                          <FileText size={19} />
                          <div>
                            <strong>{d.name}</strong>
                            <small>
                              {d.isOutput ? "Final output" : "Shared document"}{" "}
                              · {dateText(d.createdAt)}
                            </small>
                          </div>
                          <button
                            className="icon-button"
                            aria-label={`Download ${d.name}`}
                            onClick={() => void download(d)}
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        No files have been attached to this request yet.
                      </p>
                    )}
                  </div>
                  {t.rating && (
                    <div className="feedback-display">
                      <span>
                        {"★".repeat(t.rating)}
                        {"☆".repeat(5 - t.rating)}
                      </span>
                      <strong>A job well done.</strong>
                      <p>{t.feedback || "Thank you for your feedback!"}</p>
                    </div>
                  )}
                  <div className="ticket-actions">
                    {t.assigneeId && actor.role !== "admin" && (
                      <button
                        className="button secondary"
                        onClick={() => openConversation(t.id)}
                      >
                        <MessageSquare size={16} />
                        Open conversation
                      </button>
                    )}
                    {actor.role === "staff" && !t.assigneeId && (
                      <button
                        className="button primary"
                        disabled={busy}
                        onClick={() =>
                          void perform(
                            { type: "acceptTicket", ticketId: t.id },
                            "Request accepted. Your conversation is ready.",
                          )
                        }
                      >
                        <Check size={16} />
                        Accept request
                      </button>
                    )}
                    {(actor.id === t.assigneeId || actor.role === "admin") &&
                      ["In progress", "In review"].includes(t.status) &&
                      !t.deliveredAt && (
                        <button
                          className="button primary"
                          disabled={busy}
                          onClick={() =>
                            void perform(
                              { type: "deliver", ticketId: t.id },
                              "Output delivered. Your client has been notified.",
                            )
                          }
                        >
                          <CheckCheck size={16} />
                          Deliver output
                        </button>
                      )}
                    {actor.id === t.clientId && t.status === "In review" && (
                      <button
                        className="button primary"
                        onClick={() =>
                          setDialog({ type: "feedback", id: t.id })
                        }
                      >
                        <Star size={16} />
                        Approve & leave feedback
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          {dialog.type === "appointment" && (
            <Form
              onSubmit={async (form) => {
                const start = new Date(
                  `${str(form, "date")}T${str(form, "time")}`,
                );
                const end = new Date(
                  +start + Number(form.get("duration")) * 60000,
                );
                await perform(
                  {
                    type: "createAppointment",
                    title: str(form, "title"),
                    staffId: str(form, "staffId"),
                    start: start.toISOString(),
                    end: end.toISOString(),
                    notes: str(form, "notes"),
                  },
                  "Appointment scheduled.",
                );
              }}
            >
              <Field label="What’s on the agenda?">
                <input
                  name="title"
                  placeholder="e.g. Weekly project catch-up"
                  required
                  maxLength={150}
                />
              </Field>
              <Field label="Who would you like to connect with?">
                <select name="staffId" required defaultValue={dialog.staffId}>
                  {state.profiles
                    .filter(
                      (p) =>
                        p.role === "staff" &&
                        p.available &&
                        p.status === "Active",
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </Field>
              <div className="form-row">
                <Field label="Date">
                  <input
                    type="date"
                    name="date"
                    min={dateInput()}
                    defaultValue={dialog.date}
                    required
                  />
                </Field>
                <Field label="Time">
                  <input
                    type="time"
                    name="time"
                    defaultValue="10:00"
                    required
                  />
                </Field>
              </div>
              <Field label="How much time do you need?">
                <select name="duration" defaultValue="30">
                  <option value="15">15 minutes · A quick hello</option>
                  <option value="30">30 minutes · A good catch-up</option>
                  <option value="60">1 hour · Room to go deeper</option>
                  <option value="120">2 hours · Let’s make a plan</option>
                </select>
              </Field>
              <Field label="Anything else? (optional)">
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Add an agenda or preparation notes…"
                  maxLength={2000}
                />
              </Field>
              <div className="info-note">
                <Clock3 size={16} />
                <span>
                  Times use your local timezone:{" "}
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}.
                </span>
              </div>
              <div className="form-actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={closeDialog}
                >
                  Cancel
                </button>
                <Submit busy={busy}>
                  Schedule appointment
                  <CalendarDays size={15} />
                </Submit>
              </div>
            </Form>
          )}
          {dialog.type === "cancel" &&
            (() => {
              const a = myAppointments.find((a) => a.id === dialog.id);
              return a ? (
                <div className="appointment-detail">
                  <span className="appointment-detail-icon">
                    <Video size={26} />
                  </span>
                  <h2>{a.title}</h2>
                  <p>
                    {dateText(a.start, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p>
                    {timeText(a.start)} – {timeText(a.end)} ·{" "}
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </p>
                  <div className="person-inline">
                    <Avatar
                      name={
                        person(actor.role === "client" ? a.staffId : a.clientId)
                          ?.name || "Participant"
                      }
                    />
                    <span>
                      {
                        person(actor.role === "client" ? a.staffId : a.clientId)
                          ?.name
                      }
                    </span>
                  </div>
                  {a.notes && <blockquote>{a.notes}</blockquote>}
                  {a.status === "No-show" && (
                    <p className="calendar-outcome">Marked no-show</p>
                  )}
                  <div className="form-actions">
                    {new Date(a.start) > new Date() && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          setDialog({ type: "editAppointment", id: a.id })
                        }
                      >
                        Edit details
                      </button>
                    )}
                    {new Date(a.start) > new Date() && (
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() =>
                          setDialog({ type: "reschedule", id: a.id })
                        }
                      >
                        Reschedule
                      </button>
                    )}
                    {new Date(a.end) <= new Date() &&
                      a.status !== "No-show" && (
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() =>
                            void perform(
                              { type: "markNoShow", appointmentId: a.id },
                              "Appointment marked no-show.",
                            )
                          }
                        >
                          Mark no-show
                        </button>
                      )}
                    <button
                      className="button danger-secondary"
                      disabled={busy}
                      onClick={() => setDialog({ type: "confirmCancel", id: a.id })}
                    >
                      Cancel appointment
                    </button>
                    <button className="button primary" onClick={closeDialog}>
                      All set
                      <Check size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <p>This appointment has been cancelled.</p>
              );
            })()}
          {dialog.type === "reschedule" &&
            (() => {
              const appointment = myAppointments.find(
                (item) => item.id === dialog.id,
              );
              if (!appointment)
                return <p>Appointment is no longer available.</p>;
              return (
                <Form
                  onSubmit={async (form) => {
                    const start = new Date(
                      `${str(form, "date")}T${str(form, "time")}`,
                    );
                    const end = new Date(
                      start.getTime() + Number(form.get("duration")) * 60000,
                    );
                    await perform(
                      {
                        type: "rescheduleAppointment",
                        appointmentId: appointment.id,
                        start: start.toISOString(),
                        end: end.toISOString(),
                      },
                      "Appointment rescheduled.",
                    );
                  }}
                >
                  <p>
                    Choose a new time for <strong>{appointment.title}</strong>.
                    The other participant will be notified.
                  </p>
                  <div className="form-row">
                    <Field label="New date">
                      <input
                        name="date"
                        type="date"
                        min={dateInput()}
                        defaultValue={dateInput(new Date(appointment.start))}
                        required
                      />
                    </Field>
                    <Field label="New time">
                      <input
                        name="time"
                        type="time"
                        defaultValue={new Date(appointment.start)
                          .toTimeString()
                          .slice(0, 5)}
                        required
                      />
                    </Field>
                  </div>
                  <Field label="Duration">
                    <select
                      name="duration"
                      defaultValue={String(
                        Math.round(
                          (new Date(appointment.end).getTime() -
                            new Date(appointment.start).getTime()) /
                            60000,
                        ),
                      )}
                    >
                      {[15, 30, 60, 120, 240].map((minutes) => (
                        <option value={minutes} key={minutes}>
                          {minutes < 60
                            ? `${minutes} minutes`
                            : `${minutes / 60} ${minutes === 60 ? "hour" : "hours"}`}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="form-actions">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={closeDialog}
                    >
                      Back
                    </button>
                    <Submit busy={busy}>Save new time</Submit>
                  </div>
                </Form>
              );
            })()}
          {dialog.type === "editAppointment" &&
            (() => {
              const appointment = myAppointments.find(
                (item) => item.id === dialog.id,
              );
              if (!appointment)
                return <p>Appointment is no longer available.</p>;
              return (
                <Form
                  onSubmit={async (form) => {
                    await perform(
                      {
                        type: "editAppointment",
                        appointmentId: appointment.id,
                        title: str(form, "title"),
                        notes: str(form, "notes"),
                      },
                      "Appointment details updated.",
                    );
                  }}
                >
                  <Field label="Agenda title">
                    <input
                      name="title"
                      defaultValue={appointment.title}
                      maxLength={150}
                      required
                    />
                  </Field>
                  <Field label="Notes">
                    <textarea
                      name="notes"
                      defaultValue={appointment.notes}
                      maxLength={2000}
                      rows={4}
                    />
                  </Field>
                  <p>
                    The other participant will be notified. To change the time,
                    use Reschedule.
                  </p>
                  <div className="form-actions">
                    <button
                      className="button secondary"
                      type="button"
                      onClick={closeDialog}
                    >
                      Back
                    </button>
                    <Submit busy={busy}>Save details</Submit>
                  </div>
                </Form>
              );
            })()}
          {dialog.type === "report" &&
            (() => {
              const ticket = mine.find(
                (item) => item.id === dialog.id && item.assigneeId,
              );
              const client = supabase;
              if (!ticket) return <p>This conversation is not available.</p>;
              if (!client)
                return (
                  <div className="info-note">
                    <LockKeyhole size={18} />
                    <span>
                      Private case review needs a connected Supabase workspace.
                      This browser demo cannot protect reports or messages.
                    </span>
                  </div>
                );
              return (
                <Form
                  onSubmit={async (form) => {
                    setBusy(true);
                    try {
                      const { data, error } = await client.rpc(
                        "request_review_case",
                        {
                          case_kind: "conversation",
                          case_purpose: str(form, "purpose"),
                          case_reason: str(form, "reason"),
                          conversation_id: ticket.id,
                          schedule_subject: null,
                          assigned_reviewer: null,
                          range_start: new Date(
                            str(form, "start"),
                          ).toISOString(),
                          range_end: new Date(str(form, "end")).toISOString(),
                        },
                      );
                      if (error || !data)
                        throw new Error(
                          error?.message ||
                            "A reviewer is not available yet. Contact the privacy team.",
                        );
                      showToast(`Report filed. Case ${data}`);
                      setDialog(null);
                    } catch (error) {
                      showToast(
                        error instanceof Error
                          ? error.message
                          : "Report could not be filed.",
                        true,
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <p>
                    Report a concern about <strong>{ticket.title}</strong>. A
                    separate reviewer must approve limited access before reading
                    messages. Do not quote message content in the reason.
                  </p>
                  <Field label="Purpose">
                    <input
                      name="purpose"
                      minLength={8}
                      maxLength={200}
                      required
                      placeholder="What should this review resolve?"
                    />
                  </Field>
                  <div className="form-row">
                    <Field label="From">
                      <input
                        name="start"
                        type="datetime-local"
                        required
                        defaultValue={new Date(
                          Date.now() -
                            7 * 86400000 -
                            new Date().getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)}
                      />
                    </Field>
                    <Field label="To">
                      <input
                        name="end"
                        type="datetime-local"
                        required
                        defaultValue={new Date(
                          Date.now() -
                            60000 -
                            new Date().getTimezoneOffset() * 60000,
                        )
                          .toISOString()
                          .slice(0, 16)}
                      />
                    </Field>
                  </div>
                  <Field label="Reason">
                    <textarea
                      name="reason"
                      minLength={15}
                      maxLength={2000}
                      required
                      placeholder="Describe the issue without copying private messages."
                    />
                  </Field>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={closeDialog}
                    >
                      Cancel
                    </button>
                    <Submit busy={busy}>File report</Submit>
                  </div>
                </Form>
              );
            })()}
          {dialog.type === "payment" && (
            <Form
              onSubmit={async (form) => {
                await perform(
                  {
                    type: "createPayment",
                    ticketId: dialog.id!,
                    amount: Number(form.get("amount")),
                    description: str(form, "description"),
                  },
                  "Payment request sent to your client.",
                );
              }}
            >
              <div className="info-note">
                <CreditCard size={18} />
                <p>
                  Create a clear payment request for the agreed work. Your
                  client will see it in Billing and on the request.
                </p>
              </div>
              <Field label="What is this payment for?">
                <input
                  name="description"
                  placeholder="e.g. Additional video edits — agreed scope"
                  required
                  maxLength={300}
                />
              </Field>
              <Field label="Amount (USD)">
                <div className="input-prefix">
                  <span>$</span>
                  <input
                    type="number"
                    name="amount"
                    min={1}
                    max={1000000}
                    step="0.01"
                    required
                    placeholder="150"
                  />
                </div>
              </Field>
              <div className="form-actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={closeDialog}
                >
                  Cancel
                </button>
                <Submit busy={busy}>
                  Request payment
                  <ArrowUpRight size={15} />
                </Submit>
              </div>
            </Form>
          )}
          {dialog.type === "pay" &&
            (() => {
              const p = state.payments.find((p) => p.id === dialog.id);
              return p ? (
                <div className="checkout">
                  <span className="checkout-icon">
                    <ShieldCheck size={30} />
                  </span>
                  <span className="eyebrow">SIMULATED PAYMENT</span>
                  <h2>{money(p.amount)}</h2>
                  <p>{p.description}</p>
                  <div className="checkout-summary">
                    <span>
                      Payment method<strong>Prototype test payment</strong>
                    </span>
                    <span>
                      Real money charged<strong>$0</strong>
                    </span>
                    <span>
                      Test amount<strong>{money(p.amount)}</strong>
                    </span>
                  </div>
                  <p className="checkout-note">
                    No card details needed. Confirming records a simulated
                    payment, notifies your assistant, and enables skill-based
                    matching for unassigned work.
                  </p>
                  <button
                    className="button primary"
                    disabled={busy || p.status === "Paid"}
                    onClick={() =>
                      void perform(
                        { type: "pay", paymentId: p.id },
                        "Test payment confirmed. No real money was charged.",
                      )
                    }
                  >
                    {busy
                      ? "Confirming…"
                      : p.status === "Paid"
                        ? "Already paid"
                        : "Confirm test payment"}
                    <Check size={16} />
                  </button>
                  <button className="text-button" onClick={closeDialog}>
                    Back to my workspace
                  </button>
                </div>
              ) : (
                <p>Payment not found.</p>
              );
            })()}
          {dialog.type === "feedback" && (
            <Feedback
              busy={busy}
              onSubmit={async (rating, feedback) => {
                await perform(
                  {
                    type: "closeTicket",
                    ticketId: dialog.id!,
                    rating,
                    feedback,
                  },
                  "A job well done. Your request is complete!",
                );
              }}
            />
          )}
          {dialog.type === "help" && (
            <div className="guide">
              <div className="info-note">
                <Sparkles size={21} />
                <p>
                  Your workspace brings every step together. Here’s how to try a
                  complete request.
                </p>
              </div>
              {[
                {
                  title: "1. Create your request",
                  text: "In the Client workspace, create a request with a service, budget, difficulty, and due date.",
                },
                {
                  title: "2. Find your person",
                  text: "Pay the initial test payment for automatic matching, or switch to Virtual assistant and accept a matching open request.",
                },
                {
                  title: "3. Keep the conversation going",
                  text: "Use Messages to agree on the details. The assistant can create additional payment tracking after the initial request is paid.",
                },
                {
                  title: "4. Make it official, safely",
                  text: "The client confirms a test payment in Billing. Staff can verify pending payment requests. No real money is charged.",
                },
                {
                  title: "5. Share something great",
                  text: "The assistant uploads an output in the request details and selects Deliver output after all payments are paid.",
                },
                {
                  title: "6. Review and leave feedback",
                  text: "The client downloads the work, approves delivery, and leaves a star rating. Admin sees the entire journey in Activity logs.",
                },
              ].map((g) => (
                <details className="guide-accordion" key={g.title}>
                  <summary>{g.title}</summary><p>{g.text}</p>
                </details>
              ))}
              <div className="info-note">
                <ShieldCheck size={18} />
                <p>
                  {mode === "demo"
                    ? "Use your account menu at the top right to switch demo roles. Demo information persists in this browser and is for testing only."
                    : "Your account role is managed by an administrator. Data and files are protected by Supabase row-level security."}
                </p>
              </div>
              <button className="button primary" onClick={closeDialog}>
                Let’s get to it
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
          aria-atomic="true"
          onMouseEnter={() => setToastPaused(true)} onMouseLeave={() => setToastPaused(false)}
          onFocus={() => setToastPaused(true)} onBlur={() => setToastPaused(false)}
        >
          {toast.error ? <CircleHelp size={19} /> : <CircleCheck size={19} />}
          <span>{toast.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function Feedback({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (rating: number, feedback: string) => Promise<void>;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  return (
    <Form
      className="feedback-form"
      onSubmit={async (form) => {
        await onSubmit(rating, str(form, "feedback"));
      }}
    >
      <span className="feedback-spark">
        <Sparkles size={33} />
      </span>
      <h3>Review your assistant’s service</h3>
      <p>
        Your request is ready. If you’re happy with the output, close the
        request and let your assistant know how they did.
      </p>
      <div className="rating-stars" role="group" aria-label="Service rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            aria-label={`${n} star${n !== 1 ? "s" : ""}`}
            aria-pressed={rating === n}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
          >
            <Star
              size={36}
              fill={n <= (hover || rating) ? "#e8b15b" : "none"}
              color={n <= (hover || rating) ? "#e8b15b" : "#d5d3de"}
            />
          </button>
        ))}
      </div>
      <small className="rating-caption">
        {
          [
            "Choose your stars",
            "Could be better",
            "Room to grow",
            "Good work",
            "Really great work",
            "Couldn’t be happier!",
          ][rating]
        }
      </small>
      <Field label="Written feedback (optional)">
        <textarea
          name="feedback"
          rows={3}
          placeholder="What made the experience great?"
          maxLength={2000}
        />
      </Field>
      <button
        className="button primary"
        type="submit"
        disabled={busy || !rating}
      >
        {busy ? "Closing…" : "Close request & send feedback"}
        <Check size={16} />
      </button>
    </Form>
  );
}

