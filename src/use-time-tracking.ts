import { useCallback, useEffect, useState } from "react";
import { mode } from "./data";
import type { Profile, Workspace } from "./types";
import { applyTimeAction, emptyTimeStore } from "./time-engine";
import type { TimeAction, TimeStore } from "./time-engine";

const KEY = "nexusva.time.v1.3.4.1";
const EVENT = "nexusva-time-change";
function readTime(): TimeStore {
  const raw = localStorage.getItem(KEY);
  if (!raw) return emptyTimeStore();
  const parsed = JSON.parse(raw);
  if (
    !Array.isArray(parsed.entries) ||
    !Array.isArray(parsed.audit) ||
    ![5, 10, 15].includes(parsed.idleMinutes)
  )
    throw new Error(
      "Saved timer data could not be read. Keep a backup before clearing browser data.",
    );
  return parsed;
}

export function useTimeTracking(
  actor: Profile | undefined,
  workspace: Workspace | null,
  notify?: (text: string, error?: boolean) => void,
) {
  const [store, setStore] = useState<TimeStore>(emptyTimeStore);
  const [error, setError] = useState("");
  const enabled =
    mode === "demo" && !!actor && ["staff", "admin"].includes(actor.role);
  const send = useCallback(
    async (action: TimeAction) => {
      if (!enabled || !actor || !workspace)
        throw new Error(
          "The time-tracking prototype is available in the local demo only.",
        );
      const update = async () => {
        const prior = readTime();
        const next = applyTimeAction(prior, actor, workspace, action);
        if (JSON.stringify(next) !== JSON.stringify(prior)) {
          localStorage.setItem(KEY, JSON.stringify(next));
          window.dispatchEvent(new Event(EVENT));
        }
        setStore(next);
        setError("");
      };
      try {
        if (navigator.locks) await navigator.locks.request(KEY, update);
        else await update();
        const feedback: Partial<Record<TimeAction["type"], string>> = {
          start: "Work timer started.",
          stop: "Work session saved.",
          break: "Break started.",
          resume: "Work timer resumed.",
          note: "Work summary saved.",
          correction: "Admin correction added for review.",
          reviewCorrection: "Correction review saved.",
          review: "Time entry review saved.",
          policy: "Tracking rule updated.",
        };
        const message = feedback[action.type];
        if (message) notify?.(message);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Could not save this time entry.";
        setError(message);
        if (!["heartbeat", "activity"].includes(action.type))
          notify?.(message, true);
        throw e;
      }
    },
    [enabled, actor, workspace, notify],
  );

  useEffect(() => {
    if (!enabled) {
      setStore(emptyTimeStore());
      setError("");
      return;
    }
    const sync = () => {
      try {
        setStore(readTime());
        setError("");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not read time entries.",
        );
      }
    };
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [enabled, actor?.id]);

  useEffect(() => {
    if (!enabled) return;
    const act = (action: TimeAction) => void send(action).catch(() => {});
    // Only a visible, online assistant tab sends a heartbeat. Admins only reconcile
    // existing records; their open dashboard never proves an assistant is active.
    const pulse = () => {
      if (
        actor?.role === "admin" ||
        (document.visibilityState === "visible" && navigator.onLine)
      )
        act({ type: "heartbeat" });
    };
    pulse();
    const timer = window.setInterval(pulse, 15_000);
    let lastInput = 0;
    const input = (event: Event) => {
      if (
        actor?.role !== "staff" ||
        !event.isTrusted ||
        (event instanceof KeyboardEvent && event.repeat) ||
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        Date.now() - lastInput < 10_000
      )
        return;
      lastInput = Date.now();
      act({ type: "activity" });
    };
    const offline = () => {
      if (actor?.role === "staff") act({ type: "offline" });
    };
    const visible = () => {
      if (document.visibilityState === "visible") pulse();
    };
    window.addEventListener("pointerdown", input, { passive: true });
    window.addEventListener("keydown", input);
    window.addEventListener("wheel", input, { passive: true });
    window.addEventListener("offline", offline);
    window.addEventListener("online", pulse);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", input);
      window.removeEventListener("keydown", input);
      window.removeEventListener("wheel", input);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", pulse);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [enabled, actor?.role, send]);

  return { store, send, enabled, error, dismissError: () => setError("") };
}

export type TimeTracking = ReturnType<typeof useTimeTracking>;
