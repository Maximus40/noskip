import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Canap } from '@/components/Canap';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { ListRow } from '@/components/ui/ListRow';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatKg } from '@/domain/bar';
import { weekRangeLabel } from '@/domain/weekClose';
import { useMyTeams } from '@/features/teams/api';
import { type HistoryWeek, useTeamHistory } from '@/features/weeks/api';
import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing } from '@/theme/tokens';

/** Historique: every closed week of a team, newest first. */
export default function HistoryScreen() {
  const params = useLocalSearchParams<{ team?: string }>();
  const teams = useMyTeams();
  const [selected, setSelected] = useState<string | undefined>(params.team);
  const teamId = selected ?? teams.data?.[0]?.id;
  const history = useTeamHistory(teamId);
  const weeks = history.data ?? [];
  const best = weeks.reduce((max, w) => Math.max(max, w.totalKg), 0);

  return (
    <Screen
      footer={
        <Button
          label="Retour"
          variant="ghost"
          withArrow={false}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/team'))}
        />
      }
    >
      <View style={styles.head}>
        <Text variant="label" color={colors.accent}>
          Historique
        </Text>
        <Text variant="title" accessibilityRole="header">
          Les semaines passées.
        </Text>
      </View>

      {(teams.data?.length ?? 0) > 1 ? (
        <View style={styles.chips} accessibilityRole="tablist">
          {teams.data!.map((t) => {
            const active = t.id === teamId;
            return (
              <PressableScale
                key={t.id}
                onPress={() => setSelected(t.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text variant="caption" color={active ? colors.ink : colors.offWhite}>
                  {t.name}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      ) : null}

      {history.isLoading || teams.isLoading ? (
        <View style={styles.list}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : weeks.length === 0 && !history.isError ? (
        <View style={styles.empty}>
          <Canap mood="idle" size={140} />
          <Text variant="headline">Pas encore de semaine bouclée.</Text>
          <Text variant="body" color={colors.muted} style={styles.center}>
            Le premier bilan tombe dimanche à 20 h. Le Canap&apos; attend de voir.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {best > 0 ? (
            <Text variant="caption" color={colors.muted}>
              {`Meilleure semaine : ${formatKg(best)} kg`}
            </Text>
          ) : null}
          {weeks.map((w) => (
            <ListRow
              key={w.weekId}
              title={`${formatKg(w.totalKg)} kg`}
              subtitle={`${weekRangeLabel(w.weekStart)} · ${historyLine(w)}`}
              trailing={<WeekBadge week={w} />}
              accessibilityHint="Ouvre le bilan de cette semaine"
              onPress={() =>
                router.push({ pathname: '/recap/[weekId]', params: { weekId: w.weekId } })
              }
            />
          ))}
        </View>
      )}
      <ErrorNote message={history.error ? toUserMessage(history.error) : null} />
    </Screen>
  );
}

function historyLine(w: HistoryWeek): string {
  if (w.isTeamPr) return w.machinePseudo ? `PR · Machine : ${w.machinePseudo}` : 'PR';
  if (w.skipsCount === 0) return w.machinePseudo ? `Machine : ${w.machinePseudo}` : 'Barre vide';
  return `${w.skipsCount} skip${w.skipsCount > 1 ? 's' : ''} · ${w.skipperPseudo ?? ''}`.trim();
}

function WeekBadge({ week }: { week: HistoryWeek }) {
  if (week.isRecord) return <Badge label="Record" accent />;
  if (week.isTeamPr) return <Badge label="PR" accent />;
  if (week.skipsCount > 0) return <Badge label={`Canap' ${week.skipsCount}`} />;
  return null;
}

function Badge({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <View style={[styles.badge, accent && styles.badgeAccent]}>
      <Text variant="label" color={accent ? colors.ink : colors.offWhite}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipActive: { backgroundColor: colors.offWhite, borderColor: colors.offWhite },
  list: { gap: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  center: { textAlign: 'center' },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  badgeAccent: { backgroundColor: colors.accent, borderColor: colors.accent },
});
