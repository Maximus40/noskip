import type { Fetcher } from './fetcher.ts';
import { log } from './http.ts';

export type PushMessage = {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
};

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };

/**
 * Sends messages through the Expo Push API in batches of 100.
 * Returns tokens Expo reports as no longer registered, so the caller can delete them.
 * Never throws: a failed push must not fail the action that triggered it.
 */
export async function sendPush(
  fetcher: Fetcher,
  messages: PushMessage[],
  accessToken?: string,
): Promise<{ sent: number; invalidTokens: string[] }> {
  const invalidTokens: string[] = [];
  let sent = 0;
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    try {
      const res = await fetcher(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        log('warn', 'push', 'expo_http_error', { status: res.status });
        continue;
      }
      const payload = (await res.json()) as { data?: Ticket[] };
      (payload.data ?? []).forEach((ticket, idx) => {
        if (ticket.status === 'ok') sent += 1;
        else if (ticket.details?.error === 'DeviceNotRegistered') invalidTokens.push(batch[idx].to);
      });
    } catch (err) {
      log('warn', 'push', 'expo_unreachable', {
        message: err instanceof Error ? err.message : 'unknown',
      });
    }
  }
  return { sent, invalidTokens };
}
