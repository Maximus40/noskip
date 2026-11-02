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

**Phase en cours : 2 — Base de données** (phase 1 terminée).

### Phase 1 — Socle ✅
- Expo SDK 58 (RN 0.88, React 19.3, TS 6 strict), Expo Router (routes dans `src/app/`), React Compiler activé.
- `npm run check` = `tsc --noEmit` + `expo lint` (ESLint flat + Prettier) + `prettier --check` + Jest avec couverture (seuil 80 % sur `src/domain/`).
- Jest : preset `jest-expo`, resolver Reanimated + `setUpTests()`, RNTL v14 (API **asynchrone** : `await render(...)`, `await fireEvent.press(...)`).
- Thème : `src/theme/tokens.ts` (couleurs, rayons, espacements), `src/theme/typography.ts` (variantes de texte).
- Police Archivo : instances statiques générées depuis la police variable (fontsource, wght 100–900 / wdth 62–125) → `assets/fonts/` : Regular, Medium, SemiBold, Bold, Black (largeur 100) + ExpandedBold, ExpandedExtraBold (largeur 125). Licence OFL dans `assets/fonts/OFL.txt`.
- Composants de base : `Text`, `Screen`, `GlassPanel` (BlurView + `rgba(30,31,35,0.66)` + bordure), `PressableScale` (micro-interaction, respecte « Réduire les animations »), `Button` (orange, texte encre `#0E0E0F` car blanc sur orange < 4,5:1), barre d'onglets en verre flottante, icônes SVG.
- Test de contraste WCAG de la palette (y compris texte sur verre) dans `src/domain/contrast.test.ts`.
- Navigation : tous les écrans existent sous forme de squelette (`ScreenShell`, à supprimer au fil des phases) :
  - onboarding `(onboarding)/` : hook, sign-in, gym, goal, lifter-card, team-setup, location, rules, notifications → `/paywall` (étape 10) ;
  - onglets `(app)/` : team (Ma team), teams, lifter, settings ;
  - pile : session, plate-loaded, skip/[id], recap/[weekId], history, paywall, join/[code], my-data, privacy, terms, dev (`__DEV__` uniquement).
- `supabase init` fait (`supabase/config.toml`).
- Vérifié : `expo export --platform android` produit un bundle sans erreur.

### Notes d'environnement (session cloud)
- Le proxy réseau bloque api.expo.dev, GitHub, Google Fonts, docs.expo.dev, Overpass : utiliser `EXPO_OFFLINE=1 npx expo install <pkg>`. Seul le registre npm est joignable.
- API à vérifier dans les `.d.ts` locaux (Expo 58 a changé) : `Tabs` vient de `expo-router/js-tabs` ; `BottomTabBarProps` expose `navigateToTab(routeKey)`, plus de `navigation`.
- Docker présent → à tester pour `supabase start` en phase 2.

### Reste à faire
- Phases 2 à 12.
- **Bloquant pour la phase 6 : le dossier `design/` (maquettes V3) est absent du projet.** À fournir par toi.
- Icône et splash NoSkip : les assets du template Expo sont encore en place (à remplacer quand on aura le logo).
