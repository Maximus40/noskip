import { fireEvent, render, screen } from '@testing-library/react-native';

import { Canap, type CanapMood } from '../Canap';
import { PlayerRow } from '../PlayerRow';
import { TeamBar } from '../TeamBar';

describe('Canap', () => {
  it.each<[CanapMood, string]>([
    ['idle', "Le Canap' au repos, qui respire tranquillement"],
    ['smug', "Le Canap' qui ricane parce que quelqu'un a skip"],
    ['sad', "Le Canap' qui boude parce qu'un disque a été chargé"],
    ['crushed', "Le Canap' écrasé par la barre de la team après un PR"],
  ])('renders the %s mood with a spoken description', async (mood, label) => {
    await render(<Canap mood={mood} size={120} />);
    expect(screen.getByRole('image', { name: label })).toBeTruthy();
  });
});

describe('TeamBar', () => {
  it('exposes a readable summary', async () => {
    await render(
      <TeamBar
        plates={[
          { key: 'a-0', playerId: 'a', color: '#7C7E84', isMe: false },
          { key: 'me-0', playerId: 'me', color: '#FF6A3D', isMe: true },
        ]}
        newPlateKey="me-0"
        shaky
        accessibilityLabel="Barre de la team : 40 kilos, 2 disques"
      />,
    );
    expect(
      screen.getByRole('image', { name: 'Barre de la team : 40 kilos, 2 disques' }),
    ).toBeTruthy();
  });
});

describe('PlayerRow', () => {
  const player = {
    id: 'k',
    pseudo: 'Karim',
    color: '#7C7E84',
    isMe: false,
    goal: 3,
    done: 1,
    status: 'not_yet' as const,
    joker: false,
    risk: 'shaky' as const,
  };

  it('shows progress, coarse status and the spot button', async () => {
    const onPress = jest.fn();
    await render(
      <PlayerRow
        player={player}
        avatarUrl={null}
        spot={{ state: 'available', busy: false, onPress }}
      />,
    );
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText('Risque le skip')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Spotter Karim' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('shows when the spot was already sent today', async () => {
    await render(
      <PlayerRow
        player={{ ...player, risk: 'safe' }}
        avatarUrl={null}
        spot={{ state: 'sent', busy: false, onPress: jest.fn() }}
      />,
    );
    expect(screen.getByText('Spotté')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Spotter Karim' })).toBeNull();
  });

  it('never shows a time or a place, only the coarse status', async () => {
    await render(
      <PlayerRow
        player={{ ...player, status: 'at_gym', risk: 'safe' }}
        avatarUrl={null}
        spot={{ state: 'hidden', busy: false, onPress: jest.fn() }}
      />,
    );
    expect(screen.getByLabelText('Karim, 1 sur 3, À la salle')).toBeTruthy();
  });
});
