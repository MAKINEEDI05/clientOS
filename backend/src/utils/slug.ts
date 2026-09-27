/**
 * Deterministic slug used to build Hindsight tags and bank ids.
 * Hindsight path segments allow [A-Za-z0-9_-.~:@+]; we emit a conservative subset.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Bank id for a client. One bank per client — see HINDSIGHT_INTEGRATION_MAP.md §3.1. */
export function bankIdForClient(clientSlug: string): string {
  return `client-${clientSlug}`;
}
