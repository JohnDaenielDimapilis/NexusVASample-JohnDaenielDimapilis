import { useEffect, useId, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { Modal } from "./components";
import { notificationDestination, ownedNotifications } from "./notifications";
import type {
  NotificationCommand,
  NotificationDestination,
} from "./notifications";
import type { Notification, Profile, Workspace } from "./types";

export function NotificationCenter({
  state,
  actor,
  open,
  onToggle,
  onClose,
  busy,
  onUpdate,
  onNavigate,
  syncError,
  onRetry,
}: {
  state: Workspace;
  actor: Profile;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  busy: boolean;
  onUpdate: (command: NotificationCommand) => Promise<void>;
  onNavigate: (
    destination: Exclude<NotificationDestination, { type: "details" }>,
  ) => void;
  syncError: string;
  onRetry: () => void;
}) {
  const id = useId();
  const bell = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [detail, setDetail] = useState<{
    note: Notification;
    reason?: string;
  } | null>(null);
  const active = ownedNotifications(state.notifications, actor.id);
  const archived = ownedNotifications(state.notifications, actor.id, true);
  const notes = dismissed ? archived : active;
  const unread = active.filter((n) => !n.read).length;
  const disabled = busy || saving;
  const run = async (action: () => Promise<void>) => {
    if (pending.current || busy) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not confirm the notification update. Please try again.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  const select = (note: Notification) =>
    void run(async () => {
      if (!note.read)
        await onUpdate({
          type: "setNotificationRead",
          notificationId: note.id,
          read: true,
        });
      if (!mounted.current) return;
      const destination = notificationDestination(note, state, actor);
      if (destination.type === "details") {
        setDetail({ note, reason: destination.reason });
        onClose();
      } else onNavigate(destination);
    });
  const timestamp = (n: Notification) =>
    new Date(n.createdAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  return (
    <div className="notification-wrap">
      <button
        ref={bell}
        className={`icon-button notification-button ${unread ? "has-unread" : ""}`}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={onToggle}
      >
        <Bell size={18} />
      </button>
      {open && (
        <div
          id={id}
          className="popover notifications"
          role="region"
          aria-label="Notifications"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onClose();
              bell.current?.focus();
            }
          }}
        >
          <div className="popover-head">
            <strong>Notifications</strong>
            <button
              className="text-button"
              disabled={disabled || !unread}
              onClick={() =>
                void run(() =>
                  onUpdate({
                    type: "readNotifications",
                    notificationIds: active
                      .filter((n) => !n.read)
                      .map((n) => n.id),
                  }),
                )
              }
            >
              Mark all read
            </button>
          </div>
          {(error || syncError) && (
            <div className="notification-error" role="alert">
              <p>{error || `Notifications could not sync: ${syncError}`}</p>
              <button
                className="text-button"
                disabled={disabled}
                onClick={() => {
                  setError("");
                  onRetry();
                }}
              >
                Refresh notifications
              </button>
            </div>
          )}
          <span
            className="notification-announcement"
            role="status"
            aria-live="polite"
          >
            {saving
              ? "Saving notification change."
              : `${unread} unread notifications.`}
          </span>
          {notes.length ? (
            notes.map((n) => (
              <div
                className={`notification-item ${!n.read ? "unread" : ""}`}
                key={n.id}
                data-notification-id={n.id}
              >
                <span className="notification-dot" aria-hidden="true" />
                <div className="notification-content">
                  <button
                    className="notification-open"
                    disabled={disabled}
                    onClick={() => select(n)}
                    aria-label={`${n.read ? "Read" : "Unread"}: ${n.text}`}
                  >
                    <p>{n.text}</p>
                    <small>{timestamp(n)}</small>
                  </button>
                  <div className="notification-tools">
                    <button
                      className="notification-action"
                      disabled={disabled}
                      onClick={() => select(n)}
                    >
                      {notificationDestination(n, state, actor).label}
                    </button>
                    <button
                      className="notification-action notification-status"
                      disabled={disabled}
                      onClick={() =>
                        void run(() =>
                          onUpdate({
                            type: "setNotificationRead",
                            notificationId: n.id,
                            read: !n.read,
                          }),
                        )
                      }
                    >
                      {n.read ? "Mark unread" : "Mark read"}
                    </button>
                    <button
                      className="notification-dismiss"
                      title={
                        dismissed
                          ? "Restore notification"
                          : "Dismiss notification"
                      }
                      aria-label={`${dismissed ? "Restore" : "Dismiss"}: ${n.text}`}
                      disabled={disabled}
                      onClick={() =>
                        void run(() =>
                          onUpdate({
                            type: "dismissNotification",
                            notificationId: n.id,
                            dismissed: !dismissed,
                          }),
                        )
                      }
                    >
                      {dismissed ? "Restore" : <X size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="popover-empty">
              {dismissed
                ? "No dismissed notifications."
                : "You’re all caught up."}
            </div>
          )}
          {(archived.length > 0 || dismissed) && (
            <div className="notification-footer">
              <button
                className="text-button"
                onClick={() => {
                  setDismissed(!dismissed);
                  setError("");
                }}
              >
                {dismissed
                  ? "Back to notifications"
                  : `Dismissed (${archived.length})`}
              </button>
            </div>
          )}
        </div>
      )}
      {detail && (
        <Modal
          title="Notification details"
          subtitle={timestamp(detail.note)}
          close={() => setDetail(null)}
        >
          <div className="notification-detail">
            <p>{detail.note.text}</p>
            {detail.reason && <p>{detail.reason}</p>}
            <button
              className="button secondary"
              onClick={() => {
                setDetail(null);
                onToggle();
              }}
            >
              Back to notifications
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
