# PROMPT CLAUDE CODE — NoSkip (app de motivation muscu entre potes)

> Colle tout ce fichier dans Claude Code, à la racine d'un dossier vide.
> Claude Code doit d'abord le sauvegarder en `CLAUDE.md`, puis travailler phase par phase.

---

## 0. Ta mission

Tu es le développeur principal de **NoSkip**, une app mobile iOS + Android qui motive à aller à la salle de muscu grâce à un groupe de potes (la « team »).

Principe : chaque joueur fixe un objectif de séances par semaine. L'app détecte automatiquement quand il est à sa salle (géolocalisation, ≥ 40 min sur place). Chaque séance validée **charge un disque sur la barre de la team**. Si un joueur rate son objectif de la semaine, une **carte SKIP** moqueuse (signée par la mascotte « le Canap' ») est envoyée à toute la team. Les potes peuvent te **« spot »** (relancer) avant la deadline.

Objectif : une app **100 % fonctionnelle de bout en bout**, testée, prête à être publiée sur TestFlight et Google Play (test interne).

### Règles de travail (obligatoires)
1. Sauvegarde ce prompt dans `CLAUDE.md` à la racine, et tiens à jour une section `## Avancement

**Phase en cours : 3 — code terminé, projet Supabase en ligne ; reste à tester sur téléphone (magic link, recherche de salles)** (phases 1 et 2 terminées). Phase suivante : 4 — Teams.

### Phase 1 — Socle ✅
- Expo SDK 58 (RN 0.88, React 19.3, TS 6 strict), Expo Router (routes dans `src/app/`), React Compiler activé.
- `npm run check` = `tsc --noEmit` + `expo lint` (ESLint flat + Prettier) + `prettier --check` + Jest avec couverture (seuil 80 % sur `src/domain/`) + tests SQL (`npm run test:db`).
- Jest : preset `jest-expo`, resolver Reanimated + `setUpTests()`, RNTL v14 (API **asynchrone** : `await render(...)`, `await fireEvent.press(...)`).
- Thème : `src/theme/tokens.ts` (couleurs, rayons, espacements), `src/theme/typography.ts` (variantes de texte).
- Police Archivo : instances statiques générées depuis la police variable (fontsource, wght 100–900 / wdth 62–125) → `assets/fonts/` : Regular, Medium, SemiBold, Bold, Black (largeur 100) + ExpandedBold, ExpandedExtraBold (largeur 125). Licence OFL dans `assets/fonts/OFL.txt`.
- Composants de base : `Text`, `Screen`, `GlassPanel`, `PressableScale` (respecte « Réduire les animations »), `Button` (orange, texte encre `#0E0E0F` car blanc sur orange < 4,5:1), barre d'onglets en verre flottante, icônes SVG.
- Navigation : tous les écrans existent sous forme de squelette (`ScreenShell`, à supprimer au fil des phases) :
  - onboarding `(onboarding)/` : hook, sign-in, gym, goal, lifter-card, team-setup, location, rules, notifications → `/paywall` (étape 10) ;
  - onglets `(app)/` : team (Ma team), teams, lifter, settings ;
  - pile : session, plate-loaded, skip/[id], recap/[weekId], history, paywall, join/[code], my-data, privacy, terms, dev (`__DEV__` uniquement).

### Phase 2 — Base de données ✅
- Migrations `supabase/migrations/` :
  - `…000100_core_schema.sql` : enums, helpers de temps Europe/Paris (`app_private.paris_date`, `game_week_start` — semaine lundi 00:00 → dimanche 20:00, `week_deadline`), les 16 tables du §4 + `member_reports` (signalement), RLS partout, privilèges par colonne.
  - `…000200_client_rpcs.sql` : RPC SECURITY DEFINER pour toutes les écritures client : `set_weekly_goal` (immédiat sans historique, sinon lundi suivant via `pending_weekly_goal`), `choose_gym` / `remove_gym` (salles OSM uniquement, 3 max, principale changeable 1×/30 j), `create_team` (code 8 caractères sans ambiguïté, 3 teams max), `accept_team_rules`, `leave_team` (transfert au plus ancien), `delete_team`, `start_session` / `cancel_session`, `team_board` (statuts agrégés), `increment_skip_share`.
- Choix de vie privée : les coéquipiers ne lisent **ni** `sessions` **ni** `user_gyms` ; ils passent par `team_board()` qui ne renvoie que compteurs + statut (`done` / `at_gym` / `not_yet`), sans heure ni lieu.
- Écritures sensibles (`sessions.validated_at`, `weeks`, `week_results`, `skip_cards`, `belts`, `subscriptions`, `team_subscriptions`, `spots`, `team_members` insert) : **service role uniquement**. Une séance validée exige `duration_min ≥ 40` (contrainte CHECK, même pour le service role). `week_start` d'une séance = semaine de jeu de sa validation.
- Profil créé automatiquement par trigger sur `auth.users` ; suppression en cascade de toutes les données à la suppression du compte.
- Tests SQL `supabase/tests/database/*.test.sql` (74 assertions, sans pgTAP) : un joueur ne lit pas une team dont il n'est pas membre, ne peut pas valider une séance, ne peut écrire aucune table sensible, anon ne voit rien, limites salles/teams, fuseau Paris (hiver/été). Vérifié par mutation : ajouter `grant update on sessions to authenticated` fait échouer la suite.
- `scripts/db-test.sh` : sans Docker, démarre un PostgreSQL local jetable + `supabase/tests/local/supabase-shim.sql` (rôles anon/authenticated/service_role, `auth.users`, `auth.uid()`, grants par défaut de Supabase). Avec `DB_URL=…` il tourne contre un vrai `supabase start` (après `supabase db reset`).
- Types : `npm run db:types` → `scripts/gen-db-types.mjs` génère `src/lib/database.types.ts` (format `supabase gen types`). Avec un projet Supabase réel, `npx supabase gen types typescript --project-id <id>` produit l'équivalent.

### Phase 3 — Auth + onboarding (code ✅, intégration à valider)
- `app.config.ts` (remplace `app.json`) : Sign in with Apple activé, permissions localisation / photos en français, plugin Google Sign-In ajouté **uniquement** si `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` est défini.
- `src/lib/` : `env.ts` (zod), `supabase.ts` (client typé, AsyncStorage, PKCE, refresh au premier plan), `errors.ts` (codes RPC / Edge Functions / Auth → messages français), `queryClient.ts`.
- `src/features/auth/` : `AuthProvider` (session), `signIn.ts` (Apple natif avec nonce, Google natif, magic link + code à 6 chiffres, échange PKCE `noskip://auth-callback`).
- `src/features/profile/api.ts` : profil, mise à jour, objectif (`set_weekly_goal`), salles (`choose_gym`), nombre de teams, droit Pro (lecture serveur), upload d'avatar (bucket `avatars/<uid>/…`).
- `src/features/gyms/api.ts` + Edge Function `search-gyms` : recherche « autour de moi » ou par nom, Overpass `leisure=fitness_centre`, cache 7 j (`gym_search_cache`, migration `…000300`), position arrondie à ~1 km **avant** l'envoi et re-arrondie côté serveur, jamais stockée. Tests Deno (13) : validation zod, auth, arrondi, cache, erreurs Overpass, parsing.
- `src/domain/onboarding.ts` : ordre des 10 étapes et routage (`nextOnboardingRoute`), testé. La porte `src/app/index.tsx` redirige vers la prochaine étape, le paywall (sans droit `pro`) ou `/team`.
- Écrans réels : accroche (2 sélecteurs + verdict), connexion, retour du magic link, salle (liste triée par distance calculée sur le téléphone, squelettes, état vide), objectif (2–5), carte de lifter (pseudo, photo optionnelle, titre). Les étapes 6 à 10 restent des squelettes (phases 4, 5, 9, 10).
- Tests : domaine (onboarding, géo, profil), erreurs, env, écran d'accroche (RNTL).
- Outillage : Deno 2.9 en devDependency npm (`npm run test:functions`, `typecheck:functions`, `lint:functions`), imports `npm:` (jsr/esm.sh bloqués ici).
- **À valider avec un vrai projet Supabase** : envoi du magic link, `search-gyms` déployée (Overpass injoignable depuis cette session), bucket avatars.
- **Apple / Google** : code prêt, à brancher avec les identifiants (Supabase → Auth → Providers ; `.env` pour Google).
- Carte « autour de moi » : la liste est en place ; la carte visuelle (react-native-maps) arrive en phase 6 (Android demandera une clé Google Maps).

### Projet Supabase (production / test)
- Projet `noskip`, ref `kbxjsxmxelomyyzlzzqh`, région `eu-west-3` (Paris), plan gratuit. Créé via le MCP le 3/11/2026 ; le projet `voltaio` a été mis en pause pour libérer la place (limite de 2 projets gratuits actifs).
- Migrations appliquées : core_schema, client_rpcs, gym_search_cache_and_avatars, pin_search_paths, pin_require_uid.
- Edge Function déployée : `search-gyms` (v1, verify_jwt). Les secrets `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase.
- `.env` local rempli (URL + anon key, non commité).
- Vérifié en SQL sur le projet : anon n'a aucun droit, `authenticated` ne peut ni valider une séance, ni écrire skip_cards / subscriptions, ni lire le cache ; 0 table sans RLS ; bucket `avatars` présent ; semaine de jeu correcte (Paris).
- Conseiller sécurité Supabase : restent 11 « SECURITY DEFINER exécutables par authenticated » (voulu : ce sont les RPC client, chacune vérifie `auth.uid()`) et 1 info « gym_search_cache sans policy » (voulu : service role uniquement).
- La session cloud ne peut pas joindre `*.supabase.co` (proxy) : les tests HTTP réels se font depuis le téléphone ou ta machine.
- **À faire de ton côté** dans le dashboard Auth → URL Configuration : ajouter `noskip://auth-callback` aux Redirect URLs (sinon le magic link renvoie vers le site par défaut). Le code à 6 chiffres demande d'ajouter `{{ .Token }}` au modèle d'e-mail « Magic Link ».

### Notes d'environnement (session cloud)
- Le proxy réseau bloque api.expo.dev, GitHub (hors git), Google Fonts, docs.expo.dev, Overpass et les couches d'images Docker : utiliser `EXPO_OFFLINE=1 npx expo install <pkg>`. Seul le registre npm est joignable. `supabase start` impossible ici → PostgreSQL 16 local (voir ci-dessus).
- API à vérifier dans les `.d.ts` locaux (Expo 58 a changé) : `Tabs` vient de `expo-router/js-tabs` ; `BottomTabBarProps` expose `navigateToTab(routeKey)`.
- Dépôt : https://github.com/Maximus40/noskip (branche `main`).

### Design (`design/`)
- Reçus : `README.md`, `html/Canap-repos|skip|disque|pr.html`, `html/V3-Disque.html`.
- **Manquants** : `V3-Team`, `V3-Seance`, `V3-Skip`, `V3-Paywall` (HTML + PNG) et tous les PNG (`design/png/` vide ; les captures ont été vues dans le chat mais pas reçues en fichiers).

### Reste à faire
- Phases 3 à 12.
- pg_cron / pg_net : non disponibles en local, les planifications seront écrites en phase 7 de façon conditionnelle (activées sur le projet Supabase réel).
- Icône et splash NoSkip : assets du template Expo encore en place.
