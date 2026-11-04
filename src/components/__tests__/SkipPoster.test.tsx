import { render, screen } from '@testing-library/react-native';

import { skipLineText } from '../../../content/skip-lines';
import { SkipPoster } from '../SkipPoster';

describe('SkipPoster', () => {
  it('renders the poster copy and a spoken summary', async () => {
    await render(
      <SkipPoster
        width={360}
        pseudo="Maxime"
        line={skipLineText('leg-day', 'Maxime')}
        teamName="Les Déchaînés"
        teamKg={1240}
        skips={1}
        weekLabel="Semaine du 26 oct. au 1er nov."
        inviteLabel="Rejoins la team sur NoSkip · code ABCD-2345"
        animated={false}
      />,
    );
    expect(screen.getByText("MAXIME A CHOISI LE CANAP'.")).toBeTruthy();
    expect(
      screen.getByText("Maxime a skip la salle. Même le leg day n'y croyait plus."),
    ).toBeTruthy();
    expect(screen.getByText('1 240 kg')).toBeTruthy();
    expect(screen.getByText('SK')).toBeTruthy();
    expect(screen.getByText('IP.')).toBeTruthy();
    expect(screen.getByText('SEMAINE DU 26 OCT. AU 1ER NOV.')).toBeTruthy();
    expect(screen.getByLabelText(/^Carte SKIP\. Maxime a choisi le Canap'/)).toBeTruthy();
  });
});
