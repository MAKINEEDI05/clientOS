import type { ClientDetail } from '../types/api';

/**
 * Whether loaded client data belongs to the client named in the URL.
 *
 * Pages stay mounted when only the `:clientId` param changes, and a loader keeps
 * its previous result until the next one resolves. Checking identity is what
 * stops one client's name, projects or memory appearing under another's URL.
 */
export function isClient(data: ClientDetail | null | undefined, clientId: string): data is ClientDetail {
  return Boolean(data) && (data!.client.slug === clientId || data!.client.id === clientId);
}
