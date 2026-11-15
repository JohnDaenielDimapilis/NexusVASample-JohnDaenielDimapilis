import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  FileLock2,
  History,
  LockKeyhole,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "./data";
import { AppearanceSwitch } from "./AppearanceSwitch";
import type { Profile, Ticket } from "./types";

export type PrivacyView =
  | "Conversation Review"
  | "Schedule History"
  | "Administrative Audit Logs"
  | "Permissions";
type ReviewCase = {
  id: string;
  kind: "conversation" | "schedule";
  purpose: string;
  reason: string;
  ticket_id: string | null;
  subject_id: string | null;
  requester_id: string;
  reviewer_id: string;
  approval_reviewer_id: string | null;
  requested_start: string;
  requested_end: string;
  approved_start: string | null;
  approved_end: string | null;
  status: "requested" | "approved" | "denied" | "emergency" | "closed";
  approved_by: string | null;
  access_expires_at: string | null;
  emergency_reviewed_at: string | null;
  created_at: string;
  closed_at: string | null;
};
type AuditRow = {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  action: string;
  case_id: string | null;
  approval_id: string | null;
  reason: string;
  scope: Record<string, unknown>;
  outcome: string;
};
type ReviewMessage = {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
  system: boolean;
};
type HistoryItem = {
  id: string;
  title: string;
  start: string;
  end: string;
  outcome: string;
};
type ReviewerOption = {
  id: string;
  name: string;
  role: string;
  can_read: boolean;
  can_approve: boolean;
};

const stamp = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const localInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
const value = (form: FormData, key: string) =>
  String(form.get(key) || "").trim();

export function PrivacyDesk({
  view,
  actor,
  profiles,
  tickets,
}: {
  view: PrivacyView;
  actor: Profile;
  profiles: Profile[];
  tickets: Ticket[];
}) {
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLimit, setAuditLimit] = useState(100);
  const [hasOlderAudit, setHasOlderAudit] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [reviewerOptions, setReviewerOptions] = useState<ReviewerOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ReviewMessage[] | null>(null);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [requestKind, setRequestKind] = useState<"conversation" | "schedule">(
    view === "Schedule History" ? "schedule" : "conversation",
  );
  const [attachmentId, setAttachmentId] = useState("");
  const [caseReviewerId, setCaseReviewerId] = useState("");
  const selected = cases.find((item) => item.id === selectedId) || null;
  const isReviewer = selected?.reviewer_id === actor.id;
  const canApproveSelected =
    !!selected &&
    !!permissions.case_approve &&
    (actor.role === "privacy_officer" ||
      (actor.role === "support_reviewer" &&
        selected.approval_reviewer_id === actor.id));
  const accessLive =
    !!selected &&
    ["approved", "emergency"].includes(selected.status) &&
    !!selected.access_expires_at &&
    new Date(selected.access_expires_at) > new Date();
  const relevantCases = cases.filter((item) =>
    view === "Schedule History"
      ? item.kind === "schedule"
      : item.kind === "conversation",
  );

  const refresh = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    setLoading(true);
    setError("");
    try {
      const [caseResult, auditResult, reviewerResult, ...checks] =
        await Promise.all([
          client
            .from("review_cases")
            .select("*")
            .order("created_at", { ascending: false }),
          client
            .from("administrative_audit")
            .select("*")
            .order("occurred_at", { ascending: false })
            .range(0, auditLimit),
          client.rpc("visible_case_reviewers"),
          ...[
            "case_read",
            "case_approve",
            "case_metadata",
            "audit_read",
            "emergency_access",
          ].map((needed) => client.rpc("has_privacy_permission", { needed })),
        ]);
      if (caseResult.error) throw caseResult.error;
      if (auditResult.error) throw auditResult.error;
      if (reviewerResult.error) throw reviewerResult.error;
      for (const check of checks) if (check.error) throw check.error;
      setCases((caseResult.data || []) as ReviewCase[]);
      setHasOlderAudit((auditResult.data || []).length > auditLimit);
      setAudit(((auditResult.data || []) as AuditRow[]).slice(0, auditLimit));
      setReviewerOptions((reviewerResult.data || []) as ReviewerOption[]);
      setPermissions(
        Object.fromEntries(
          [
            "case_read",
            "case_approve",
            "case_metadata",
            "audit_read",
            "emergency_access",
          ].map((permission, index) => [permission, !!checks[index].data]),
        ),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Review service could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [auditLimit]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    setRequestKind(view === "Schedule History" ? "schedule" : "conversation");
    setCaseReviewerId("");
    setSelectedId(null);
    setMessages(null);
    setHistory(null);
    setNotice("");
  }, [view]);
  useEffect(() => {
    if (!selectedId) return;
    const item = cases.find((entry) => entry.id === selectedId);
    if (
      !item ||
      !["approved", "emergency"].includes(item.status) ||
      !item.access_expires_at
    ) {
      setMessages(null);
      setHistory(null);
      return;
    }
    const remaining = new Date(item.access_expires_at).getTime() - Date.now();
    if (remaining <= 0) {
      setMessages(null);
      setHistory(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setMessages(null);
      setHistory(null);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [cases, selectedId]);

  const run = async (
    name: string,
    args: Record<string, unknown>,
    success: string,
  ) => {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data, error: rpcError } = await supabase.rpc(name, args);
      if (rpcError) throw rpcError;
      if (data === false || data === null)
        throw new Error(
          "Access was denied. Check the case scope and your permissions.",
        );
      setNotice(success);
      await refresh();
      return data;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The action could not be completed.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  };
  const submit =
    (action: (form: FormData) => Promise<unknown>) =>
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void action(new FormData(event.currentTarget));
    };
  const readCase = async () => {
    if (!supabase || !selected) return;
    setBusy(true);
    setError("");
    setMessages(null);
    setHistory(null);
    try {
      if (selected.kind === "conversation") {
        const { data, error: rpcError } = await supabase.rpc(
          "read_case_messages",
          { target_case: selected.id },
        );
        if (rpcError) throw rpcError;
        setMessages((data || []) as ReviewMessage[]);
      } else {
        const { data, error: rpcError } = await supabase.rpc(
          "read_schedule_history",
          { target_case: selected.id },
        );
        if (rpcError) throw rpcError;
        setHistory((data || []) as HistoryItem[]);
      }
      await refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Access could not be checked.",
      );
    } finally {
      setBusy(false);
    }
  };
  const openAttachment = async () => {
    if (!supabase || !selected || !attachmentId) return;
    setBusy(true);
    setError("");
    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        "review-attachment",
        {
          body: { caseId: selected.id, documentId: attachmentId.trim() },
        },
      );
      if (functionError || !data?.url)
        throw new Error(
          data?.error || "Attachment access is restricted or expired.",
        );
      window.open(data.url, "_blank", "noopener,noreferrer");
      setNotice("A short-lived, read-only attachment link was opened.");
      await refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Attachment could not be opened.",
      );
    } finally {
      setBusy(false);
    }
  };

  const title = view === "Permissions" ? "Permissions" : view;
  const description =
    view === "Conversation Review"
      ? "Investigate reported conversations through approved, time-limited cases."
      : view === "Schedule History"
        ? "Review past appointment outcomes through a case. Live schedules remain private."
        : view === "Administrative Audit Logs"
          ? "Read-only record of privacy decisions and access attempts."
          : "Manage account roles and explicit privacy permissions. This does not grant private content access.";

  return (
    <div className="privacy-desk">
      <div className="privacy-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {supabase && (
          <button
            className="button secondary compact"
            onClick={() => void refresh()}
            disabled={loading}
          >
            Refresh
          </button>
        )}
      </div>
      {!supabase && (
        <div className="privacy-alert" role="alert">
          <LockKeyhole size={18} /> Connected Supabase is required for case
          review. The browser demo cannot enforce private access.
        </div>
      )}
      {loading && (
        <div className="privacy-state" role="status">
          Loading authorized case information…
        </div>
      )}
      {error && (
        <div className="privacy-alert error-banner" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => {
              setError("");
              void refresh();
            }}
          >
            Retry
          </button>
        </div>
      )}
      {notice && (
        <div className="privacy-alert success" role="status">
          {notice}
        </div>
      )}

      {view === "Permissions" ? (
        actor.role === "super_admin" ? (
          <div className="privacy-grid">
            <section className="privacy-panel">
              <h2>Account role</h2>
              <p>Use a verified account ID. You cannot change your own role.</p>
              <form
                onSubmit={submit(async (form) => {
                  await run(
                    "set_account_role",
                    {
                      target_user: value(form, "userId"),
                      new_role: value(form, "role"),
                      change_reason: value(form, "reason"),
                    },
                    "Account role updated.",
                  );
                })}
              >
                <label>
                  Account ID
                  <input name="userId" required placeholder="User UUID" />
                </label>
                <label>
                  Role
                  <select name="role">
                    <option value="support_reviewer">Support Reviewer</option>
                    <option value="privacy_officer">Privacy Officer</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="client">Client</option>
                    <option value="staff">VA</option>
                  </select>
                </label>
                <label>
                  Reason
                  <textarea name="reason" minLength={15} required />
                </label>
                <button className="button primary" disabled={busy || !supabase}>
                  Update role
                </button>
              </form>
            </section>
            <section className="privacy-panel">
              <h2>Privacy permission</h2>
              <p>
                Permissions require a case assignment before private content can
                be read.
              </p>
              <form
                onSubmit={submit(async (form) => {
                  await run(
                    "set_privacy_permission",
                    {
                      target_user: value(form, "userId"),
                      needed: value(form, "permission"),
                      enabled: value(form, "enabled") === "true",
                      change_reason: value(form, "reason"),
                    },
                    "Permission updated.",
                  );
                })}
              >
                <label>
                  Account ID
                  <input name="userId" required placeholder="User UUID" />
                </label>
                <label>
                  Permission
                  <select name="permission">
                    <option value="case_read">Read assigned cases</option>
                    <option value="case_approve">Approve cases</option>
                    <option value="case_metadata">View case metadata</option>
                    <option value="audit_read">
                      Read administrative audit
                    </option>
                    <option value="emergency_access">
                      Request emergency access
                    </option>
                  </select>
                </label>
                <label>
                  Change
                  <select name="enabled">
                    <option value="true">Grant</option>
                    <option value="false">Revoke</option>
                  </select>
                </label>
                <label>
                  Reason
                  <textarea name="reason" minLength={15} required />
                </label>
                <button className="button primary" disabled={busy || !supabase}>
                  Save permission
                </button>
              </form>
            </section>
          </div>
        ) : (
          <div className="privacy-state">
            Only the Super Admin can manage roles and permissions.
          </div>
        )
      ) : view === "Administrative Audit Logs" ? (
        <section className="privacy-panel">
          <h2>Access and decision log</h2>
          {audit.length ? (
            <div className="privacy-audit-list">
              {audit.map((entry) => (
                <div key={entry.id}>
                  <strong>{entry.action.replaceAll("_", " ")}</strong>
                  <span>{entry.outcome}</span>
                  <small>
                    {stamp(entry.occurred_at)} ·{" "}
                    {profiles.find((p) => p.id === entry.actor_id)?.name ||
                      "Account"}
                  </small>
                  <p>{entry.reason}</p>
                  {entry.case_id && <small>Case {entry.case_id}</small>}
                  {(entry.approval_id ||
                    Object.keys(entry.scope || {}).length > 0) && (
                    <details>
                      <summary>Scope and approval</summary>
                      {entry.approval_id && (
                        <p>
                          Approved by{" "}
                          {profiles.find((p) => p.id === entry.approval_id)
                            ?.name || entry.approval_id}
                        </p>
                      )}
                      {Object.entries(entry.scope || {}).map(([key, item]) => (
                        <small key={key}>
                          {key.replaceAll("_", " ")}: {String(item)}
                        </small>
                      ))}
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            !loading && (
              <p className="privacy-empty">
                No authorized audit records are available.
              </p>
            )
          )}
          {hasOlderAudit && (
            <button
              className="button secondary compact"
              disabled={loading}
              onClick={() => setAuditLimit((limit) => limit + 100)}
            >
              Load older records
            </button>
          )}
        </section>
      ) : (
        <>
          <div className="privacy-grid">
            <section className="privacy-panel">
              <h2>
                {view === "Schedule History"
                  ? "Schedule cases"
                  : "Conversation cases"}
              </h2>
              {relevantCases.length ? (
                <div className="privacy-case-list">
                  {relevantCases.map((item) => (
                    <button
                      key={item.id}
                      className={selectedId === item.id ? "selected" : ""}
                      onClick={() => {
                        setSelectedId(item.id);
                        setMessages(null);
                        setHistory(null);
                      }}
                    >
                      <span>
                        <strong>{item.purpose}</strong>
                        <small>
                          Case {item.id.slice(0, 8)} · {stamp(item.created_at)}
                        </small>
                      </span>
                      <span className={`privacy-status ${item.status}`}>
                        {item.status}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                !loading && (
                  <p className="privacy-empty">
                    No cases are assigned or available for this view.
                  </p>
                )
              )}
            </section>
            <section className="privacy-panel">
              {selected ? (
                <>
                  <div className="privacy-case-head">
                    <div>
                      <h2>{selected.purpose}</h2>
                      <small>Case {selected.id}</small>
                    </div>
                    <span className={`privacy-status ${selected.status}`}>
                      {selected.status}
                    </span>
                  </div>
                  <p>{selected.reason}</p>
                  <dl className="privacy-facts">
                    <div>
                      <dt>Requested by</dt>
                      <dd>
                        {profiles.find((p) => p.id === selected.requester_id)
                          ?.name || selected.requester_id}
                      </dd>
                    </div>
                    <div>
                      <dt>Assigned reviewer</dt>
                      <dd>
                        {profiles.find((p) => p.id === selected.reviewer_id)
                          ?.name || selected.reviewer_id}
                      </dd>
                    </div>
                    <div>
                      <dt>Independent approver</dt>
                      <dd>
                        {selected.approval_reviewer_id
                          ? profiles.find(
                              (p) => p.id === selected.approval_reviewer_id,
                            )?.name || selected.approval_reviewer_id
                          : "Authorized Privacy Officer"}
                      </dd>
                    </div>
                    <div>
                      <dt>Requested range</dt>
                      <dd>
                        {stamp(selected.requested_start)} –{" "}
                        {stamp(selected.requested_end)}
                      </dd>
                    </div>
                    <div>
                      <dt>Approved scope</dt>
                      <dd>
                        {selected.approved_start && selected.approved_end
                          ? `${stamp(selected.approved_start)} – ${stamp(selected.approved_end)}`
                          : "Awaiting independent approval"}
                      </dd>
                    </div>
                    <div>
                      <dt>Access ends</dt>
                      <dd>
                        {selected.access_expires_at
                          ? stamp(selected.access_expires_at)
                          : "No access granted"}
                      </dd>
                    </div>
                  </dl>
                  {selected.access_expires_at && !accessLive && (
                    <div className="privacy-alert">
                      Access expired or this case is closed. Content cannot be
                      opened.
                    </div>
                  )}
                  {isReviewer && (
                    <div className="privacy-actions">
                      <button
                        className="button primary"
                        disabled={
                          busy ||
                          !supabase ||
                          !accessLive ||
                          !permissions.case_read
                        }
                        onClick={() => void readCase()}
                      >
                        {selected.kind === "schedule" ? (
                          <History size={16} />
                        ) : (
                          <FileLock2 size={16} />
                        )}{" "}
                        Open read-only review
                      </button>
                    </div>
                  )}
                  {isReviewer &&
                    selected.status === "requested" &&
                    permissions.emergency_access && (
                      <form
                        className="privacy-inline-form"
                        onSubmit={submit(async (form) => {
                          await run(
                            "request_emergency_access",
                            {
                              target_case: selected.id,
                              emergency_reason: value(form, "reason"),
                            },
                            "Emergency access opened for 15 minutes and queued for review.",
                          );
                        })}
                      >
                        <label>
                          Emergency justification
                          <textarea name="reason" minLength={20} required />
                        </label>
                        <button className="button secondary" disabled={busy}>
                          Request emergency access
                        </button>
                      </form>
                    )}
                  {canApproveSelected &&
                    selected.status === "requested" &&
                    selected.reviewer_id !== actor.id && (
                      <form
                        className="privacy-inline-form"
                        onSubmit={submit(async (form) => {
                          await run(
                            "approve_review_case",
                            {
                              target_case: selected.id,
                              range_start: new Date(
                                value(form, "start"),
                              ).toISOString(),
                              range_end: new Date(
                                value(form, "end"),
                              ).toISOString(),
                              expires_at: new Date(
                                value(form, "expiresAt"),
                              ).toISOString(),
                              approval_reason: value(form, "reason"),
                            },
                            "Case scope approved.",
                          );
                        })}
                      >
                        <h3>Independent approval</h3>
                        <p>
                          The requested range is the maximum scope. Access must
                          expire within 24 hours.
                        </p>
                        <div className="privacy-form-grid">
                          <label>
                            Approved from
                            <input
                              name="start"
                              type="datetime-local"
                              required
                              defaultValue={localInput(
                                new Date(
                                  Math.ceil(
                                    new Date(
                                      selected.requested_start,
                                    ).getTime() / 60000,
                                  ) * 60000,
                                ),
                              )}
                            />
                          </label>
                          <label>
                            Approved to
                            <input
                              name="end"
                              type="datetime-local"
                              required
                              defaultValue={localInput(
                                new Date(selected.requested_end),
                              )}
                            />
                          </label>
                        </div>
                        <label>
                          Access expires
                          <input
                            name="expiresAt"
                            type="datetime-local"
                            required
                            defaultValue={localInput(
                              new Date(Date.now() + 60 * 60 * 1000),
                            )}
                          />
                        </label>
                        <label>
                          Approval reason
                          <textarea name="reason" minLength={15} required />
                        </label>
                        <button className="button primary" disabled={busy}>
                          Approve limited access
                        </button>
                      </form>
                    )}
                  {canApproveSelected &&
                    selected.status === "requested" &&
                    selected.reviewer_id !== actor.id && (
                      <form
                        className="privacy-inline-form"
                        onSubmit={submit(async (form) => {
                          await run(
                            "deny_review_case",
                            {
                              target_case: selected.id,
                              denial_reason: value(form, "reason"),
                            },
                            "Case request denied. No private access was granted.",
                          );
                        })}
                      >
                        <h3>Deny this review</h3>
                        <label>
                          Denial reason
                          <textarea
                            name="reason"
                            minLength={15}
                            required
                            placeholder="Why should this access not be granted?"
                          />
                        </label>
                        <button
                          className="button danger-secondary"
                          disabled={busy}
                        >
                          Deny request
                        </button>
                      </form>
                    )}
                  {canApproveSelected &&
                    selected.status === "emergency" &&
                    !selected.emergency_reviewed_at && (
                      <form
                        className="privacy-inline-form"
                        onSubmit={submit(async (form) => {
                          await run(
                            "review_emergency_access",
                            {
                              target_case: selected.id,
                              accepted: value(form, "decision") === "approve",
                              review_reason: value(form, "reason"),
                            },
                            "Emergency use reviewed.",
                          );
                        })}
                      >
                        <h3>Review emergency access</h3>
                        <label>
                          Decision
                          <select name="decision">
                            <option value="approve">Confirm</option>
                            <option value="deny">Revoke immediately</option>
                          </select>
                        </label>
                        <label>
                          Review reason
                          <textarea name="reason" minLength={15} required />
                        </label>
                        <button className="button secondary" disabled={busy}>
                          Record review
                        </button>
                      </form>
                    )}
                  {(selected.requester_id === actor.id ||
                    actor.role === "admin" ||
                    canApproveSelected) &&
                    selected.status !== "closed" && (
                      <form
                        className="privacy-inline-form"
                        onSubmit={submit(async (form) => {
                          await run(
                            "close_review_case",
                            {
                              target_case: selected.id,
                              close_reason: value(form, "reason"),
                            },
                            "Case closed and access revoked.",
                          );
                        })}
                      >
                        <label>
                          Close reason
                          <input
                            name="reason"
                            minLength={8}
                            required
                            placeholder="Reason for closing"
                          />
                        </label>
                        <button className="button secondary" disabled={busy}>
                          Close case
                        </button>
                      </form>
                    )}
                  {selected.kind === "conversation" &&
                    canApproveSelected &&
                    accessLive && (
                      <form
                        className="privacy-inline-form"
                        onSubmit={submit(async (form) => {
                          await run(
                            "approve_case_attachment",
                            {
                              target_case: selected.id,
                              target_document: value(form, "documentId"),
                              justification: value(form, "reason"),
                              expires_at: new Date(
                                value(form, "expiresAt"),
                              ).toISOString(),
                            },
                            "Separate attachment access approved.",
                          );
                        })}
                      >
                        <h3>Approve one attachment</h3>
                        <p>
                          Use the document ID supplied in the report. Approval
                          is separate from message access.
                        </p>
                        <label>
                          Document ID
                          <input
                            name="documentId"
                            required
                            placeholder="Document UUID"
                          />
                        </label>
                        <label>
                          Access expires
                          <input
                            name="expiresAt"
                            type="datetime-local"
                            required
                            defaultValue={localInput(
                              new Date(Date.now() + 15 * 60 * 1000),
                            )}
                          />
                        </label>
                        <label>
                          Justification
                          <textarea name="reason" minLength={15} required />
                        </label>
                        <button className="button secondary" disabled={busy}>
                          Approve attachment
                        </button>
                      </form>
                    )}
                  {selected.kind === "conversation" &&
                    isReviewer &&
                    accessLive && (
                      <div className="privacy-inline-form">
                        <h3>Approved attachment</h3>
                        <p>
                          Enter an approved document ID. The link expires after
                          60 seconds.
                        </p>
                        <label>
                          Document ID
                          <input
                            value={attachmentId}
                            onChange={(event) =>
                              setAttachmentId(event.target.value)
                            }
                            placeholder="Document UUID"
                          />
                        </label>
                        <button
                          className="button secondary"
                          disabled={busy || !attachmentId}
                          onClick={() => void openAttachment()}
                        >
                          Open approved attachment
                        </button>
                      </div>
                    )}
                </>
              ) : (
                <div className="privacy-state">
                  <ShieldCheck size={22} />
                  <p>
                    Select a case to inspect its purpose, approval, and scope.
                    Private content is never shown in this list.
                  </p>
                </div>
              )}
            </section>
          </div>
          {messages && (
            <section className="privacy-panel privacy-results">
              <h2>Read-only conversation range</h2>
              {messages.length ? (
                messages.map((message) => (
                  <article key={message.id}>
                    <small>
                      {stamp(message.createdAt)} ·{" "}
                      {profiles.find((p) => p.id === message.senderId)?.name ||
                        (message.system ? "System" : "Participant")}
                    </small>
                    <p>{message.text}</p>
                  </article>
                ))
              ) : (
                <p className="privacy-empty">
                  No messages are available in the approved range.
                </p>
              )}
            </section>
          )}
          {history && (
            <section className="privacy-panel privacy-results">
              <h2>Historical appointments</h2>
              {history.length ? (
                history.map((item) => (
                  <article key={item.id}>
                    <strong>{item.title}</strong>
                    <span className="privacy-status">{item.outcome}</span>
                    <p>
                      {stamp(item.start)} – {stamp(item.end)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="privacy-empty">
                  No eligible past appointments are in this approved scope.
                </p>
              )}
            </section>
          )}
          {(actor.role === "admin" || actor.role === "privacy_officer") &&
            supabase && (
              <section className="privacy-panel privacy-new-case">
                <h2>Request a documented review</h2>
                <p>
                  A second authorized person must approve the scope before
                  private content is available. Do not quote private message
                  text in case metadata.
                </p>
                <form
                  onSubmit={submit(async (form) => {
                    const result = await run(
                      "request_review_case",
                      {
                        case_kind: requestKind,
                        case_purpose: value(form, "purpose"),
                        case_reason: value(form, "reason"),
                        conversation_id:
                          requestKind === "conversation"
                            ? value(form, "target")
                            : null,
                        schedule_subject:
                          requestKind === "schedule"
                            ? value(form, "target")
                            : null,
                        assigned_reviewer: value(form, "reviewer"),
                        second_reviewer: value(form, "secondReviewer") || null,
                        range_start: new Date(
                          value(form, "start"),
                        ).toISOString(),
                        range_end: new Date(value(form, "end")).toISOString(),
                      },
                      "Review case requested. Private content remains restricted until independent approval.",
                    );
                    if (result) setSelectedId(String(result));
                  })}
                >
                  <div className="privacy-form-grid">
                    <label>
                      Review type
                      <select value={requestKind} disabled>
                        <option value={requestKind}>
                          {requestKind === "conversation"
                            ? "Conversation"
                            : "Schedule history"}
                        </option>
                      </select>
                    </label>
                    <label>
                      {requestKind === "conversation"
                        ? "Request conversation"
                        : "Calendar owner"}
                      <select name="target" required>
                        <option value="">
                          Choose a{" "}
                          {requestKind === "conversation"
                            ? "request"
                            : "person"}
                        </option>
                        {(requestKind === "conversation"
                          ? tickets
                          : profiles.filter(
                              (p) => p.role === "client" || p.role === "staff",
                            )
                        ).map((item) => (
                          <option key={item.id} value={item.id}>
                            {"title" in item
                              ? `NX-${item.number} · ${item.title}`
                              : item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Assigned reviewer
                      <select
                        name="reviewer"
                        required
                        value={caseReviewerId}
                        onChange={(event) =>
                          setCaseReviewerId(event.target.value)
                        }
                      >
                        <option value="">Choose a reviewer</option>
                        {reviewerOptions
                          .filter((p) => p.id !== actor.id && p.can_read)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {p.role.replaceAll("_", " ")}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Independent second reviewer (optional)
                      <select name="secondReviewer" defaultValue="">
                        <option value="">Authorized Privacy Officer</option>
                        {reviewerOptions
                          .filter(
                            (p) =>
                              p.role === "support_reviewer" &&
                              p.can_approve &&
                              p.id !== actor.id &&
                              p.id !== caseReviewerId,
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Purpose
                      <input
                        name="purpose"
                        minLength={8}
                        maxLength={200}
                        required
                        placeholder="What must this review resolve?"
                      />
                    </label>
                    <label>
                      From
                      <input
                        name="start"
                        type="datetime-local"
                        required
                        defaultValue={localInput(
                          new Date(Date.now() - 7 * 86400000),
                        )}
                      />
                    </label>
                    <label>
                      To
                      <input
                        name="end"
                        type="datetime-local"
                        required
                        defaultValue={localInput(new Date(Date.now() - 60000))}
                      />
                    </label>
                  </div>
                  <label>
                    Reason
                    <textarea
                      name="reason"
                      minLength={15}
                      maxLength={2000}
                      required
                      placeholder="Document the report and why this scope is necessary."
                    />
                  </label>
                  {!reviewerOptions.some(
                    (p) => p.id !== actor.id && p.can_read,
                  ) && (
                    <p className="privacy-empty">
                      No authorized reviewer is available. The Super Admin must
                      assign a reviewer role and permission first.
                    </p>
                  )}
                  <button
                    className="button primary"
                    disabled={
                      busy ||
                      !reviewerOptions.some(
                        (p) => p.id !== actor.id && p.can_read,
                      )
                    }
                  >
                    Request review
                  </button>
                </form>
              </section>
            )}
        </>
      )}
    </div>
  );
}

export function PrivacyWorkspace({
  actor,
  profiles,
  tickets,
  appearance,
  onToggleAppearance,
  onSignout,
}: {
  actor: Profile;
  profiles: Profile[];
  tickets: Ticket[];
  appearance: "light" | "dark";
  onToggleAppearance: () => void;
  onSignout: () => void;
}) {
  const [view, setView] = useState<PrivacyView>(
    actor.role === "super_admin" ? "Permissions" : "Conversation Review",
  );
  const links: { label: PrivacyView; icon: typeof FileLock2 }[] =
    actor.role === "super_admin"
      ? [
          { label: "Permissions", icon: ShieldCheck },
          { label: "Administrative Audit Logs", icon: ScrollText },
        ]
      : [
          { label: "Conversation Review", icon: FileLock2 },
          { label: "Schedule History", icon: History },
          { label: "Administrative Audit Logs", icon: ScrollText },
        ];
  return (
    <div className="privacy-workspace">
      <header>
        <img src="/nexus-wordmark-white.png" alt="Nexus Virtual Executives" />
        <span>{actor.role.replaceAll("_", " ")}</span>
        <AppearanceSwitch
          appearance={appearance}
          onToggle={onToggleAppearance}
          className="privacy-appearance-switch"
        />
        <button onClick={onSignout}>Sign out</button>
      </header>
      <nav aria-label="Privacy workspace">
        {links.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={view === label ? "active" : ""}
            onClick={() => setView(label)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>
      <main>
        <PrivacyDesk
          view={view}
          actor={actor}
          profiles={profiles}
          tickets={tickets}
        />
      </main>
      <footer>
        <ArrowLeft size={14} /> Private content requires an assigned, approved
        case and expires automatically.{" "}
        <a href="/privacy-notice.html" target="_blank" rel="noreferrer">
          Privacy notice
        </a>
      </footer>
    </div>
  );
}
