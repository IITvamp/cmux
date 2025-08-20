import * as React from "react";

type Props = React.SVGProps<SVGSVGElement> & {
  /** Size in px, rem, etc. Defaults to "1em" so it scales with font size. */
  size?: number | string;
  /** Use brand gradient when true; otherwise uses `currentColor`. Defaults to true. */
  gradient?: boolean;
  /** Gradient start color. */
  from?: string;
  /** Gradient end color. */
  to?: string;
  /** Accessible title. If omitted, the SVG is aria-hidden. */
  title?: string;
};

export default function CmuxArrow({
  size = "1em",
  gradient = true,
  from = "#00D4FF",
  to = "#7C3AED",
  title,
  style,
  ...rest
}: Props) {
  const id = React.useId();
  const gradId = `cmuxGradient-${id}`;
  const titleId = title ? `cmuxTitle-${id}` : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      role="img"
      aria-labelledby={title ? titleId : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      {...rest}
    >
      {gradient && (
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
      )}

      <path
        d="M88 56 L192 128 L88 200 L88 168 L144 128 L88 88 Z"
        fill={gradient ? `url(#${gradId})` : "currentColor"}
      />

      {title ? <title id={titleId}>{title}</title> : null}
    </svg>
  );
}
