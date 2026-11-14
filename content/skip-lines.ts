/**
 * SKIP card one-liners, signed by le Canap'. `{pseudo}` is replaced by the player's name.
 *
 * Absolute rule: mock the excuse, the couch, the comfort — never the body, the weight or
 * the person. Ids are stored in `skip_cards.line_id`: never rename or reuse an id, only add
 * new ones (a removed id falls back to the first line). After any change run
 * `npm run sync:shared` so the Edge Function draws from the same ids.
 */
/** Packs sold in the shop (noskip.shop.pack.<pack>): their lines join the team's draw. */
export const JOKE_PACKS = [
  'foot',
  'gaming',
  'braquage',
  'telerealite',
  'rap',
  'manga',
  'daron',
  'horoscope',
] as const;
export type JokePack = (typeof JOKE_PACKS)[number];

export type SkipLine = { id: string; text: string; pack?: JokePack };

export const SKIP_LINES: readonly SkipLine[] = [
  { id: 'canap-pr-sieste', text: "Le Canap' vient de faire un PR de sieste." },
  { id: 'leg-day', text: "{pseudo} a skip la salle. Même le leg day n'y croyait plus." },
  { id: 'place-chauffee', text: "Le Canap' garde une place chauffée à {pseudo}." },
  { id: 'serie-netflix', text: "Trois épisodes d'une série, zéro série de squats." },
  { id: 'telecommande', text: 'Seule charge soulevée cette semaine : la télécommande.' },
  { id: 'coussin-moule', text: 'Le coussin a gardé la forme. Les disques, eux, attendent.' },
  { id: 'demain-promis', text: '« Demain, promis. » — {pseudo}, tous les jours de la semaine.' },
  { id: 'chips-orange', text: 'Les chips ont fait plus de répétitions que {pseudo}.' },
  {
    id: 'sac-de-sport',
    text: "Le sac de sport attend dans l'entrée. Il a fini par défaire ses affaires.",
  },
  { id: 'meteo', text: 'Il pleuvait. Dans la salle aussi, apparemment.' },
  { id: 'fatigue', text: "« J'étais à plat. » Le Canap' valide l'excuse, la team non." },
  { id: 'plaid', text: 'Le plaid a gagné par K.O. au premier round.' },
  { id: 'echauffement', text: "Une semaine d'échauffement. Direction : le frigo." },
  { id: 'abonnement', text: "L'abonnement à la salle de {pseudo} se sent un peu seul." },
  { id: 'cardio-scroll', text: 'Cardio de la semaine : 4 km de scroll.' },
  {
    id: 'pr-canap',
    text: "Nouveau record : 7 jours sans quitter le Canap'. Personne n'a applaudi.",
  },
  { id: 'vestiaire', text: 'Le casier de {pseudo} a lancé un avis de recherche.' },
  { id: 'reveil', text: "Le réveil a sonné. Le Canap' a répondu." },
  { id: 'shaker-vide', text: 'Le shaker est resté propre. Trop propre.' },
  { id: 'agenda', text: "« J'avais trop de trucs. » Le Canap' a vu l'agenda : il était vide." },
  {
    id: 'jour-de-repos',
    text: "Un jour de repos, c'est bien. Sept, c'est un abonnement au Canap'.",
  },
  { id: 'tenue-prete', text: 'La tenue était prête. Elle a fait la sieste aussi.' },
  { id: 'sofa-signe', text: "Le Canap' a signé {pseudo} pour toute la saison." },
  { id: 'bouchon', text: '« Il y avait des bouchons. » Entre le salon et la cuisine ?' },
  {
    id: 'motivation-livree',
    text: 'La motivation est commandée. Livraison estimée : lundi prochain.',
  },
  { id: 'pizza-deadlift', text: 'Seul soulevé de terre de la semaine : la boîte de pizza.' },
  { id: 'coach-canap', text: "Le Canap' a un nouveau client. Programme : zéro série." },
  { id: 'excuse-premium', text: "L'excuse était premium. Le résultat, beaucoup moins." },
  { id: 'gps-salon', text: 'Trajet le plus long de la semaine : salon → cuisine.' },
  { id: 'trop-froid', text: "« Il faisait trop froid. » Le Canap' : 21 °C, plaid inclus." },
  { id: 'trop-chaud', text: "« Il faisait trop chaud. » Le Canap' : ventilo, plaid, même combat." },
  { id: 'lundi', text: '{pseudo} commence lundi. {pseudo} commence toujours lundi.' },
  { id: 'disque-poussiere', text: 'Les disques prennent la poussière. La barre fait la tête.' },
  { id: 'replay', text: "Une vidéo de muscu regardée en entier. Depuis le Canap'." },
  { id: 'trophee', text: "Le Canap' range un nouveau trophée sur l'étagère." },
  { id: 'negociation', text: '{pseudo} a négocié avec la flemme. La flemme a gagné.' },
  { id: 'battery', text: 'Batterie à 100 %. Motivation à 2 %.' },
  { id: 'team-attend', text: 'La team a chargé la barre. {pseudo} a chargé son téléphone.' },
  { id: 'canap-merci', text: "Le Canap' tient à remercier {pseudo} pour sa fidélité." },
  { id: 'semaine-off', text: "Semaine « off ». Le Canap' l'a notée « on »." },
  { id: 'pas-le-temps', text: "« Pas le temps. » Six heures d'écran par jour, d'après le Canap'." },
  { id: 'reprise', text: 'La reprise se prépare. Depuis trois semaines. Tranquillement.' },
  { id: 'grasse-mat', text: "Grasse mat' validée, séance non validée." },
  { id: 'canap-sourire', text: "Le Canap' sourit. Il sait qu'il a gagné cette manche." },
  { id: 'revanche', text: "Le Canap' attend la revanche. Il n'a pas peur." },

  // Pack Foot (shop).
  {
    id: 'foot-var',
    text: 'VAR consultée : aucune séance de {pseudo} cette semaine. But refusé.',
    pack: 'foot',
  },
  {
    id: 'foot-banc',
    text: "{pseudo} a passé la semaine sur le banc. Celui du Canap'.",
    pack: 'foot',
  },
  {
    id: 'foot-carton',
    text: 'Carton rouge pour {pseudo} : auto-expulsion de la salle.',
    pack: 'foot',
  },
  { id: 'foot-mercato', text: "Mercato surprise : {pseudo} signe au Canap' FC.", pack: 'foot' },
  {
    id: 'foot-tab',
    text: "Séance perdue aux tirs au but. Le Canap' n'a même pas eu à plonger.",
    pack: 'foot',
  },
  {
    id: 'foot-coup-envoi',
    text: "Seul sprint de la semaine : pour ne pas rater le coup d'envoi.",
    pack: 'foot',
  },
  { id: 'foot-hors-jeu', text: 'Hors-jeu toute la semaine. Position : allongé.', pack: 'foot' },
  {
    id: 'foot-prolongations',
    text: '« Je fais ma séance après le match. » Il y a eu prolongations. Sept jours.',
    pack: 'foot',
  },
  {
    id: 'foot-capitaine',
    text: "Le capitaine du Canap' FC salue sa nouvelle recrue : {pseudo}.",
    pack: 'foot',
  },
  { id: 'foot-remontada', text: "La remontada est prévue lundi. Comme d'habitude.", pack: 'foot' },

  // Pack Gaming (shop).
  {
    id: 'gaming-afk',
    text: "{pseudo} est AFK depuis lundi. Le Canap' a pris la manette.",
    pack: 'gaming',
  },
  {
    id: 'gaming-respawn',
    text: 'Respawn à la salle prévu lundi. Chargement… 3 %.',
    pack: 'gaming',
  },
  { id: 'gaming-quete', text: 'Quête « aller à la salle » : non commencée.', pack: 'gaming' },
  {
    id: 'gaming-lag',
    text: "« J'ai eu du lag. » Sept jours de lag, c'est un record.",
    pack: 'gaming',
  },
  { id: 'gaming-save', text: '{pseudo} a sauvegardé la partie. Pas la séance.', pack: 'gaming' },
  {
    id: 'gaming-boss',
    text: "Boss de la semaine : le Canap'. Défaite sans combat.",
    pack: 'gaming',
  },
  { id: 'gaming-xp', text: '+0 XP en force. +500 XP en canapé.', pack: 'gaming' },
  {
    id: 'gaming-tuto',
    text: '{pseudo} bloque encore au tuto « prendre son sac de sport ».',
    pack: 'gaming',
  },
  {
    id: 'gaming-ranked',
    text: "Classement de la team : {pseudo} descend en division Canap'.",
    pack: 'gaming',
  },
  { id: 'gaming-gg', text: "GG au Canap', qui a gagné sans toucher la manette.", pack: 'gaming' },
  {
    id: 'braquage-mission',
    text: 'MISSION ÉCHOUÉE. Point de rendez-vous : la salle. Aucune trace de {pseudo}.',
    pack: 'braquage',
  },
  {
    id: 'braquage-etoiles',
    text: '{pseudo} a 5 étoiles de recherche. Le coach a lancé un appel à toutes les unités.',
    pack: 'braquage',
  },
  {
    id: 'braquage-planque',
    text: "{pseudo} se planque depuis lundi. Planque repérée : le Canap'.",
    pack: 'braquage',
  },
  {
    id: 'braquage-casse',
    text: 'Le casse du siècle était prévu mardi. {pseudo} a oublié de se lever.',
    pack: 'braquage',
  },
  {
    id: 'braquage-drive',
    text: '{pseudo} a pris une voiture pour aller à la salle. Arrêt au drive. Mission annulée.',
    pack: 'braquage',
  },
  {
    id: 'braquage-silence',
    text: "Garde à vue sur le Canap' : {pseudo} garde le droit au silence. Et la télécommande.",
    pack: 'braquage',
  },
  {
    id: 'braquage-respawn',
    text: "{pseudo} a réapparu au point de sauvegarde. Le point de sauvegarde, c'est le Canap'.",
    pack: 'braquage',
  },
  {
    id: 'braquage-butin',
    text: 'Butin de la semaine : 0 séance, 3 paquets de chips.',
    pack: 'braquage',
  },
  {
    id: 'braquage-complice',
    text: "Le Canap' était le complice parfait. Aucune trace de {pseudo} à la salle.",
    pack: 'braquage',
  },
  {
    id: 'braquage-cinematique',
    text: "{pseudo} a passé toute la semaine à regarder la cinématique d'intro.",
    pack: 'braquage',
  },
  {
    id: 'telerealite-aventure',
    text: "{pseudo} quitte l'aventure. Le Canap' remporte l'immunité.",
    pack: 'telerealite',
  },
  {
    id: 'telerealite-votes',
    text: 'Les votes sont clos : la salle élimine {pseudo} cette semaine.',
    pack: 'telerealite',
  },
  {
    id: 'telerealite-confessionnal',
    text: "Confessionnal de {pseudo} : « J'allais y aller, mais le Canap' a gagné. »",
    pack: 'telerealite',
  },
  {
    id: 'telerealite-officiel',
    text: "{pseudo} et le Canap', c'est officiel. La production confirme.",
    pack: 'telerealite',
  },
  {
    id: 'telerealite-epreuve',
    text: "Épreuve d'endurance : forfait. Épreuve de la sieste : victoire écrasante de {pseudo}.",
    pack: 'telerealite',
  },
  {
    id: 'telerealite-inedit',
    text: 'Ce soir, épisode inédit : {pseudo} cherche ses baskets. Toujours pas trouvées.',
    pack: 'telerealite',
  },
  {
    id: 'telerealite-casting',
    text: "Nouvelle saison : « Les Anges du Canap' ». {pseudo} décroche le casting.",
    pack: 'telerealite',
  },
  {
    id: 'telerealite-rose',
    text: "Le Canap' a reçu la rose. {pseudo} n'a même pas ouvert son sac de sport.",
    pack: 'telerealite',
  },
  {
    id: 'telerealite-clash',
    text: 'Clash en direct : {pseudo} contre son réveil. Le réveil a perdu.',
    pack: 'telerealite',
  },
  {
    id: 'telerealite-villa',
    text: '{pseudo} rentre à la villa. La salle, ce sera pour la saison prochaine.',
    pack: 'telerealite',
  },
  {
    id: 'rap-album',
    text: "{pseudo} sort son album : « Zéro séance ». Disque d'or au Canap'.",
    pack: 'rap',
  },
  {
    id: 'rap-freestyle',
    text: "Freestyle de {pseudo} : « J'ai pas bougé, mais j'avais le flow. »",
    pack: 'rap',
  },
  {
    id: 'rap-feat',
    text: "{pseudo} a sorti un feat avec le Canap'. Le clip est tourné en pyjama.",
    pack: 'rap',
  },
  {
    id: 'rap-studio',
    text: "{pseudo} était en studio toute la semaine. À poser… sur le Canap'.",
    pack: 'rap',
  },
  {
    id: 'rap-punchline',
    text: "Punchline du Canap' pour {pseudo} : « Ta barre est vide, la mienne est confort. »",
    pack: 'rap',
  },
  {
    id: 'rap-lache',
    text: '{pseudo} rappe « on lâche rien ». Résultat : salle lâchée.',
    pack: 'rap',
  },
  {
    id: 'rap-streams',
    text: "Featuring de l'année : {pseudo} × le Canap'. Zéro répétitions, que des streams.",
    pack: 'rap',
  },
  {
    id: 'rap-sac',
    text: "Le flow de {pseudo} a voyagé partout. Son sac de sport, lui, n'a pas bougé.",
    pack: 'rap',
  },
  {
    id: 'rap-tournee',
    text: '{pseudo} annule sa tournée des salles. Raison : canapé complet.',
    pack: 'rap',
  },
  {
    id: 'rap-diss',
    text: 'La salle a sorti un diss sur {pseudo}. Toujours pas de réponse.',
    pack: 'rap',
  },
  {
    id: 'manga-forme',
    text: "{pseudo} n'a pas atteint sa forme finale. Ni la salle.",
    pack: 'manga',
  },
  {
    id: 'manga-filler',
    text: "Épisode de remplissage : {pseudo} a passé la semaine sur le Canap'.",
    pack: 'manga',
  },
  {
    id: 'manga-arc',
    text: "« Je reviendrai plus fort », a dit {pseudo}. Fin de l'arc. Pas de séance.",
    pack: 'manga',
  },
  {
    id: 'manga-esquive',
    text: "Technique secrète de {pseudo} : l'esquive de la salle. Niveau maître.",
    pack: 'manga',
  },
  {
    id: 'manga-salon',
    text: "{pseudo} s'entraîne dans une salle hors du temps. Elle s'appelle le salon.",
    pack: 'manga',
  },
  {
    id: 'manga-ko',
    text: "Le Canap' lance l'attaque « Sieste éternelle ». {pseudo} est KO.",
    pack: 'manga',
  },
  {
    id: 'manga-sensei',
    text: 'Le sensei attend {pseudo} depuis lundi. Il a eu le temps de prendre sa retraite.',
    pack: 'manga',
  },
  {
    id: 'manga-flashback',
    text: 'Flash-back de 45 minutes : {pseudo} se souvient de sa dernière séance.',
    pack: 'manga',
  },
  {
    id: 'manga-ninja',
    text: "{pseudo} a juré sur son honneur de ninja d'aller à la salle. Ninja introuvable.",
    pack: 'manga',
  },
  {
    id: 'manga-suite',
    text: 'Suite au prochain épisode. Comme la séance de {pseudo}.',
    pack: 'manga',
  },
  {
    id: 'daron-neige',
    text: 'De mon temps, {pseudo}, on allait à la salle à pied. Dans la neige. En montée.',
    pack: 'daron',
  },
  {
    id: 'daron-retraite',
    text: "Tu crois que le Canap' va te payer ta retraite, {pseudo} ?",
    pack: 'daron',
  },
  {
    id: 'daron-lumiere',
    text: '{pseudo}, éteins la lumière en sortant. Ah non, tu ne sors jamais.',
    pack: 'daron',
  },
  {
    id: 'daron-decu',
    text: '« Je suis pas fâché, je suis déçu. » Le coach, à propos de {pseudo}.',
    pack: 'daron',
  },
  {
    id: 'daron-hotel',
    text: "{pseudo}, la salle c'est pas un hôtel. Le Canap' non plus.",
    pack: 'daron',
  },
  {
    id: 'daron-abonnement',
    text: "On t'a pas payé un abonnement pour décorer ton portefeuille, {pseudo}.",
    pack: 'daron',
  },
  {
    id: 'daron-chambre',
    text: "Range ta chambre et va à la salle. Tu n'as fait ni l'un ni l'autre, {pseudo}.",
    pack: 'daron',
  },
  {
    id: 'daron-demain',
    text: "{pseudo} a dit « j'y vais demain ». Demain, c'était il y a sept jours.",
    pack: 'daron',
  },
  {
    id: 'daron-rentabilise',
    text: 'Tu sais combien ça coûte, un canapé, {pseudo} ? Rentabilisé, visiblement.',
    pack: 'daron',
  },
  {
    id: 'daron-air',
    text: "Va prendre l'air, {pseudo}. La salle, c'est dehors.",
    pack: 'daron',
  },
  {
    id: 'horoscope-venus',
    text: "Vénus était alignée avec le Canap'. {pseudo} ne pouvait rien faire.",
    pack: 'horoscope',
  },
  {
    id: 'horoscope-mercure',
    text: 'Mercure rétrograde. {pseudo} aussi.',
    pack: 'horoscope',
  },
  {
    id: 'horoscope-astres',
    text: "Les astres l'avaient prédit : {pseudo} ne quittera pas le salon cette semaine.",
    pack: 'horoscope',
  },
  {
    id: 'horoscope-ascendant',
    text: 'Ascendant canapé : {pseudo} ne pouvait pas lutter.',
    pack: 'horoscope',
  },
  {
    id: 'horoscope-chance',
    text: 'Chance : 2/5. Énergie : 1/5. Motivation : en option. Signé : les astres de {pseudo}.',
    pack: 'horoscope',
  },
  {
    id: 'horoscope-lune',
    text: 'Pleine lune, sac de sport vide. Semaine difficile pour {pseudo}.',
    pack: 'horoscope',
  },
  {
    id: 'horoscope-conseil',
    text: 'Conseil des astres : bouger. Conseil suivi par {pseudo} : zapper.',
    pack: 'horoscope',
  },
  {
    id: 'horoscope-saturne',
    text: 'Saturne déconseillait le leg day. {pseudo} a aussi évité tous les autres jours.',
    pack: 'horoscope',
  },
  {
    id: 'horoscope-couleur',
    text: "Couleur porte-bonheur de {pseudo} cette semaine : celle du Canap'.",
    pack: 'horoscope',
  },
  {
    id: 'horoscope-prevision',
    text: 'Prévision : séance cette semaine. Fiabilité : faible. Les astres connaissent {pseudo}.',
    pack: 'horoscope',
  },
];

/** Text of a line for a player; unknown ids fall back to the first line. */
export function skipLineText(id: string, pseudo: string): string {
  const line = SKIP_LINES.find((l) => l.id === id) ?? SKIP_LINES[0];
  return line.text.replaceAll('{pseudo}', pseudo);
}
