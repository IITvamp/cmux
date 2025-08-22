import * as React from "react";

type Props = Omit<
  React.SVGProps<SVGSVGElement>,
  "width" | "height" | "title"
> & {
  /** Visual height (e.g. "1.5rem", 48). Width stays proportional. Default: "1em". */
  height?: number | string;
  /** Accessible label (screen readers only). If omitted, the SVG is aria-hidden. */
  label?: string;
  /** Gradient colors for the mark. */
  from?: string; // default "#00D4FF"
  to?: string; // default "#7C3AED"
  /** Toggle the wordmark. Set false for arrow-only. */
  showWordmark?: boolean; // default true
};

export default function CmuxLogo({
  height = "1em",
  label,
  from = "#00D4FF",
  to = "#7C3AED",
  showWordmark = true,
  style,
  ...rest
}: Props) {
  const id = React.useId();
  const gradId = `cmuxGradient-${id}`;
  const titleId = label ? `cmuxTitle-${id}` : undefined;

  const css = `
    .mark-line { stroke: url(#${gradId}); stroke-width: 14; stroke-linecap: round; }
    .mark-fill { fill: url(#${gradId}); }
    .wordmark  { font-weight: 700; letter-spacing: 1.5px;
                 font-family: "JetBrains Mono","SFMono-Regular","Menlo","Consolas","ui-monospace","Monaco","Courier New",monospace; }
  `;

  return (
    <svg
      viewBox="60 0 840 240"
      role="img"
      aria-labelledby={label ? titleId : undefined}
      aria-hidden={label ? undefined : true}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        height,
        width: "auto",
        ...style,
      }}
      {...rest}
    >
      {label ? <title id={titleId}>{label}</title> : null}

      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <style>{css}</style>
      </defs>

      {/* Logomark (left-flush) */}
      <g transform="translate(0,48)">
        <polygon
          className="mark-fill"
          points="100,48 168,80 100,112 100,96 140,80 100,64"
        />
      </g>

      {/* Wordmark */}
      {showWordmark && (
        <text
          className="wordmark fill-neutral-900 dark:fill-white"
          x={208}
          y={162}
          fontSize={112}
        >
          {/* cmux.dev */}
          cmux
        </text>
      )}
    </svg>
  );
}
