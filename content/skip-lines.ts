/**
 * SKIP card one-liners, signed by le Canap'. `{pseudo}` is replaced by the player's name.
 *
 * Absolute rule: mock the excuse, the couch, the comfort — never the body, the weight or
 * the person. Ids are stored in `skip_cards.line_id`: never rename or reuse an id, only add
 * new ones (a removed id falls back to the first line). After any change run
 * `npm run sync:shared` so the Edge Function draws from the same ids.
 */
/** Packs sold in the shop (noskip.shop.pack.<pack>): their lines join the team's draw. */
export const JOKE_PACKS = ['foot', 'gaming'] as const;
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
  { id: 'fatigue', text: "« J'étais crevé. » Le Canap' valide l'excuse, la team non." },
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
    text: 'Carton rouge pour {pseudo} : expulsé de la salle par lui-même.',
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
    text: '{pseudo} est resté bloqué au tuto « prendre son sac de sport ».',
    pack: 'gaming',
  },
  {
    id: 'gaming-ranked',
    text: "Classement de la team : {pseudo} descend en division Canap'.",
    pack: 'gaming',
  },
  { id: 'gaming-gg', text: "GG au Canap', qui a gagné sans toucher la manette.", pack: 'gaming' },
];

/** Text of a line for a player; unknown ids fall back to the first line. */
export function skipLineText(id: string, pseudo: string): string {
  const line = SKIP_LINES.find((l) => l.id === id) ?? SKIP_LINES[0];
  return line.text.replaceAll('{pseudo}', pseudo);
}
