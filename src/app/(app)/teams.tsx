import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { formatInviteCode, MAX_TEAMS_PER_PLAYER } from '@/domain/teams';
import { useMyTeams } from '@/features/teams/api';
import { toUserMessage } from '@/lib/errors';
import { colors, spacing } from '@/theme/tokens';

export default function TeamsScreen() {
  const teams = useMyTeams();
  const count = teams.data?.length ?? 0;

  return (
    <Screen>
      <View style={styles.content}>
        <Text variant="label" color={colors.accent}>
          Mes teams
        </Text>
        <Text variant="display" accessibilityRole="header">
          {count <= 1 ? 'Ta team.' : `Tes ${count} teams.`}
        </Text>

        {teams.isLoading ? (
          <>
            <Skeleton />
            <Skeleton />
          </>
        ) : (
          teams.data?.map((t) => (
            <ListRow
              key={t.id}
              title={t.name}
              subtitle={`${t.member_count} joueur${t.member_count > 1 ? 's' : ''} · code ${formatInviteCode(t.invite_code)}${t.role === 'owner' ? ' · créateur' : ''}`}
              onPress={() => router.push({ pathname: '/team-manage/[id]', params: { id: t.id } })}
              accessibilityHint="Gérer la team et inviter"
            />
          ))
        )}
        <ErrorNote message={teams.error ? toUserMessage(teams.error) : null} />

        {count < MAX_TEAMS_PER_PLAYER ? (
          <Button
            label="Créer ou rejoindre une team"
            variant="secondary"
            onPress={() => router.push('/team-new')}
          />
        ) : (
          <Text variant="caption" color={colors.muted}>
            {`${MAX_TEAMS_PER_PLAYER} teams max. Quitte-en une pour en rejoindre une autre.`}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Leaves room for the floating glass tab bar.
  content: { gap: spacing.md, paddingBottom: 120 },
});
