import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Button } from '@/components/ui/Button';
import { ErrorNote } from '@/components/ui/ErrorNote';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { onboardingStepNumber } from '@/domain/onboarding';
import {
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  sendMagicLink,
  SignInCancelled,
  signInWithApple,
  signInWithGoogle,
  verifyEmailCode,
} from '@/features/auth/signIn';
import { toUserMessage } from '@/lib/errors';
import { colors, radii, spacing } from '@/theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignInStep() {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'ios') isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  async function run(action: () => Promise<void>, onDone?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone?.();
    } catch (err) {
      if (!(err instanceof SignInCancelled)) setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const enter = () => router.replace('/');
  const emailValid = EMAIL_RE.test(email.trim());

  if (sentTo) {
    return (
      <OnboardingScreen
        step={onboardingStepNumber('/sign-in')}
        title="Check ta boîte mail."
        subtitle={`Lien envoyé à ${sentTo}. Ouvre le mail sur ce téléphone et touche le lien : tu reviens ici, connecté.`}
        footer={
          <>
            {showCode ? (
              <Button
                label="Valider le code"
                disabled={busy || code.trim().length < 6}
                onPress={() => run(() => verifyEmailCode(sentTo, code), enter)}
              />
            ) : null}
            <Button
              label="Renvoyer le lien"
              variant={showCode ? 'ghost' : 'secondary'}
              withArrow={false}
              disabled={busy}
              onPress={() => run(() => sendMagicLink(sentTo))}
            />
            <Button
              label="Changer d'adresse"
              variant="ghost"
              withArrow={false}
              onPress={() => {
                setSentTo(null);
                setCode('');
                setShowCode(false);
              }}
            />
          </>
        }
      >
        {showCode ? (
          <TextField
            label="Code reçu"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            placeholder="123456"
          />
        ) : (
          <Button
            label="Mon mail contient un code à 6 chiffres"
            variant="ghost"
            withArrow={false}
            onPress={() => setShowCode(true)}
          />
        )}
        <ErrorNote message={error} />
      </OnboardingScreen>
    );
  }

  return (
    <OnboardingScreen
      step={onboardingStepNumber('/sign-in')}
      title="Crée ton compte."
      subtitle="10 secondes. Après, c'est la barre qui parle."
      footer={
        <Text variant="caption" color={colors.muted} style={styles.legal}>
          En continuant, tu acceptes les CGU et la politique de confidentialité de NoSkip.
        </Text>
      }
    >
      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={radii.button}
          style={styles.apple}
          onPress={() => run(signInWithApple, enter)}
        />
      ) : null}
      {isGoogleSignInConfigured ? (
        <Button
          label="Continuer avec Google"
          variant="secondary"
          withArrow={false}
          disabled={busy}
          onPress={() => run(signInWithGoogle, enter)}
        />
      ) : null}
      {appleAvailable || isGoogleSignInConfigured ? (
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text variant="label" color={colors.muted}>
            ou par e-mail
          </Text>
          <View style={styles.line} />
        </View>
      ) : null}
      <TextField
        label="Ton e-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        placeholder="toi@exemple.fr"
        returnKeyType="send"
        onSubmitEditing={() =>
          emailValid &&
          run(
            () => sendMagicLink(email),
            () => setSentTo(email.trim()),
          )
        }
      />
      <Button
        label="Recevoir mon lien"
        disabled={busy || !emailValid}
        onPress={() =>
          run(
            () => sendMagicLink(email),
            () => setSentTo(email.trim().toLowerCase()),
          )
        }
      />
      <ErrorNote message={error} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  apple: { height: 56, width: '100%' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.glassBorder },
  legal: { textAlign: 'center' },
});
