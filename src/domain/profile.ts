/** Pseudo rules shared by the lifter card and settings (mirrors the DB check: 2..20 chars). */
export function validatePseudo(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 2) return 'Au moins 2 caractères.';
  if (trimmed.length > 20) return '20 caractères max.';
  return null;
}

export function initialsOf(pseudo: string): string {
  const parts = pseudo.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
