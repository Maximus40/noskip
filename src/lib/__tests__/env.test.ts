import { parseEnv, PUBLIC_DEFAULTS } from '../env';

const KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl';

describe('parseEnv', () => {
  it('requires Supabase URL and anon key', () => {
    expect(parseEnv({})).toBeNull();
    expect(parseEnv({ supabaseUrl: 'not a url', supabaseAnonKey: KEY })).toBeNull();
  });

  it('treats empty optional values as absent', () => {
    expect(
      parseEnv({
        supabaseUrl: 'https://abc.supabase.co',
        supabaseAnonKey: KEY,
        googleWebClientId: '',
      }),
    ).toEqual({ supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: KEY });
  });

  it('accepts anon JWTs and publishable keys, rejects masked or garbled keys', () => {
    const url = 'https://abc.supabase.co';
    expect(parseEnv({ supabaseUrl: url, supabaseAnonKey: 'sb_publishable_abc123' })).not.toBeNull();
    expect(parseEnv({ supabaseUrl: url, supabaseAnonKey: `${KEY}\r` })).not.toBeNull();
    expect(
      parseEnv({ supabaseUrl: url, supabaseAnonKey: 'eyJhbGci••••••••••••••••••••' }),
    ).toBeNull();
    expect(parseEnv({ supabaseUrl: url, supabaseAnonKey: 'x'.repeat(40) })).toBeNull();
  });

  it('falls back to the public defaults when the build value is missing or masked', () => {
    expect(parseEnv({}, PUBLIC_DEFAULTS)).toEqual(PUBLIC_DEFAULTS);
    expect(
      parseEnv({ supabaseAnonKey: 'eyJhbGci••••••••••••••••••••' }, PUBLIC_DEFAULTS)
        ?.supabaseAnonKey,
    ).toBe(PUBLIC_DEFAULTS.supabaseAnonKey);
    expect(
      parseEnv({ supabaseUrl: 'https://other.supabase.co', supabaseAnonKey: KEY }, PUBLIC_DEFAULTS),
    ).toEqual({ supabaseUrl: 'https://other.supabase.co', supabaseAnonKey: KEY });
  });
});
