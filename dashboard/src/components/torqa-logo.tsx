"use client";

/**
 * Torqa logo system
 *
 * TorqaLogoMark      — static mark, single color
 * TorqaLogoAnimated  — always-on subtle pulse (use in sidebar)
 * TorqaLogoScanning  — active scanning animation (use when processing)
 */

import { useId } from "react";

/* ── Shared path data ──────────────────────────────────────────── */

const BAR1 = "M6 18 L52 18 L58 26 L12 26 Z";
const BAR2 = "M6 35 L40 35 L46 42 L12 42 Z";
const DOT_CX = 56;
const DOT_CY = 40;
const DOT_R = 3.5;

/* ── Static mark ──────────────────────────────────────────────── */

export function TorqaLogoMark({
  size = 22,
  className,
  color = "currentColor",
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className={className}
      fill="none"
    >
      <path d={BAR1} fill={color} />
      <path d={BAR2} fill={color} opacity={0.75} />
      <circle cx={DOT_CX} cy={DOT_CY} r={DOT_R} fill={color} />
    </svg>
  );
}

/* ── Animated — gentle pulse, always on ──────────────────────── */

export function TorqaLogoAnimated({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const gradId = `tq-g-${id}`;
  const clipId = `tq-c-${id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className={className}
      fill="none"
    >
      <defs>
        {/* shimmer gradient */}
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="45%"  stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="55%"  stopColor="var(--accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.3" />
        </linearGradient>
        {/* clip to mark shape */}
        <clipPath id={clipId}>
          <path d={BAR1} />
          <path d={BAR2} />
          <circle cx={DOT_CX} cy={DOT_CY} r={DOT_R + 2} />
        </clipPath>
      </defs>

      {/* Base mark — dim */}
      <path d={BAR1} fill="var(--accent)" opacity={0.35} />
      <path d={BAR2} fill="var(--accent)" opacity={0.25} />
      <circle cx={DOT_CX} cy={DOT_CY} r={DOT_R} fill="var(--accent)" opacity={0.35} />

      {/* Shimmer sweep */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          x="-64"
          y="0"
          width="64"
          height="64"
          fill={`url(#${gradId})`}
          style={{
            animation: "tq-shimmer 2.4s ease-in-out infinite",
          }}
        />
      </g>

      {/* Dot pulse ring */}
      <circle
        cx={DOT_CX}
        cy={DOT_CY}
        r={DOT_R}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        style={{
          transformOrigin: `${DOT_CX}px ${DOT_CY}px`,
          animation: "tq-pulse-ring 2.4s ease-out infinite",
        }}
      />
      {/* Dot solid */}
      <circle
        cx={DOT_CX}
        cy={DOT_CY}
        r={DOT_R - 1}
        fill="var(--accent)"
        style={{
          transformOrigin: `${DOT_CX}px ${DOT_CY}px`,
          animation: "tq-pulse 2.4s ease-in-out infinite",
        }}
      />
    </svg>
  );
}

/* ── Scanning — active scan animation for processing states ───── */

export function TorqaLogoScanning({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const clipId = `tq-sc-${id}`;
  const scanGradId = `tq-sg-${id}`;

  return (
    <div
      className={className}
      style={{ position: "relative", width: size, height: size, display: "inline-block" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        aria-label="Scanning…"
        fill="none"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={BAR1} />
            <path d={BAR2} />
            <circle cx={DOT_CX} cy={DOT_CY} r={DOT_R + 3} />
          </clipPath>
          <linearGradient id={scanGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="50%"  stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer frame brackets */}
        <path
          d="M4 4 L4 16 M4 4 L16 4"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.5}
        />
        <path
          d="M60 4 L60 16 M60 4 L48 4"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.5}
        />
        <path
          d="M4 60 L4 48 M4 60 L16 60"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.5}
        />
        <path
          d="M60 60 L60 48 M60 60 L48 60"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.5}
        />

        {/* Mark base */}
        <path d={BAR1} fill="var(--accent)" opacity={0.2} />
        <path d={BAR2} fill="var(--accent)" opacity={0.15} />
        <circle cx={DOT_CX} cy={DOT_CY} r={DOT_R} fill="var(--accent)" opacity={0.2} />

        {/* Active scan sweep (horizontal beam) */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            x="-64"
            y="0"
            width="64"
            height="64"
            fill={`url(#${scanGradId})`}
            style={{
              animation: "tq-shimmer 1.1s linear infinite",
            }}
          />
        </g>

        {/* Dot active pulse */}
        <circle
          cx={DOT_CX}
          cy={DOT_CY}
          r={DOT_R + 4}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          style={{
            transformOrigin: `${DOT_CX}px ${DOT_CY}px`,
            animation: "tq-pulse-ring 1.1s ease-out infinite",
          }}
        />
        <circle
          cx={DOT_CX}
          cy={DOT_CY}
          r={DOT_R}
          fill="var(--accent)"
          style={{
            transformOrigin: `${DOT_CX}px ${DOT_CY}px`,
            animation: "tq-pulse 1.1s ease-in-out infinite",
          }}
        />
      </svg>
    </div>
  );
}

/* ── Full wordmark (logo + text) ─────────────────────────────── */

export function TorqaWordmark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <TorqaLogoAnimated size={size} />
      <span
        style={{
          fontSize: size * 0.75,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "var(--fg-1)",
          lineHeight: 1,
        }}
      >
        Torqa
      </span>
    </div>
  );
}
