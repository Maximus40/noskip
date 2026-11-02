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

**Phase en cours : 3 — Auth + onboarding** (phases 1 et 2 terminées).

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
