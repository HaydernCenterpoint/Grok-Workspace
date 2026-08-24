/**
 * Composer project chip — pick / clear / create project.
 * Git worktrees live in {@link ComposerWorktreeMenu} (branch chip).
 */

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { IconCheck } from "@/components/icons";
import { Tip } from "@/components/ui/tooltip";
import { useFloatingMenu } from "@/lib/floatingMenu";

export type ProjectOption = {
  id: string;
  name: string;
  path: string;
  trusted: boolean;
  pathOk: boolean;
  pinned?: boolean;
};

type Props = {
  activeProject: ProjectOption | null;
  projects: ProjectOption[];
  labels: {
    noProject: string;
    pickProject: string;
    chooseProject: string;
    searchProjects: string;
    newProject: string;
    projectsEmpty: string;
    /** Badge when project folder is missing on disk. */
    pathMissing?: string;
  };
  disabled?: boolean;
  /**
   * `chip` — composer toolbar (legacy).
   * `context` — new-session bar above the input (flat, no chevron).
   */
  variant?: "chip" | "context";
  onSelect: (project: ProjectOption | null) => void;
  onAdd: () => void;
};

const LIST_MAX_H = 240;

export function filterProjectOptions(
  projects: ProjectOption[],
  query: string,
): ProjectOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return projects;
  return projects.filter(
    (p) =>
      p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
  );
}

export function defaultWorkspaceMatchesQuery(
  query: string,
  label: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return label.toLowerCase().includes(q);
}

export function ComposerProjectMenu({
  activeProject,
  projects,
  labels,
  disabled,
  variant = "chip",
  onSelect,
  onAdd,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filterProjectOptions(projects, query),
    [projects, query],
  );
  const showDefault = defaultWorkspaceMatchesQuery(query, labels.noProject);
  const listEmpty = !showDefault && filtered.length === 0;

  const estHeight = Math.min(
    420,
    56 + 44 + Math.min(LIST_MAX_H, (filtered.length + (showDefault ? 1 : 0)) * 40 + 8) + 48,
  );
  const { pos, style: popStyle } = useFloatingMenu({
    open,
    triggerRef,
    panelRef: popRef,
    roots: [rootRef],
    onClose: () => {
      setOpen(false);
      setQuery("");
    },
    placement: "auto",
    fitContent: true,
    minWidth: 280,
    estHeight,
    gap: 8,
    deps: [filtered.length, query],
  });

  const label = activeProject?.name ?? labels.chooseProject;
  const activeMissing = activeProject?.pathOk === false;
  const tip = activeMissing
    ? (labels.pathMissing
        ? `${labels.pathMissing}: ${activeProject?.path || ""}`.trim()
        : activeProject?.path) || labels.pickProject
    : activeProject?.path || labels.pickProject;

  const isContext = variant === "context";

  return (
    <div
      ref={rootRef}
      className={
        `cpm${open ? " is-open" : ""}` + (isContext ? " cpm--context" : "")
      }
    >
      <Tip label={tip} disabled={open}>
        <button
          ref={triggerRef}
          type="button"
          className={
            isContext
              ? "composer__context-item composer__context-item--project" +
                (open ? " is-open" : "") +
                (!activeProject ? " is-muted" : "") +
                (activeMissing ? " is-path-missing" : "")
              : "chip chip--project" +
                (open ? " is-open" : "") +
                (!activeProject ? " chip--muted" : "") +
                (activeMissing ? " chip--project-path-missing" : "")
          }
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() =>
            setOpen((v) => {
              const next = !v;
              if (!next) setQuery("");
              return next;
            })
          }
        >
          <span className={isContext ? "composer__context-label" : "chip__label"}>
            {label}
          </span>
        </button>
      </Tip>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            className="cmm__pop cmm__pop--portal cpm__pop"
            role="menu"
            aria-label={labels.chooseProject}
            style={popStyle as CSSProperties}
          >
            <div className="cpm__search">
              <input
                type="search"
                className="cpm__search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={labels.searchProjects}
                aria-label={labels.searchProjects}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                onMouseDown={(e) => e.stopPropagation()}
              />
            </div>
            <div
              className="cpm__list"
              style={{ maxHeight: LIST_MAX_H }}
              role="group"
              aria-label={labels.chooseProject}
            >
              {showDefault ? (
                <button
                  type="button"
                  role="menuitem"
                  className={
                    "cmm__opt cpm__item" + (!activeProject ? " is-active" : "")
                  }
                  onClick={() => {
                    onSelect(null);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="cmm__opt-main">
                    <span className="cmm__opt-title">{labels.noProject}</span>
                  </span>
                  {!activeProject ? (
                    <span className="cmm__opt-check" aria-hidden>
                      <IconCheck size={16} />
                    </span>
                  ) : null}
                </button>
              ) : null}
              {filtered.map((p) => {
                const active = activeProject?.id === p.id;
                const missing = p.pathOk === false;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    className={
                      "cmm__opt cpm__item" +
                      (active ? " is-active" : "") +
                      (missing ? " cpm__item--path-missing" : "")
                    }
                    title={
                      missing && labels.pathMissing
                        ? `${labels.pathMissing}: ${p.path}`
                        : p.path
                    }
                    onClick={() => {
                      onSelect(p);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="cmm__opt-main">
                      <span className="cmm__opt-title">{p.name}</span>
                      {missing && labels.pathMissing ? (
                        <span className="cpm__path-badge">
                          {labels.pathMissing}
                        </span>
                      ) : null}
                    </span>
                    {active ? (
                      <span className="cmm__opt-check" aria-hidden>
                        <IconCheck size={16} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {listEmpty ? (
                <div className="cpm__empty" role="status">
                  {labels.projectsEmpty}
                </div>
              ) : null}
            </div>
            <div className="cpm__footer">
              <button
                type="button"
                role="menuitem"
                className="cpm__new"
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                  onAdd();
                }}
              >
                {labels.newProject}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
