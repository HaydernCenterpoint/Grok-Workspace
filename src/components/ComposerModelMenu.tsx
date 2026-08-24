/**
 * Composer chip menus:
 * - Model: ChatGPT-style Model / Speed / Context window rows
 * - Access: Ask / Approve for me / Full access (no Mode or Advanced)
 * Narrow composer widths compress triggers to icon (+ short label).
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  GROK_BUILD_MODELS,
  effortDisplayLabel,
  effortUiOptionsForCatalog,
  effortsForModel,
  findModel,
  spawnIdToEffortUiSlot,
  type ModelOption,
  type PermissionPolicyId,
} from "@/lib/grokCatalog";
import {
  buildComposerModelGroups,
  filterComposerModelGroups,
  isComposerModelEntryActive,
  type ComposerModelPick,
  type ComposerProviderInput,
} from "@/lib/composerModelGroups";
import { composerModelChipLabel } from "@/lib/effectiveModel";
import { formatTokenCount } from "@/lib/contextUsage";
import { Tip } from "@/components/ui/tooltip";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
} from "@/components/icons";
import {
  COMPOSER_PRIMARY_POLICIES,
  asPermissionPolicyId,
  composerPolicyIcon,
} from "@/components/composerAccessVisuals";
import { useFloatingMenu, type FloatingPos } from "@/lib/floatingMenu";

type Nested = "model" | "effort" | "window" | null;

function usePortalMenu(
  estHeight = 220,
  minWidth = 200,
  nestedKey?: string,
) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  const { pos, style: popStyle } = useFloatingMenu({
    open,
    triggerRef,
    panelRef: popRef,
    roots: [rootRef],
    onClose: () => setOpen(false),
    placement: "auto",
    fitContent: true,
    minWidth,
    estHeight,
    gap: 8,
    deps: [nestedKey],
  });

  return {
    open,
    setOpen,
    pos,
    popStyle: popStyle as CSSProperties | undefined,
    rootRef,
    triggerRef,
    popRef,
    popId,
  };
}

function MenuShell({
  open,
  setOpen,
  rootRef,
  triggerRef,
  popRef,
  popId,
  pos,
  popStyle,
  triggerIcon,
  triggerText,
  triggerShort,
  ariaLabel,
  title,
  danger,
  children,
  onOpenChange,
  className = "",
  /** Applied on the portaled panel (body), not the trigger root. */
  panelClassName = "",
}: {
  open: boolean;
  setOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  rootRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  popRef: React.RefObject<HTMLDivElement | null>;
  popId: string;
  pos: FloatingPos | null;
  popStyle: CSSProperties | undefined;
  triggerIcon?: ReactNode;
  /** Full label (wide layout) */
  triggerText: string;
  /** Short label (medium; icon-only when very narrow via CSS) */
  triggerShort?: string;
  ariaLabel: string;
  title?: string;
  danger?: boolean;
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  panelClassName?: string;
}) {
  const panel =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popRef}
            className={["cmm__pop", "cmm__pop--portal", panelClassName]
              .filter(Boolean)
              .join(" ")}
            id={popId}
            role="dialog"
            aria-label={ariaLabel}
            style={popStyle}
          >
            {children}
          </div>,
          document.body,
        )
      : null;

  const tipLabel = title ?? ariaLabel;
  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      className="cmm__trigger"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={popId}
      aria-label={ariaLabel}
      onClick={() => {
        setOpen((v) => {
          const next = !v;
          onOpenChange?.(next);
          return next;
        });
      }}
    >
      {triggerIcon ? (
        <span className="cmm__icon" aria-hidden>
          {triggerIcon}
        </span>
      ) : null}
      <span className="cmm__trigger-text cmm__trigger-text--full">
        {triggerText}
      </span>
      {triggerShort != null && (
        <span className="cmm__trigger-text cmm__trigger-text--short">
          {triggerShort}
        </span>
      )}
      <span className="cmm__chev" aria-hidden>
        <IconChevronDown size={12} />
      </span>
    </button>
  );

  return (
    <div
      ref={rootRef}
      className={`cmm ${open ? "is-open" : ""} ${danger ? "cmm--danger" : ""} ${className}`.trim()}
    >
      {tipLabel ? <Tip label={tipLabel}>{trigger}</Tip> : trigger}
      {panel}
    </div>
  );
}

/* ---------- Model + effort ---------- */

export interface ComposerModelMenuProps {
  modelId: string;
  effort: string;
  /** Live selectable models only (from Host catalog). */
  models?: ModelOption[];
  /** Configured custom providers for grouped menu entries. */
  providers?: ComposerProviderInput[];
  /** Active inference route: official | custom. */
  activeSource?: string;
  activeProviderId?: string | null;
  labels: {
    model: string;
    effort: string;
    effortHigh: string;
    effortMedium: string;
    effortLow: string;
    effortXhigh?: string;
    effortMax?: string;
    /** Search field placeholder in the model nested list. */
    modelSearchPlaceholder: string;
    /** Empty state when filter matches nothing. */
    modelSearchEmpty: string;
    /** ChatGPT-style Speed row (maps to reasoning effort). */
    speed?: string;
    /** Section header for official catalog models. */
    modelGroupOfficial: string;
    /** @deprecated Prefer real custom groups via `providers`. */
    modelViaProvider?: string;
    /** Context window sub-menu labels. */
    contextWindow: string;
    contextWindowOfficial: string;
    contextWindowCustom: string;
    contextWindowPlaceholder: string;
    contextWindowSave: string;
    contextWindowOfficialHint: string;
  };
  /** Resolved UI locale — token window uses K/M (en) vs 万/千 (zh). */
  locale?: string;
  /** Effective context window (tokens) for the active route. */
  contextWindow?: number | null;
  /** True for custom routes (editable); false for official (read-only). */
  contextWindowEditable?: boolean;
  /** Save a new context window (custom channels only). */
  onContextWindow?: (tokens: number) => void;
  /**
   * When custom route is active, use channel-configured efforts
   * (e.g. DeepSeek low/high/xhigh/max) instead of official catalog.
   */
  channelEfforts?: import("@/lib/grokCatalog").EffortOption[] | null;
  /** Prefer over onModel when provided. */
  onModelPick?: (pick: ComposerModelPick) => void;
  onModel?: (id: string) => void;
  onEffort: (id: string) => void;
  /**
   * Apply-path honesty when a live agent is attached (e.g. soft-respawn /
   * immediate set_model). Shown as a footer note in nested lists when set.
   */
  applyNotes?: {
    model?: string | null;
    effort?: string | null;
  };
}

function effortI18n(labels: ComposerModelMenuProps["labels"]) {
  return {
    high: labels.effortHigh,
    medium: labels.effortMedium,
    low: labels.effortLow,
    xhigh: labels.effortXhigh,
    max: labels.effortMax ?? labels.effortXhigh,
  };
}

/** Label for a spawn effort id via the canonical UI ladder (低/中/高/极高). */
function resolveEffortLabel(
  spawnId: string,
  catalogEfforts: ReturnType<typeof effortsForModel> | null | undefined,
  labels: ComposerModelMenuProps["labels"],
): string {
  const slot = spawnIdToEffortUiSlot(spawnId, catalogEfforts);
  return effortDisplayLabel(slot ?? spawnId, effortI18n(labels));
}

export function ComposerModelMenu({
  modelId,
  effort,
  models = GROK_BUILD_MODELS,
  providers = [],
  activeSource = "official",
  activeProviderId = null,
  channelEfforts = null,
  labels,
  onModelPick,
  onModel,
  onEffort,
  applyNotes,
  locale = "en",
  contextWindow = null,
  contextWindowEditable = false,
  onContextWindow,
}: ComposerModelMenuProps) {
  const [nested, setNested] = useState<Nested>(null);
  const [modelQuery, setModelQuery] = useState("");
  const [windowDraft, setWindowDraft] = useState("");
  const modelSearchRef = useRef<HTMLInputElement>(null);
  /* Wider min so long custom model ids render fully in the root rows. */
  const menu = usePortalMenu(240, 200, nested ?? "root");
  const modelList = models.length > 0 ? models : GROK_BUILD_MODELS;
  const groups = buildComposerModelGroups({
    officialModels: modelList,
    providers,
    officialGroupTitle: labels.modelGroupOfficial,
  });
  const filteredGroups = filterComposerModelGroups(groups, modelQuery);
  const activeModel = findModel(modelId, modelList);
  const effortCatalog =
    activeSource === "custom" && channelEfforts && channelEfforts.length > 0
      ? effortsForModel(null, channelEfforts)
      : effortsForModel(activeModel);
  /** Ordered UI ladder (3 or 4 slots); spawnId is the real model value. */
  const effortUiList = effortUiOptionsForCatalog(effortCatalog);

  const clearModelQuery = () => setModelQuery("");

  const selectPick = (pick: ComposerModelPick) => {
    if (onModelPick) {
      onModelPick(pick);
    } else if (pick.kind === "official" && onModel) {
      onModel(pick.modelId);
    }
    // Close the whole menu (root + nested), not just pop back to stage 1.
    setNested(null);
    menu.setOpen(false);
  };

  useEffect(() => {
    if (!menu.open) {
      setNested(null);
      clearModelQuery();
    }
  }, [menu.open]);

  // Clear filter when leaving the model nested list (back / effort / select).
  useEffect(() => {
    if (nested !== "model") clearModelQuery();
  }, [nested]);

  // Autofocus search when entering the model list.
  useEffect(() => {
    if (!menu.open || nested !== "model") return;
    const id = requestAnimationFrame(() => {
      modelSearchRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [menu.open, nested]);

  useEffect(() => {
    if (!menu.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && nested) {
        // Capture + stopImmediate so floatingMenu does not close the whole panel.
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setNested(null);
        return;
      }
      // Typing while on model list focuses the filter (e.g. after tabbing to a row).
      if (nested !== "model") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;
      const active = document.activeElement;
      if (
        active === modelSearchRef.current ||
        (active instanceof HTMLElement &&
          active.closest("input, textarea, [contenteditable=true]"))
      ) {
        return;
      }
      e.preventDefault();
      setModelQuery((q) => q + e.key);
      modelSearchRef.current?.focus();
    };
    // Capture so Escape wins over useFloatingMenu's bubble listener.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [menu.open, nested]);

  const activeCustom =
    activeSource === "custom" && activeProviderId
      ? (() => {
          const p = providers.find((x) => x.id === activeProviderId);
          if (!p) return null;
          const activeId = p.model?.trim() ?? "";
          const entry =
            p.models?.find((m) => m.id === activeId) ??
            (activeId ? { id: activeId, name: activeId } : null);
          return entry
            ? { name: entry.name || entry.id, model: entry.id }
            : { name: p.name, model: p.model };
        })()
      : null;
  const activeRequestModel =
    activeSource === "custom"
      ? providers.find((x) => x.id === activeProviderId)?.model ?? null
      : null;
  const officialLabel = activeModel?.label ?? modelId;
  const modelLabel = composerModelChipLabel({
    modelId,
    officialLabel,
    activeCustom,
  });
  const eLabel = resolveEffortLabel(effort, effortCatalog, labels);
  const speedLabel = labels.speed ?? labels.effort;
  // Compact trigger: model + short effort (locale), no middle-dot noise.
  const triggerText = `${modelLabel} ${eLabel}`;
  const title = `${labels.model}: ${modelLabel} · ${speedLabel}: ${eLabel}`;

  return (
    <MenuShell
      {...menu}
      className="cmm--model"
      panelClassName="cmm__pop--model"
      triggerText={triggerText}
      triggerShort={eLabel}
      ariaLabel={labels.model}
      title={title}
      onOpenChange={(o) => {
        if (!o) {
          setNested(null);
          clearModelQuery();
        }
      }}
    >
      {nested === null ? (
        <>
          <button
            type="button"
            className="cmm__row"
            onClick={() => setNested("model")}
          >
            <span>{labels.model}</span>
            <span className="cmm__row-val">
              <span className="cmm__row-val-text" title={modelLabel}>
                {modelLabel}
              </span>
              <IconChevronRight size={14} />
            </span>
          </button>
          <button
            type="button"
            className="cmm__row"
            onClick={() => setNested("effort")}
          >
            <span>{speedLabel}</span>
            <span className="cmm__row-val">
              <span className="cmm__row-val-text">{eLabel}</span>
              <IconChevronRight size={14} />
            </span>
          </button>
          <button
            type="button"
            className="cmm__row"
            onClick={() => {
              setWindowDraft(
                contextWindowEditable && contextWindow
                  ? String(contextWindow)
                  : "",
              );
              setNested("window");
            }}
          >
            <span>{labels.contextWindow}</span>
            <span className="cmm__row-val">
              <span className="cmm__row-val-text">
                {contextWindow ? formatTokenCount(contextWindow, locale) : "—"}
              </span>
              <IconChevronRight size={14} />
            </span>
          </button>
        </>
      ) : (
        <div className="cmm__nested">
          <button
            type="button"
            className="cmm__back"
            onClick={() => setNested(null)}
          >
            {nested === "model"
              ? labels.model
              : nested === "window"
                ? labels.contextWindow
                : speedLabel}
          </button>
          {nested === "model" &&
            (groups.length === 0 ? (
              <div className="cmm__opt cmm__opt--muted" role="status">
                <span className="cmm__opt-main">
                  <span className="cmm__opt-title">{modelId || "—"}</span>
                </span>
              </div>
            ) : (
              <>
                <div className="cmm__search">
                  <input
                    ref={modelSearchRef}
                    type="search"
                    className="cmm__search-input"
                    value={modelQuery}
                    onChange={(e) => setModelQuery(e.target.value)}
                    placeholder={labels.modelSearchPlaceholder}
                    aria-label={labels.modelSearchPlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                    // Keep menu open / avoid accidental form submit.
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                  />
                </div>
                {filteredGroups.length === 0 ? (
                  <div className="cmm__opt cmm__opt--muted" role="status">
                    <span className="cmm__opt-main">
                      <span className="cmm__opt-title">
                        {labels.modelSearchEmpty}
                      </span>
                    </span>
                  </div>
                ) : (
                  filteredGroups.map((group) => (
                    <div key={group.key}>
                      <div className="cmm__section">{group.title}</div>
                      {group.entries.map((entry) => {
                        const active = isComposerModelEntryActive(entry, {
                          activeSource,
                          activeProviderId,
                          activeRequestModel,
                          modelId,
                        });
                        return (
                          <button
                            key={entry.key}
                            type="button"
                            className={"cmm__opt" + (active ? " is-active" : "")}
                            onClick={() => selectPick(entry.pick)}
                          >
                            <span className="cmm__opt-main">
                              <span className="cmm__opt-title">
                                {entry.title}
                              </span>
                              {entry.subtitle ? (
                                <span className="cmm__opt-desc">
                                  {entry.subtitle}
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
                    </div>
                  ))
                )}
              </>
            ))}
          {nested === "effort" &&
            effortUiList.map((e) => {
              const active =
                e.spawnId === effort ||
                spawnIdToEffortUiSlot(effort, effortCatalog) === e.uiId;
              return (
                <button
                  key={e.uiId}
                  type="button"
                  className={"cmm__opt" + (active ? " is-active" : "")}
                  onClick={() => {
                    onEffort(e.spawnId);
                    // Close whole menu after second-stage pick (same as model).
                    setNested(null);
                    menu.setOpen(false);
                  }}
                >
                  <span className="cmm__opt-main">
                    <span className="cmm__opt-title">
                      {effortDisplayLabel(e.uiId, effortI18n(labels))}
                    </span>
                  </span>
                  {active ? (
                    <span className="cmm__opt-check" aria-hidden>
                      <IconCheck size={16} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          {nested === "window" && (
            <div className="cmm__opt cmm__opt--muted">
              {contextWindowEditable ? (
                <>
                  <span className="cmm__opt-main">
                    <span className="cmm__opt-title">
                      {labels.contextWindowCustom}
                    </span>
                  </span>
                  <div className="cmm__inline-edit">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={windowDraft}
                      placeholder={labels.contextWindowPlaceholder}
                      onChange={(e) => setWindowDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const n = parseInt(windowDraft, 10);
                          if (Number.isFinite(n) && n > 0) {
                            onContextWindow?.(n);
                            setNested(null);
                            menu.setOpen(false);
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="cmm__inline-save"
                      disabled={!Number.isFinite(parseInt(windowDraft, 10))}
                      onClick={() => {
                        const n = parseInt(windowDraft, 10);
                        if (Number.isFinite(n) && n > 0) {
                          onContextWindow?.(n);
                          setNested(null);
                          menu.setOpen(false);
                        }
                      }}
                    >
                      {labels.contextWindowSave}
                    </button>
                  </div>
                </>
              ) : (
                <span className="cmm__opt-main">
                  <span className="cmm__opt-title">
                    {contextWindow
                      ? formatTokenCount(contextWindow, locale)
                      : "—"}
                  </span>
                  <span className="cmm__opt-desc">
                    {contextWindow
                      ? labels.contextWindowOfficial
                      : labels.contextWindowOfficialHint}
                  </span>
                </span>
              )}
            </div>
          )}
          {nested === "model" && applyNotes?.model ? (
            <div className="cmm__apply-note" role="note">
              {applyNotes.model}
            </div>
          ) : null}
          {nested === "effort" && applyNotes?.effort ? (
            <div className="cmm__apply-note" role="note">
              {applyNotes.effort}
            </div>
          ) : null}
        </div>
      )}
    </MenuShell>
  );
}

/* ---------- Access: ChatGPT-style Ask / Approve / Full access ---------- */

export interface ComposerAccessMenuProps {
  policy: string;
  labels: {
    access: string;
    accessHint: string;
    learnMore: string;
    permission: string;
    policyAsk: string;
    policyAcceptEdits: string;
    policySession: string;
    policyAuto: string;
    policyDontAsk: string;
    policyYolo: string;
    policyAskDesc: string;
    policyAcceptEditsDesc: string;
    policySessionDesc: string;
    policyAutoDesc: string;
    policyDontAskDesc: string;
    policyYoloDesc: string;
    policyShortAsk: string;
    policyShortAccept: string;
    policyShortSession: string;
    policyShortAuto: string;
    policyShortDontAsk: string;
    policyShortYolo: string;
  };
  onPolicy: (id: PermissionPolicyId) => void;
  onLearnMore?: () => void;
}

function policyLabel(
  id: PermissionPolicyId,
  labels: ComposerAccessMenuProps["labels"],
): string {
  switch (id) {
    case "accept_edits":
      return labels.policyAcceptEdits;
    case "allow_for_session":
      return labels.policySession;
    case "auto":
      return labels.policyAuto;
    case "dont_ask":
      return labels.policyDontAsk;
    case "always_approve":
      return labels.policyYolo;
    case "ask":
      return labels.policyAsk;
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

function policyShort(
  id: PermissionPolicyId,
  labels: ComposerAccessMenuProps["labels"],
): string {
  switch (id) {
    case "accept_edits":
      return labels.policyShortAccept;
    case "allow_for_session":
      return labels.policyShortSession;
    case "auto":
      return labels.policyShortAuto;
    case "dont_ask":
      return labels.policyShortDontAsk;
    case "always_approve":
      return labels.policyShortYolo;
    case "ask":
      return labels.policyShortAsk;
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

function policyDesc(
  id: PermissionPolicyId,
  labels: ComposerAccessMenuProps["labels"],
): string {
  switch (id) {
    case "accept_edits":
      return labels.policyAcceptEditsDesc;
    case "allow_for_session":
      return labels.policySessionDesc;
    case "auto":
      return labels.policyAutoDesc;
    case "dont_ask":
      return labels.policyDontAskDesc;
    case "always_approve":
      return labels.policyYoloDesc;
    case "ask":
      return labels.policyAskDesc;
    default: {
      const _never: never = id;
      return _never;
    }
  }
}

function AccessPolicyRow({
  id,
  active,
  labels,
  onSelect,
}: {
  id: PermissionPolicyId;
  active: boolean;
  labels: ComposerAccessMenuProps["labels"];
  onSelect: (id: PermissionPolicyId) => void;
}) {
  const yolo = id === "always_approve";
  return (
    <button
      type="button"
      className={
        "cmm__opt cmm__opt--access" +
        (active ? " is-active" : "") +
        (yolo ? " is-yolo" : "")
      }
      onClick={() => onSelect(id)}
    >
      <span
        className={
          "cmm__opt-icon" + (yolo ? " cmm__opt-icon--grok" : "")
        }
        aria-hidden
      >
        {composerPolicyIcon(id, 20)}
      </span>
      <span className="cmm__opt-main">
        <span className="cmm__opt-title">{policyLabel(id, labels)}</span>
        <span className="cmm__opt-desc">{policyDesc(id, labels)}</span>
      </span>
      {active ? (
        <span className="cmm__opt-check" aria-hidden>
          <IconCheck size={16} />
        </span>
      ) : null}
    </button>
  );
}

export function ComposerAccessMenu({
  policy,
  labels,
  onPolicy,
  onLearnMore,
}: ComposerAccessMenuProps) {
  const menu = usePortalMenu(360, 320);
  const policyId = asPermissionPolicyId(policy);
  const isYolo = policyId === "always_approve";
  const full = policyLabel(policyId, labels);
  const short = policyShort(policyId, labels);

  const pickPolicy = (id: PermissionPolicyId) => {
    onPolicy(id);
    menu.setOpen(false);
  };

  const panel =
    menu.open && menu.pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menu.popRef}
            className="cmm__pop cmm__pop--portal cmm__pop--access"
            id={menu.popId}
            role="dialog"
            aria-label={labels.access}
            style={menu.popStyle}
          >
            <div className="cmm__access-sheet">
              <div className="cmm__access-head">
                <div className="cmm__header-title">{labels.accessHint}</div>
                {onLearnMore ? (
                  <button
                    type="button"
                    className="cmm__access-learn"
                    onClick={() => {
                      menu.setOpen(false);
                      onLearnMore();
                    }}
                  >
                    {labels.learnMore}
                  </button>
                ) : null}
              </div>
              <div role="group" aria-label={labels.permission}>
                {COMPOSER_PRIMARY_POLICIES.map((id) => (
                  <AccessPolicyRow
                    key={id}
                    id={id}
                    active={id === policyId}
                    labels={labels}
                    onSelect={pickPolicy}
                  />
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={menu.rootRef}
      className={`cmm cmm--access${menu.open ? " is-open" : ""}${isYolo ? " cmm--danger" : ""}`}
    >
      <button
        ref={menu.triggerRef}
        type="button"
        className="cmm__trigger cmm-run__pill"
        aria-haspopup="dialog"
        aria-expanded={menu.open}
        aria-controls={menu.popId}
        aria-label={full}
        onClick={() => menu.setOpen((v) => !v)}
      >
        <span className="cmm__icon" aria-hidden>
          {composerPolicyIcon(policyId, 16)}
        </span>
        <span className="cmm__trigger-text cmm__trigger-text--full">
          {full}
        </span>
        <span className="cmm__trigger-text cmm__trigger-text--short">
          {short}
        </span>
      </button>
      {panel}
    </div>
  );
}

