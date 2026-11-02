export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Error with a stable code the app maps to French copy (see src/lib/errors.ts). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(err: unknown, fn: string): Response {
  if (err instanceof HttpError) {
    if (err.status >= 500) log('error', fn, err.code, { message: err.message });
    return json({ error: err.code }, err.status);
  }
  log('error', fn, 'unhandled', { message: err instanceof Error ? err.message : String(err) });
  return json({ error: 'internal_error' }, 500);
}

/** Structured one-line logs. Never pass coordinates or tokens here. */
export function log(
  level: 'info' | 'warn' | 'error',
  fn: string,
  event: string,
  data: Record<string, unknown> = {},
) {
  const line = JSON.stringify({ level, fn, event, ...data });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}
