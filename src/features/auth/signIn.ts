import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';

import { env } from '@/lib/env';
import { unregisterPush } from '@/features/notifications/push';
import { resetRevenueCat } from '@/features/subscriptions/revenuecat';
import { db } from '@/lib/supabase';

export class SignInCancelled extends Error {
  constructor() {
    super('sign_in_cancelled');
  }
}

export const AUTH_CALLBACK_PATH = 'auth-callback';

export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Native Sign in with Apple → Supabase session (nonce flow). */
export async function signInWithApple(): Promise<void> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new SignInCancelled();
    throw err;
  }
  if (!credential.identityToken) throw new Error('apple_no_identity_token');
  const { error } = await db().auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
}

export const isGoogleSignInConfigured = Boolean(env?.googleWebClientId);

/** Native Google Sign-In → Supabase session. Only offered when client ids are configured. */
export async function signInWithGoogle(): Promise<void> {
  if (!env?.googleWebClientId) throw new Error('google_not_configured');
  const { GoogleSignin, isSuccessResponse } =
    await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    iosClientId: env.googleIosClientId,
  });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw new SignInCancelled();
  const token = response.data.idToken;
  if (!token) throw new Error('google_no_id_token');
  const { error } = await db().auth.signInWithIdToken({ provider: 'google', token });
  if (error) throw error;
}

/** Emails a magic link (and a 6-digit code, depending on the Supabase email template). */
export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await db().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: Linking.createURL(AUTH_CALLBACK_PATH), shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await db().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  });
  if (error) throw error;
}

/** Completes a magic-link sign-in from `dipsorchips://auth-callback?code=…`. */
export async function completeAuthCallback(params: {
  code?: string;
  error_description?: string;
}): Promise<void> {
  if (params.error_description) throw new Error('otp_expired');
  if (!params.code) throw new Error('otp_expired');
  const { error } = await db().auth.exchangeCodeForSession(params.code);
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  // Stop this phone from receiving the player's notifications before the session goes away.
  await unregisterPush();
  await resetRevenueCat();
  await db().auth.signOut();
}
