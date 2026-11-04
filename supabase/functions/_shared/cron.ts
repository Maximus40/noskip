import { HttpError } from './http.ts';

/** Checks the secret pg_cron sends in `x-cron-secret` (compared in SQL, never logged). */
export type CronAuthorizer = (req: Request) => Promise<void>;

export function cronAuthorizer(isValid: (secret: string) => Promise<boolean>): CronAuthorizer {
  return async (req) => {
    const secret = req.headers.get('x-cron-secret') ?? '';
    if (secret.length < 32 || !(await isValid(secret))) {
      throw new HttpError(401, 'not_authorized');
    }
  };
}

/** "1 240" — French thousands separator, as in the app. */
export function formatKg(kg: number): string {
  return String(Math.round(kg)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
