# Checklist de publication Dips or Chips

À cocher dans l'ordre. ☐ = à faire de ton côté. Tout ce qui concerne le code est déjà en place.

## A. Comptes et identifiants

- ☐ **Expo / EAS** : `eas login`, `eas init` → `EAS_PROJECT_ID` dans `.env` et les environnements EAS.
- ✅ **Apple Developer** : Team ID `6PFWK3G845`, identifiant `com.noskipapp.app` (défini dans
  `app.config.ts` iOS **et** Android).
- ☐ **Google Play Console** (25 $ une fois) : créer l'app `com.noskipapp.app`.
- ☐ **Domaine** (facultatif mais conseillé) : pour les liens d'invitation cliquables partout
  (`EXPO_PUBLIC_INVITE_HOST`) et pour héberger la confidentialité / les CGU.

## B. Backend

- ☐ SMTP personnalisé (Resend…) dans Supabase + `{{ .Token }}` dans le modèle « Magic link ».
- ☐ Sign in with Apple configuré dans Supabase (Services ID, Key ID, clé `.p8`, Team ID).
- ☐ Google Sign-In : clients Web, iOS, Android (empreinte SHA-1 du keystore EAS : `eas credentials`) ;
  ids dans `.env` + Supabase.
- ☐ `REVENUECAT_WEBHOOK_AUTH` posé dans les secrets des Edge Functions.
- ✅ Migrations, 10 Edge Functions, 4 crons et `cron_config` déployés sur le projet `kbxjsxmxelomyyzlzzqh`.
- ☐ Ne **pas** définir `DEMO_USER_IDS` sur le projet de production.

## C. Notifications push

- ☐ iOS : clé APNs via `eas credentials`.
- ☐ Android : projet Firebase, clé de compte de service FCM v1 via `eas credentials`.
- ☐ Tester sur un vrai téléphone : spot, disque chargé, SKIP (via `npm run simulate:week` ou le mode démo).

## D. Abonnements

- ☐ Contrats « Applications payantes » signés (App Store Connect → Accords ; Play Console → Profil de paiement).
- ☐ 4 abonnements créés dans chaque store (voir README §7), avec essais 7 j (annuel) et 3 j (hebdo).
- ☐ RevenueCat : apps, entitlement `pro`, offre courante (Annuel + Hebdo), offre `friends` (Duo + Team),
  webhook, clés SDK dans `.env` / EAS.
- ☐ Achat test : bac à sable iOS (compte Sandbox) et testeurs de licence Google Play. Vérifier que la ligne
  apparaît dans `subscriptions` et que l'app débloque.
- ☐ Tester Pack Duo (le pote est débloqué, « Offert par … ») et Team (8 places).

## E. Contenu et mentions légales

- ☐ `EXPO_PUBLIC_LEGAL_PUBLISHER`, `EXPO_PUBLIC_LEGAL_EMAIL`, `EXPO_PUBLIC_PRIVACY_URL`,
  `EXPO_PUBLIC_TERMS_URL` remplis (sinon l'app affiche « [à compléter avant publication] »).
- ☐ Publier sur le web les textes de `content/legal.ts` (mêmes contenus que dans l'app) aux deux URL.
- ☐ Remplacer les sons provisoires de `assets/sounds/` (clang de disque, clap de craie, ricanement).
- ☐ Valider l'icône (`assets/images/icon.png`, générée par `scripts/make-icons.mjs`) ou fournir la tienne.

## F. Contrôle sur appareil

- ☐ `eas build --profile development --platform all`, installer sur ton téléphone.
- ☐ Onboarding complet (10 étapes), y compris le lien d'invitation reçu par un pote.
- ☐ Pointage réel : arriver à la salle, rester 40 min, repartir → « Disque chargé ». Puis app tuée pendant la
  séance → validation à la réouverture.
- ☐ Plan B : refuser « Toujours » → « Je suis à la salle », puis valider après 40 min.
- ☐ Contrôle visuel sur simulateur iOS et émulateur Android (flou du verre, contrastes) comparé aux maquettes.
- ☐ Suppression de compte de bout en bout.
- ☐ « Réduire les animations » et grandes tailles de texte.

## G. App Store Connect (TestFlight)

1. ☐ Créer l'app (nom, langue principale Français, bundle `com.noskipapp.app`, SKU).
2. ☐ `eas build --profile production --platform ios` puis `eas submit --platform ios` (EAS demande l'app
   App Store Connect à utiliser).
3. ☐ **Confidentialité de l'app** (« étiquette nutritionnelle ») :
   - Coordonnées : adresse e-mail (fonctionnement de l'app, liée à l'identité).
   - Identifiants : identifiant utilisateur (fonctionnement de l'app).
   - Contenu utilisateur : photo (facultative), pseudo.
   - Achats : historique d'achats (via RevenueCat).
   - **Localisation : non collectée** (le calcul reste sur le téléphone ; la recherche « autour de moi » envoie
     une position arrondie à ~1 km, non stockée → à déclarer en « localisation approximative, fonctionnement de
     l'app, non liée, non conservée » si tu préfères être prudent).
   - Aucun suivi publicitaire (pas d'ATT).
4. ☐ Notes pour la review : expliquer le géorepérage (« l'app vérifie la présence à la salle choisie pour valider
   une séance ; la position ne quitte pas l'appareil »), fournir un **compte de démonstration** (e-mail +
   moyen de connexion) et rappeler que le contenu payant se teste en Sandbox.
5. ☐ Captures 6,9" et 6,5" (Ma team, Disque chargé, Carte SKIP, Bilan, Paiement).
6. ☐ Informations abonnements : nom, description, capture de l'écran de paiement pour chaque produit.
7. ☐ Testeurs internes TestFlight (jusqu'à 100), puis externes (review bêta).

## H. Google Play (test interne)

1. ☐ Créer l'app, catégorie Santé et remise en forme.
2. ☐ `eas build --profile production --platform android` puis `eas submit --platform android`
   (piste `internal`, brouillon ; la première fois, Play exige un envoi manuel de l'AAB : télécharge-le depuis
   expo.dev et dépose-le dans Play Console).
3. ☐ **Sécurité des données** : mêmes réponses que pour Apple ; données chiffrées en transit ; suppression
   possible dans l'app (et URL de demande de suppression = page web de confidentialité).
4. ☐ **Déclaration de localisation en arrière-plan** (obligatoire) : texte + vidéo courte montrant l'écran
   explicatif de l'étape 7 puis la séance validée automatiquement.
5. ☐ Questionnaire de classification du contenu, public cible (adultes / 16+), annonces : « non ».
6. ☐ Testeurs internes (liste d'e-mails) → lien d'opt-in.
7. ☐ Pour passer en production avec un compte personnel récent : 12 testeurs pendant 14 jours en test fermé.

## I. Après le lancement

- ☐ Brancher PostHog (clé à fournir) pour suivre : invitations acceptées, essai → payant, revenu par
  installation à J14 et J60.
- ☐ Si les invitations chutent à cause du paywall : tester un essai de 14 jours pour les invités.
- ☐ Mode hardcore (Screen Time / Family Controls) en V1.1 après accord d'Apple.
