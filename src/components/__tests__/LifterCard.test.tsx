import { render, screen } from '@testing-library/react-native';

import { LifterCard } from '../LifterCard';

const card = {
  userId: 'u1',
  pseudo: 'Karim',
  avatarUrl: null,
  title: 'machine' as const,
  plateColor: '#B9BBC0',
  lifetimeSessions: 24,
  skipsTotal: 2,
  trophies: [{ type: 'belt' as const, month: '2026-10-01', teamName: 'Les Déchaînés' }],
  history: [
    { weekStart: '2026-11-02', achieved: true, usedJoker: false, exempt: false },
    { weekStart: '2026-10-26', achieved: true, usedJoker: false, exempt: false },
  ],
  jokerThisWeek: false,
  jokerMonthUsed: false,
  isMe: true,
};

describe('LifterCard', () => {
  it('shows level, personal bar, streak and trophies', async () => {
    await render(<LifterCard card={card} />);
    expect(screen.getByText('GYM BRO.')).toBeTruthy();
    expect(screen.getByText('Encore 8 séances pour passer Machine (100 kg).')).toBeTruthy();
    expect(screen.getByLabelText('Série : 2 sem., Record : 2')).toBeTruthy();
    expect(screen.getByLabelText("Ceinture d'octobre, team Les Déchaînés")).toBeTruthy();
    expect(screen.getByLabelText('Skips : 2')).toBeTruthy();
  });

  it('empty trophies state', async () => {
    await render(<LifterCard card={{ ...card, trophies: [] }} />);
    expect(
      screen.getByText(
        'Pas encore de ceinture. Le 1er de chaque mois, elle va au plus régulier de la team.',
      ),
    ).toBeTruthy();
  });
});
