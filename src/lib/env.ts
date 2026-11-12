import { z } from 'zod';

// Expo inlines EXPO_PUBLIC_* at build time; each must be read with a static property access.
const raw = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  inviteHost: process.env.EXPO_PUBLIC_INVITE_HOST,
};

const optional = z
  .string()
  .trim()
  .transform((v) => (v.length ? v : undefined))
  .optional();

const schema = z.object({
  supabaseUrl: z.url(),
  // A legacy anon JWT or a publishable key. Rejects masked copies such as "eyJhbGci•••" that
  // `eas env:pull` can write: iOS silently drops a header holding non-ASCII characters.
  supabaseAnonKey: z
    .string()
    .trim()
    .regex(/^(eyJ[\w-]+\.[\w-]+\.[\w-]+|sb_publishable_[\w-]+)$/),
  googleWebClientId: optional,
  googleIosClientId: optional,
  // Domain serving universal links (https://<host>/join/<code>). Optional until a domain exists.
  inviteHost: optional,
});

export type Env = z.infer<typeof schema>;

export function parseEnv(input: Record<string, string | undefined>): Env | null {
  const parsed = schema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** null when the build has no Supabase configuration (the app then shows a setup screen). */
export const env = parseEnv(raw);
