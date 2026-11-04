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

**Phase en cours : 7 — Domaine semaine** (phases 1 à 6 terminées côté code ; à tester sur téléphone : magic link, recherche de salles, teams, pointage réel, barre, spot).

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

### Phase 4 — Teams ✅ (à tester sur téléphone)
- Migration `…000600_teams_join_and_manage.sql` : `app_private.team_capacity` (4, ou 8 avec une `team_subscriptions` active), `normalize_invite_code`, `team_preview`, `join_team_by_code` (verrou `FOR UPDATE` sur la team : pas de dépassement de capacité en cas de clics simultanés, idempotent, 3 teams max) ; wrappers `svc_team_preview` / `svc_join_team` exécutables **uniquement** par le service role ; RPC créateur `rename_team`, `regenerate_invite_code` (les anciens liens cessent de marcher), `remove_member` ; `accept_all_team_rules` (étape 8).
- Edge Function `join-team` (aperçu ou rejoindre ; l'id du joueur vient du JWT, jamais du corps ; erreurs `invalid_invite_code` 404, `team_full` / `max_teams_reached` 409). 5 tests Deno. Déployée.
- Tests SQL `40_teams_join.test.sql` (20) : wrappers interdits aux joueurs, code en minuscules/tirets accepté, idempotence, plafond 4 puis 8 avec l'offre Team puis retour à 4 à l'expiration, couleurs de disque distinctes, outils créateur, rotation du code.
- `src/domain/teams.ts` (testé) : normalisation/extraction du code depuis un lien collé, format `ABCD-2345`, lien d'invitation (`https://<EXPO_PUBLIC_INVITE_HOST>/join/<code>` si un domaine est configuré, sinon `noskip://join/<code>`), message de partage, validations.
- Écrans : étape 6 « Avec qui tu soulèves ? » (créer → carte d'invitation + partage natif ; rejoindre → aperçu de la team), étape 8 règles (case à cocher obligatoire), `join/[code]` (deep link : sans compte, le code est mémorisé et la team est rejointe automatiquement à l'étape 6 ; avec compte, aperçu + règles + rejoindre), onglet « Mes teams », `team-new` (créer ou rejoindre depuis l'app), `team-manage/[id]` (inviter, joueurs, signaler, exclure, renommer, changer le code, quitter, supprimer).
- Écran magic link : le lien passe en premier, le code à 6 chiffres est une option (le modèle d'e-mail n'est pas modifiable sans SMTP personnalisé).
- Liens universels : `app.config.ts` ajoute `associatedDomains` (iOS) et `intentFilters` autoVerify (Android) dès que `EXPO_PUBLIC_INVITE_HOST` est défini. **Il faudra un domaine** qui sert `/.well-known/apple-app-site-association` et `/.well-known/assetlinks.json`, et une page web `/join/<code>` de repli. En attendant, les invitations partent en `noskip://join/<code>` + code lisible (les liens `noskip://` ne sont pas cliquables dans toutes les messageries, d'où le code affiché).

### Phase 5 — Pointage ✅ (à tester sur téléphone, development build obligatoire)
- **Anti-triche serveur** (migration `…000700_session_validation.sql`) : colonne `sessions.server_opened_at` posée par trigger à l'ouverture (et à la réouverture), non modifiable par le joueur. `app_private.validate_session` calcule la durée depuis `max(started_at, server_opened_at − 5 min)` : un départ antidaté par le téléphone ne sert à rien, il faut que le **serveur** ait vu la séance ouverte depuis ≥ 40 min. Fin future ramenée à `now()`, durée plafonnée à 360 min, salle = celle de la séance et du joueur, une séance validée par jour, `lifetime_sessions` incrémenté. Wrappers service role : `svc_validate_session`, `svc_teammate_push_targets` (coéquipiers + préférence de notif), `svc_delete_push_tokens`. RPC joueur : `my_open_session`.
- Tests SQL `50_session_validation.test.sql` (17) : départ antidaté refusé, 30 min refusé, 47 min validé (52 avec la tolérance), fin future bornée, mauvaise salle, pas de séance ouverte, 1/jour, réouverture qui remet l'horloge à zéro, joueur qui ne peut pas toucher l'horloge, mode démo.
- Edge Function `validate-session` (déployée) : zod strict (toute coordonnée dans le corps = 400), id joueur depuis le JWT, erreurs stables (`session_too_short` 422, `no_open_session` / `already_validated_today` 409, `gym_mismatch` 403), push « {pseudo} vient de charger 20 kg 💪 » aux coéquipiers (préférence `plate_loaded`), suppression des jetons `DeviceNotRegistered`, un échec de push n'annule jamais la validation. `_shared/push.ts` (Expo Push API, lots de 100, ne lève jamais d'exception). 9 tests Deno + 2 pour le push.
- **Mode démo** : accepté par le serveur seulement pour les ids listés dans le secret `DEMO_USER_IDS` de la fonction (non défini = démo refusée, ce qui est le cas actuellement). Pour l'activer sur un projet de dev : Dashboard → Edge Functions → Secrets → `DEMO_USER_IDS=<ton user id>` (le bouton « Copier mon user id » est dans l'écran Mode démo).
- App : `src/domain/checkin.ts` (testé : entrée/sortie, ≥ 40 min, reprise sans événement de sortie = valider seulement si encore dans la zone, visite > 18 h abandonnée, fixes simulés/imprécis rejetés, tolérance d'imprécision ≤ 50 m, chrono, anneau → 45:00, régions de 150 m, 3 max).
- `src/features/checkin/` : `engine.ts` (effets : `start_session` à l'arrivée, rejet des positions `mocked` signalées par l'OS, mode hors ligne avec reprise, `validate-session` avec **uniquement** gym_id / started_at / ended_at / duration_min — vérifié par test, annulation sinon), `tasks.ts` (tâche de geofencing + tâche de fond `expo-background-task` toutes les ~30 min pour le cas « app tuée »), `storage.ts` / `gymCache.ts` (état local : heures + id de salle, jamais de position), `useCheckin.ts` (synchro des zones et reprise à chaque retour au premier plan, affichage de « Disque chargé » une fois par validation, plan B). 9 tests de l'engine.
- Écrans : étape 7 localisation (explication puis « pendant l'utilisation » puis « toujours » ; si refus « toujours » → plan B expliqué ; lien vers les réglages), « Séance en cours » (chrono, anneau animé vers 45:00, plan B : « Je suis à la salle » puis « Valider ma séance » ≥ 40 min avec seconde vérification de position, annulation), mode démo (`/dev`, `__DEV__` uniquement : entrée −45 min, entrée maintenant, sortie, réinitialiser).
- `app.config.ts` : `isAndroidBackgroundLocationEnabled: true` ; iOS sans mode de fond continu (le geofencing iOS ne demande que l'autorisation « Toujours »).
- **Limites connues** : le geofencing ne marche que dans un development build (pas Expo Go) et doit être testé en vrai ; l'écran « Disque chargé » reçoit durée / disques / objectif mais son design arrive en phase 6 ; l'onglet « Ma team » est encore un squelette avec un accès à « Séance en cours ».

### Phase 6 — Barre de la team ✅ (contrôle visuel fait en web, à refaire sur simulateur)
- `src/domain/bar.ts` (testé) : 1 disque par séance validée (20 kg, dessiné en 2 × 10 kg de part et d'autre), potes près de la butée, toi en orange à l'extérieur, épaisseur adaptée jusqu'à 8 joueurs, kilos au format français, PR de la team (tout le monde a atteint son objectif), barre perso (20 kg + 2,5 kg / séance), libellés, règle « peut être spotté ».
- `src/domain/week.ts` (testé) : semaine Europe/Paris côté app (lundi 00:00 → dimanche 20:00, été/hiver), jours restants, `weekRisk` : `achieved` / `safe` / `shaky` (« la barre tremble » : il faut y aller tous les jours restants) / `lost` ; le joker protège.
- Composants : `Canap` (SVG repris des maquettes, 4 humeurs animées avec Reanimated : respiration + clignement, ricanement + miettes, bouderie + chips tombées, écrasé + nuage de craie ; poses fixes si « Réduire les animations » ; emplacement prévu pour un futur Rive/Lottie), `TeamBar` (géométrie de `V3-Disque.html`, disque qui glisse avec rebond, barre qui vacille), `MapBackdrop` (iOS : Apple Plans sombre ; Android : Google Maps stylé si `GOOGLE_MAPS_ANDROID_API_KEY` est fourni, sinon quartier dessiné ; point orange de la salle qui pulse ; jamais la position en direct), `CountUp`, `RoundGlassButton` (50 / 70 px), `PlayerRow`, `ProgressRing`.
- Écrans : **Ma team** (carte + verre : choix de la team, kilos qui défilent, barre, « X risque le skip », PR avec Canap' écrasé, série duo en grand, joueurs avec statut « Fait / À la salle / Pas encore », bouton Spot, état vide « Barre vide. Le Canap' adore. », squelettes en verre, tirer pour rafraîchir, boutons ronds Historique / Séance), **Disque chargé** (fidèle à `V3-Disque.html` : +20 KG., ligne « Ton 3e disque… », VOIR LA BARRE, 3 chiffres, barre avec le nouveau disque, Canap' qui boude), **Séance en cours** passée en verre sur carte.
- Son et haptique (`src/features/feedback`) : `expo-audio` (expo-av n'existe plus en SDK 58), clang + haptique lourd au disque chargé, craie au PR, ricanement au skip ; respecte `sound_enabled` / `haptics_enabled`. Sons **synthétisés provisoires** dans `assets/sounds/` (`plate-clang.wav`, `chalk-clap.wav`, `canap-snicker.wav`) : **à remplacer par de vrais sons**.
- Spot : migration `…000800_spots.sql` (`app_private.send_spot` : 3 envois/jour, 1/jour vers la même personne, pas après sa séance, pas sur un joker, verrou consultatif contre les envois simultanés ; `my_spots_today`), Edge Function `send-spot` (push « {pseudo} te spot : bouge à la salle ! », préférence `spot`). 13 tests SQL, 4 tests Deno. Déployés.
- Contrôle visuel : pas de simulateur dans la session cloud → `npm run qa:visual` exporte l'app en web (mode dev) et capture la page `/dev-gallery` (dev uniquement, données d'exemple) avec Playwright. Capture : `design/qa/phase6-gallery.png`. Correction faite après revue : la ligne d'un joueur à risque passait sur 2 lignes → « Risque le skip » remplace le statut. **À refaire sur simulateur iOS / émulateur Android** (le flou du verre n'existe pas en web).

### Projet Supabase (production / test)
- Projet `noskip`, ref `kbxjsxmxelomyyzlzzqh`, région `eu-west-3` (Paris), plan gratuit. Créé via le MCP le 3/11/2026 ; le projet `voltaio` a été mis en pause pour libérer la place (limite de 2 projets gratuits actifs).
- Migrations appliquées : core_schema, client_rpcs, gym_search_cache_and_avatars, pin_search_paths, pin_require_uid, teams_join_and_manage, session_validation, spots.
- Edge Functions déployées : `search-gyms` (v1), `join-team` (v1), `validate-session` (v1), `send-spot` (v1), toutes en verify_jwt. Secrets optionnels : `DEMO_USER_IDS` (dev seulement), `EXPO_ACCESS_TOKEN` (si la sécurité push renforcée d'Expo est activée). Les secrets `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase.
- `.env` local rempli (URL + anon key, non commité).
- Vérifié en SQL sur le projet : anon n'a aucun droit, `authenticated` ne peut ni valider une séance, ni écrire skip_cards / subscriptions, ni lire le cache ; 0 table sans RLS ; bucket `avatars` présent ; semaine de jeu correcte (Paris).
- Conseiller sécurité Supabase : restent 11 « SECURITY DEFINER exécutables par authenticated » (voulu : ce sont les RPC client, chacune vérifie `auth.uid()`) et 1 info « gym_search_cache sans policy » (voulu : service role uniquement).
- La session cloud ne peut pas joindre `*.supabase.co` (proxy) : les tests HTTP réels se font depuis le téléphone ou ta machine.
- Redirect URL `noskip://auth-callback` ajoutée par toi ✅.
- E-mails : le serveur intégré de Supabase (plan gratuit) n'envoie qu'aux membres de l'organisation, quelques mails par heure, modèles non modifiables. **Avant d'inviter des potes : configurer un SMTP personnalisé (ex. Resend)**, puis ajouter `{{ .Token }}` au modèle « Magic link or OTP ».

### Notes d'environnement (session cloud)
- Le proxy réseau bloque api.expo.dev, GitHub (hors git), Google Fonts, docs.expo.dev, Overpass et les couches d'images Docker : utiliser `EXPO_OFFLINE=1 npx expo install <pkg>`. Seul le registre npm est joignable. `supabase start` impossible ici → PostgreSQL 16 local (voir ci-dessus).
- API à vérifier dans les `.d.ts` locaux (Expo 58 a changé) : `Tabs` vient de `expo-router/js-tabs` ; `BottomTabBarProps` expose `navigateToTab(routeKey)`.
- Dépôt : https://github.com/Maximus40/noskip (branche `main`).

### Design (`design/`)
- Reçus : `README.md`, `html/Canap-repos|skip|disque|pr.html`, `html/V3-Disque.html`.
- **Non disponibles** (confirmé par toi) : `V3-Team`, `V3-Seance`, `V3-Skip`, `V3-Paywall`. Ces écrans suivent la direction artistique écrite du §3.

### Reste à faire
- Phases 3 à 12.
- pg_cron / pg_net : non disponibles en local, les planifications seront écrites en phase 7 de façon conditionnelle (activées sur le projet Supabase réel).
- Icône et splash NoSkip : assets du template Expo encore en place.
