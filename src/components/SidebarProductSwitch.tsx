/**
 * Sidebar brand as the Grok Build / Grok Office product switcher.
 * Click the Grok mark to pick a work mode — not a second agent or editor suite.
 */

import { useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { SidebarBrand } from "@/components/SidebarBrand";
import {
  IconCheck,
  IconChevronDown,
  IconCode,
  IconFileText,
  IconImagine,
} from "@/components/icons";
import { useFloatingMenu } from "@/lib/floatingMenu";
import type { WorkMode } from "@/lib/grokOffice";
import type { ProviderBrandId } from "@/lib/providerPresets";

export type SidebarProductSwitchLabels = {
  build: string;
  office: string;
  studio: string;
  buildTip: string;
  officeTip: string;
  studioTip: string;
  switcher: string;
};

export type SidebarProductSwitchProps = {
  workMode: WorkMode;
  onSelect: (mode: WorkMode) => void;
  labels: SidebarProductSwitchLabels;
  replaceLogo?: boolean;
  brandId?: ProviderBrandId | null;
  providerLabel?: string;
};

export function SidebarProductSwitch({
  workMode,
  onSelect,
  labels,
  replaceLogo = false,
  brandId = null,
  providerLabel,
}: SidebarProductSwitchProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const { pos, style: popStyle } = useFloatingMenu({
    open,
    triggerRef,
    panelRef: popRef,
    roots: [rootRef],
    onClose: () => setOpen(false),
    placement: "auto",
    fitContent: true,
    minWidth: 240,
    estHeight: 198,
    gap: 6,
  });

  const productLabel =
    workMode === "office"
      ? labels.office
      : workMode === "studio"
        ? labels.studio
        : labels.build;
  const brandLabel =
    replaceLogo && brandId ? providerLabel || productLabel : productLabel;

  return (
    <div ref={rootRef} className="sidebar-product-switch">
      <button
        ref={triggerRef}
        type="button"
        className={
          "sidebar-brand-switch" + (open ? " is-open" : "")
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={labels.switcher}
        title={labels.switcher}
        onClick={() => setOpen((v) => !v)}
      >
        <SidebarBrand
          replaceLogo={replaceLogo}
          brandId={brandId}
          label={brandLabel}
        />
        <IconChevronDown size={12} className="sidebar-brand-switch__chev" />
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            className="cmm__pop cmm__pop--portal sidebar-product-switch__pop"
            role="menu"
            aria-label={labels.switcher}
            style={popStyle as CSSProperties}
          >
            <button
              type="button"
              role="menuitem"
              className={
                "cmm__opt" + (workMode === "code" ? " is-active" : "")
              }
              onClick={() => {
                onSelect("code");
                setOpen(false);
              }}
            >
              <span className="cmm__opt-icon" aria-hidden>
                <IconCode size={16} />
              </span>
              <span className="cmm__opt-main">
                <span className="cmm__opt-title">{labels.build}</span>
                <span className="cmm__opt-desc">{labels.buildTip}</span>
              </span>
              {workMode === "code" ? (
                <IconCheck size={14} className="cmm__opt-check" />
              ) : null}
            </button>
            <button
              type="button"
              role="menuitem"
              className={
                "cmm__opt" + (workMode === "office" ? " is-active" : "")
              }
              onClick={() => {
                onSelect("office");
                setOpen(false);
              }}
            >
              <span className="cmm__opt-icon" aria-hidden>
                <IconFileText size={16} />
              </span>
              <span className="cmm__opt-main">
                <span className="cmm__opt-title">{labels.office}</span>
                <span className="cmm__opt-desc">{labels.officeTip}</span>
              </span>
              {workMode === "office" ? (
                <IconCheck size={14} className="cmm__opt-check" />
              ) : null}
            </button>
            <button
              type="button"
              role="menuitem"
              className={
                "cmm__opt" + (workMode === "studio" ? " is-active" : "")
              }
              onClick={() => {
                onSelect("studio");
                setOpen(false);
              }}
            >
              <span className="cmm__opt-icon" aria-hidden>
                <IconImagine size={16} />
              </span>
              <span className="cmm__opt-main">
                <span className="cmm__opt-title">{labels.studio}</span>
                <span className="cmm__opt-desc">{labels.studioTip}</span>
              </span>
              {workMode === "studio" ? (
                <IconCheck size={14} className="cmm__opt-check" />
              ) : null}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
