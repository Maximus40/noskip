import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { InviteCard } from '@/components/InviteCard';
import { PlateSwatch } from '@/components/PlateSwatch';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { ListRow } from '@/components/ui/ListRow';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { MAX_TEAMS_PER_PLAYER, teamFill, validateTeamName } from '@/domain/teams';
import {
  type BoardRow,
  useDeleteTeam,
  useLeaveTeam,
  useMyTeams,
  useRegenerateInviteCode,
  useRemoveMember,
  useRenameTeam,
  useReportMember,
  useTeamBoard,
} from '@/features/teams/api';
import { toUserMessage } from '@/lib/errors';
import { colors, spacing } from '@/theme/tokens';

export default function TeamManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const teams = useMyTeams();
  const team = teams.data?.find((t) => t.id === id);
  const board = useTeamBoard(team?.id);
  const isOwner = team?.role === 'owner';

  const rename = useRenameTeam();
  const regenerate = useRegenerateInviteCode();
  const remove = useRemoveMember();
  const report = useReportMember();
  const leave = useLeaveTeam();
  const del = useDeleteTeam();
  const [name, setName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const error =
    rename.error ?? regenerate.error ?? remove.error ?? report.error ?? leave.error ?? del.error;

  if (teams.isLoading) {
    return (
      <Screen>
        <Skeleton height={120} />
        <Skeleton />
      </Screen>
    );
  }
  if (!team) {
    return (
      <Screen>
        <Text variant="title">Team introuvable.</Text>
        <Button label="Retour" onPress={() => router.back()} />
      </Screen>
    );
  }

  const currentName = name ?? team.name;
  const fill = teamFill(team.member_count, 4);

  function memberActions(member: BoardRow) {
    const pseudo = member.pseudo ?? 'Ce joueur';
    const options: Parameters<typeof Alert.alert>[2] = [
      {
        text: 'Signaler',
        onPress: () =>
          report.mutate(
            {
              teamId: team!.id,
              userId: member.user_id,
              reason: 'Signalé depuis la gestion de team',
            },
            { onSuccess: () => setNotice(`${pseudo} a été signalé. On regarde ça.`) },
          ),
      },
    ];
    if (isOwner) {
      options.push({
        text: 'Exclure de la team',
        style: 'destructive',
        onPress: () => remove.mutate({ teamId: team!.id, userId: member.user_id }),
      });
    }
    options.push({ text: 'Annuler', style: 'cancel' });
    Alert.alert(
      pseudo,
      isOwner ? 'Signaler ou exclure ce joueur ?' : 'Signaler ce joueur ?',
      options,
    );
  }

  return (
    <Screen>
      <View style={styles.content}>
        <Text variant="label" color={colors.accent}>
          {isOwner ? 'Ta team · créateur' : 'Ta team'}
        </Text>
        <Text variant="display" accessibilityRole="header">
          {team.name}
        </Text>
        <Text variant="caption" color={colors.muted}>
          {fill.label}
        </Text>

        {!fill.full ? (
          <InviteCard
            teamName={team.name}
            code={team.invite_code}
            memberCount={team.member_count}
          />
        ) : null}

        <Text variant="label" color={colors.muted}>
          Joueurs
        </Text>
        {board.isLoading ? <Skeleton /> : null}
        {board.data?.map((m) => (
          <ListRow
            key={m.user_id}
            leading={<PlateSwatch color={m.plate_color} isMe={m.is_me} />}
            title={`${m.pseudo ?? 'Un pote'}${m.is_me ? ' (toi)' : ''}`}
            subtitle={m.role === 'owner' ? 'Créateur' : undefined}
            onPress={m.is_me ? undefined : () => memberActions(m)}
            accessibilityHint={isOwner ? 'Signaler ou exclure' : 'Signaler'}
          />
        ))}

        {isOwner ? (
          <>
            <Text variant="label" color={colors.muted}>
              Réglages du créateur
            </Text>
            <TextField
              label="Nom de la team"
              value={currentName}
              onChangeText={setName}
              maxLength={32}
              error={validateTeamName(currentName)}
            />
            <Button
              label="Renommer"
              variant="secondary"
              withArrow={false}
              disabled={
                currentName.trim() === team.name ||
                Boolean(validateTeamName(currentName)) ||
                rename.isPending
              }
              onPress={() => rename.mutate({ teamId: team.id, name: currentName })}
            />
            <Button
              label="Changer le code d'invitation"
              variant="secondary"
              withArrow={false}
              accessibilityHint="Les anciens liens ne marcheront plus"
              onPress={() =>
                Alert.alert(
                  'Nouveau code ?',
                  'Les anciens liens d’invitation ne marcheront plus.',
                  [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Changer', onPress: () => regenerate.mutate(team.id) },
                  ],
                )
              }
            />
          </>
        ) : null}

        <ErrorNote message={error ? toUserMessage(error) : null} />
        {notice ? (
          <Text variant="caption" color={colors.muted} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}

        <Button
          label="Quitter la team"
          variant="ghost"
          withArrow={false}
          onPress={() =>
            Alert.alert(
              'Quitter la team ?',
              isOwner
                ? 'La team passera au plus ancien joueur. Seul, la team sera supprimée.'
                : 'Tes séances restent à toi. Tu pourras revenir avec le code.',
              [
                { text: 'Rester', style: 'cancel' },
                {
                  text: 'Quitter',
                  style: 'destructive',
                  onPress: () => leave.mutate(team.id, { onSuccess: () => router.replace('/') }),
                },
              ],
            )
          }
        />
        {isOwner ? (
          <Button
            label="Supprimer la team"
            variant="ghost"
            withArrow={false}
            onPress={() =>
              Alert.alert(
                'Supprimer la team ?',
                'La barre, l’historique et les cartes SKIP de la team seront effacés.',
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => del.mutate(team.id, { onSuccess: () => router.replace('/') }),
                  },
                ],
              )
            }
          />
        ) : null}
        <Text variant="caption" color={colors.muted}>
          {`Tu peux être dans ${MAX_TEAMS_PER_PLAYER} teams au maximum.`}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { gap: spacing.md } });
