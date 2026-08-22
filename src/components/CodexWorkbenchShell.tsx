/**
 * Ready-state workbench chrome wrapper.
 * Codex vs classic is `data-chrome` on <html>; this keeps the same pane tree.
 */
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type CodexWorkbenchShellProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function CodexWorkbenchShell({
  children,
  className,
  style,
  ...rest
}: CodexWorkbenchShellProps) {
  return (
    <div
      className={className ? `codex-workbench ${className}` : "codex-workbench"}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}
