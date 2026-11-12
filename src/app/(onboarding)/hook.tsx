import { useState } from 'react';

import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { hookVerdict, onboardingStepNumber } from '@/domain/onboarding';
import { useUpdateLocalOnboarding } from '@/features/onboarding/localStore';
import { colors } from '@/theme/tokens';
import { useGoNext } from '@/features/onboarding/useGoNext';

export default function HookStep() {
  const goNext = useGoNext();
  const [planned, setPlanned] = useState(12);
  const [done, setDone] = useState(5);
  const save = useUpdateLocalOnboarding();

  return (
    <OnboardingScreen
      step={onboardingStepNumber('/hook')}
      canGoBack={false}
      title="Le mois dernier, t'avais prévu combien de séances ?"
      subtitle="Et t'en as fait combien ? Sois honnête, personne ne regarde. Enfin, pas encore."
      footer={
        <Button
          label="C'est parti"
          disabled={save.isPending}
          onPress={() => save.mutate({ hook: { planned, done } }, { onSuccess: () => goNext() })}
        />
      }
    >
      <Stepper label="Prévues" value={planned} onChange={setPlanned} max={31} suffix="séances" />
      <Stepper label="Faites" value={done} onChange={setDone} max={31} suffix="séances" />
      <Text variant="headline" color={colors.accent} accessibilityLiveRegion="polite">
        {hookVerdict({ planned, done })}
      </Text>
    </OnboardingScreen>
  );
}
