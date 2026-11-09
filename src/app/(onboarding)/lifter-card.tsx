import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { OptionCard } from '@/components/ui/OptionCard';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { onboardingStepNumber } from '@/domain/onboarding';
import { initialsOf, validatePseudo } from '@/domain/profile';
import {
  LIFTER_TITLES,
  type LifterTitle,
  useProfile,
  useUpdateProfile,
  useUploadAvatar,
} from '@/features/profile/api';
import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing } from '@/theme/tokens';

export default function LifterCardStep() {
  const editing = useLocalSearchParams<{ edit?: string }>().edit === '1';
  const profile = useProfile();
  const update = useUpdateProfile();
  const upload = useUploadAvatar();
  const [pseudo, setPseudo] = useState<string | null>(null);
  const [title, setTitle] = useState<LifterTitle | null>(null);
  const [touched, setTouched] = useState(false);

  const currentPseudo = pseudo ?? profile.data?.pseudo ?? '';
  const currentTitle = title ?? profile.data?.title ?? 'machine';
  const avatar = profile.data?.avatar_url ?? null;
  const pseudoError = validatePseudo(currentPseudo);
  const error = update.error ?? upload.error;

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) upload.mutate({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
  }

  const initials = initialsOf(currentPseudo);
  const titleLabel = LIFTER_TITLES.find((t) => t.value === currentTitle)?.label ?? '';

  return (
    <OnboardingScreen
      step={onboardingStepNumber('/lifter-card')}
      editLabel={editing ? 'Réglages' : undefined}
      title="Ta carte de lifter."
      subtitle="C'est elle que ta team verra sur la barre."
      footer={
        <Button
          label={editing ? 'Enregistrer' : 'Valider ma carte'}
          disabled={Boolean(pseudoError) || update.isPending || upload.isPending}
          onPress={() =>
            update.mutate(
              { pseudo: currentPseudo.trim(), title: currentTitle },
              { onSuccess: () => (editing ? router.back() : router.replace('/')) },
            )
          }
        />
      }
    >
      <View
        style={styles.card}
        accessible
        accessibilityLabel={`Aperçu : ${currentPseudo || 'sans pseudo'}, ${titleLabel}`}
      >
        <PressableScale
          onPress={pickPhoto}
          accessibilityRole="button"
          accessibilityLabel={avatar ? 'Changer la photo' : 'Ajouter une photo (optionnel)'}
          style={styles.avatar}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <Text variant="title" color={colors.ink}>
              {initials}
            </Text>
          )}
        </PressableScale>
        <View style={styles.cardText}>
          <Text variant="label" color={colors.accent}>
            {titleLabel}
          </Text>
          <Text variant="title" numberOfLines={1}>
            {currentPseudo.trim() || 'Ton pseudo'}
          </Text>
          <Text variant="caption" color={colors.muted}>
            {upload.isPending
              ? 'Envoi de la photo…'
              : avatar
                ? 'Touche la photo pour la changer'
                : 'Photo optionnelle : touche le rond'}
          </Text>
        </View>
      </View>

      <TextField
        label="Pseudo"
        value={currentPseudo}
        onChangeText={setPseudo}
        onBlur={() => setTouched(true)}
        error={touched ? pseudoError : null}
        maxLength={20}
        autoCapitalize="words"
        autoCorrect={false}
        placeholder="Comme tes potes t'appellent"
      />

      <Text variant="label" color={colors.muted}>
        Ton titre
      </Text>
      {LIFTER_TITLES.map((t) => (
        <OptionCard
          key={t.value}
          selected={currentTitle === t.value}
          onPress={() => setTitle(t.value)}
          title={t.label}
        />
      ))}
      <ErrorNote message={error ? toUserMessage(error) : null} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radii.cardLarge,
    padding: spacing.xl,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 84, height: 84 },
  cardText: { flex: 1, gap: 2 },
});
