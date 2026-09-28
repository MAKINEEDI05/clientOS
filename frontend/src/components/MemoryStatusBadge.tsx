import { useMemoryHealth } from '../hooks/useMemoryHealth';
import { StatusDot, type StatusTone } from './ui';

/**
 * Live memory-connection indicator, always visible in the top bar.
 *
 * If Hindsight is not reachable, every screen says so. This is what makes it
 * impossible for the app to imply memory worked when it did not.
 *
 * Driven by the same three-state availability the page uses, so the header can
 * never contradict the memory status shown below it — and, like the page, it does
 * not report an outage while the probe is still running.
 */
export function MemoryStatusBadge() {
  const { status, availability, unreachable } = useMemoryHealth();

  if (availability === 'checking') {
    return <Pill tone="checking" label="Checking memory…" />;
  }
  if (availability === 'unavailable') {
    return unreachable
      ? <Pill tone="bad" label="Backend unreachable" title="The ClientOS API is not responding." />
      : (
        <Pill
          tone="bad"
          label="Memory disconnected"
          title={`Hindsight: ${status?.reason ?? 'not connected'}. Recommendations that need history will be refused.`}
        />
      );
  }
  if (!status) {
    return <Pill tone="off" label="Memory status unknown" />;
  }
  return (
    <Pill
      tone="memory"
      label="Memory connected"
      title={`Hindsight ${status.version ?? ''} · ${status.baseUrl}${
        status.llmConfigured ? ` · ${status.model}` : ' · AI not configured'
      }`}
    />
  );
}

function Pill({ tone, label, title }: { tone: StatusTone; label: string; title?: string }) {
  const styles = {
    memory: 'border-memory-line bg-memory-soft text-memory',
    bad: 'border-reject-line bg-reject-soft text-reject',
    checking: 'border-line bg-paper text-ink-muted',
    off: 'border-line bg-paper text-ink-muted',
  }[tone];

  return (
    <span
      className={`inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${styles}`}
      title={title}
      role="status"
    >
      <StatusDot tone={tone} />
      {label}
    </span>
  );
}
