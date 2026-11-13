import { fireEvent, render, screen } from '@testing-library/react-native';

import { TEAM_TUTORIAL } from '@/domain/tutorial';

import { CoachMarks, CoachMarksProvider } from '../CoachMarks';

describe('CoachMarks', () => {
  it('walks through every step, then hands back to the screen', async () => {
    const onDone = jest.fn();
    await render(
      <CoachMarksProvider>
        <CoachMarks steps={TEAM_TUTORIAL} visible onDone={onDone} />
      </CoachMarksProvider>,
    );
    expect(screen.getByText('Ta barre de team.')).toBeTruthy();
    expect(screen.getByText('1 / 4')).toBeTruthy();
    for (let i = 0; i < 3; i += 1) {
      await fireEvent.press(screen.getByRole('button', { name: 'Suivant' }));
    }
    expect(screen.getByText('Bilan à 20 h.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: "C'est parti" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('can be skipped at any time, and shows nothing when hidden', async () => {
    const onDone = jest.fn();
    const { rerender } = await render(
      <CoachMarksProvider>
        <CoachMarks steps={TEAM_TUTORIAL} visible onDone={onDone} />
      </CoachMarksProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Passer le tutoriel' }));
    expect(onDone).toHaveBeenCalled();
    await rerender(
      <CoachMarksProvider>
        <CoachMarks steps={TEAM_TUTORIAL} visible={false} onDone={onDone} />
      </CoachMarksProvider>,
    );
    expect(screen.queryByText('Ta barre de team.')).toBeNull();
  });
});
