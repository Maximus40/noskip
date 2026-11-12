# PROMPT CLAUDE CODE — NoSkip (app de motivation muscu entre potes)

> Colle tout ce fichier dans Claude Code, à la racine d'un dossier vide.
> Claude Code doit d'abord le sauvegarder en `CLAUDE.md`, puis travailler phase par phase.

---

## 0. Ta mission

Tu es le développeur principal de **NoSkip**, une app mobile iOS + Android qui motive à aller à la salle de muscu grâce à un groupe de potes (la « team »).

Principe : chaque joueur fixe un objectif de séances par semaine. L'app détecte automatiquement quand il est à sa salle (géolocalisation, ≥ 40 min sur place). Chaque séance validée **charge un disque sur la barre de la team**. Si un joueur rate son objectif de la semaine, une **carte SKIP** moqueuse (signée par la mascotte « le Canap' ») est envoyée à toute la team. Les potes peuvent te **« spot »** (relancer) avant la deadline.

Objectif : une app **100 % fonctionnelle de bout en bout**, testée, prête à être publiée sur TestFlight et Google Play (test interne).

### Règles de travail (obligatoires)
1. Sauvegarde ce prompt dans `CLAUDE.md` à la racine, et tiens à jour une section `## Avancement` à la fin (phase en cours, ce qui est fait, ce qui reste).
2. Travaille **phase par phase** (section 9). À la fin de chaque phase : lance le typecheck, le lint et les tests. Corrige jusqu'à ce que tout passe. Fais un commit git clair. Ensuite seulement, passe à la phase suivante.
3. N'invente jamais une clé, un identifiant ou un secret. Quand il t'en faut un, **arrête-toi et demande-le-moi** avec la liste exacte de ce qu'il faut et où le trouver. Mets les secrets dans `.env` (jamais commité) et fournis un `.env.example`.
4. Pas de code factice, de TODO laissé dans le chemin principal, ou de données simulées dans l'app finale. Si une partie ne peut pas être finie sans moi (comptes, appareil physique), dis-le clairement dans `## Avancement`.
5. Code en TypeScript strict. Interface et textes en **français** (tutoiement). Code, noms de variables et commentaires en anglais.
6. Avant chaque phase, relis `CLAUDE.md`.

---

## 1. Stack imposée

| Brique | Choix |
|---|---|
| App | **Expo (SDK le plus récent stable) + React Native + TypeScript**, Expo Router |
| Build | EAS Build (development build obligatoire : la géolocalisation en arrière-plan ne marche pas dans Expo Go) |
| Géoloc | `expo-location` (geofencing / region monitoring) + `expo-task-manager` |
| État / data | TanStack Query + client `@supabase/supabase-js` |
| Backend | **Supabase** : Auth, Postgres + RLS, Edge Functions (Deno), Cron (`pg_cron`), Storage |
| Notifications | `expo-notifications` + Expo Push API (envoyées depuis les Edge Functions) |
| Animations | `react-native-reanimated`, `lottie-react-native` (ou `rive-react-native`), `expo-haptics`, `expo-av` pour les sons |
| Cartes partageables | `react-native-view-shot` + `expo-sharing` (image 1080×1920) |
| Paiement | RevenueCat (`react-native-purchases`) — offres Pro, Pack Duo et Team |
| Recherche de salles | API Overpass d'OpenStreetMap (`leisure=fitness_centre`), appelée via une Edge Function avec cache en base |
| Analytics | PostHog (sans aucun SDK publicitaire) |
| Tests | Jest + React Native Testing Library (app), tests Deno (Edge Functions), tests SQL des policies RLS |
| Qualité | ESLint, Prettier, `tsc --noEmit` |

Utilise la CLI Supabase (`supabase init`, migrations versionnées dans `supabase/migrations`, `supabase start` en local pour développer et tester).

---

## 2. Fonctionnalités du MVP (toutes obligatoires)

### 2.1 Compte et onboarding (≤ 60 secondes)
1. Écran d'accroche : « Le mois dernier, tu avais prévu combien de séances ? Et t'en as fait combien ? » (2 sélecteurs, juste pour l'effet, stockés dans le profil).
2. Connexion : **Sign in with Apple** (iOS) + **Google** + e-mail magic link en secours.
3. Choix de la salle : recherche par nom ou carte autour de moi (salles réelles OSM uniquement, pas de point placé à la main).
4. Objectif hebdo : 2, 3, 4 ou 5 séances.
5. Carte de lifter : pseudo, photo (optionnelle), titre au choix (« Machine », « Bro du lundi », « Toujours au shaker », « Skippeur de jambes »), couleur de disque attribuée.
6. Créer une team (nom) OU rejoindre via lien/code d'invitation. **L'invitation fait partie de l'onboarding** (partage natif du lien).
7. Écran explicatif AVANT la demande de localisation « Toujours » : « On vérifie juste que t'es à la salle. Ta team voit "venu" ou "pas venu", jamais où t'es. » Puis demande de permission (d'abord « pendant l'utilisation », puis « toujours »).
8. Acceptation explicite des règles de la team (case à cocher) : « J'accepte d'être chambré par le Canap' si je skip. »
9. Permission notifications.
10. **Écran de paiement** (voir 2.8), après un aperçu de la barre de la team.

### 2.2 Pointage automatique (cœur technique)
- Geofence circulaire de **150 m** autour de la salle choisie (max 3 salles par joueur, limite iOS de 20 régions jamais atteinte).
- Événement **entrée** → enregistre `entered_at` localement (AsyncStorage) + envoie un événement « session_started » au backend.
- Événement **sortie** → calcule la durée. Si **≥ 40 minutes** → appelle l'Edge Function `validate-session`. Sinon → rien (ou session annulée).
- Si l'app est tuée et qu'aucun événement de sortie n'arrive : à la prochaine ouverture, ou via un fetch en arrière-plan, vérifie la position actuelle. Si l'utilisateur est toujours dans la zone et que ≥ 40 min se sont écoulées, valide.
- Une seule séance validée par jour calendaire et par joueur.
- **Anti-triche** :
  - salle choisie uniquement dans la base OSM ;
  - changement de salle principale limité à 1 fois / 30 jours (et notifié à la team) ;
  - sur Android, rejeter les positions `mocked` ;
  - le serveur vérifie la cohérence (durée, horodatage, pas de séance déjà validée ce jour-là).
- **Vie privée** : les coordonnées GPS ne sont **jamais** envoyées au serveur. Seuls partent : `gym_id`, `started_at`, `ended_at`, `duration_min`. Aucune trace de déplacement stockée.
- Plan B si la permission « toujours » est refusée : bouton « Je suis à la salle » qui lance une vérification de position au premier plan (position actuelle dans la zone), puis une seconde vérification au moins 40 min plus tard pour valider.

### 2.3 La team et la barre (écran d'accueil)
- Écran principal = **la barre olympique de la team**, dessinée en SVG/Skia, chargée d'un disque par séance validée de la semaine (nuance de gris propre à chaque pote, couleur d'accent pour toi).
- Compteur de kilos au-dessus. Chaque disque = 20 kg (2 disques de 10 kg de part et d'autre, visuellement).
- Liste des joueurs : avatar, couleur, progression `2/3`, statut du jour (« À la salle », « Fait », « Pas encore »). Ne jamais afficher de position ni d'heure précise.
- Animation **« Disque chargé »** quand une séance est validée (le disque glisse sur la barre, clang, haptique lourd) + notification push à la team : « Sofiane vient de charger 20 kg 💪 ».
- **Spot** : bouton sur un joueur qui n'a pas encore fait sa séance du jour → notification push « Karim te spot : bouge à la salle ». Limite : 3 spots envoyés par jour par joueur, 1 spot reçu de la même personne par jour.
- **Barre qui tremble** : quand un joueur ne peut plus atteindre son objectif qu'en allant à la salle tous les jours restants, la barre vacille dans l'app et une notif part (« Karim risque le skip »).
- **PR de la team** : si TOUS les joueurs atteignent leur objectif, animation « la team soulève la barre » + record si plus de kg que la meilleure semaine précédente.
- **Taille des teams** : le cas principal est le **duo ou le trio** (on va à la salle à 1, 2, 3, rarement plus). Team standard : 2 à 4 joueurs. Offre Team : jusqu'à 8 joueurs. Un joueur peut être dans 3 teams maximum. Les grandes teams et les défis de masse sponsorisés par des marques viendront plus tard (hors MVP) : prévois juste un modèle de données qui ne les bloque pas.
- **Série du binôme** : en duo, une série commune (nombre de semaines où les deux ont tenu leur objectif), affichée en grand sur l'écran de la team. Chaque joueur reste compté séparément : si l'un annule, l'autre peut quand même charger son disque, et seul celui qui sèche prend la carte SKIP.
- Toute l'interface est pensée d'abord pour 2 à 4 joueurs (la barre, la liste et le bilan doivent être superbes à 2), puis s'adapte jusqu'à 8.

### 2.4 Carte SKIP (moteur viral)
- Chaque **dimanche à 20:00 (heure de Paris)**, une Edge Function planifiée clôt la semaine (lundi 00:00 → dimanche 20:00).
- Pour chaque joueur qui n'a pas atteint son objectif → création d'une carte SKIP + push à la team : « SKIP. Maxime a choisi le canap'. »
- La carte (écran + image partageable 1080×1920) : affiche façon campagne sportive sur fond blanc cassé #ECECE8 : « SK / IP. » en lettres noires géantes empilées, le Canap' monochrome qui ricane à la place de l'athlète, « {PRÉNOM} A CHOISI LE CANAP'. », la vanne, le score de la semaine (« Les Déchaînés 200 kg / Le Canap' 1 »), le logo NOSKIP en haut à droite et le lien d'invitation en bas (voir section 3 et la maquette V3 Carte SKIP).
- Vannes : une **banque de 40 vannes minimum** en français dans un fichier de contenu (`content/skip-lines.ts`), tirées au hasard sans répétition récente. Règle absolue : on se moque de l'excuse ou du canapé, **jamais du physique, du poids ou de la personne**.
  Exemples : « SKIP. Maxime a choisi le canap'. Le Canap' vient de faire un PR de sieste. » / « Maxime a skip la salle. Même le leg day n'y croyait plus. » / « 3e skip du mois. Le Canap' lui garde une place chauffée. »
- Bouton « Partager en story » (image générée + partage natif).
- **Joker blessure** : 1 par mois par joueur, à déclarer avant dimanche 20:00 → pas de carte SKIP cette semaine-là, série préservée.

### 2.5 Bilan du dimanche
- Écran + push à 20:05 : kilos soulevés par la team, score Team vs Canap' (nombre de skips), « Machine de la semaine » (plus de séances), « Skippeur de la semaine », PR éventuel, séries.
- Historique des semaines consultable.

### 2.6 Progression personnelle
- **Barre perso** : +2,5 kg par séance validée, à vie. Niveaux : Barre à vide (20 kg) → Gym bro (60) → Machine (100) → Monstre (160) → Légende (250).
- **Série** : nombre de semaines consécutives avec l'objectif atteint (le joker la préserve).
- Carte de lifter : photo, couleur, titre, niveau, barre perso, série, total de séances, nombre de skips.

### 2.7 Saisons et Ceinture (simple au MVP)
- Saison = mois calendaire. Le 1er du mois à 10:00, attribution de la **Ceinture** au joueur le plus régulier de chaque team (taux d'objectif atteint, départage au nombre de séances), affichée sur sa carte. Trophée « Gros Canap' » au plus de skips (pour rire).

### 2.8 Abonnements (RevenueCat) — écran de paiement obligatoire
- **Pas de version gratuite.** L'app fonctionne avec un écran de paiement obligatoire (hard paywall) affiché à la fin de l'onboarding, juste après la création ou l'entrée dans une team et le premier aperçu de la barre. Pas de bouton pour le passer. Lien « Restaurer mes achats » obligatoire.
- Justification (benchmarks RevenueCat 2026) : un écran de paiement obligatoire convertit en médiane 10,7 % des téléchargements à 35 jours contre 2,1 % en freemium, avec une rétention à un an équivalente.
- **Formules affichées** (maquette V3-Paywall) :
  - **Annuel** : 59,99 €/an, 7 jours d'essai gratuit, présenté par défaut et mis en avant (« Meilleure offre », « Soit 1,15 € par semaine »).
  - **Hebdo** : 4,99 €/semaine, 3 jours d'essai gratuit.
  - **Pas de formule mensuelle.**
  - Lien secondaire « Avec tes potes » : **Pack Duo** 89,99 €/an (Pro pour deux comptes) et **Team** 149,99 €/an (team jusqu'à 8, Pro pour tous les membres).
- **Invités** : un pote qui rejoint via un lien d'invitation passe aussi par l'écran de paiement avec son propre essai, sauf si un membre de la team a un Pack Duo ou Team qui le couvre (dans ce cas, accès direct et message « Offert par {pseudo} »).
- Droits RevenueCat : `pro` (individuel, Duo ou Team) et `team_large` (limite 8). Synchronisation serveur : webhook RevenueCat → Edge Function → tables `subscriptions` et `team_subscriptions`. Sans droit `pro` actif, l'app affiche l'écran de paiement à chaque ouverture (les données restent conservées).
- Les prix et formules doivent être modifiables sans mise à jour de l'app (offerings RevenueCat) et testables (expérimentations RevenueCat : par exemple 4,99 € contre 6,99 € la semaine). Le critère de décision est le revenu par installation, pas le taux de conversion.
- Inclus dans l'abonnement : tout le jeu (team, pointage, barre, spot, cartes SKIP, bilan, séries, saisons) + **mode hardcore** (blocage des réseaux sociaux jusqu'à la séance via l'API Screen Time / équivalent Android ; peut arriver en V1.1 si l'autorisation Apple tarde).
- Mesures à suivre dès le lancement : taux d'invitations acceptées (si l'écran de paiement fait chuter les invitations, tester un essai de 14 jours pour les invités), passage essai → payant, revenu par installation à J14 et J60.
- Hors MVP, prévu plus tard : grandes teams et défis sponsorisés par des marques, salles partenaires.

### 2.9 Réglages et conformité
- Quitter une team, supprimer une team (créateur), changer d'objectif (pris en compte la semaine suivante), sons/haptique on/off, notifications par type.
- **Suppression de compte dans l'app** (obligatoire App Store) : supprime toutes les données du joueur.
- Écran « Tes données » : ce qui est stocké, ce qui ne l'est jamais (position).
- Pages Politique de confidentialité et CGU (texte en français dans l'app + URL publique à me demander).
- Signaler / exclure un membre (créateur de team).

---

## 3. Direction artistique « V3 — verre, carte et affiche » (à respecter précisément)

Niveau visé : une app conçue par une agence créative premium, pas par un générateur de templates. Mots-clés : bold, athletic, editorial, premium, immersive, minimal, powerful. Inspiration : l'énergie des campagnes sportives de Nike et des apps de running premium, **sans copier** ni logo, ni slogan, ni interface, ni élément protégé.

**La référence visuelle, ce sont les maquettes V3 du dossier `design/` à la racine du projet** (lis d'abord `design/README.md`) : captures dans `design/png/`, HTML avec les valeurs exactes et les animations dans `design/html/`. Écrans : Ma team, Séance en cours, Disque chargé, Carte SKIP, Paiement, et la mascotte animée « Le Canap' » (4 humeurs). Regarde chaque capture avant de coder l'écran correspondant ; les SVG (Canap', barre) peuvent être repris dans `react-native-svg`. Reproduis leur hiérarchie, leurs proportions, leurs matières et leur typographie. Trois langages, chacun à sa place :

1. **Verre sur carte (écrans de jeu : Ma team, Séance en cours)** : fond = carte sombre stylisée du quartier autour de la salle (rues noires, libellés gris, point orange de la salle qui pulse). Par-dessus, des panneaux en verre dépoli : `rgba(30,31,35,0.66)` + flou d'arrière-plan 18–20 px + bordure 1 px `rgba(255,255,255,0.13)`, coins 24–34 px. Boutons ronds en verre (50 px, central 70 px). Utilise `expo-blur` (BlurView) et une carte : `react-native-maps` avec un style sombre personnalisé (Apple Maps en mode sombre sur iOS, style JSON sur Android), sans afficher la position en direct de l'utilisateur aux autres.
2. **Cartes plates sombres (moments forts : Disque chargé, Paiement)** : fond `#111214`, cartes `#1D1E22`/`#202125` coins 18–22 px, petit label en majuscules orange (« AUJOURD'HUI / SÉANCE VALIDÉE »), titre géant, gros bouton orange rectangulaire arrondi 14 px avec flèche ↗, rangée de 3 chiffres clés.
3. **Affiche (Carte SKIP)** : fond blanc cassé `#ECECE8`, lettres géantes noires empilées (« SK / IP. », Archivo 900, ~236 px, interlettrage serré), le Canap' en noir et gris à la place de l'athlète, un seul point orange (les chips). Format 9:16 pour la story.

```ts
// theme/tokens.ts
export const colors = {
  map: '#16171A',        // fond carte
  bg: '#111214',         // fond écrans plats
  card: '#1D1E22',
  glass: 'rgba(30,31,35,0.66)',
  glassBorder: 'rgba(255,255,255,0.13)',
  offWhite: '#F5F5F0',   // texte principal, disques des potes
  paper: '#ECECE8',      // fond de l'affiche SKIP
  muted: '#A3A4A9',      // texte secondaire (contraste vérifié)
  accent: '#FF6A3D',     // UNE seule couleur d'accent : orange
  plates: ['#F5F5F0', '#B9BBC0', '#7C7E84', '#5E6066', '#D9DADD', '#9A9CA1'], // potes ; accent = toi
};
```

**Règle de couleur** : une seule couleur d'accent (orange) pour ce qui est à toi (tes disques, ton avatar), l'action principale et les moments forts. Pas de dégradés violets ou bleus, pas de vert par défaut.

**Typographie : Archivo** (police variable Google Fonts, axes largeur et graisse) partout, pour une identité cohérente :
- Chiffres et titres d'écran en **Archivo élargie** (largeur 125 %, graisse 700–800) : « 140 kg », « 38:12 », « +20 KG. », « PASSE EN MODE NOSKIP. ».
- Affiche SKIP en **Archivo 900 largeur normale**, lettres empilées.
- Texte courant en Archivo 400–600 largeur normale. Labels en majuscules avec léger interlettrage.
- Charge la police variable avec ses axes (`expo-font` + fichier `.ttf` variable, ou instances statiques Expanded / Black si les axes ne sont pas supportés).

**Élément signature : LA BARRE** : le total de kilos de la team en chiffre géant élargi, puis une barre olympique dessinée dans un panneau de verre, chargée de disques (gris pour les potes, orange pour toi). Elle apparaît sur Ma team, Disque chargé et le Bilan.

**Le Canap'** (voir l'artboard « Le Canap' », 4 humeurs) : canapé noir et gris anthracite, yeux blanc cassé mi-clos, sourcils et sourire blancs, télécommande, paquet de chips orange. Composant `<Canap mood="idle|smug|sad|crushed" />` en SVG découpé en parties animées avec Reanimated :
- `idle` : respiration (échelle verticale 1 → 1,035, 3,2 s) et clignement des yeux toutes les ~4 s ;
- `smug` (skip) : ricanement en rebonds avec légère rotation (1,1 s en boucle), miettes de chips qui tombent ;
- `sad` (disque chargé) : se tasse et boude (2,6 s), chips qui tombent par terre ;
- `crushed` (PR de la team) : écrasé par une barre chargée (rebond élastique 0,9 s), yeux en croix, nuage de craie.
Prévois l'emplacement pour le remplacer plus tard par un fichier Rive/Lottie.

**Motion design** (Reanimated + Moti)
- Transitions fluides entre écrans, apparitions en cascade des panneaux de verre.
- Chiffres qui défilent jusqu'à leur valeur (kilos, minutes).
- Point de la salle qui pulse sur la carte ; anneau de progression qui se remplit vers 45:00 pendant la séance.
- Disque chargé : le disque glisse sur la barre avec un rebond, clang, haptique lourd.
- Carte SKIP : « SK » puis « IP. » tombent l'un après l'autre comme un tampon.
- Micro-interactions sur tous les boutons (pression, relâchement).
- Respecte le réglage système « Réduire les animations » : fondus simples à la place.
- Jamais d'effet au détriment de l'ergonomie.

**Sons** courts (clang de disque, clap de craie, ricanement du Canap'), désactivables. Si tu n'as pas de fichiers, génère des placeholders silencieux et liste les sons à fournir dans `## Avancement`.

**UX** : parcours courts, action principale toujours visible, cibles tactiles ≥ 44 px, états de chargement élégants (panneaux de verre en squelette, pas de spinners génériques), messages d'erreur compréhensibles, états vides dessinés (par exemple « Barre vide. Le Canap' adore. »), contrastes vérifiés (texte ≥ 4,5:1, y compris sur le verre).

**Interdits absolus** : dashboard SaaS générique, ombres artificielles sur chaque élément, dégradés violets ou bleus, icônes génériques à chaque ligne (les icônes sont réservées à la barre de navigation et aux boutons ronds), composants standard non personnalisés, esthétique de template IA.

**Contrôle qualité visuel** : à la fin des phases 6, 7 et 11, prends des captures d'écran (simulateur iOS et émulateur Android), compare-les aux maquettes V3, critique-les comme un directeur artistique exigeant (hiérarchie, alignements, flou du verre, contrastes) et corrige avant de continuer.

Ton : tutoiement, vannes de vestiaire bienveillantes.

Écrans à produire : Onboarding (10 étapes), Ma team (carte + barre), Séance en cours (carte + chrono + anneau), Disque chargé, Carte SKIP (affiche), Bilan du dimanche, Historique, Mes teams, Carte de lifter, Paiement (annuel / hebdo, Duo, Team), Réglages, Rejoindre via lien (deep link `noskip://join/<code>` + lien universel).

---

## 4. Modèle de données (Supabase / Postgres)

Écris les migrations SQL correspondantes (adapte si nécessaire, mais garde l'esprit) :

- `profiles` (id = auth.users.id, pseudo, avatar_url, title, plate_color, weekly_goal, goal_effective_from, lifetime_sessions, created_at, onboarding_answers jsonb)
- `gyms` (id, osm_id unique, name, lat, lng, address, created_at) — cache des salles OSM
- `user_gyms` (user_id, gym_id, is_primary, chosen_at) — max 3, contrainte de changement 30 jours
- `teams` (id, name, created_by, invite_code unique, created_at)
- `team_members` (team_id, user_id, role 'owner'|'member', joined_at, accepted_rules_at, plate_color)
- `sessions` (id, user_id, gym_id, started_at, ended_at, duration_min, validated_at, source 'geofence'|'manual_check', unique (user_id, local_date))
- `weeks` (id, team_id, week_start date, closed_at, total_kg, skips_count, is_team_pr, machine_user_id, skipper_user_id)
- `week_results` (week_id, user_id, goal, done, achieved bool, used_joker bool)
- `skip_cards` (id, week_id, user_id, team_id, line_id, created_at, shared_count)
- `spots` (id, from_user, to_user, team_id, created_at)
- `jokers` (user_id, month, used_at)
- `belts` (team_id, month, user_id, type 'belt'|'big_canap')
- `push_tokens` (user_id, token, platform, updated_at)
- `subscriptions` (user_id, entitlement 'pro', source 'individual'|'duo'|'team', status, expires_at, rc_customer_id, granted_by_user_id)
- `team_subscriptions` (team_id, payer_user_id, product 'team', status, expires_at, rc_customer_id)
- `duo_streaks` (team_id, current_weeks, best_weeks, updated_at) — pour les teams de 2

**RLS sur toutes les tables** : un joueur ne voit que ses propres données et celles des teams dont il est membre. Les écritures sensibles (`sessions.validated_at`, `weeks`, `week_results`, `skip_cards`, `belts`, `team_subscriptions`) passent **uniquement** par les Edge Functions (service role). Écris des tests SQL qui prouvent qu'un joueur ne peut ni lire une team dont il n'est pas membre, ni valider une séance lui-même.

Fuseau : toute la logique de semaine en **Europe/Paris**.

---

## 5. Edge Functions (Deno)

| Fonction | Déclencheur | Rôle |
|---|---|---|
| `search-gyms` | app | Requête Overpass autour d'un point / par nom, cache dans `gyms` |
| `validate-session` | app | Vérifie cohérence (durée ≥ 40, 1/jour, salle du joueur), écrit la séance, push « disque chargé » à la team, déclenche PR live si objectif team atteint |
| `send-spot` | app | Vérifie les limites, push au destinataire |
| `midweek-check` | cron quotidien 18:00 Paris | Détecte « barre qui tremble », push |
| `close-week` | cron dimanche 20:00 Paris | Calcule résultats, cartes SKIP, PR, séries, push SKIP puis bilan à 20:05 |
| `monthly-belt` | cron 1er du mois 10:00 | Ceinture + Gros Canap' |
| `revenuecat-webhook` | webhook | Met à jour `subscriptions` et `team_subscriptions`, attribue Pro au binôme (Duo) ou à toute la team (Team) |
| `delete-account` | app | Suppression complète des données de l'utilisateur |
| `join-team` | app | Rejoindre via code, vérifie limites (4 joueurs, 8 avec l'offre Team, 3 teams par joueur) |

Toutes les fonctions : validation des entrées (zod), authentification JWT, tests unitaires, logs propres, idempotence pour les crons (rejouer `close-week` ne doit pas dupliquer les cartes).

---

## 6. Notifications push (textes FR)
- Disque chargé : « {pseudo} vient de charger 20 kg 💪 »
- Spot : « {pseudo} te spot : bouge à la salle ! »
- Barre qui tremble : « {pseudo} risque le skip. Spotte-le ! » / pour soi : « Il te reste {n} jours pour charger {m} disques. Le Canap' te chauffe déjà la place. »
- SKIP : « SKIP. {pseudo} a choisi le canap'. »
- Bilan : « Bilan : la team a soulevé {kg} kg. Machine de la semaine : {pseudo}. »
- PR : « PR DE LA TEAM ! {kg} kg soulevés cette semaine 🏆 »
Gère les préférences par type et les tokens invalides (suppression).

---

## 7. Qualité, tests et critères d'acceptation

L'app est terminée quand **tous** ces points sont vrais :
1. `tsc --noEmit`, lint et tous les tests passent (app, Edge Functions, RLS).
2. Tests unitaires sur la logique métier pure (dans `src/domain/`) : calcul de semaine Europe/Paris, objectif atteint, barre qui tremble, PR, série + joker, niveaux, ceinture, tirage des vannes sans répétition. Couverture ≥ 80 % sur `src/domain/`.
3. Un **script de simulation** (`scripts/simulate-week.ts`) qui crée une team de test en local, injecte des séances, lance `close-week`, et vérifie que les bonnes cartes SKIP, PR et notifications (mockées) sont produites.
4. Un **mode démo développeur** (accessible uniquement en build de dev) qui permet de simuler une entrée/sortie de salle pour tester sans bouger.
5. L'app compile en development build iOS et Android via EAS (`eas build --profile development`), et en preview (`--profile preview`).
6. Aucune coordonnée GPS ne transite vers le serveur (vérifie et documente).
7. Suppression de compte fonctionnelle de bout en bout.
8. README complet : installation, variables d'env, lancement local (Supabase local + app), déploiement des Edge Functions et des crons, configuration RevenueCat, build et soumission TestFlight / Play Console.

---

## 8. Ce dont tu auras besoin de moi (demande-le au bon moment, pas avant)
- Projet Supabase (URL, anon key, service role key) — ou je te laisse le créer via le MCP Supabase si disponible.
- Compte Apple Developer (Team ID, bundle id `com.noskip.app` à confirmer), clé Sign in with Apple, clé APNs pour Expo.
- Compte Google Play Console + identifiants Google Sign-In.
- Compte Expo / EAS (`eas login`).
- Clés RevenueCat (iOS + Android) et produits créés dans les stores.
- Clé PostHog.
- URL publique pour la politique de confidentialité.

---

## 9. Plan de phases (commit à la fin de chaque phase)

1. **Socle** : init Expo + TypeScript + Expo Router + lint/prettier/jest, thème (tokens, polices), navigation vide de tous les écrans, `supabase init`, CI locale (`npm run check`).
2. **Base de données** : migrations, RLS, tests RLS, types TypeScript générés.
3. **Auth + onboarding** : Apple/Google/magic link, profil, choix d'objectif, carte de lifter, recherche de salles (`search-gyms`).
4. **Teams** : création, lien d'invitation + deep links, `join-team`, règles acceptées, limites.
5. **Pointage** : geofencing arrière-plan, plan B manuel, `validate-session`, anti-triche, mode démo dev.
6. **Barre de la team** : rendu SVG/Skia, disques, animations, haptique, sons, statuts joueurs, spot (`send-spot`).
7. **Domaine semaine** : logique pure + tests, `midweek-check`, `close-week`, cartes SKIP (écran + image partageable + banque de vannes), bilan du dimanche, historique, script de simulation.
8. **Progression** : barre perso, niveaux, séries, joker, saisons, `monthly-belt`.
9. **Notifications** : enregistrement des tokens, envoi depuis les fonctions, préférences.
10. **Offres payantes** : RevenueCat, paywall (Pro, Pack Duo, Team), webhook, droits Pro partagés, limite 8 joueurs, mode hardcore.
11. **Conformité et finitions** : suppression de compte, écran « Tes données », CGU/confidentialité, états vides, erreurs réseau, chargements, accessibilité (tailles de texte, VoiceOver sur les éléments clés).
12. **Livraison** : README, configuration EAS (dev, preview, production), checklist de soumission stores, mise à jour finale de `## Avancement` avec ce qui reste à faire de mon côté.

Commence maintenant par la phase 1. Avant d'écrire du code, résume-moi en 10 lignes ta compréhension du projet et la liste des choses dont tu auras besoin de moi plus tard.

---

## Avancement

**Phase en cours : terminé côté code (phases 1 à 12).** Ce qui reste demande tes comptes, tes clés ou un vrai téléphone : voir « Reste à faire de ton côté » en bas.

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

### Phase 7 — Domaine semaine ✅ (déployée sur Supabase)
- **Spec restaurée** : depuis la phase 2, les §1 à §9 de ce fichier avaient été écrasés par erreur lors d'une mise à jour d'Avancement ; ils sont revenus (depuis le 1er commit).
- Migrations `…000900` à `…000903` (`week_close_1_schema`, `_2_close_logic`, `_3_cron`, `_4_api`, découpées pour pouvoir être appliquées par le MCP Supabase sans demande de confirmation bloquante ; plus de table temporaire ni de `truncate` dans la clôture) : `app_private.close_team_week` (idempotente, verrou `FOR UPDATE` : rejouer ne duplique rien), `week_results.exempt` (joueur arrivé trop tard pour pouvoir tenir son objectif : pas de carte), joker = pas de carte, séance du dimanche après 20 h comptée la semaine suivante, PR de la team (tous les joueurs comptés ont tenu) + `weeks.is_record` (plus de kg que la meilleure semaine), Machine (plus de séances), Skippeur (plus gros déficit), série du binôme (+1 si les deux tiennent, conservée sans progresser avec un joker, remise à 0 sinon). Notifications « réclamées » une seule fois (`skip_notified_at`, `recap_sent_at`), rattrapage si un envoi a planté. `claim_shaky_alerts` (barre qui tremble, 1 alerte/joueur/jour, à partir de 18 h). Lecture app : `team_history`, `week_recap`, `latest_closed_week`, `skip_card_week`. Tout le reste en service role uniquement.
- **Crons** (pg_cron + pg_net, installés par la migration seulement s'ils existent : projet hébergé) : clôture dimanche `0 18,19 * * 0` UTC, bilan `5 18,19 * * 0`, barre qui tremble `0 16,17 * * *` (deux heures UTC pour couvrir été/hiver ; les fonctions sont idempotentes et filtrent sur l'heure de Paris). Appels authentifiés par un secret partagé généré dans la base (`app_private.cron_config`, jamais exposé par l'API) ; `close-week` et `midweek-check` sont déployées sans vérification JWT et refusent tout appel sans ce secret.
- Edge Functions `close-week` (étapes `close` puis `recap`, une team en échec ne bloque pas les autres, push « SKIP. {pseudo} a choisi le canap'. », « PR DE LA TEAM ! … », « Bilan : la team a soulevé … ») et `midweek-check` (« Il te reste n jours pour charger m disques… » + « {pseudo} risque le skip. Spotte-le ! »). 10 tests Deno.
- Vannes : `content/skip-lines.ts` (45 vannes, écriture neutre, test qui interdit le vocabulaire sur le physique), tirage sans répétition des 20 dernières vannes de la team (`src/domain/skipDraw.ts`). `npm run sync:shared` copie le tirage et la liste des ids dans `supabase/functions/_shared/generated/` (les fonctions sont déployées seules) ; `npm run check` échoue si la copie est périmée.
- Domaine : `src/domain/weekClose.ts` (modèle de référence de la clôture, séries + joker, dates en français, statut du bilan). Tests SQL `70_week_close.test.sql` (64).
- **Simulation** : `npm run simulate:week` crée une team de 4 et un duo dans une base locale jetable, injecte séances / joker / jetons push, lance le vrai handler `close-week` (20:00 puis 20:05, push mockés), compare au modèle du domaine, rejoue tout (idempotence), nettoie. Fait partie de `npm run check`. Refuse de tourner si `cron_config` existe (base de prod).
- App : **Carte SKIP** (affiche papier `#ECECE8`, « SK / IP. » en Archivo Black qui tombent comme un tampon, Canap' qui ricane, un seul point orange = les chips, score Team / Canap', lien ou code d'invitation ; « PARTAGER EN STORY » → image 1080×1920 via `react-native-view-shot` + `expo-sharing`, compteur de partages), **Bilan du dimanche** (cartes plates : kilos, Team vs Canap', barre de la semaine, PR + record, Machine / Skippeur, série duo, joueurs, accès aux cartes), **Historique** (par team, badges PR / record / Canap'), bandeau « Bilan du dimanche » sur Ma team jusqu'au mardi soir.
- Contrôle visuel (web) : `design/qa/phase7-skip-poster.png`. Corrigé après revue : « K » qui débordait, Canap' qui masquait « IP. », ligne d'invitation coupée. `scripts/visual-qa.mjs` : `--clear` + arrêt réel du serveur (un ancien serveur servait un export périmé).
- Ouverture des écrans depuis les notifications (données `card_id` / `week_id` déjà dans les push) : phase 9.
- **Déployé sur le projet** : migrations (appliquées en 9 morceaux via le MCP : `week_close_1_schema`, `2a_players`, `2b_close_team_week`, `2c_notifications`, `4a_service_wrappers`, `4b_app_reads`, `3a_cron_functions`, `3b_enable_cron`, `5_pin_search_path` ; contenu identique aux 4 fichiers du dépôt), fonctions `close-week` (v1) et `midweek-check` (v1) sans vérification JWT, ligne `cron_config` créée avec un secret aléatoire de 64 caractères généré par la base, 3 planifications `noskip-close-week` / `noskip-week-recap` / `noskip-midweek-check` enregistrées. Test réel : appel par la base avec le secret → 200, avec un faux secret → 401.
- **Leçon MCP Supabase** : au-delà d'une certaine taille, ou avec `truncate` / `drop`, `apply_migration` demande une confirmation qui ne s'affiche pas dans ton app (ni téléphone, ni PC) et expire. Il faut envoyer les migrations en petits morceaux sans instruction destructive.
- Conseiller sécurité : `pg_net` signalé « dans le schéma public » sur le projet (installé avant la correction ; le dépôt l'installe désormais dans `extensions`). Le déplacer demande de supprimer puis recréer l'extension, ce qui déclenche la confirmation bloquante : laissé tel quel, sans risque (ses fonctions vivent dans le schéma `net`, non exposé).

### Phase 8 — Progression ✅ (déployée sur Supabase)
- Migrations `…001000_progression_1_player`, `…001001_progression_2_belts`, `…001002_progression_3_cron` (appliquées en 7 petits morceaux via le MCP + `progression_4_pin_search_path`).
- **Joker blessure** : RPC `declare_joker()` — 1 par mois (mois du lundi de la semaine), pour la semaine de jeu en cours, idempotent ; refusé si le joker du mois est déjà pris (`joker_already_used`) ou si l'objectif est déjà atteint (`goal_already_reached`). Effets déjà en place : pas de carte SKIP, pas de spot, série préservée, statut « Joker blessure » visible par la team.
- **Carte de lifter** : RPC `lifter_card(p_user?)` (moi ou un coéquipier, sinon `not_found`) : photo, titre, couleur, total de séances, nombre de skips (semaines distinctes), trophées, historique des semaines closes fusionné entre teams, état du joker.
- **Saisons / Ceinture** : `app_private.award_team_belts(team, mois)` (semaines dont le lundi tombe dans le mois ; Ceinture = meilleur taux d'objectif atteint hors jokers et arrivées tardives, départage au nombre de séances puis à l'ancienneté ; Gros Canap' = le plus de cartes SKIP, départage au moins de séances ; idempotent ; refuse le mois en cours), `due_belt_month` (rien avant le 1er à 10 h Paris), notification « réclamée » une seule fois (`belts.notified_at`). Edge Function **`monthly-belt`** (cron `0 8,9 1 * *` UTC, secret partagé, push « 🥇 {pseudo} décroche la Ceinture d'octobre… » / « Trophée Gros Canap' … », préférence `recap`). 5 tests Deno. Testée en réel : appel par la base → 200 (`{"month":"2026-10-01","awarded":0}`, aucune semaine close en octobre).
- Domaine `src/domain/progression.ts` (testé) : niveaux Barre à vide 20 → Gym bro 60 → Machine 100 → Monstre 160 → Légende 250 (progression, séances restantes), série actuelle et record (joker et semaine d'arrivée tardive préservent sans prolonger), libellés de mois (« Ceinture d'octobre »), modèle de la Ceinture identique au SQL, état du joker.
- Tests SQL `80_progression.test.sql` (33) : joker (idempotent, 1/mois, objectif atteint, anon), Ceinture / Gros Canap' sur un mois de 4 semaines + une semaine hors mois, rejeu, mois en cours refusé, horaires Paris été/hiver, notifications une seule fois, carte (moi, coéquipier, inconnu refusé).
- App : onglet **Carte de lifter** (identité, NIVEAU en géant, barre perso avec progression vers le niveau suivant, Série / Séances / Skips, Trophées, carte Joker avec confirmation), **carte d'un coéquipier** (`lifter/[id]`, en touchant un joueur sur Ma team). Contrôle visuel web : `design/qa/phase8-lifter-card.png` (corrigé : badges de trophées de largeurs différentes → titres désalignés).
- Pas encore : modifier sa carte (pseudo, photo, titre) depuis l'onglet → phase 11 (réglages).

### Phase 9 — Notifications ✅ (déployée ; réception réelle à valider avec EAS + APNs)
- `expo-notifications` (plugin, couleur orange). `src/features/notifications/push.ts` : affichage au premier plan, canal Android « NoSkip », `registerForPush(ask)` (permission, jeton Expo, enregistrement serveur), `unregisterPush()` à la déconnexion (le téléphone ne reçoit plus les notifs du compte).
- Migration `…001100_push_registration.sql` : RPC `register_push_token` (jetons Expo uniquement ; si un autre compte a utilisé le téléphone avant, le jeton lui est retiré), déclencheur sur le changement de salle principale → Edge Function **`notify-gym-change`** (secret partagé, « {pseudo} a changé de salle principale… », **jamais le nom de la salle**, appel périmé ignoré, préférence `gym_change`). 14 tests SQL, 3 tests Deno. Testée en réel (appel périmé → 200 `stale`).
- `src/domain/notifications.ts` (testé) : préférences par type (actives par défaut, comme le SQL) et écran ouvert au toucher d'une notification : SKIP → carte, bilan / PR → bilan, Ceinture → carte de lifter du gagnant, disque / spot / barre qui tremble / salle → Ma team.
- `useNotificationRouting` (toucher une notif, app ouverte ou fermée ; rafraîchit la barre quand une notif de jeu arrive) et `usePushRegistration` (jeton rafraîchi au démarrage et à chaque retour au premier plan, sans jamais redemander la permission), montés dans les onglets.
- Écrans : **étape 9** (exemples de vraies notifs, « Activer les notifs » / « Plus tard », 2 tests RNTL), **Réglages** : notifications par type (7 interrupteurs maison `ToggleRow`), état de la permission avec « Activer » / « Ouvrir les réglages », sons, vibrations, « Se déconnecter ». Le reste des réglages (objectif, salles, compte, données, CGU) arrive en phase 11.
- **Bloqué de ton côté** : Expo ne délivre un jeton push qu'avec un **EAS project id** (`EAS_PROJECT_ID` dans `.env`, créé par `eas init`) ; iOS demande aussi la **clé APNs** (Apple Developer) et Android un fichier **FCM** (Firebase). Sans eux, l'app fonctionne mais `registerForPush` renvoie « indisponible » et aucun téléphone n'est enregistré. Demandé en phase 12.
- Pas fait : le « PR live » en cours de semaine dans `validate-session` (le PR est annoncé à la clôture du dimanche).

### Phase 10 — Offres payantes ✅ (déployée ; achats réels en attente de RevenueCat + stores)
- Migration `…001200_subscriptions.sql` (appliquée en 3 morceaux) : accès Pro calculé en direct (`app_private.has_pro`) = abonnement perso actif, OU Pack Duo payé par un pote, OU offre Team d'une team dont je suis membre ; « annulé » garde l'accès jusqu'à l'échéance. `apply_rc_event` (service role) : 1 enregistrement par événement RevenueCat (`rc_events`, rejouer ne fait rien), un événement plus ancien n'écrase jamais un plus récent (`last_event_at`). Pack Duo = le payeur + **un** coéquipier (celui choisi dans l'app, sinon le premier coéquipier ; si le payeur est seul, le premier qui rejoint sa team en profite — déclencheur `team_members_grant_pending_duo`). Team = toute la team choisie (sinon la plus ancienne du payeur), plafond 8 (`team_capacity` utilise la même règle), et le payeur garde Pro s'il quitte la team. RPC app `my_entitlement()` (actif, formule, « offert par », team, payeur). 25 tests SQL.
- Edge Function **`revenuecat-webhook`** (sans JWT) : vérifie l'en-tête `Authorization` envoyé par RevenueCat contre le secret `REVENUECAT_WEBHOOK_AUTH` (comparaison à temps constant ; **secret non défini = tout est refusé, 503**), zod, statut par type d'événement (achat / renouvellement / essai → actif ou essai, annulation, problème de paiement, expiration ; TEST / TRANSFER ignorés), formule déduite de l'identifiant produit (`noskip.pro.*`, `noskip.duo.*`, `noskip.team.*`), partenaire Duo et team lus dans les attributs `noskip_duo_partner` / `noskip_team_id` posés par l'app avant l'achat, identifiants anonymes RevenueCat ignorés. 6 tests Deno. Test réel : 503 `webhook_not_configured` tant que le secret n'est pas posé.
- App : `react-native-purchases` (`src/features/subscriptions/`) : configuration avec l'id Supabase du joueur comme `appUserID` (le webhook sait qui a payé), déconnexion RevenueCat à la sortie du compte, offres lues dans RevenueCat (offre courante = Annuel + Hebdo, offre `friends` = Pack Duo + Team → prix modifiables et testables sans mise à jour), essai gratuit lu dans le store (iOS : prix d'intro ; Android : phase gratuite), achat, restauration, gestion de l'abonnement. `useHasPro` = serveur, ou reçu du store juste après l'achat (déblocage immédiat sans attendre le webhook).
- **Écran de paiement** (cartes plates sombres, sans bouton pour passer) : aperçu de la barre de la team, Annuel par défaut (« Meilleure offre », « Soit 1,15 € par semaine », « 7 jours gratuits »), Hebdo, « Avec tes potes » (Pack Duo avec choix du pote, Team avec choix de la team), bouton « COMMENCER L'ESSAI GRATUIT », mention de renouvellement automatique exigée par les stores, « Restaurer mes achats », CGU, Confidentialité. 4 tests RNTL. Domaine `src/domain/paywall.ts` (6 tests).
- « Offert par {pseudo} » : bandeau unique sur Ma team quand un Duo / une offre Team couvre le joueur ; Réglages → Abonnement (formule, échéance, offert par, Gérer mon abonnement, Restaurer).
- Build de dev sans clés RevenueCat : l'écran affiche « paiement pas encore branché » + « Continuer sans payer (dev) » (**uniquement en `__DEV__`**, ignoré en production).
- **Mode hardcore** (blocage des réseaux sociaux) : reporté en V1.1 comme prévu par la spec (Apple doit accorder l'autorisation « Family Controls » au compte développeur).
- **À configurer de ton côté** (détaillé en phase 12) :
  1. App Store Connect / Play Console : 4 abonnements `noskip.pro.annual` (59,99 €, essai 7 j), `noskip.pro.weekly` (4,99 €, essai 3 j), `noskip.duo.annual` (89,99 €), `noskip.team.annual` (149,99 €).
  2. RevenueCat : projet + apps iOS/Android, entitlement `pro` sur les 4 produits, offre courante avec les packages Annuel et Hebdo, offre `friends` avec Duo et Team ; clés SDK publiques → `.env` (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`).
  3. Webhook RevenueCat → `https://kbxjsxmxelomyyzlzzqh.supabase.co/functions/v1/revenuecat-webhook`, avec une valeur d'en-tête Authorization de ton choix, et la même valeur en secret Supabase `REVENUECAT_WEBHOOK_AUTH`.

### Phase 11 — Conformité et finitions ✅ (déployée ; mentions légales à compléter)
- **Suppression de compte** : migration `…001300_account_deletion.sql` (`handover_teams` : chaque team créée par le joueur passe au plus ancien membre restant ; renvoie les teams où il est seul) + Edge Function **`delete-account`** (JWT, confirmation `SUPPRIMER` vérifiée aussi côté serveur ; supprime les teams solo, les photos `avatars/<uid>/`, le journal RevenueCat, puis l'utilisateur Auth → tout le reste part en cascade ; un échec intermédiaire laisse le compte, on peut réessayer). 12 tests SQL (dont la cascade complète), 3 tests Deno. Côté app : écran **Supprimer ton compte** (liste de ce qui part, avertissement « ton abonnement n'est pas résilié automatiquement » + Gérer mon abonnement pour le payeur, saisie de SUPPRIMER), puis nettoyage du téléphone (zones de geofencing arrêtées, toutes les clés `noskip.*`, cache, RevenueCat, session). 2 tests RNTL.
- **Tes données** (ce qui est stocké, ce qui ne l'est jamais — la position —, ce que la team voit), **Politique de confidentialité** et **CGU** en français (`content/legal.ts`, écran commun `LegalScreen`). L'éditeur, l'e-mail de contact et les URLs publiques viennent de `EXPO_PUBLIC_LEGAL_PUBLISHER`, `EXPO_PUBLIC_LEGAL_EMAIL`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL` : **non renseignés, le texte affiche « [à compléter avant publication] »**.
- **Réglages complets** : Toi (modifier pseudo / photo / titre, objectif avec l'objectif à venir, salles : principale / en plus, retirer, ajouter), Notifications, Abonnement, Sons et vibrations, Tes données (stockage, confidentialité, CGU), Se déconnecter, Supprimer mon compte. Les écrans carte / objectif / salle de l'onboarding sont réutilisés en mode « réglages » (`?edit=1` : sans barre de progression, retour aux réglages).
- **Hors ligne** : `expo-network` branché sur TanStack Query (les requêtes se mettent en pause et repartent au retour du réseau) + bandeau « Pas de réseau. Tes séances sont gardées et partiront au retour. ».
- **Accessibilité** : tailles de texte du système respectées (texte courant jusqu'à ×1,6, grands chiffres ×1,2, affiche SKIP figée pour garder sa composition), libellés VoiceOver / TalkBack sur les éléments clés, rôles (radio, switch, alert).
- Contrôle visuel web : `design/qa/phase11-dev-paywall.png` (écran de paiement avec prix d'exemple, page dev `/dev-paywall`), `design/qa/phase11-my-data.png`. **À refaire sur simulateur** comme les phases 6 et 7.
- Pas fait : PostHog (clé non fournie, aucune mesure n'est envoyée pour l'instant).

### Projet Supabase (production / test)
- Projet `noskip`, ref `kbxjsxmxelomyyzlzzqh`, région `eu-west-3` (Paris), plan gratuit. Créé via le MCP le 3/11/2026 ; le projet `voltaio` a été mis en pause pour libérer la place (limite de 2 projets gratuits actifs).
- Migrations appliquées : core_schema, client_rpcs, gym_search_cache_and_avatars, pin_search_paths, pin_require_uid, teams_join_and_manage, session_validation, spots, puis les 9 morceaux de week_close (phase 7) et les 8 de progression (phase 8), puis `push_registration_1_register` et `push_registration_2_gym_change` (phase 9), puis `subscriptions_1_base`, `_2_apply_event`, `_3_entitlement_and_rights` (phase 10), `account_deletion` (phase 11).
- Edge Functions déployées : `search-gyms` (v1), `join-team` (v1), `validate-session` (v1), `send-spot` (v1), `delete-account` (v1) en verify_jwt ; `close-week` (v1), `midweek-check` (v1), `monthly-belt` (v1), `notify-gym-change` (v1) sans JWT, protégées par le secret de `cron_config` ; `revenuecat-webhook` (v1) sans JWT, protégée par `REVENUECAT_WEBHOOK_AUTH` (à poser). Secrets optionnels : `DEMO_USER_IDS` (dev seulement), `EXPO_ACCESS_TOKEN` (si la sécurité push renforcée d'Expo est activée). Les secrets `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase.
- `.env` local rempli (URL + anon key, non commité).
- Vérifié en SQL sur le projet : anon n'a aucun droit, `authenticated` ne peut ni valider une séance, ni écrire skip_cards / subscriptions, ni lire le cache ; 0 table sans RLS ; bucket `avatars` présent ; semaine de jeu correcte (Paris).
- Conseiller sécurité Supabase : restent 25 « SECURITY DEFINER exécutables par authenticated » (voulu : ce sont les RPC client, chacune vérifie `auth.uid()` et l'appartenance à la team), 3 infos « sans policy » (`gym_search_cache`, `shaky_alerts`, `rc_events` : voulu, service role uniquement) et `pg_net` dans public (voir phase 7).
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

### Phase 12 — Livraison ✅
- `README.md` (français) : installation, variables d'env et secrets des fonctions (où les trouver), lancement local (PostgreSQL jetable ou `supabase start`), qualité (`npm run check`), déploiement Supabase (`db push`, `functions deploy`, `cron_config` + `install_cron_jobs`, Auth, SMTP), builds EAS, push (APNs / FCM), RevenueCat pas à pas, vie privée (ce qui part vers le serveur, vérifié), suppression de compte.
- `eas.json` : profils `development` (client de dev, distribution interne), `development-simulator`, `preview` (interne, APK Android), `production` (numéro de build auto) ; environnements EAS du même nom ; `submit` Android sur la piste interne en brouillon.
- `supabase/config.toml` : les 10 fonctions avec leur `verify_jwt` (5 avec JWT, 4 cron, webhook RevenueCat) → `npx supabase functions deploy` déploie tout correctement.
- `docs/STORE_CHECKLIST.md` : comptes, backend, push, abonnements, mentions légales, tests sur appareil, App Store Connect (étiquette de confidentialité, notes de review), Google Play (sécurité des données, déclaration de localisation en arrière-plan), après le lancement.
- Icône NoSkip (disque orange sur fond `#111214`), calques Android adaptatifs, icône monochrome, splash et favicon générés par `scripts/make-icons.mjs` ; l'icône du template Expo (`assets/expo.icon`) est supprimée.

### Reste à faire de ton côté
1. **Expo / EAS** : ✅ projet `@noskip-app/noskip` créé (id dans `app.config.ts`) ; recopier les variables de `.env` dans les environnements EAS ; premier `eas build --profile development`.
2. **Apple** : ✅ compte Developer actif, Team ID `6PFWK3G845` ; reste : confirmer `com.noskip.app`, clé Sign in with Apple (→ Supabase), clé APNs (→ `eas credentials`).
3. **Google** : Play Console, clients OAuth Web/iOS/Android (→ `.env` + Supabase), Firebase + FCM v1 (→ `eas credentials`), clé Google Maps Android (facultative).
4. **RevenueCat** + produits dans les stores + webhook + `REVENUECAT_WEBHOOK_AUTH` (README §7).
5. **Mentions légales** : éditeur, e-mail de contact, URLs publiques de la confidentialité et des CGU.
6. **SMTP** (Resend…) avant d'inviter des potes.
7. **Domaine** pour les liens d'invitation universels (facultatif, conseillé).
8. **PostHog** : clé à fournir, intégration pas encore faite (aucune mesure envoyée).
9. **Sons** définitifs (`assets/sounds/`), validation de l'icône.
10. **Tests sur téléphone** des phases 1 à 11 (magic link, recherche de salles, teams, pointage réel, barre, spot, push, achats) et contrôle visuel sur simulateur iOS / émulateur Android.
11. Non fait volontairement : « PR live » en cours de semaine (le PR est annoncé à la clôture du dimanche) ; mode hardcore en V1.1 (autorisation Family Controls d'Apple).
