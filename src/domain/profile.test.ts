import { initialsOf, validatePseudo } from './profile';

describe('profile rules', () => {
  it('validates pseudo length', () => {
    expect(validatePseudo(' a ')).toBe('Au moins 2 caractères.');
    expect(validatePseudo('x'.repeat(21))).toBe('20 caractères max.');
    expect(validatePseudo('  Sofiane  ')).toBeNull();
  });

  it('builds initials', () => {
    expect(initialsOf('')).toBe('?');
    expect(initialsOf('karim')).toBe('KA');
    expect(initialsOf('Jean Michel')).toBe('JM');
  });
});
