import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { initials } from "./types";

export function Avatar({
  name,
  size = "",
  color = 0,
}: {
  name: string;
  size?: string;
  color?: number;
}) {
  return (
    <span className={`avatar ${size} avatar-${color % 5}`}>
      {initials(name)}
    </span>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={`badge ${tone || String(children).toLowerCase().replaceAll(" ", "-")}`}
    >
      <i />
      {children}
    </span>
  );
}
export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  close,
  wide = false,
  variant = "modal",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  variant?: "modal" | "drawer" | "page";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    if (variant === "page") {
      ref.current?.querySelector<HTMLElement>("h1")?.focus();
      document.querySelector(".workspace-main")?.scrollTo({ top: 0 });
      return () => { if (before?.isConnected) before.focus({ preventScroll: true }); };
    }
    const old = document.body.style.overflow;
    const workspace = document.querySelector<HTMLElement>(".workspace-main");
    const oldWorkspaceOverflow = workspace?.style.overflowY;
    document.body.style.overflow = "hidden";
    if (workspace) workspace.style.overflowY = "hidden";
    // Keep the page out of the keyboard and accessibility navigation while an
    // overlay is open. The overlay itself lives outside .workspace-main.
    const background = Array.from(document.querySelectorAll<HTMLElement>(".workspace-main,.sidebar,.rail"));
    const inertBefore = background.map((node) => node.inert);
    background.forEach((node) => { node.inert = true; });
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          ) || [],
        );
        const visible = nodes.filter((node) => node.getClientRects().length > 0);
        const first = visible[0],
          last = visible[visible.length - 1];
        if (!first) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = old;
      if (workspace) workspace.style.overflowY = oldWorkspaceOverflow || "";
      background.forEach((node, index) => { node.inert = inertBefore[index]; });
      document.removeEventListener("keydown", handler);
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [variant]);
  const heading = <header className="modal-head">
    <div>
      {variant === "page" ? <h1 id={titleId} tabIndex={-1}>{title}</h1> : <h2 id={titleId}>{title}</h2>}
      {subtitle && <p>{subtitle}</p>}
    </div>
    <button className={variant === "page" ? "button secondary" : "icon-button"}
      aria-label={variant === "page" ? "Back to workspace" : variant === "drawer" ? "Close panel" : "Close dialog"}
      onClick={close} type="button"><X size={20} />{variant === "page" && "Back"}</button>
  </header>;
  if (variant === "page") {
    const host = document.getElementById("workflow-page");
    return host ? createPortal(<section className="workflow-page modal" ref={ref} aria-labelledby={titleId}>{heading}{children}</section>, host) : null;
  }
  return createPortal(
    <div
      className={`modal-backdrop ${variant === "drawer" ? "drawer-backdrop" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""} ${variant === "drawer" ? "drawer" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {heading}
        {children}
      </div>
    </div>,
    document.querySelector(".app-shell") || document.body,
  );
}

/** Date editors and reference information stay in the page and do not trap focus. */
export function InlinePanel({ title, subtitle, close, children }: {
  title: string; subtitle?: string; close: () => void; children: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input,h2")?.focus();
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <section className="inline-panel" ref={ref} aria-labelledby={id}>
    <header><div><h2 id={id} tabIndex={-1}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      <button type="button" className="icon-button" aria-label={`Close ${title.toLowerCase()}`} onClick={close}><X size={18} /></button>
    </header>{children}
  </section>;
}
export function Submit({
  busy,
  children = "Save changes",
}: {
  busy: boolean;
  children?: ReactNode;
}) {
  return (
    <button className="button primary" type="submit" disabled={busy}>
      {busy ? (
        <>
          <span className="spinner" /> Working…
        </>
      ) : (
        children
      )}
    </button>
  );
}
export function Form({
  onSubmit,
  children,
  className = "",
}: {
  onSubmit: (data: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      className={`form ${className}`}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void onSubmit(new FormData(e.currentTarget));
      }}
    >
      {children}
    </form>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search requests…",
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-box">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className="icon-button mini"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
export function DataTable<T>({
  data,
  columns,
  onRow,
  mobileCard,
  mobileSortLabel = "Sort requests",
  empty = "Nothing here yet.",
  pageSize = 6,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  onRow?: (row: T) => void;
  mobileCard?: (row: T) => ReactNode;
  mobileSortLabel?: string;
  empty?: string;
  pageSize?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const sortId = useId();
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });
  return (
    <>
      {mobileCard && (
        <div className="mobile-table-sort">
          <label htmlFor={sortId}>{mobileSortLabel}</label>
          <select
            id={sortId}
            value={
              sorting[0]
                ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`
                : ""
            }
            onChange={(event) => {
              const [id, direction] = event.target.value.split(":");
              setSorting(id ? [{ id, desc: direction === "desc" }] : []);
            }}
          >
            <option value="">Default order</option>
            {table
              .getAllLeafColumns()
              .filter((column) => column.getCanSort())
              .flatMap((column) => {
                const label = column.columnDef.header;
                if (typeof label !== "string") return [];
                return [
                  <option key={`${column.id}:asc`} value={`${column.id}:asc`}>
                    {label} — ascending
                  </option>,
                  <option key={`${column.id}:desc`} value={`${column.id}:desc`}>
                    {label} — descending
                  </option>,
                ];
              })}
          </select>
        </div>
      )}
      <div className={`table-scroll ${mobileCard ? "has-mobile-cards" : ""}`}>
        <table>
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th
                    key={h.id}
                    aria-sort={
                      h.column.getCanSort()
                        ? h.column.getIsSorted() === "asc"
                          ? "ascending"
                          : h.column.getIsSorted() === "desc"
                            ? "descending"
                            : "none"
                        : undefined
                    }
                  >
                    {h.column.getCanSort() ? (
                      <button
                        className="sort-button"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "asc" ? (
                          <ArrowUp size={12} />
                        ) : h.column.getIsSorted() === "desc" ? (
                          <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={11} />
                        )}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={onRow ? "clickable-row" : ""}
                tabIndex={onRow ? 0 : undefined}
                onClick={(event) => {
                  if (
                    (event.target as HTMLElement).closest(
                      "button,a,input,select,textarea",
                    )
                  )
                    return;
                  onRow?.(row.original);
                }}
                onKeyDown={(event) => {
                  if (!onRow || event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onRow(row.original);
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && <div className="table-empty">{empty}</div>}
      </div>
      {mobileCard && (
        <div className="mobile-request-list">
          {table.getRowModel().rows.map((row) => (
            <div className="mobile-request-card" key={row.id}>
              {mobileCard(row.original)}
            </div>
          ))}
          {!data.length && <div className="table-empty">{empty}</div>}
        </div>
      )}
      {data.length > pageSize && (
        <div className="pagination">
          <span>
            {table.getState().pagination.pageIndex * pageSize + 1}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * pageSize,
              data.length,
            )}{" "}
            of {data.length} results
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft size={16} />
            </button>
            <span>{table.getState().pagination.pageIndex + 1}</span>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export const SuccessIcon = () => (
  <span className="success-icon">
    <Check size={22} />
  </span>
);
