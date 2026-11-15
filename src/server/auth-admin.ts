// The one place the secret (service role) key is used (ADR 0052, "Secrets and least privilege"):
// deleting a player. Deleting the auth user deletes their profile, which forfeits their open series
// and keeps finished ones for the opponent's history (the migration's foreign keys and trigger).
import { fetchAuth, refusalOf } from './auth.ts';
import type { Config } from './config.ts';

export async function deleteUser(config: Config, userId: string): Promise<void> {
  const url = `${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
  const response = await fetchAuth(url, {
    method: 'DELETE',
    headers: { apikey: config.supabaseSecretKey },
    signal: AbortSignal.timeout(8000),
  });
  // Already gone counts as deleted: "Forget me" twice, or a retry after a timeout.
  if (!response.ok && response.status !== 404) {
    throw await refusalOf(response, `Deleting a user answered ${String(response.status)}`);
  }
}
