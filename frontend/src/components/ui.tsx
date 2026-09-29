import type { KeyboardEvent } from 'react';

/**
 * Small presentational primitives shared across screens, so identity, status
 * and section structure look the same wherever they appear.
 */

/** Initials for a client, e.g. "Vive Studio" → "VS". Derived, never stored. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1
    ? `${words[0]!.charAt(0)}${words[words.length - 1]!.charAt(0)}`
    : (words[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/** Client monogram. Decorative: the client's name is always printed beside it. */
export function ClientAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const box = {
    sm: 'h-6 w-6 rounded-md text-[0.625rem]',
    md: 'h-9 w-9 rounded-lg text-xs',
    lg: 'h-11 w-11 rounded-xl text-sm',
  }[size];
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center border border-line bg-paper font-semibold tracking-wide text-ink-soft shadow-card ${box}`}
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * The client, named once at the top of every client screen: monogram, name, and
 * (on wide screens) the client's own context line. The name is the heading; the
 * context stays outside it so the heading remains short.
 */
export function ClientIdentity({
  name, context, as: Tag = 'p',
}: { name: string; context?: string | null; as?: 'h1' | 'p' }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <ClientAvatar name={name} size="sm" />
      <Tag className="shrink-0 text-sm font-semibold tracking-[-0.005em] text-ink">{name}</Tag>
      {context && (
        <p className="hidden min-w-0 truncate text-[0.8125rem] text-ink-muted md:block" title={context}>
          <span aria-hidden="true" className="mr-1.5 text-ink-faint">·</span>
          {context}
        </p>
      )}
    </div>
  );
}

export type StatusTone = 'memory' | 'off' | 'checking' | 'bad';

/**
 * The memory status dot. A live, reachable memory gets a slow ring so it reads
 * as "on"; everything else is still. Decorative — status is always also written.
 */
export function StatusDot({ tone, className = '' }: { tone: StatusTone; className?: string }) {
  const fill = {
    memory: 'bg-memory-bright',
    off: 'border border-ink-faint bg-transparent',
    checking: 'bg-ink-faint animate-pulse',
    bad: 'bg-reject',
  }[tone];
  return (
    <span aria-hidden="true" className={`relative inline-flex h-2 w-2 shrink-0 ${className}`}>
      {tone === 'memory' && (
        <span className="absolute inset-0 animate-status-ring rounded-full bg-memory-bright" />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${fill}`} />
    </span>
  );
}

/**
 * Arrow-key movement for a row of `role="tab"` buttons: Left/Right move to the
 * neighbouring tab and activate it, Home/End jump to the ends. Tabs here switch
 * a view immediately on click, so activating on arrow keeps both paths equal.
 */
export function handleTabListKeyDown(e: KeyboardEvent<HTMLElement>): void {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  const tabs = Array.from(
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
  );
  const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
  if (current === -1 || tabs.length === 0) return;
  e.preventDefault();
  const next =
    e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
        : (current + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next]?.focus();
  tabs[next]?.click();
}
