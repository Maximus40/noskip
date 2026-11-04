import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { skipLineText } from '../../../content/skip-lines';
import { SkipPoster } from '@/components/SkipPoster';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { PressableScale } from '@/components/ui/PressableScale';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { posterInviteLabel } from '@/domain/teams';
import { weekRangeLabel } from '@/domain/weekClose';
import { feedback } from '@/features/feedback/feedback';
import { useProfile } from '@/features/profile/api';
import { shareSkipPoster } from '@/features/weeks/shareSkip';
import { useCountSkipShare, useSkipCard } from '@/features/weeks/api';
import { env } from '@/lib/env';
import { toUserMessage } from '@/lib/errors';
import { colors, minTouch, spacing } from '@/theme/tokens';

/** Carte SKIP: the poster, and "Partager en story" (1080×1920 image + native share). */
export default function SkipCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const card = useSkipCard(id);
  const profile = useProfile();
  const countShare = useCountSkipShare();
  const poster = useRef<ComponentRef<typeof View>>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The poster fits the screen above the share button, 9:16.
  const width = Math.min(screenWidth - spacing.lg * 2, ((screenHeight - 220) * 9) / 16, 420);

  const loaded = Boolean(card.data);
  useEffect(() => {
    if (!loaded || !profile.data) return;
    feedback('skip', { sound: profile.data.sound_enabled, haptics: profile.data.haptics_enabled });
  }, [loaded, profile.data]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/team'));

  async function onShare() {
    if (!card.data) return;
    setError(null);
    setSharing(true);
    try {
      const shared = await shareSkipPoster(poster);
      if (!shared) setError("Le partage n'est pas disponible sur cet appareil.");
      else countShare.mutate(card.data.player.cardId as string);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSharing(false);
    }
  }

  const data = card.data;
  const isMine = data?.player.isMe ?? false;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text variant="label" color={colors.muted}>
          Carte SKIP
        </Text>
        <PressableScale
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          style={styles.close}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6 6l12 12M18 6L6 18"
              stroke={colors.offWhite}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          </Svg>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {data ? (
          <SkipPoster
            ref={poster}
            width={width}
            pseudo={data.player.pseudo}
            line={skipLineText(data.player.lineId ?? '', data.player.pseudo)}
            teamName={data.recap.teamName}
            teamKg={data.recap.totalKg}
            skips={data.recap.skipsCount}
            weekLabel={weekRangeLabel(data.recap.weekStart)}
            inviteLabel={posterInviteLabel(data.recap.inviteCode, env?.inviteHost)}
          />
        ) : card.isError ? null : (
          <Skeleton height={(width * 16) / 9} style={{ width }} />
        )}
        <ErrorNote message={card.error ? toUserMessage(card.error) : error} />
      </ScrollView>

      {data ? (
        <View style={styles.footer}>
          <Button
            label={sharing ? 'Préparation…' : 'PARTAGER EN STORY'}
            onPress={onShare}
            disabled={sharing}
            accessibilityHint="Crée une image 1080 × 1920 et ouvre le partage"
          />
          <Text variant="caption" color={colors.muted} style={styles.hint}>
            {isMine
              ? "Assume. La semaine prochaine, c'est toi qui charges la barre."
              : `Fais tourner. ${data.player.pseudo} s'en souviendra lundi.`}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  close: {
    width: 48,
    height: Math.max(minTouch, 48),
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  hint: { textAlign: 'center' },
});
