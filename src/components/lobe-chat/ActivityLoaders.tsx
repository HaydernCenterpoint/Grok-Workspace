/**
 * Live activity marks — decorative, no copy.
 * Reasoning / work: 3-dot harmonic scale.
 * Tools: 4-square blue pulse.
 */

export function ReasoningDots({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={["act-dots", className].filter(Boolean).join(" ")}
      aria-hidden
    >
      <span />
      <span />
      <span />
    </span>
  );
}

export function ToolGrid({ className = "" }: { className?: string }) {
  return (
    <span
      className={["act-tool-grid", className].filter(Boolean).join(" ")}
      aria-hidden
    >
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
