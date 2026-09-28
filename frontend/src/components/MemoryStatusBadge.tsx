import { useMemoryHealth } from '../hooks/useMemoryHealth';

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
    return <Pill tone="neutral" label="Checking memory…" />;
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
    return <Pill tone="neutral" label="Memory status unknown" />;
  }
  return (
    <Pill
      tone="good"
      label="Memory connected"
      title={`Hindsight ${status.version ?? ''} · ${status.baseUrl}${
        status.llmConfigured ? ` · ${status.model}` : ' · AI not configured'
      }`}
    />
  );
}

function Pill({
  tone, label, title,
}: { tone: 'good' | 'bad' | 'neutral'; label: string; title?: string }) {
  const styles = {
    good: 'bg-approve-soft text-approve',
    bad: 'bg-reject-soft text-reject',
    neutral: 'bg-paper-sunken text-ink-muted',
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}
      title={title}
      role="status"
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          tone === 'good' ? 'bg-approve' : tone === 'bad' ? 'bg-reject' : 'bg-ink-muted'
        }`}
      />
      {label}
    </span>
  );
}
