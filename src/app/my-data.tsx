import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { colors, radii, spacing } from '@/theme/tokens';

const STORED = [
  ['Ton compte', 'E-mail ou identifiant Apple / Google.'],
  ['Ta carte', 'Pseudo, photo si tu en ajoutes une, titre, couleur de disque.'],
  [
    'Ton jeu',
    'Objectif, salles choisies, séances validées (date, heures, durée), teams, spots, jokers, cartes SKIP, bilans, trophées.',
  ],
  ['Ton téléphone', 'Le jeton pour t’envoyer les notifications que tu as choisies.'],
  ['Ton abonnement', 'Formule et échéance, synchronisées depuis le store.'],
] as const;

const NEVER = [
  'Ta position GPS : le calcul « suis-je à la salle ? » se fait sur ton téléphone.',
  'Tes trajets, même pas une trace.',
  'Tes contacts, tes photos (sauf celle que tu choisis), tes autres apps.',
  'De la pub ou un profil revendu à qui que ce soit.',
] as const;

const TEAM_SEES = [
  'Ton pseudo, ta photo, ton titre et ta carte de lifter.',
  'Ton compteur de la semaine (2/3) et « Fait », « À la salle » ou « Pas encore ».',
  'Jamais ta salle, jamais l’heure, jamais où tu es.',
] as const;

/** « Tes données » : what is stored, what never is, what the team sees. */
export default function MyDataScreen() {
  return (
    <Screen
      footer={
        <Button
          label="Retour"
          variant="ghost"
          withArrow={false}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
        />
      }
    >
      <View style={styles.head}>
        <Text variant="label" color={colors.accent}>
          Tes données
        </Text>
        <Text variant="title" accessibilityRole="header">
          Ce qu’on garde. Ce qu’on ne garde jamais.
        </Text>
      </View>

      <View style={[styles.card, styles.never]}>
        <Text variant="label" color={colors.accent}>
          Jamais stocké
        </Text>
        {NEVER.map((line) => (
          <Bullet key={line} text={line} />
        ))}
      </View>

      <View style={styles.card}>
        <Text variant="caption" color={colors.muted}>
          Stocké sur nos serveurs (Paris)
        </Text>
        {STORED.map(([title, body]) => (
          <View key={title} style={styles.item}>
            <Text variant="bodyStrong">{title}</Text>
            <Text variant="body" color="#C9CACE">
              {body}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text variant="caption" color={colors.muted}>
          Ce que ta team voit
        </Text>
        {TEAM_SEES.map((line) => (
          <Bullet key={line} text={line} />
        ))}
      </View>

      <Button
        label="Politique de confidentialité"
        variant="secondary"
        withArrow={false}
        onPress={() => router.push('/privacy')}
      />
      <Button
        label="Supprimer mon compte"
        variant="ghost"
        withArrow={false}
        onPress={() => router.push('/account-delete')}
      />
    </Screen>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.dot} />
      <Text variant="body" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  never: { borderWidth: 1, borderColor: colors.accent },
  item: { gap: 2 },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 9 },
  flex: { flex: 1 },
});
