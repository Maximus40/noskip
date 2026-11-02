import { parseEnv } from '../env';

describe('parseEnv', () => {
  it('requires Supabase URL and anon key', () => {
    expect(parseEnv({})).toBeNull();
    expect(parseEnv({ supabaseUrl: 'not a url', supabaseAnonKey: 'x'.repeat(40) })).toBeNull();
  });

  it('treats empty optional values as absent', () => {
    expect(
      parseEnv({
        supabaseUrl: 'https://abc.supabase.co',
        supabaseAnonKey: 'x'.repeat(40),
        googleWebClientId: '',
      }),
    ).toEqual({ supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'x'.repeat(40) });
  });
});
