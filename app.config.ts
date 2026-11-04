import type { ConfigContext, ExpoConfig } from 'expo/config';

// iOS Google Sign-In needs the reversed iOS client id as a URL scheme.
function googleIosUrlScheme(): string | null {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  if (!iosClientId) return null;
  const prefix = iosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
  return `com.googleusercontent.apps.${prefix}`;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleScheme = googleIosUrlScheme();
  // Universal / App Links for https://<host>/join/<code>, once a domain serves the
  // apple-app-site-association and assetlinks.json files.
  const inviteHost = process.env.EXPO_PUBLIC_INVITE_HOST?.trim() || null;
  return {
    ...config,
    name: 'NoSkip',
    slug: 'noskip',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'noskip',
    userInterfaceStyle: 'dark',
    backgroundColor: '#111214',
    ios: {
      bundleIdentifier: 'com.noskip.app',
      supportsTablet: false,
      icon: './assets/expo.icon',
      usesAppleSignIn: true,
      ...(inviteHost ? { associatedDomains: [`applinks:${inviteHost}`] } : {}),
    },
    android: {
      package: 'com.noskip.app',
      adaptiveIcon: {
        backgroundColor: '#111214',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      ...(inviteHost
        ? {
            intentFilters: [
              {
                action: 'VIEW',
                autoVerify: true,
                data: [{ scheme: 'https', host: inviteHost, pathPrefix: '/join/' }],
                category: ['BROWSABLE', 'DEFAULT'],
              },
            ],
          }
        : {}),
    },
    web: { output: 'single', favicon: './assets/images/favicon.png' },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-apple-authentication',
      [
        'expo-splash-screen',
        { backgroundColor: '#111214', image: './assets/images/splash-icon.png', imageWidth: 76 },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            "NoSkip vérifie juste que t'es à ta salle. Ta team voit « venu » ou « pas venu », jamais où t'es.",
          locationAlwaysAndWhenInUsePermission:
            'Pour pointer ta séance tout seul, même téléphone en poche. Ta position ne quitte jamais ton téléphone.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Pour mettre une photo sur ta carte de lifter (optionnel).',
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      ...(googleScheme
        ? [
            ['@react-native-google-signin/google-signin', { iosUrlScheme: googleScheme }] as [
              string,
              { iosUrlScheme: string },
            ],
          ]
        : []),
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
  };
};
