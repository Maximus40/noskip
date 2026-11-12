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

/**
 * Production project, used when the build provides no valid value. Both are public by design
 * (the publishable key ships inside every app; data is protected by RLS), so they live in code:
 * copying keys by hand proved fragile (a masked `eyJhbGci•••` copy broke a device test).
 */
export const PUBLIC_DEFAULTS = {
  supabaseUrl: 'https://kbxjsxmxelomyyzlzzqh.supabase.co',
  supabaseAnonKey: 'sb_publishable_8sgPhbq7wMoJQqocoi5G2w_4jrAnGPm',
} as const;

/** Each Supabase value comes from the build when valid, otherwise from `defaults`. */
export function parseEnv(
  input: Record<string, string | undefined>,
  defaults: Partial<Record<'supabaseUrl' | 'supabaseAnonKey', string>> = {},
): Env | null {
  const pick = (key: 'supabaseUrl' | 'supabaseAnonKey') =>
    schema.shape[key].safeParse(input[key]).success ? input[key] : defaults[key];
  const parsed = schema.safeParse({
    ...input,
    supabaseUrl: pick('supabaseUrl'),
    supabaseAnonKey: pick('supabaseAnonKey'),
  });
  return parsed.success ? parsed.data : null;
}

/** null only if neither the build nor the defaults give a usable configuration. */
export const env = parseEnv(raw, PUBLIC_DEFAULTS);
