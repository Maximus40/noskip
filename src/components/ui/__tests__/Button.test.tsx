import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('renders its label and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continuer" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continuer" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
