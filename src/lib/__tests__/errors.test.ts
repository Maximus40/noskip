import { errorCode, functionErrorCode, GENERIC_ERROR, toUserMessage } from '../errors';

describe('error mapping', () => {
  it('maps RPC exception messages', () => {
    expect(toUserMessage({ message: 'max_teams_reached', code: 'P0001' })).toBe(
      "Tu es déjà dans 3 teams. C'est le max.",
    );
    expect(errorCode({ message: 'primary_gym_change_too_soon' })).toBe(
      'primary_gym_change_too_soon',
    );
  });

  it('maps auth, rate limit and network errors', () => {
    expect(errorCode({ name: 'AuthApiError', message: 'Token has expired or is invalid' })).toBe(
      'otp_expired',
    );
    expect(errorCode({ status: 429, message: 'x' })).toBe('rate_limited');
    expect(errorCode({ code: 'email_address_invalid', message: 'x' })).toBe('invalid_email');
    expect(errorCode(new TypeError('Network request failed'))).toBe('network');
    expect(errorCode('gym_search_unavailable')).toBe('gym_search_unavailable');
  });

  it('falls back to a generic message', () => {
    expect(toUserMessage(new Error('boom'))).toBe(GENERIC_ERROR);
    expect(toUserMessage(null)).toBe(GENERIC_ERROR);
    expect(errorCode(42)).toBeNull();
  });

  it('reads Edge Function error bodies', async () => {
    const err = {
      context: new Response(JSON.stringify({ error: 'gym_search_unavailable' }), { status: 503 }),
    };
    await expect(functionErrorCode(err)).resolves.toBe('gym_search_unavailable');
    const notJson = { context: new Response('nope', { status: 500 }) };
    await expect(functionErrorCode(notJson)).resolves.toBeNull();
    await expect(functionErrorCode({ message: 'network request failed' })).resolves.toBe('network');
  });
});
