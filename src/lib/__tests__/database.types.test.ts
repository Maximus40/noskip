import { createClient } from '@supabase/supabase-js';

import type { Database, Tables } from '../database.types';

// Compile-time contract between the generated types and supabase-js; runtime is a smoke check.
describe('generated database types', () => {
  it('type a client against the schema', () => {
    const client = createClient<Database>('http://127.0.0.1:54321', 'test-anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const board = client.rpc('team_board', { p_team: '00000000-0000-0000-0000-000000000000' });
    const profiles = client.from('profiles').select('id, pseudo, weekly_goal');
    expect(board).toBeDefined();
    expect(profiles).toBeDefined();

    const goal: Tables<'profiles'>['weekly_goal'] = 3;
    expect(goal).toBe(3);
  });
});
