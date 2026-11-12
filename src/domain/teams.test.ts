import {
  extractInviteCode,
  formatInviteCode,
  inviteMessage,
  inviteUrl,
  posterInviteLabel,
  normalizeInviteCode,
  pseudoList,
  teamFill,
  validateTeamName,
} from './teams';

describe('invite codes', () => {
  it('normalises codes typed by humans', () => {
    expect(normalizeInviteCode('abcd-2345')).toBe('ABCD2345');
    expect(normalizeInviteCode(' AB CD 23 45 ')).toBe('ABCD2345');
    expect(normalizeInviteCode('ABCD234')).toBeNull();
    expect(normalizeInviteCode('ABCD2340')).toBeNull(); // 0 is not in the alphabet
    expect(normalizeInviteCode('IOIO2345')).toBeNull();
  });

  it('extracts codes from links', () => {
    expect(extractInviteCode('dipsorchips://join/ABCD2345')).toBe('ABCD2345');
    expect(extractInviteCode('https://dipsorchips.app/join/abcd-2345?utm=x')).toBe('ABCD2345');
    expect(extractInviteCode('Rejoins-nous ! https://dipsorchips.app/join/ABCD2345')).toBe(
      'ABCD2345',
    );
    expect(extractInviteCode('abcd2345')).toBe('ABCD2345');
    expect(extractInviteCode('pas un code')).toBeNull();
  });

  it('formats and builds links', () => {
    expect(formatInviteCode('ABCD2345')).toBe('ABCD-2345');
    expect(inviteUrl('ABCD2345')).toBe('dipsorchips://join/ABCD2345');
    expect(inviteUrl('ABCD2345', 'dipsorchips.app')).toBe('https://dipsorchips.app/join/ABCD2345');
    expect(posterInviteLabel('ABCD2345')).toBe(
      'Rejoins la team sur Dips or Chips · code ABCD-2345',
    );
    expect(posterInviteLabel('ABCD2345', 'dipsorchips.app')).toBe(
      'Rejoins la team → dipsorchips.app/join/ABCD2345',
    );
    const msg = inviteMessage('Les Déchaînés', 'ABCD2345', 'dipsorchips.app');
    expect(msg).toContain('« Les Déchaînés »');
    expect(msg).toContain('https://dipsorchips.app/join/ABCD2345');
    expect(msg).toContain('Code : ABCD-2345');
  });
});

describe('team helpers', () => {
  it('validates team names', () => {
    expect(validateTeamName(' a ')).toBe('Au moins 2 caractères.');
    expect(validateTeamName('x'.repeat(33))).toBe('32 caractères max.');
    expect(validateTeamName('Les Déchaînés')).toBeNull();
  });

  it('describes how full a team is', () => {
    expect(teamFill(2, 4)).toEqual({ label: '2 / 4 joueurs', full: false });
    expect(teamFill(4, 4).full).toBe(true);
  });

  it('lists pseudos in French', () => {
    expect(pseudoList([])).toBe('personne pour l’instant');
    expect(pseudoList(['Sofiane'])).toBe('Sofiane');
    expect(pseudoList(['Sofiane', 'Karim'])).toBe('Sofiane et Karim');
    expect(pseudoList(['A', 'B', 'C'])).toBe('A, B et 1 autre');
    expect(pseudoList(['A', 'B', 'C', 'D'])).toBe('A, B et 2 autres');
  });
});
