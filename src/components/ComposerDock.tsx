/**
 * Composer wrap — docked strip (Codex) or floating card (classic).
 * Inner composer chrome still lives in AppWorkbench.
 */
import type { CSSProperties, ReactNode, Ref } from "react";
import type { WorkbenchChrome } from "@/lib/workbenchChrome";

export type ComposerDockProps = {
  chrome: WorkbenchChrome;
  welcome: boolean;
  sideDock: boolean;
  /** Phone keeps the existing float / sheet composer. */
  phone?: boolean;
  wrapRef?: Ref<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
  welcomeMark?: ReactNode;
  children: ReactNode;
};

export function ComposerDock({
  chrome,
  welcome,
  sideDock,
  phone = false,
  wrapRef,
  className,
  style,
  welcomeMark,
  children,
}: ComposerDockProps) {
  const dock = !phone && (chrome === "codex" || sideDock);
  const wrapClass =
    "composer-wrap" +
    (dock ? " composer-wrap--dock" : " composer-wrap--float") +
    (welcome && !dock ? " composer-wrap--welcome" : "") +
    (sideDock ? " composer-wrap--side-dock" : "") +
    (className ? ` ${className}` : "");

  return (
    <div
      ref={wrapRef}
      className={wrapClass}
      style={style}
      data-side-dock={sideDock ? "true" : undefined}
    >
      {welcome && welcomeMark && !dock ? welcomeMark : null}
      {children}
    </div>
  );
}
