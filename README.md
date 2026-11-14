# NOXCUSE

App mobile iOS + Android de motivation à la salle entre potes. Chaque séance validée (au moins 40 min à
ta salle, détectée par géolocalisation) charge un disque sur la barre de ta team. Si tu rates ton objectif de la
semaine, le Canap' envoie une carte SKIP à toute la team.

- **App** : Expo SDK 58, React Native, TypeScript strict, Expo Router (`src/app/`), TanStack Query.
- **Backend** : Supabase (Auth, Postgres + RLS, Edge Functions Deno, `pg_cron` + `pg_net`, Storage).
- **Paiement** : RevenueCat. **Push** : Expo Push API.

Le suivi détaillé, phase par phase, est dans `CLAUDE.md` (section « Avancement »). La checklist de publication
est dans [`docs/STORE_CHECKLIST.md`](docs/STORE_CHECKLIST.md).

---

## 1. Installation

Prérequis : Node 22+, npm, et Git. Pour les builds natifs, un compte Expo (`npm i -g eas-cli`, puis `eas login`).
Facultatif : la CLI Supabase et Docker si tu veux un Supabase local complet.

```bash
npm install
cp .env.example .env   # puis remplis les valeurs (voir section 2)
```

Deno est installé comme dépendance npm : rien d'autre à installer pour les Edge Functions.

## 2. Variables d'environnement

`.env` n'est jamais commité. Les variables `EXPO_PUBLIC_*` sont intégrées dans l'app (ce sont des valeurs
publiques : jamais de clé secrète dedans).

| Variable                             | Obligatoire         | Où la trouver                                                                 |
| ------------------------------------ | ------------------- | ----------------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`           | oui                 | Supabase → Project Settings → API                                             |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`      | oui                 | Supabase → Project Settings → API (clé `anon` / publishable)                  |
| `EAS_PROJECT_ID`                     | pour les push       | Créé par `eas init` (affiché aussi sur expo.dev → projet)                     |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`   | pour Google         | Google Cloud Console → APIs & Services → Credentials (client « Web »)         |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`   | pour Google sur iOS | Même endroit, client « iOS » (bundle `com.noskipapp.app`)                     |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY`     | pour payer          | RevenueCat → Project settings → API keys (clé SDK publique iOS, `appl_…`)     |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | pour payer          | Même endroit, clé SDK publique Android (`goog_…`)                             |
| `EXPO_PUBLIC_INVITE_HOST`            | non                 | Ton domaine pour les liens d'invitation (`noskip.fr`, sans `https://`)        |
| `GOOGLE_MAPS_ANDROID_API_KEY`        | non                 | Google Cloud Console (Maps SDK for Android). Sans elle, fond de carte dessiné |
| `EXPO_PUBLIC_LEGAL_PUBLISHER`        | avant publication   | Nom de l'éditeur de l'app (toi ou ta société)                                 |
| `EXPO_PUBLIC_LEGAL_EMAIL`            | avant publication   | E-mail de contact affiché dans les CGU / la confidentialité                   |
| `EXPO_PUBLIC_PRIVACY_URL`            | avant publication   | URL publique de la politique de confidentialité                               |
| `EXPO_PUBLIC_TERMS_URL`              | avant publication   | URL publique des CGU                                                          |

Sans clés RevenueCat, l'écran de paiement affiche « paiement pas encore branché » ; en build de développement
seulement, un bouton « Continuer sans payer (dev) » permet d'avancer.

**Secrets des Edge Functions** (Supabase → Edge Functions → Secrets, jamais dans l'app) :

| Secret                                                           | Rôle                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Fournis automatiquement par Supabase                                                         |
| `REVENUECAT_WEBHOOK_AUTH`                                        | Valeur de l'en-tête `Authorization` du webhook RevenueCat. Non défini = webhook refusé (503) |
| `DEMO_USER_IDS`                                                  | Facultatif, projet de dev uniquement : ids autorisés à valider une séance en mode démo       |
| `EXPO_ACCESS_TOKEN`                                              | Facultatif : seulement si la « sécurité push renforcée » est activée sur Expo                |
| `OVERPASS_URL`                                                   | Facultatif : autre serveur Overpass (défaut `overpass-api.de`)                               |

## 3. Lancer en local

### Base de données

Deux options :

1. **Sans Docker** (ce que fait `npm run check`) : `npm run test:db` démarre un PostgreSQL 16 jetable, applique
   toutes les migrations sur une couche qui imite Supabase (`supabase/tests/local/supabase-shim.sql`) et lance
   les tests SQL. Idéal pour les tests, pas pour faire tourner l'app.
2. **Supabase local complet** (Docker) :

   ```bash
   npx supabase start
   npx supabase db reset          # applique supabase/migrations/
   npx supabase functions serve   # Edge Functions sur http://localhost:54321/functions/v1
   ```

   Mets ensuite l'URL et la clé `anon` affichées par `supabase start` dans `.env`.
   Les tests SQL peuvent tourner contre cette base : `DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db`.

### App

La géolocalisation en arrière-plan, Sign in with Apple, les achats et les push **ne marchent pas dans Expo Go** :
il faut un _development build_ (section 6), installé une fois sur le téléphone ou le simulateur.

```bash
npm start            # Metro ; ouvre ensuite le development build installé
```

**Mode démo** (development build uniquement) : bouton « Mode démo » en bas de Ma team (route `/dev`). Il simule une entrée
à la salle il y a 45 min, puis une sortie, pour tester « Disque chargé » sans bouger. Côté serveur, ajoute ton
user id (bouton « Copier mon user id ») dans le secret `DEMO_USER_IDS`.

## 4. Qualité

```bash
npm run check
```

enchaîne : copie partagée à jour (`sync:shared`), `tsc --noEmit`, `deno check`, ESLint, `deno lint`, Prettier,
Jest avec couverture (≥ 80 % sur `src/domain/`), tests Deno des Edge Functions, tests SQL des policies RLS et
des RPC, puis `npm run simulate:week`.

| Commande                             | Ce qu'elle fait                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` / `npm run test:coverage` | Tests de l'app (Jest + React Native Testing Library)                                                                                                 |
| `npm run test:functions`             | Tests Deno des Edge Functions                                                                                                                        |
| `npm run test:db`                    | Tests SQL (RLS, limites, fuseau Paris, clôture, abonnements, suppression…)                                                                           |
| `npm run simulate:week`              | Crée une team de test, injecte des séances, lance le vrai `close-week`, vérifie cartes SKIP, PR et push (mockés), rejoue pour vérifier l'idempotence |
| `npm run sync:shared`                | Recopie `src/domain/skipDraw.ts` et les ids de vannes dans `supabase/functions/_shared/generated/`                                                   |
| `npm run db:types`                   | Régénère `src/lib/database.types.ts` depuis les migrations                                                                                           |
| `npm run qa:visual <png> <route>`    | Export web + capture Playwright (routes `/dev-gallery`, `/dev-poster`, `/dev-lifter`, `/dev-paywall`)                                                |
| `node scripts/make-icons.mjs`        | Régénère l'icône, les calques Android, le splash et le favicon                                                                                       |

## 5. Déployer le backend Supabase

Le projet de production actuel : `noskip` (ref `kbxjsxmxelomyyzlzzqh`, région Paris). Pour un nouveau projet :

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push                     # applique supabase/migrations/
npx supabase functions deploy            # toutes les fonctions, verify_jwt lu dans supabase/config.toml
```

`supabase/config.toml` fixe la vérification JWT de chaque fonction :

- **avec JWT** (appelées par l'app) : `search-gyms`, `join-team`, `validate-session`, `send-spot`, `delete-account` ;
- **sans JWT, protégées par le secret de cron** (appelées par la base) : `close-week`, `midweek-check`,
  `monthly-belt`, `notify-gym-change` ;
- **sans JWT, protégée par `REVENUECAT_WEBHOOK_AUTH`** : `revenuecat-webhook`.

### Crons

Les migrations activent `pg_cron` et `pg_net` (projet hébergé) et créent 4 planifications. Les heures sont en
UTC et doublées pour couvrir l'heure d'été et d'hiver ; les fonctions vérifient elles-mêmes l'heure de Paris et
sont idempotentes.

| Planification          | Cron (UTC)      | Rôle                                                    |
| ---------------------- | --------------- | ------------------------------------------------------- |
| `noskip-close-week`    | `0 18,19 * * 0` | Dimanche 20:00 Paris : clôture, cartes SKIP, PR, séries |
| `noskip-week-recap`    | `5 18,19 * * 0` | Dimanche 20:05 : push du bilan                          |
| `noskip-midweek-check` | `0 16,17 * * *` | 18:00 chaque jour : « la barre tremble »                |
| `noskip-monthly-belt`  | `0 8,9 1 * *`   | 1er du mois 10:00 : Ceinture et Gros Canap'             |

Les appels partent de la base avec l'en-tête `x-cron-secret`. Après le premier déploiement, crée **une fois** la
configuration (SQL Editor du projet) ; le secret est généré par la base et n'est jamais exposé par l'API :

```sql
insert into app_private.cron_config (functions_url, secret)
values ('https://<ref>.supabase.co/functions/v1', encode(extensions.gen_random_bytes(32), 'hex'));
select app_private.install_cron_jobs();
```

Vérification : `select jobname, schedule from cron.job;`.

### Auth

Supabase → Authentication :

- **URL Configuration** → Redirect URLs : `noxcuse://auth-callback`.
- **Providers** → Apple : Services ID, Team ID, Key ID et clé `.p8` (Apple Developer → Certificates, IDs &
  Profiles → Keys, avec « Sign in with Apple »). Ajoute `com.noskipapp.app` dans « Client IDs ».
- **Providers** → Google : client Web (id + secret) et, dans « Client IDs », les clients iOS et Android.
- **SMTP** : le serveur d'e-mail intégré n'écrit qu'aux membres de ton organisation Supabase, quelques mails par
  heure. Avant d'inviter des potes, configure un SMTP (par exemple Resend) dans Authentication → Emails → SMTP,
  puis ajoute `{{ .Token }}` au modèle « Magic link » pour afficher aussi le code à 6 chiffres.

### Stockage

Le bucket `avatars` (lecture publique, 2 Mo max, écriture limitée au dossier `avatars/<uid>/` du joueur) est créé par les migrations.

## 6. Builds EAS

`eas.json` définit trois profils :

| Profil                  | Pour quoi                                               | Distribution                  |
| ----------------------- | ------------------------------------------------------- | ----------------------------- |
| `development`           | Development build (client de dev Expo, mode démo, logs) | interne (lien d'installation) |
| `development-simulator` | Même chose pour le simulateur iOS                       | fichier `.app`                |
| `preview`               | Version de test proche de la prod (APK Android)         | interne                       |
| `production`            | Stores (numéro de build incrémenté automatiquement)     | App Store / Play              |

Première fois :

```bash
npm i -g eas-cli
eas login
eas init                      # crée le projet Expo ; mets l'id obtenu dans EAS_PROJECT_ID
```

`.env` n'est pas envoyé aux serveurs EAS (il est ignoré par Git). Recopie les variables dans les environnements
EAS (`development`, `preview`, `production`), sur expo.dev → projet → Environment variables, ou :

```bash
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
```

(à faire pour chaque variable de la section 2 ; `GOOGLE_MAPS_ANDROID_API_KEY` en visibilité `sensitive`).

Builds :

```bash
eas build --profile development --platform all
eas build --profile preview --platform all
eas build --profile production --platform all
```

Au premier build iOS, EAS demande ton compte Apple Developer et crée le certificat, le profil de provisioning et
l'identifiant `com.noskipapp.app` (avec les capacités Sign in with Apple, Push Notifications et Associated Domains).

### Push

- **iOS** : clé APNs. `eas credentials` → iOS → Push Notifications → laisse EAS en créer une, ou fournis ta clé
  `.p8` (Apple Developer → Keys → « Apple Push Notifications service »).
- **Android** : projet Firebase → app Android `com.noskipapp.app` → `google-services.json` ; puis clé de compte de
  service FCM v1 à téléverser via `eas credentials` → Android → Google Service Account (FCM V1).

## 7. RevenueCat

1. **Stores** : crée 3 abonnements (même groupe d'abonnement sur iOS) :

   | Produit              | Prix           | Essai   |
   | -------------------- | -------------- | ------- |
   | `noskip.pro.annual`  | 59,99 €/an     | 7 jours |
   | `noskip.pro.weekly`  | 4,99 €/semaine | 3 jours |
   | `noskip.team.annual` | 149,99 €/an    | —       |

   Le serveur déduit la formule du nom (`pro` / `team`) : garde ces préfixes.

   **« Un pote paie, toute la team joue »** : un abonnement Annuel ou Hebdo (essai compris) donne aussi accès,
   gratuitement, aux autres joueurs de la première team du payeur tant qu'elle compte 4 joueurs au plus
   (`app_private.crew_sponsor`). L'offre Team couvre les teams de 5 à 8. Le Pack Duo n'est plus vendu (le
   serveur sait encore gérer un ancien produit `noskip.duo.*`).

2. **RevenueCat** : projet + apps iOS (App Store Connect API key / clé d'achat in-app) et Android (compte de
   service Google Play). Entitlement **`pro`** rattaché aux 3 produits.
3. **Offerings** :
   - offre **courante** : packages `$rc_annual` (Annuel) et `$rc_weekly` (Hebdo) ;
   - offre **`friends`** : un package pour `noskip.team.annual`.
     Les prix et formules se changent dans RevenueCat sans mise à jour de l'app ; les _Experiments_ permettent de
     tester 4,99 € contre 6,99 € la semaine (critère : revenu par installation).
4. **Webhook** : Integrations → Webhooks → URL
   `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`, en-tête Authorization = une valeur longue
   aléatoire de ton choix ; mets **la même valeur** dans le secret Supabase `REVENUECAT_WEBHOOK_AUTH`.
5. Clés SDK publiques dans `.env` et les environnements EAS (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`,
   `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`).

L'app identifie le joueur dans RevenueCat par son id Supabase, et pose l'attribut `noskip_team_id` avant un
achat Team : le webhook sait quelle team couvrir.

### Boutique (achats intégrés uniques)

Cosmétiques uniquement : rien ne s'achète pour gagner (ni séance, ni disque, ni joker).

| Produit (type : **non consommable**) | Prix conseillé | Effet                                                     |
| ------------------------------------ | -------------- | --------------------------------------------------------- |
| `noskip.shop.skin.gold`              | 1,99 €         | Disques Or sur la barre (vus par la team)                 |
| `noskip.shop.skin.carbon`            | 1,99 €         | Disques Carbone                                           |
| `noskip.shop.skin.chrome`            | 1,99 €         | Disques Chrome                                            |
| `noskip.shop.pack.foot`              | 0,99 €         | +10 vannes Foot dans le tirage des cartes SKIP de la team |
| `noskip.shop.pack.gaming`            | 0,99 €         | +10 vannes Gaming                                         |
| `noskip.shop.poster.gold`            | 2,99 €         | Carte SKIP « Édition Or » imposée aux potes qui skip      |
| `noskip.shop.poster.redcard`         | 2,99 €         | Carte SKIP « Carton Rouge »                               |
| `noskip.shop.poster.gameover`        | 2,99 €         | Carte SKIP « Game Over »                                  |
| `noskip.shop.poster.wanted`          | 2,99 €         | Carte SKIP « Avis de recherche »                          |
| `noskip.shop.poster.news`            | 2,99 €         | Carte SKIP « Alerte Info »                                |
| `noskip.shop.poster.all`             | 6,99 €         | Les 5 cartes SKIP premium                                 |

App Store Connect → ton app → **Monétisation → Achats intégrés** → **+** → **Non consommable**, avec ces
identifiants. Dans RevenueCat, ajoute les 11 produits (Product catalog → Products), **sans** les rattacher à
l'entitlement `pro` et sans offre : l'app les lit directement par leur identifiant. Le webhook enregistre
l'achat dans `shop_purchases` (un remboursement le retire).

Cartes SKIP premium : le joueur équipe une carte achetée (`equip_poster_style`). Quand un coéquipier prend une
carte SKIP, le serveur tire au hasard un style parmi ceux équipés par **les autres** joueurs de la team et le
garde sur la carte (`skip_cards.poster_style`, déclencheur `skip_cards_pick_poster_style`) : toute la team voit
la même affiche, pour toujours. Sa propre carte n'est jamais stylée par son propre achat.

## 8. Vie privée : ce qui part vers le serveur

Vérifié dans le code et par les tests :

- **Pointage** : le téléphone calcule seul s'il est dans la zone de 150 m. `start_session` envoie
  `gym_id`, `started_at`, `source` ; `validate-session` reçoit **uniquement** `gym_id`, `started_at`, `ended_at`,
  `duration_min` (son schéma zod est strict : un corps qui contient une coordonnée est refusé ; test
  `src/features/checkin/__tests__/engine.test.ts` sur le corps envoyé).
- **Stockage local** : heures et id de salle, jamais de position.
- **Recherche de salles** (`search-gyms`, seulement quand tu cherches « autour de moi ») : la position est
  arrondie à ~1 km **sur le téléphone** avant l'envoi, ré-arrondie côté serveur, utilisée pour interroger
  OpenStreetMap et **jamais enregistrée** (le cache est indexé par la position arrondie).
- **Coéquipiers** : ils ne lisent ni tes séances ni tes salles ; `team_board()` ne renvoie que des compteurs et un
  statut (« Fait », « À la salle », « Pas encore »), sans heure ni lieu. Le changement de salle est annoncé sans le
  nom de la salle.
- Pas de SDK publicitaire. PostHog n'est pas encore branché (aucune mesure envoyée).

## 9. Suppression de compte

Réglages → Supprimer mon compte → taper `SUPPRIMER`. L'Edge Function `delete-account` transmet les teams créées
au plus ancien membre restant, supprime les teams où le joueur est seul, ses photos, son journal RevenueCat,
puis l'utilisateur Auth : toutes les autres tables partent en cascade (test `95_account_deletion.test.sql`).
Le téléphone est ensuite nettoyé (zones de géolocalisation, stockage local, RevenueCat, session).
L'abonnement store n'est pas résilié automatiquement : l'écran le dit et renvoie vers la gestion d'abonnement.

## 10. Publication

Voir [`docs/STORE_CHECKLIST.md`](docs/STORE_CHECKLIST.md) : TestFlight, test interne Google Play, fiches,
déclarations de confidentialité, justification de la localisation en arrière-plan.

## Arborescence

```
src/app/              écrans (Expo Router)
src/components/       composants (barre, Canap', affiche SKIP, verre…)
src/domain/           logique métier pure, testée (semaine Paris, barre, séries, niveaux, ceinture…)
src/features/         accès aux données et effets (auth, checkin, teams, weeks, subscriptions…)
content/              vannes du Canap', textes légaux
supabase/migrations/  schéma, RLS, RPC, crons
supabase/functions/   Edge Functions (Deno) + tests
supabase/tests/       tests SQL
scripts/              tests DB locaux, simulation de semaine, QA visuelle, icônes
design/               maquettes V3 et captures de contrôle
```
