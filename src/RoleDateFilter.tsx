import { useCallback, useState } from "react";
import { CalendarDays, Download, Info } from "lucide-react";
import { InlinePanel } from "./components";
import { rangeError, reportPresets, presetRange } from "./owner-report";
import type { Preset, ReportRange } from "./owner-report";

export type RoleSelection = { preset: Preset; range: ReportRange };
const day = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const roleRangeLabel = (range: ReportRange) => {
  if (range.start === range.end) return day(range.start);
  const from = new Date(range.start + "T12:00:00"),
    to = new Date(range.end + "T12:00:00");
  return from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth()
    ? `${from.toLocaleDateString("en-US", { month: "short" })} ${from.getDate()}–${to.getDate()}, ${from.getFullYear()}`
    : `${day(range.start)} – ${day(range.end)}`;
};
export function readRoleSelection(key: string): RoleSelection {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (
      saved &&
      reportPresets.some(([p]) => p === saved.preset) &&
      typeof saved.range?.start === "string" &&
      typeof saved.range?.end === "string" &&
      !rangeError(saved.range)
    )
      return {
        preset: saved.preset,
        range:
          saved.preset === "custom" ? saved.range : presetRange(saved.preset),
      };
  } catch {
    /* Saved preferences are optional. */
  }
  return { preset: "today", range: presetRange("today") };
}

export function RoleDateFilter({
  selection,
  onChange,
  onExport,
  staff,
}: {
  selection: RoleSelection;
  onChange: (value: RoleSelection) => void;
  onExport: () => void;
  staff: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [info, setInfo] = useState(false);
  const [draft, setDraft] = useState(selection.range);
  const close = useCallback(() => setEditing(false), []);
  const closeInfo = useCallback(() => setInfo(false), []);
  const edit = () => {
    setDraft(selection.range);
    setEditing(true);
  };
  const error = rangeError(draft);
  return (
    <>
      <section className="owner-filters" aria-label="Dashboard date filters">
        <div className="owner-filter-controls">
          <label className="owner-preset">
            <CalendarDays size={16} aria-hidden="true" />
            <select
              aria-label="Dashboard reporting period"
              value={selection.preset}
              onChange={(e) => {
                const preset = e.target.value as Preset;
                if (preset === "custom") edit();
                else onChange({ preset, range: presetRange(preset) });
              }}
            >
              {reportPresets.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="owner-active-range"
            aria-label="Edit date range"

            aria-expanded={editing}
            onClick={edit}
          >
            <strong data-testid="role-report-range">
              {roleRangeLabel(selection.range)}
            </strong>
            <CalendarDays size={14} aria-hidden="true" />
          </button>
          <button
            className="button secondary compact"
            aria-label="Export CSV"
            title="Export period CSV"
            onClick={onExport}
          >
            <Download size={15} />{" "}
            <span className="role-export-label">Export CSV</span>
          </button>
          <span className="role-timezone">
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </span>
          <button
            className="owner-date-info"
            aria-label="Report date details"

            title="Date definitions and time zone"
            onClick={() => setInfo(true)}
          >
            <Info size={17} />
          </button>
        </div>
      </section>
      {editing && (
        <InlinePanel
          title="Custom report dates"
          subtitle="Both dates are included. Apply dates to update your dashboard."
          close={close}
        >
          <form
            className="owner-custom-range owner-date-editor"
            onSubmit={(e) => {
              e.preventDefault();
              if (!error) {
                onChange({ preset: "custom", range: draft });
                close();
              }
            }}
          >
            <label>
              Start date
              <input
                type="date"
                required
                aria-label="Report start date"
                value={draft.start}
                onChange={(e) => setDraft({ ...draft, start: e.target.value })}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                required
                aria-label="Report end date"
                value={draft.end}
                onChange={(e) => setDraft({ ...draft, end: e.target.value })}
              />
            </label>
            <button
              className="button primary compact"
              disabled={!!error}
              type="submit"
            >
              Apply dates
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => setDraft(selection.range)}
            >
              Revert dates
            </button>
            <button
              className="button secondary compact"
              type="button"
              onClick={close}
            >
              Cancel
            </button>
            {error && (
              <p className="owner-date-error" role="alert">
                {error}
              </p>
            )}
          </form>
        </InlinePanel>
      )}
      {info && (
        <InlinePanel
          title="Report dates & definitions"
          subtitle={`${Intl.DateTimeFormat().resolvedOptions().timeZone} · Both dates included`}
          close={closeInfo}
        >
          <div className="owner-date-definitions role-definitions">
            <h3>{roleRangeLabel(selection.range)}</h3>
            <p>
              Requests use due dates; completed requests show their current
              status among requests due in the period, not their completion
              date. Deliveries use their delivery timestamp. Payment requests
              and conversations use creation dates. Appointments use their start
              dates. Statuses are current; selecting older dates does not
              reconstruct past statuses.
            </p>
            <p>
              Active work excludes completed requests. Overdue delivery means a
              request is past due with no recorded delivery and is not in client
              review. Payment dates are creation dates; the system does not
              store invoice due dates.
            </p>
            {staff && (
              <p>
                Recorded work uses only your own timer segments inside these
                dates, clipped at midnight boundaries and the current time.
                Breaks and unverified time are separate. Corrections are
                excluded from period hours because their work dates are not
                stored. Current timer status stays visible independently of the
                filter.
              </p>
            )}
            <p>
              Current actions, all active work, waiting-on-client handovers, the
              next appointment and conversations stay visible regardless of the
              summary dates. The CSV exports only period records. Conversations
              show the latest recorded message; they do not imply unread
              messages or unanswered questions.
            </p>
          </div>
        </InlinePanel>
      )}
    </>
  );
}
