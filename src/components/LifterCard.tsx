import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { CountUp } from '@/components/CountUp';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { initialsOf } from '@/domain/profile';
import { bestStreak, currentStreak, levelFor, trophyLabel } from '@/domain/progression';
import type { LifterCardData } from '@/features/progression/api';
import { LIFTER_TITLES } from '@/features/profile/api';
import { colors, radii, spacing } from '@/theme/tokens';

type Props = { card: LifterCardData; footer?: ReactNode };

/**
 * Carte de lifter (flat dark cards): photo, colour, title, level, personal bar, streak,
 * sessions, skips and trophies. Same card for me and for a teammate.
 */
export function LifterCard({ card, footer }: Props) {
  const reduced = useReducedMotion();
  const level = levelFor(card.lifetimeSessions);
  const streak = currentStreak(card.history);
  const best = bestStreak(card.history);
  const tint = card.isMe ? colors.accent : card.plateColor;
  const titleLabel = LIFTER_TITLES.find((t) => t.value === card.title)?.label ?? '';
  const enter = (i: number) => (reduced ? FadeIn : FadeInDown.delay(i * 90).duration(400));

  return (
    <View style={styles.stack}>
      <Animated.View entering={enter(0)} style={styles.hero}>
        <View style={styles.identity}>
          <View style={[styles.avatar, { borderColor: tint }]}>
            {card.avatarUrl ? (
              <Image source={{ uri: card.avatarUrl }} style={styles.avatarImg} contentFit="cover" />
            ) : (
              <Text variant="title" color={tint}>
                {initialsOf(card.pseudo)}
              </Text>
            )}
          </View>
          <View style={styles.flex}>
            <Text variant="title" numberOfLines={1} accessibilityRole="header">
              {card.pseudo}
            </Text>
            <Text variant="body" color={colors.muted} numberOfLines={1}>
              {titleLabel}
            </Text>
          </View>
        </View>
        <View style={styles.levelBlock}>
          <Text variant="label" color={colors.accent}>
            Niveau
          </Text>
          <Text variant="display" style={styles.levelName} numberOfLines={1} adjustsFontSizeToFit>
            {`${level.level.name.toUpperCase()}.`}
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        entering={enter(1)}
        style={styles.card}
        accessible
        accessibilityLabel={`Barre perso : ${formatKg(level.kg)} kilos.${
          level.next
            ? ` Encore ${level.sessionsToNext} séances pour passer ${level.next.name}.`
            : ' Niveau maximum.'
        }`}
      >
        <Text variant="caption" color={colors.muted}>
          Barre perso · +2,5 kg par séance, à vie
        </Text>
        <View style={styles.kgRow}>
          <CountUp variant="number" style={styles.kg} value={level.kg} format={formatKg} />
          <Text variant="headline" style={styles.kgUnit}>
            kg
          </Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(level.progress * 100)}%`, backgroundColor: tint },
            ]}
          />
        </View>
        <Text variant="caption" color={colors.muted}>
          {level.next
            ? `Encore ${level.sessionsToNext} séance${level.sessionsToNext > 1 ? 's' : ''} pour passer ${level.next.name} (${level.next.minKg} kg).`
            : 'Légende. Le Canap’ ne te reconnaît plus.'}
        </Text>
      </Animated.View>

      <Animated.View entering={enter(2)} style={styles.stats}>
        <Stat
          value={`${streak} sem.`}
          label="Série"
          detail={`Record : ${best}`}
          accent={streak > 0}
        />
        <Stat value={String(card.lifetimeSessions)} label="Séances" />
        <Stat value={String(card.skipsTotal)} label="Skips" />
      </Animated.View>

      <Animated.View entering={enter(3)} style={styles.card}>
        <Text variant="caption" color={colors.muted}>
          Trophées
        </Text>
        {card.trophies.length === 0 ? (
          <Text variant="body" color="#C9CACE">
            Pas encore de ceinture. Le 1er de chaque mois, elle va au plus régulier de la team.
          </Text>
        ) : (
          card.trophies.map((t) => (
            <View
              key={`${t.type}-${t.month}-${t.teamName}`}
              style={styles.trophy}
              accessible
              accessibilityLabel={`${trophyLabel(t.type, t.month)}, team ${t.teamName}`}
            >
              <View
                style={[styles.badge, t.type === 'belt' ? styles.badgeBelt : styles.badgeCanap]}
              >
                <Text variant="label" color={t.type === 'belt' ? colors.ink : colors.offWhite}>
                  {t.type === 'belt' ? 'Ceinture' : "Gros Canap'"}
                </Text>
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {trophyLabel(t.type, t.month)}
                </Text>
                <Text variant="caption" color={colors.muted} numberOfLines={1}>
                  {`${t.month.slice(0, 4)} · ${t.teamName}`}
                </Text>
              </View>
            </View>
          ))
        )}
      </Animated.View>

      {footer}
    </View>
  );
}

function Stat({
  value,
  label,
  detail,
  accent,
}: {
  value: string;
  label: string;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <View
      style={[styles.card, styles.stat]}
      accessible
      accessibilityLabel={`${label} : ${value}${detail ? `, ${detail}` : ''}`}
    >
      <Text variant="headline" color={accent ? colors.accent : colors.offWhite} numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" color={colors.muted}>
        {label}
      </Text>
      {detail ? (
        <Text variant="caption" color={colors.muted}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  flex: { flex: 1 },
  hero: {
    borderRadius: radii.cardLarge,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    gap: spacing.lg,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  avatarImg: { width: 72, height: 72 },
  levelBlock: { gap: spacing.xs },
  levelName: { fontSize: 44, lineHeight: 48, letterSpacing: -1.5 },
  card: {
    borderRadius: radii.card,
    backgroundColor: colors.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  kgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  kg: { fontSize: 48, lineHeight: 52 },
  kgUnit: { paddingBottom: 8 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: { height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, gap: 2 },
  trophy: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  badge: {
    minWidth: 124,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.round,
  },
  badgeBelt: { backgroundColor: colors.accent },
  badgeCanap: { borderWidth: 1, borderColor: colors.glassBorder },
});
