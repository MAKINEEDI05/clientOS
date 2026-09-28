import type { ReactNode } from 'react';

/**
 * The ClientOS icon set.
 *
 * One small, consistent family — 24px grid, round 1.75 stroke — drawn inline so
 * the product has no icon dependency and no mismatched glyphs. Icons are always
 * decorative: the text next to them carries the meaning, so they are hidden
 * from assistive technology.
 */
const PATHS = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  workspace: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9h17" />
      <path d="M9 9v10.5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.4 8.6-2.1 4.7-4.7 2.1 2.1-4.7z" />
    </>
  ),
  history: (
    <>
      <path d="M3.8 12a8.2 8.2 0 1 0 2.4-5.8" />
      <path d="M3.8 4.6v3.9h3.9" />
      <path d="M12 7.8V12l2.9 1.9" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.8 8.2 4.3L12 12.4 3.8 8.1z" />
      <path d="m3.8 12 8.2 4.3 8.2-4.3" />
      <path d="m3.8 15.9 8.2 4.3 8.2-4.3" />
    </>
  ),
  folder: <path d="M3.5 7.5a2 2 0 0 1 2-2h3.7l2 2.2h7.3a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />,
  message: <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8.7a1.5 1.5 0 0 1-1.5 1.5h-8.3L6 20v-3.3H5a1.5 1.5 0 0 1-1.5-1.5V6.5A1.5 1.5 0 0 1 5 5z" />,
  shield: (
    <>
      <path d="M12 3.6 19.2 6v5.6c0 4.3-3 7.5-7.2 8.8-4.2-1.3-7.2-4.5-7.2-8.8V6z" />
      <path d="m9.2 12 2 2 3.7-3.8" />
    </>
  ),
  check: <path d="m5 12.5 4.4 4.4L19 7.4" />,
  x: <path d="M6.6 6.6 17.4 17.4M17.4 6.6 6.6 17.4" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  'arrow-right': <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  'arrow-down': <path d="M12 4.5v15M6 13.5l6 6 6-6" />,
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  'chevron-down': <path d="m6 9.5 6 6 6-6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  alert: (
    <>
      <path d="M10.3 4.6 3.1 17.2A2 2 0 0 0 4.8 20h14.4a2 2 0 0 0 1.7-2.8L13.7 4.6a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4" />
      <path d="M12 16.8h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.2" />
      <path d="M12 7.9h.01" />
    </>
  ),
  swap: (
    <>
      <path d="M7.5 4.5 4 8l3.5 3.5" />
      <path d="M4 8h12.5" />
      <path d="m16.5 12.5 3.5 3.5-3.5 3.5" />
      <path d="M20 16H7.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  bookmark: <path d="M7 4.5h10a.5.5 0 0 1 .5.5v14.5L12 16l-5.5 3.5V5a.5.5 0 0 1 .5-.5z" />,
  flag: (
    <>
      <path d="M5.5 20.5v-16" />
      <path d="M5.5 4.5h11.5l-2.2 4 2.2 4H5.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.8" />
    </>
  ),
  archive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4.5" rx="1" />
      <path d="M5 9v9.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" />
      <path d="M10 13h4" />
    </>
  ),
  restore: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.3-5.4" />
      <path d="M4.5 4.8v4h4" />
    </>
  ),
  quote: (
    <>
      <path d="M9.5 8H6.5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2.5v.8A3.2 3.2 0 0 1 5.8 17" />
      <path d="M18.5 8h-3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1H18v.8a3.2 3.2 0 0 1-3.2 3.2" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({
  name, className = 'h-4 w-4', strokeWidth = 1.75,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}

/**
 * The product mark: a "C" that closes on a point of memory.
 * Decorative — the wordmark beside it is the accessible name.
 */
export function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false" className={`shrink-0 ${className}`}>
      <rect width="28" height="28" rx="7" fill="#1b1d21" />
      <path
        d="M17.9 9.4a6.2 6.2 0 1 0 0 9.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="19.2" cy="14" r="2" fill="#56b98d" />
    </svg>
  );
}
