/**
 * Personal center — ChatGPT-style compact list: identity · usage · settings · theme · logout.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  IconActivity,
  IconCheck,
  IconChevronRight,
  IconHelp,
  IconLogout,
  IconSettings,
  IconThemeMoon,
  IconThemeSun,
} from "@/components/icons";
import type { Theme, ThemePreference } from "@/lib/theme";
import { GrokLogo } from "@/components/GrokLogo";
import {
  FLOATING_MENU_Z_INDEX,
  useFloatingMenu,
} from "@/lib/floatingMenu";
import { useOpenPresence } from "@/lib/openPresence";
import type {
  AccountStatus,
  CustomProvider,
  ProviderBalanceResult,
  SavedAccount,
} from "@/lib/api";
import { accountInitials, tierLabel } from "@/lib/accountUi";
import {
  formatQuotaRemainLabel,
  resolveQuotaPercents,
} from "@/lib/accountQuotaHonesty";
import { formatProviderBalanceLine } from "@/lib/providerBalanceFormat";
import {
  mergeAccountQuota,
  type SwitcherQuota,
} from "@/lib/accountSwitcherQuota";
import { formatShortcutHint } from "@/lib/shortcuts";

export interface UserMenuProps {
  open: boolean;
  onClose: () => void;
  /** Resolved light/dark for icons. */
  theme: Theme;
  /** Preference driving the theme submenu selection. */
  themePreference: ThemePreference;
  /** App locale, so the quota reset clock follows Settings. */
  locale: string;
  labels: {
    settings: string;
    /** Optional product tour entry label */
    tutorial?: string;
    theme: string;
    themeSystem: string;
    themeLight: string;
    themeDark: string;
    local: string;
    signedIn: string;
    signedOut: string;
    login: string;
    logout: string;
    remaining: string;
    usage: string;
    profileActive: string;
    switchTo: string;
    customProvider: string;
    /** Prefix for quota refresh time, e.g. 重置 / Resets */
    resetsAt: string;
    /** DeepSeek balance (optional) */
    balanceAvailable?: string;
    balanceUnavailable?: string;
    balanceGranted?: string;
    balanceToppedUp?: string;
    balanceRefresh?: string;
    balanceChecking?: string;
  };
  account: AccountStatus | null;
  activeProvider: CustomProvider | null;
  accountBusy: boolean;
  /** Active custom provider balance (DeepSeek); null when N/A or failed. */
  providerBalance?: ProviderBalanceResult | null;
  providerBalanceBusy?: boolean;
  providerBalanceError?: string | null;
  onRefreshProviderBalance?: () => void;
  onSettings: () => void;
  onAccountSettings: () => void;
  /** Open the usage-limit sheet (ChatGPT-style Usage row). */
  onUsage?: () => void;
  /** Open optional in-app product tour */
  onTutorial?: () => void;
  onTheme: (preference: ThemePreference) => void;
  onLogin: () => void;
  onLogout: () => void;
  savedAccounts?: SavedAccount[];
  activeAccountId?: string | null;
  accountQuotas?: Record<string, SwitcherQuota>;
  onSwitchAccount?: (id: string) => void;
  children: ReactNode;
}

/** Honest remaining % — never invents 0 / 100 when Host billing is silent. */
export function remainingPercent(account: AccountStatus | null): number | null {
  return resolveQuotaPercents(account?.billing ?? null).remainingPercent;
}

const THEME_OPTIONS: ThemePreference[] = ["system", "light", "dark"];
const FLYOUT_GAP = 4;
const FLYOUT_MIN_W = 148;
const FLYOUT_EST_H = 120;

function computeThemeFlyoutStyle(
  anchor: DOMRect,
  panelW: number,
  panelH: number,
): CSSProperties {
  const vw =
    typeof window.innerWidth === "number" ? window.innerWidth : 1024;
  const vh =
    typeof window.innerHeight === "number" ? window.innerHeight : 768;
  const margin = 8;

  // Prefer open to the right of the theme row (sidebar sits left).
  let left = anchor.right + FLYOUT_GAP;
  if (left + panelW > vw - margin) {
    left = anchor.left - FLYOUT_GAP - panelW;
  }
  left = Math.max(margin, Math.min(left, vw - margin - panelW));

  // Vertically center the flyout on the theme menu item.
  let top = anchor.top + anchor.height / 2 - panelH / 2;
  top = Math.max(margin, Math.min(top, vh - margin - panelH));

  return {
    position: "fixed",
    top,
    left,
    minWidth: FLYOUT_MIN_W,
    // Above the account menu (FLOATING_MENU_Z_INDEX) so the flyout is not clipped under it.
    zIndex: FLOATING_MENU_Z_INDEX + 1,
  };
}

export function UserMenu({
  open,
  onClose,
  theme,
  themePreference,
  labels,
  account,
  activeProvider,
  accountBusy,
  providerBalance = null,
  providerBalanceBusy = false,
  onSettings,
  onAccountSettings,
  onUsage,
  onTutorial,
  onTheme,
  onLogin,
  onLogout,
  savedAccounts = [],
  activeAccountId = null,
  accountQuotas = {},
  onSwitchAccount,
  children,
}: UserMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const themeItemRef = useRef<HTMLButtonElement>(null);
  const themeFlyoutRef = useRef<HTMLDivElement>(null);
  const [themeSubOpen, setThemeSubOpen] = useState(false);
  const [flyoutStyle, setFlyoutStyle] = useState<CSSProperties | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const settingsHint = useMemo(
    () => (open ? formatShortcutHint("settings") : ""),
    [open],
  );

  useEffect(() => {
    if (!open) setThemeSubOpen(false);
  }, [open]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleCloseThemeSub = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setThemeSubOpen(false);
      closeTimerRef.current = null;
    }, 160);
  }, [clearCloseTimer]);

  const openThemeSub = useCallback(() => {
    clearCloseTimer();
    setThemeSubOpen(true);
  }, [clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const updateFlyoutPos = useCallback(() => {
    const el = themeItemRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const fly = themeFlyoutRef.current;
    const pw = fly?.offsetWidth || FLYOUT_MIN_W;
    const ph = fly?.offsetHeight || FLYOUT_EST_H;
    setFlyoutStyle(computeThemeFlyoutStyle(r, pw, ph));
  }, []);

  useLayoutEffect(() => {
    if (!open || !themeSubOpen) {
      // Keep last rect so the flyout can play its exit motion.
      return;
    }
    updateFlyoutPos();
    const onMove = () => updateFlyoutPos();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, themeSubOpen, updateFlyoutPos]);

  // Refine after flyout mounts (real size).
  useLayoutEffect(() => {
    if (!open || !themeSubOpen || !themeFlyoutRef.current) return;
    updateFlyoutPos();
  }, [open, themeSubOpen, updateFlyoutPos, themePreference]);

  const panelPresence = useOpenPresence(open);
  const { pos, style, settled } = useFloatingMenu({
    open: panelPresence.mounted,
    triggerRef,
    panelRef,
    roots: [rootRef, themeFlyoutRef],
    onClose,
    placement: "up",
    fitContent: true,
    matchTriggerWidth: true,
    minWidth: 220,
    estHeight: savedAccounts.length > 1 ? 280 : 220,
    gap: 6,
    // CSS owns transform (rise from the footer). Do not apply placeAbove -100%.
    anchorTransform: false,
  });
  const panelEntered = useOpenPresence(Boolean(open && settled)).entered;

  const profile = account?.profile;
  const billing = account?.billing;
  const isCustomProvider = activeProvider != null;
  const signedIn = !isCustomProvider && !!profile?.signedIn;
  const providerName =
    activeProvider?.name.trim() || activeProvider?.id.trim() || labels.customProvider;
  const officialPlan = billing
    ? tierLabel(billing, account?.channel ?? "")
    : "—";
  const name = isCustomProvider
    ? providerName
    : signedIn
      ? officialPlan
      : labels.local;
  const initials = isCustomProvider
    ? Array.from(providerName)[0]?.toUpperCase() || "P"
    : profile
      ? accountInitials(profile)
      : "G";
  const livePercents = resolveQuotaPercents(billing ?? null);
  const usedPct = livePercents.usedPercent;
  const remaining = livePercents.remainingPercent;
  const remainLabel = formatQuotaRemainLabel(remaining);
  const remainText = remainLabel ? `${remainLabel} ${labels.remaining}` : "—";
  const showSavedOfficialAccounts = signedIn && savedAccounts.length > 0;
  const providerBalanceLine = formatProviderBalanceLine(providerBalance);
  const usageMeta = isCustomProvider
    ? providerBalanceLine ||
      (providerBalanceBusy ? (labels.balanceChecking ?? "…") : "—")
    : remainText;
  const showUsageRow = signedIn || isCustomProvider;
  const openUsage = () => {
    onClose();
    if (onUsage) onUsage();
    else onAccountSettings();
  };

  const themeLabel = (pref: ThemePreference) => {
    if (pref === "system") return labels.themeSystem;
    if (pref === "light") return labels.themeLight;
    return labels.themeDark;
  };

  const flyoutPresence = useOpenPresence(open && themeSubOpen, !!flyoutStyle);
  const themeFlyout =
    flyoutPresence.mounted &&
    flyoutStyle &&
    typeof document !== "undefined"
      ? createPortal(
          <div
            ref={themeFlyoutRef}
            className={
              "menu-panel user-menu__flyout" +
              (flyoutPresence.entered ? " is-open" : "")
            }
            role="menu"
            aria-label={labels.theme}
            style={flyoutStyle}
            onMouseEnter={openThemeSub}
            onMouseLeave={scheduleCloseThemeSub}
          >
            {THEME_OPTIONS.map((pref) => {
              const selected = themePreference === pref;
              return (
                <button
                  key={pref}
                  type="button"
                  className={
                    "user-menu__item user-menu__item--flyout" +
                    (selected ? " is-selected" : "")
                  }
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => {
                    onTheme(pref);
                    setThemeSubOpen(false);
                    onClose();
                  }}
                >
                  <span className="user-menu__check" aria-hidden>
                    {selected ? <IconCheck size={14} stroke={2.4} /> : null}
                  </span>
                  <span className="user-menu__item-label">
                    {themeLabel(pref)}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  const panel =
    panelPresence.mounted && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            className={
              "menu-panel user-menu__pop user-menu__pop--portal user-menu__pop--account" +
              (panelEntered ? " is-open" : "")
            }
            role="menu"
            style={style}
          >
            {showSavedOfficialAccounts ? (
              <div className="user-menu__accounts">
                {savedAccounts.map((saved) => {
                  const active = saved.id === activeAccountId;
                  const q = mergeAccountQuota(
                    saved.id,
                    saved.email,
                    accountQuotas,
                    {
                      id: activeAccountId,
                      email: profile?.email,
                      remaining,
                      used: usedPct,
                      resetsAt: billing?.resetsAt ?? null,
                      subscriptionTier: billing?.subscriptionTier ?? null,
                    },
                  );
                  const probedPlan = (q?.subscriptionTier || "").trim();
                  const rowName =
                    (active && officialPlan !== "—"
                      ? officialPlan
                      : probedPlan) ||
                    (active ? officialPlan : "—");
                  const rowRemain = q?.remainingPercent ?? null;
                  const rowRemainLabel = formatQuotaRemainLabel(rowRemain);
                  const low = rowRemain != null && rowRemain <= 10;
                  return (
                    <button
                      key={saved.id}
                      type="button"
                      className={
                        "user-menu__item user-menu__item--profile" +
                        (active ? " is-on" : "") +
                        (low ? " is-low" : "")
                      }
                      role="menuitem"
                      disabled={accountBusy}
                      aria-current={active ? "true" : undefined}
                      aria-label={
                        active
                          ? `${rowName}, ${labels.profileActive}`
                          : `${labels.switchTo}: ${rowName}`
                      }
                      onClick={() => {
                        if (active) {
                          onClose();
                          onAccountSettings();
                          return;
                        }
                        if (!onSwitchAccount) return;
                        onClose();
                        onSwitchAccount(saved.id);
                      }}
                    >
                      <span className="user-menu__face" aria-hidden>
                        {active && signedIn ? (
                          <GrokLogo size={15} />
                        ) : (
                          rowName.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span className="user-menu__item-label">{rowName}</span>
                      <span className="user-menu__meta">
                        {rowRemainLabel ?? "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                type="button"
                className="user-menu__item user-menu__item--profile is-on"
                role="menuitem"
                onClick={() => {
                  onClose();
                  onAccountSettings();
                }}
              >
                <span className="user-menu__face" aria-hidden>
                  {signedIn ? <GrokLogo size={15} /> : initials}
                </span>
                <span className="user-menu__item-label">{name}</span>
              </button>
            )}

            {showUsageRow ? (
              <button
                type="button"
                className="user-menu__item"
                role="menuitem"
                onClick={openUsage}
              >
                <IconActivity size={16} />
                <span className="user-menu__item-label">{labels.usage}</span>
                <span
                  className={
                    "user-menu__meta" +
                    (remaining != null && remaining <= 10 ? " is-low" : "")
                  }
                >
                  {usageMeta}
                </span>
              </button>
            ) : null}

            <button
              type="button"
              className="user-menu__item"
              role="menuitem"
              onClick={() => {
                onClose();
                onSettings();
              }}
            >
              <IconSettings size={16} />
              <span className="user-menu__item-label">{labels.settings}</span>
              {settingsHint ? (
                <kbd className="menu-shortcut" aria-hidden>
                  {settingsHint}
                </kbd>
              ) : null}
            </button>

            {onTutorial && labels.tutorial ? (
              <button
                type="button"
                className="user-menu__item"
                role="menuitem"
                onClick={() => {
                  onClose();
                  onTutorial();
                }}
              >
                <IconHelp size={16} />
                <span className="user-menu__item-label">{labels.tutorial}</span>
              </button>
            ) : null}

            <button
              ref={themeItemRef}
              type="button"
              className={
                "user-menu__item user-menu__item--submenu" +
                (themeSubOpen ? " is-open" : "")
              }
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={themeSubOpen}
              onClick={() => {
                if (themeSubOpen) {
                  setThemeSubOpen(false);
                } else {
                  openThemeSub();
                }
              }}
              onMouseEnter={openThemeSub}
              onMouseLeave={scheduleCloseThemeSub}
            >
              {theme === "dark" ? (
                <IconThemeMoon size={16} />
              ) : (
                <IconThemeSun size={16} />
              )}
              <span className="user-menu__item-label">{labels.theme}</span>
              <IconChevronRight
                size={14}
                className="user-menu__sub-chev"
                aria-hidden
              />
            </button>

            {isCustomProvider ? null : signedIn ? (
              <button
                type="button"
                className="user-menu__item user-menu__item--danger"
                role="menuitem"
                disabled={accountBusy}
                onClick={() => {
                  onClose();
                  onLogout();
                }}
              >
                <IconLogout size={16} />
                <span className="user-menu__item-label">{labels.logout}</span>
              </button>
            ) : (
              <button
                type="button"
                className="user-menu__item"
                role="menuitem"
                disabled={accountBusy}
                onClick={() => {
                  onClose();
                  onLogin();
                }}
              >
                <span className="user-menu__item-label">{labels.login}</span>
              </button>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={"user-menu" + (open ? " is-open" : "")} ref={rootRef}>
      <div ref={triggerRef} className="user-menu__anchor">
        {children}
      </div>
      {panel}
      {themeFlyout}
    </div>
  );
}
