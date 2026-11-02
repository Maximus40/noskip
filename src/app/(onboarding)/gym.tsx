import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { OptionCard } from '@/components/ui/OptionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { distanceMeters, formatDistance } from '@/domain/geo';
import { onboardingStepNumber } from '@/domain/onboarding';
import { type FoundGym, useGymSearch } from '@/features/gyms/api';
import { useChooseGym } from '@/features/profile/api';
import { toUserMessage } from '@/lib/errors';
import { colors, spacing } from '@/theme/tokens';

type Point = { lat: number; lng: number };

export default function GymStep() {
  const [query, setQuery] = useState('');
  // Precise position stays in memory on the phone, only used to sort and show distances.
  const [here, setHere] = useState<Point | null>(null);
  const [selected, setSelected] = useState<FoundGym | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const search = useGymSearch();
  const choose = useChooseGym();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  function searchByName(text: string) {
    setQuery(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < 3) return;
    debounce.current = setTimeout(() => {
      search.mutate({ mode: 'name', query: text, ...(here ?? {}) });
    }, 500);
  }

  async function searchAroundMe() {
    setLocationNote(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      setLocationNote(
        "Sans localisation, cherche ta salle par son nom. Promis, c'est aussi rapide.",
      );
      return;
    }
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const point = { lat: position.coords.latitude, lng: position.coords.longitude };
    setHere(point);
    search.mutate({ mode: 'near', ...point });
  }

  const gyms = sortByDistance(search.data ?? [], here);
  const errorMessage = search.error
    ? toUserMessage(search.error)
    : choose.error
      ? toUserMessage(choose.error)
      : null;

  return (
    <OnboardingScreen
      step={onboardingStepNumber('/gym')}
      title="C'est où, ta salle ?"
      subtitle="Uniquement des vraies salles (OpenStreetMap). Le pointage se fera tout seul quand tu y seras."
      footer={
        <Button
          label={selected ? `C'est ma salle` : 'Choisis ta salle'}
          disabled={!selected || choose.isPending}
          onPress={() =>
            selected &&
            choose.mutate({ gymId: selected.id }, { onSuccess: () => router.replace('/') })
          }
        />
      }
    >
      <Button
        label="Autour de moi"
        variant="secondary"
        withArrow={false}
        onPress={searchAroundMe}
      />
      <TextField
        label="Ou cherche par nom"
        value={query}
        onChangeText={searchByName}
        placeholder="Fitness Park, Basic-Fit, On Air…"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() =>
          query.trim().length >= 2 && search.mutate({ mode: 'name', query, ...(here ?? {}) })
        }
      />
      {locationNote ? (
        <Text variant="caption" color={colors.muted}>
          {locationNote}
        </Text>
      ) : null}
      <ErrorNote message={errorMessage} />

      {search.isPending ? (
        <View style={styles.list}>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </View>
      ) : search.isSuccess && gyms.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="headline">Aucune salle par ici.</Text>
          <Text variant="caption" color={colors.muted}>
            Essaie un autre nom, ou le nom de ta ville avec. Le Canap&apos; espérait que tu
            abandonnes.
          </Text>
        </View>
      ) : (
        <View style={styles.list} accessibilityRole="radiogroup">
          {gyms.map((gym) => (
            <OptionCard
              key={gym.id}
              selected={selected?.id === gym.id}
              onPress={() => setSelected(gym)}
              title={gym.name}
              subtitle={[
                gym.address,
                here ? formatDistance(distanceMeters(here.lat, here.lng, gym.lat, gym.lng)) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
        </View>
      )}
    </OnboardingScreen>
  );
}

function sortByDistance(gyms: FoundGym[], here: Point | null): FoundGym[] {
  if (!here) return gyms;
  return [...gyms].sort(
    (a, b) =>
      distanceMeters(here.lat, here.lng, a.lat, a.lng) -
      distanceMeters(here.lat, here.lng, b.lat, b.lng),
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  empty: { gap: spacing.xs, paddingVertical: spacing.xl },
});
