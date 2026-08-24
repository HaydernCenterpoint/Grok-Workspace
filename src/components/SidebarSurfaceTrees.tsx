/**
 * Sidebar project tree grouped by Grok Build / Office / Studio, then Recents.
 * Surfaces list folders plus folderless chats tagged for that workspace.
 * Recents is only stamped Recents `+` chats (never folder sessions).
 */
import {
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { Locale, MessageKey } from "@/i18n";
import { ContextMenu } from "@/components/ContextMenu";
import {
  IconArchive,
  IconArrowsVerticalCollapse,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconFolder,
  IconListCheck,
  IconMore,
  IconPin,
  IconPlus,
  IconNewChat,
} from "@/components/icons";
import { SidebarSessionRow } from "@/components/SidebarSessionRow";
import type {
  SidebarSessionRowLabels,
  SidebarSessionWorktreeBadgeProp,
} from "@/components/SidebarSessionRow";
import { SidebarTreeReveal } from "@/components/SidebarTreeReveal";
import { Tip } from "@/components/ui/tooltip";
import { VirtualList } from "@/components/VirtualList";
import {
  projectDisplayName,
  type Project,
  type SessionRow,
} from "@/lib/app/sidebarModels";
import type { SidebarProjectReorderApi } from "@/hooks/useSidebarProjectReorder";
import {
  newSessionKey,
  productTitleKey,
  WORK_MODES,
  type WorkMode,
} from "@/lib/grokOffice";
import { resolveProjectColorCss } from "@/lib/projectColor";
import { isProjectPathMissing } from "@/lib/projectPath";
import { areAllIdsSelected } from "@/lib/sessionSelect";
import {
  projectVisibleOnSurface,
  type SessionWorkModeMap,
} from "@/lib/sessionWorkMode";
import {
  isCreateProjectWorkspace,
  type CreateProjectWorkspace,
  type ProjectWorkModeMap,
} from "@/lib/projectWorkMode";
import { notePreview } from "@/lib/sessionNotes";
import { SESSION_DROP_ORPHAN } from "@/lib/sessionMoveProject";
import {
  folderListKey,
  folderlessListKey,
  SESSION_LIST_RECENTS,
} from "@/lib/sessionSidebarOrder";
import type {
  SidebarActionScope,
  SidebarSessionLists,
} from "@/lib/sessionSidebarLists";

export type SidebarSurfaceTreesProps = {
  workMode: WorkMode;
  surfaceOpen: Record<WorkMode, boolean>;
  onToggleSurface: (mode: WorkMode) => void;
  onCreateInSurface: (mode: WorkMode) => void;
  recentsOpen: boolean;
  onToggleRecents: () => void;
  onCreateRecent: () => void;
  sessionSelectScope: SidebarActionScope | null;
  onEnterSelect: (scope: SidebarActionScope) => void;
  onExitSelect: () => void;
  onArchiveOlder: (scope: SidebarActionScope, e: ReactMouseEvent) => void;
  onCollapseSurfaceProjects: (mode: WorkMode) => void;
  onAddProject: (workspace: CreateProjectWorkspace) => void;
  canAddProject: boolean;
  onOpenProject: (proj: Project, mode: WorkMode) => void;
  onNewProjectChat: (proj: Project, mode: WorkMode) => void;
  visibleProjects: Project[];
  /** All project ids (not space-filtered) so bound chats are not treated as orphans. */
  projectIds: readonly string[];
  noProjectsAtAll: boolean;
  sessions: SessionRow[];
  sessionWorkModes: SessionWorkModeMap;
  projectWorkModes: ProjectWorkModeMap;
  sessionLists: SidebarSessionLists;
  expandedProjects: Record<string, boolean>;
  setExpandedProjects: (
    next:
      | Record<string, boolean>
      | ((prev: Record<string, boolean>) => Record<string, boolean>),
  ) => void;
  projectReorder: SidebarProjectReorderApi;
  sessionSelectMode: boolean;
  selectedSessionIds: Set<string>;
  toggleSessionsSelected: (ids: string[]) => void;
  activeSessionId: string | null;
  busyIds: Set<string>;
  unreadSessionIds: Set<string>;
  planPendingSessionIds: Set<string>;
  mutedSessionIds: Set<string>;
  sessionNotesMap: Record<string, string>;
  sidebarSessionLabels: SidebarSessionRowLabels;
  locale: Locale;
  sidebarShowRelativeTime: boolean;
  rowHeight: number;
  rowGap: number;
  tr: (key: MessageKey, vars?: Record<string, string>) => string;
  openProjectMenu: (e: ReactMouseEvent, proj: Project) => void;
  relocateProject: (proj: Project) => void;
  trustProject: (proj: Project) => void;
  buildSidebarWorktreeBadge: (
    s: SessionRow,
  ) => SidebarSessionWorktreeBadgeProp | null;
  onSidebarSessionOpen: (s: { id: string }) => void;
  onSidebarSessionContextMenu: (
    e: ReactMouseEvent,
    s: { id: string },
  ) => void;
  onToggleSelect: (sessionId: string, opts?: { shiftKey?: boolean }) => void;
  onSidebarSessionPin: (s: { id: string; pinned?: boolean }) => void;
  onSidebarSessionArchive: (s: { id: string }) => void;
  onSidebarSessionMenu: (e: ReactMouseEvent, s: { id: string }) => void;
  onSidebarSessionRename: (s: { id: string }, title: string) => void;
};

function SurfaceSectionActions(props: {
  selectActive: boolean;
  sessionCount: number;
  canCollapse: boolean;
  createLabel: string;
  tr: (key: MessageKey, vars?: Record<string, string>) => string;
  onEnterSelect: () => void;
  onExitSelect: () => void;
  onArchiveOlder: (e: ReactMouseEvent) => void;
  onCollapse?: () => void;
  onCreate: () => void;
  onAddProject?: () => void;
}) {
  const [plusMenu, setPlusMenu] = useState<{ x: number; y: number } | null>(
    null,
  );
  const plusUsesMenu = !!props.onAddProject;
  const showSelect = props.sessionCount > 0;
  return (
    <div
      className={
        "tree-l1__actions" +
        (props.selectActive ? " tree-l1__actions--select-mode" : "")
      }
    >
      {props.selectActive ? (
        <Tip label={props.tr("common.cancel")}>
          <button
            type="button"
            className="tree-l1__action"
            aria-label={props.tr("common.cancel")}
            onClick={(e) => {
              e.stopPropagation();
              props.onExitSelect();
            }}
          >
            <IconClose size={15} />
          </button>
        </Tip>
      ) : showSelect ? (
        <>
          <Tip label={props.tr("sidebar.select")}>
            <button
              type="button"
              className="tree-l1__action"
              aria-label={props.tr("sidebar.select")}
              onClick={(e) => {
                e.stopPropagation();
                props.onEnterSelect();
              }}
            >
              <IconListCheck size={15} />
            </button>
          </Tip>
          <Tip label={props.tr("sidebar.archiveOlder")}>
            <button
              type="button"
              className="tree-l1__action"
              aria-label={props.tr("sidebar.archiveOlder")}
              onClick={(e) => {
                e.stopPropagation();
                props.onArchiveOlder(e);
              }}
            >
              <IconArchive size={15} />
            </button>
          </Tip>
        </>
      ) : null}
      {props.canCollapse && !props.selectActive ? (
        <Tip label={props.tr("sidebar.collapseAllProjects")}>
          <button
            type="button"
            className="tree-l1__action"
            aria-label={props.tr("sidebar.collapseAllProjects")}
            onClick={(e) => {
              e.stopPropagation();
              props.onCollapse?.();
            }}
          >
            <IconArrowsVerticalCollapse size={15} />
          </button>
        </Tip>
      ) : null}
      {!props.selectActive ? (
        <Tip
          label={
            plusUsesMenu ? props.tr("sidebar.surfacePlus") : props.createLabel
          }
        >
          <button
            type="button"
            className="tree-l1__action"
            aria-label={
              plusUsesMenu ? props.tr("sidebar.surfacePlus") : props.createLabel
            }
            onClick={(e) => {
              e.stopPropagation();
              if (plusUsesMenu) {
                setPlusMenu({ x: e.clientX, y: e.clientY });
                return;
              }
              props.onCreate();
            }}
          >
            <IconPlus size={15} />
          </button>
        </Tip>
      ) : null}
      {plusUsesMenu ? (
        <ContextMenu
          open={!!plusMenu}
          x={plusMenu?.x ?? 0}
          y={plusMenu?.y ?? 0}
          onClose={() => setPlusMenu(null)}
          items={[
            {
              id: "new-session",
              label: props.createLabel,
              icon: <IconNewChat size={16} />,
              onClick: () => props.onCreate(),
            },
            {
              id: "add-project",
              label: props.tr("sidebar.addProject"),
              icon: <IconFolder size={16} />,
              onClick: () => props.onAddProject?.(),
            },
          ]}
        />
      ) : null}
    </div>
  );
}

export function SidebarSurfaceTrees({
  workMode,
  surfaceOpen,
  onToggleSurface,
  onCreateInSurface,
  recentsOpen,
  onToggleRecents,
  onCreateRecent,
  sessionSelectScope,
  onEnterSelect,
  onExitSelect,
  onArchiveOlder,
  onCollapseSurfaceProjects,
  onAddProject,
  canAddProject,
  onOpenProject,
  onNewProjectChat,
  visibleProjects,
  noProjectsAtAll,
  sessions,
  sessionWorkModes,
  projectWorkModes,
  sessionLists,
  expandedProjects,
  setExpandedProjects,
  projectReorder,
  sessionSelectMode,
  selectedSessionIds,
  toggleSessionsSelected,
  activeSessionId,
  busyIds,
  unreadSessionIds,
  planPendingSessionIds,
  mutedSessionIds,
  sessionNotesMap,
  sidebarSessionLabels,
  locale,
  sidebarShowRelativeTime,
  rowHeight,
  rowGap,
  tr,
  openProjectMenu,
  relocateProject,
  trustProject,
  buildSidebarWorktreeBadge,
  onSidebarSessionOpen,
  onSidebarSessionContextMenu,
  onToggleSelect,
  onSidebarSessionPin,
  onSidebarSessionArchive,
  onSidebarSessionMenu,
  onSidebarSessionRename,
}: SidebarSurfaceTreesProps) {
  const recentsSessions = sessionLists[SESSION_LIST_RECENTS] ?? [];
  const selectOnRecents =
    sessionSelectMode &&
    (sessionSelectScope == null || sessionSelectScope === "recents");

  return (
    <>
      {WORK_MODES.map((surfaceMode) => {
        const open = surfaceOpen[surfaceMode] !== false;
        const surfaceProjects = visibleProjects.filter((proj) =>
          projectVisibleOnSurface(
            proj.id,
            sessions,
            surfaceMode,
            sessionWorkModes,
            projectWorkModes,
          ),
        );
        const createLabel = tr(newSessionKey(surfaceMode));
        const folderlessKey = folderlessListKey(surfaceMode);
        const folderlessSessions = sessionLists[folderlessKey] ?? [];
        const empty =
          surfaceProjects.length === 0 && folderlessSessions.length === 0;
        const surfaceSessionCount =
          folderlessSessions.length +
          surfaceProjects.reduce(
            (n, proj) =>
              n + (sessionLists[folderListKey(surfaceMode, proj.id)]?.length ?? 0),
            0,
          );
        const selectOnSurface =
          sessionSelectMode &&
          (sessionSelectScope == null || sessionSelectScope === surfaceMode);
        const addWorkspace = isCreateProjectWorkspace(surfaceMode)
          ? surfaceMode
          : null;
        return (
          <div key={surfaceMode} className="tree-surface">
            <div className="tree-l1" data-surface-drop={surfaceMode}>
              <button
                type="button"
                className={
                  "tree-l1__head" +
                  (workMode === surfaceMode ? " is-current" : "")
                }
                aria-expanded={open}
                onClick={() => onToggleSurface(surfaceMode)}
              >
                <span className="tree-l1__chevron" aria-hidden>
                  {open ? (
                    <IconChevronDown size={14} />
                  ) : (
                    <IconChevronRight size={14} />
                  )}
                </span>
                <span className="tree-l1__label">
                  {tr(productTitleKey(surfaceMode))}
                </span>
              </button>
              <SurfaceSectionActions
                selectActive={selectOnSurface}
                sessionCount={surfaceSessionCount}
                canCollapse={surfaceProjects.length > 0}
                createLabel={createLabel}
                tr={tr}
                onEnterSelect={() => onEnterSelect(surfaceMode)}
                onExitSelect={onExitSelect}
                onArchiveOlder={(e) => onArchiveOlder(surfaceMode, e)}
                onCollapse={() => onCollapseSurfaceProjects(surfaceMode)}
                onCreate={() => onCreateInSurface(surfaceMode)}
                onAddProject={
                  canAddProject && addWorkspace
                    ? () => onAddProject(addWorkspace)
                    : undefined
                }
              />
            </div>
            <SidebarTreeReveal
              open={open}
              className="tree-reveal--projects"
            >
              {empty ? (
                <div className="sidebar-empty">
                  {noProjectsAtAll && surfaceMode === "code"
                    ? tr("sidebar.noProjects")
                    : tr("sidebar.surfaceEmpty")}
                </div>
              ) : null}
              {surfaceProjects.map((proj) => {
                const folderOpen = expandedProjects[proj.id] !== false;
                const projListKey = folderListKey(surfaceMode, proj.id);
                const projSessions = sessionLists[projListKey] ?? [];
                const projSessionIds = projSessions.map((s) => s.id);
                const projAllSelected = areAllIdsSelected(
                  selectedSessionIds,
                  projSessionIds,
                );
                return (
                  <div
                    key={`${surfaceMode}:${proj.id}`}
                    className="tree-project"
                    data-session-drop={proj.id}
                    data-session-drop-surface={surfaceMode}
                  >
                    <div
                      className={
                        "tree-l2" +
                        (isProjectPathMissing(proj.pathOk)
                          ? " tree-l2--path-missing"
                          : "") +
                        (selectOnSurface ? " tree-l2--select-mode" : "") +
                        (projectReorder.enabled
                          ? " tree-l2--reorderable"
                          : "")
                      }
                      data-project-reorder-id={proj.id}
                      data-session-drop={proj.id}
                      data-session-drop-surface={surfaceMode}
                      role="button"
                      tabIndex={0}
                      aria-expanded={folderOpen}
                      {...(projectReorder.enabled
                        ? projectReorder.bindRow(proj.id)
                        : {})}
                      onClick={() => {
                        if (projectReorder.suppressNextClick()) return;
                        onOpenProject(proj, surfaceMode);
                        setExpandedProjects((e) => ({
                          ...e,
                          [proj.id]: !folderOpen,
                        }));
                      }}
                      onContextMenu={(e) => openProjectMenu(e, proj)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onOpenProject(proj, surfaceMode);
                          setExpandedProjects((ex) => ({
                            ...ex,
                            [proj.id]: !folderOpen,
                          }));
                        }
                      }}
                    >
                      <span className="tree-l2__icon">
                        <IconFolder size={15} />
                      </span>
                      {resolveProjectColorCss(proj.color) ? (
                        <span
                          className="tree-l2__color-dot"
                          style={
                            {
                              "--project-color": resolveProjectColorCss(
                                proj.color,
                              ),
                            } as CSSProperties
                          }
                          aria-hidden
                        />
                      ) : null}
                      <Tip
                        label={
                          isProjectPathMissing(proj.pathOk)
                            ? tr("project.pathMissing", { name: proj.name })
                            : proj.path
                        }
                      >
                        <span className="tree-l2__name">
                          {proj.pinned ? (
                            <IconPin size={12} className="tree-l2__pin" />
                          ) : null}
                          {projectDisplayName(proj, tr)}
                        </span>
                      </Tip>
                      {isProjectPathMissing(proj.pathOk) ? (
                        <span className="project-row__badge project-row__badge--path-missing">
                          {tr("sidebar.pathMissing")}
                        </span>
                      ) : !proj.trusted ? (
                        <span className="project-row__badge">
                          {tr("sidebar.untrusted")}
                        </span>
                      ) : null}
                      <span
                        className={
                          "tree-l2__actions" +
                          (selectOnSurface
                            ? " tree-l2__actions--select-mode"
                            : "")
                        }
                      >
                        {selectOnSurface ? (
                          projSessionIds.length > 0 ? (
                            <button
                              type="button"
                              className={
                                "tree-l2__select-all" +
                                (projAllSelected
                                  ? " tree-l2__select-all--on"
                                  : "")
                              }
                              aria-label={
                                projAllSelected
                                  ? tr("sidebar.deselectAllInGroup")
                                  : tr("sidebar.selectAllInGroup")
                              }
                              aria-pressed={projAllSelected}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSessionsSelected(projSessionIds);
                              }}
                            >
                              <span
                                className={
                                  "tree-l3__check" +
                                  (projAllSelected ? " is-on" : "")
                                }
                                aria-hidden
                              >
                                {projAllSelected ? (
                                  <IconCheck size={11} stroke={2.4} />
                                ) : null}
                              </span>
                              <span className="tree-l2__select-all-label">
                                {projAllSelected
                                  ? tr("sidebar.deselectAllInGroup")
                                  : tr("sidebar.selectAllInGroup")}
                              </span>
                            </button>
                          ) : null
                        ) : (
                          <>
                            <Tip label={tr("sidebar.newConversation")}>
                              <button
                                type="button"
                                className="tree-icon-btn"
                                disabled={
                                  !proj.trusted ||
                                  isProjectPathMissing(proj.pathOk)
                                }
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNewProjectChat(proj, surfaceMode);
                                }}
                              >
                                <IconNewChat size={14} />
                              </button>
                            </Tip>
                            <Tip label={tr("sidebar.menu")}>
                              <button
                                type="button"
                                className="tree-icon-btn"
                                onClick={(e) => openProjectMenu(e, proj)}
                              >
                                <IconMore size={14} />
                              </button>
                            </Tip>
                          </>
                        )}
                      </span>
                    </div>

                    <SidebarTreeReveal open={folderOpen}>
                      <div className="tree-l3-list-wrap">
                        {isProjectPathMissing(proj.pathOk) && (
                          <button
                            type="button"
                            className="tree-l3 tree-l3--hint"
                            onClick={(e) => {
                              e.stopPropagation();
                              void relocateProject(proj);
                            }}
                          >
                            {tr("sidebar.relocateProject")}
                          </button>
                        )}
                        {!proj.trusted &&
                          !isProjectPathMissing(proj.pathOk) && (
                            <button
                              type="button"
                              className="tree-l3 tree-l3--hint"
                              onClick={(e) => {
                                e.stopPropagation();
                                void trustProject(proj);
                              }}
                            >
                              {tr("sidebar.trustProject")}
                            </button>
                          )}
                        {projSessions.length > 0 ? (
                          <VirtualList
                            className="tree-l3-list"
                            items={projSessions}
                            getKey={(s) => s.id}
                            rowHeight={rowHeight}
                            gap={rowGap}
                            scrollToKey={
                              activeSessionId &&
                              projSessions.some(
                                (x) => x.id === activeSessionId,
                              )
                                ? activeSessionId
                                : null
                            }
                            renderItem={(s) => {
                              const noteRaw =
                                sessionNotesMap[s.id]?.trim() || "";
                              return (
                                <SidebarSessionRow
                                  session={s}
                                  variant="project"
                                  listKey={projListKey}
                                  active={activeSessionId === s.id}
                                  working={busyIds.has(s.id)}
                                  unread={unreadSessionIds.has(s.id)}
                                  planPending={planPendingSessionIds.has(
                                    s.id,
                                  )}
                                  checked={selectedSessionIds.has(s.id)}
                                  selectMode={selectOnSurface}
                                  muted={mutedSessionIds.has(s.id)}
                                  noteTitle={
                                    noteRaw
                                      ? notePreview(noteRaw) ||
                                        sidebarSessionLabels.noteAria
                                      : null
                                  }
                                  worktreeBadge={buildSidebarWorktreeBadge(
                                    s,
                                  )}
                                  labels={sidebarSessionLabels}
                                  locale={locale}
                                  showRelativeTime={
                                    sidebarShowRelativeTime
                                  }
                                  onOpen={onSidebarSessionOpen}
                                  onContextMenu={
                                    onSidebarSessionContextMenu
                                  }
                                  onToggleSelect={onToggleSelect}
                                  onPin={onSidebarSessionPin}
                                  onArchive={onSidebarSessionArchive}
                                  onMenu={onSidebarSessionMenu}
                                  onRename={onSidebarSessionRename}
                                />
                              );
                            }}
                          />
                        ) : null}
                        {projSessions.length === 0 && proj.trusted && (
                          <div
                            className="sidebar-empty"
                            style={{ padding: "4px 10px" }}
                          >
                            {tr("sidebar.noChats")}
                          </div>
                        )}
                      </div>
                    </SidebarTreeReveal>
                  </div>
                );
              })}
              {folderlessSessions.length > 0 ? (
                <div className="tree-orphan">
                  <div className="tree-l3-list-wrap">
                    <VirtualList
                      className="tree-l3-list"
                      items={folderlessSessions}
                      getKey={(s) => s.id}
                      rowHeight={rowHeight}
                      gap={rowGap}
                      scrollToKey={
                        activeSessionId &&
                        folderlessSessions.some(
                          (x) => x.id === activeSessionId,
                        )
                          ? activeSessionId
                          : null
                      }
                      renderItem={(s) => {
                        const noteRaw = sessionNotesMap[s.id]?.trim() || "";
                        return (
                          <SidebarSessionRow
                            session={s}
                            variant="project"
                            listKey={folderlessKey}
                            active={activeSessionId === s.id}
                            working={busyIds.has(s.id)}
                            unread={unreadSessionIds.has(s.id)}
                            planPending={planPendingSessionIds.has(s.id)}
                            checked={selectedSessionIds.has(s.id)}
                            selectMode={selectOnSurface}
                            muted={mutedSessionIds.has(s.id)}
                            noteTitle={
                              noteRaw
                                ? notePreview(noteRaw) ||
                                  sidebarSessionLabels.noteAria
                                : null
                            }
                            worktreeBadge={buildSidebarWorktreeBadge(s)}
                            labels={sidebarSessionLabels}
                            locale={locale}
                            showRelativeTime={sidebarShowRelativeTime}
                            onOpen={onSidebarSessionOpen}
                            onContextMenu={onSidebarSessionContextMenu}
                            onToggleSelect={onToggleSelect}
                            onPin={onSidebarSessionPin}
                            onArchive={onSidebarSessionArchive}
                            onMenu={onSidebarSessionMenu}
                            onRename={onSidebarSessionRename}
                          />
                        );
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </SidebarTreeReveal>
          </div>
        );
      })}
      <div className="tree-surface" data-session-drop={SESSION_DROP_ORPHAN}>
        <div className="tree-l1" data-session-drop={SESSION_DROP_ORPHAN}>
          <Tip label={tr("sidebar.recentsTip")}>
            <button
              type="button"
              className="tree-l1__head"
              aria-expanded={recentsOpen}
              onClick={onToggleRecents}
            >
              <span className="tree-l1__chevron" aria-hidden>
                {recentsOpen ? (
                  <IconChevronDown size={14} />
                ) : (
                  <IconChevronRight size={14} />
                )}
              </span>
              <span className="tree-l1__label">{tr("sidebar.recents")}</span>
            </button>
          </Tip>
          <SurfaceSectionActions
            selectActive={selectOnRecents}
            sessionCount={recentsSessions.length}
            canCollapse={false}
            createLabel={tr("sidebar.recentsNewSession")}
            tr={tr}
            onEnterSelect={() => onEnterSelect("recents")}
            onExitSelect={onExitSelect}
            onArchiveOlder={(e) => onArchiveOlder("recents", e)}
            onCreate={onCreateRecent}
          />
        </div>
        <SidebarTreeReveal
          open={recentsOpen}
          className="tree-reveal--projects"
        >
          {recentsSessions.length === 0 ? (
            <div className="sidebar-empty">{tr("sidebar.recentsEmpty")}</div>
          ) : (
            <div className="tree-orphan">
              <div className="tree-l3-list-wrap">
                <VirtualList
                  className="tree-orphan-list"
                  items={recentsSessions}
                  getKey={(s) => s.id}
                  rowHeight={rowHeight}
                  gap={rowGap}
                  scrollToKey={
                    activeSessionId &&
                    recentsSessions.some((x) => x.id === activeSessionId)
                      ? activeSessionId
                      : null
                  }
                  renderItem={(s) => {
                    const noteRaw = sessionNotesMap[s.id]?.trim() || "";
                    return (
                      <SidebarSessionRow
                        session={s}
                        variant="orphan"
                        listKey={SESSION_LIST_RECENTS}
                        active={activeSessionId === s.id}
                        working={busyIds.has(s.id)}
                        unread={unreadSessionIds.has(s.id)}
                        planPending={planPendingSessionIds.has(s.id)}
                        checked={selectedSessionIds.has(s.id)}
                        selectMode={selectOnRecents}
                        muted={mutedSessionIds.has(s.id)}
                        noteTitle={
                          noteRaw
                            ? notePreview(noteRaw) ||
                              sidebarSessionLabels.noteAria
                            : null
                        }
                        worktreeBadge={buildSidebarWorktreeBadge(s)}
                        labels={sidebarSessionLabels}
                        locale={locale}
                        showRelativeTime={sidebarShowRelativeTime}
                        onOpen={onSidebarSessionOpen}
                        onContextMenu={onSidebarSessionContextMenu}
                        onToggleSelect={onToggleSelect}
                        onPin={onSidebarSessionPin}
                        onArchive={onSidebarSessionArchive}
                        onMenu={onSidebarSessionMenu}
                        onRename={onSidebarSessionRename}
                      />
                    );
                  }}
                />
              </div>
            </div>
          )}
        </SidebarTreeReveal>
      </div>
    </>
  );
}
