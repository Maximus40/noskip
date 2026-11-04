import { router } from 'expo-router';
import { useState } from 'react';

import { InviteCard } from '@/components/InviteCard';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { extractInviteCode, pseudoList, validateTeamName } from '@/domain/teams';
import {
  useAcceptTeamRules,
  useCreateTeam,
  useJoinTeam,
  useTeamPreview,
} from '@/features/teams/api';
import { toUserMessage } from '@/lib/errors';
import { colors } from '@/theme/tokens';

export default function NewTeamScreen() {
  const [name, setName] = useState('');
  const [rawCode, setRawCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  const create = useCreateTeam();
  const join = useJoinTeam();
  const acceptRules = useAcceptTeamRules();
  const code = extractInviteCode(rawCode);
  const preview = useTeamPreview(code);
  const error = create.error ?? join.error ?? acceptRules.error ?? (code ? preview.error : null);

  if (create.data) {
    return (
      <Screen footer={<Button label="Terminé" variant="secondary" onPress={() => router.back()} />}>
        <Text variant="title">{`« ${create.data.name} » est créée.`}</Text>
        <InviteCard teamName={create.data.name} code={create.data.invite_code} memberCount={1} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="label" color={colors.accent}>
        Nouvelle team
      </Text>
      <Text variant="title" accessibilityRole="header">
        Créer
      </Text>
      <TextField
        label="Nom de la team"
        value={name}
        onChangeText={setName}
        maxLength={32}
        placeholder="Les Déchaînés"
      />
      <Button
        label="Créer la team"
        disabled={Boolean(validateTeamName(name)) || !accepted || create.isPending}
        onPress={() =>
          create.mutate(name, {
            onSuccess: (team) => team && acceptRules.mutate(team.id),
          })
        }
      />

      <Text variant="title" accessibilityRole="header">
        Ou rejoindre
      </Text>
      <TextField
        label="Code ou lien d'invitation"
        value={rawCode}
        onChangeText={setRawCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ABCD-2345"
      />
      {preview.data ? (
        <Text variant="caption" color={colors.muted}>
          {`${preview.data.name} · ${pseudoList(preview.data.member_pseudos)}`}
        </Text>
      ) : null}
      <Button
        label={preview.data ? `Rejoindre « ${preview.data.name} »` : 'Rejoindre'}
        variant="secondary"
        disabled={!code || !preview.data || !accepted || join.isPending}
        onPress={() =>
          code &&
          join.mutate(code, {
            onSuccess: (team) =>
              acceptRules.mutate(team.team_id, { onSuccess: () => router.back() }),
          })
        }
      />

      <Checkbox
        checked={accepted}
        onChange={setAccepted}
        label="J'accepte d'être chambré par le Canap' si je skip."
      />
      <ErrorNote message={error ? toUserMessage(error) : null} />
    </Screen>
  );
}
