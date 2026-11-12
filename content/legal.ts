/**
 * Legal texts (French), shown in the app and rendered to the public site (docs/) by
 * scripts/build-legal-site.ts. The publisher's identity lives in content/publisher.ts; the
 * EXPO_PUBLIC_LEGAL_* build variables can override it.
 */
import { APP_NAME } from './brand';
import { PUBLISHER, SITE_PAGES } from './publisher';

export type LegalInfo = {
  publisher: string | null;
  address: string | null;
  siret: string | null;
  phone: string | null;
  email: string | null;
  privacyUrl: string | null;
  termsUrl: string | null;
  noticeUrl: string | null;
};

export type LegalSection = { title: string; body: string[] };

const MISSING = '[à compléter avant publication]';
const v = (value: string | null) => value ?? MISSING;

export function legalInfo(): LegalInfo {
  const read = (value: string | undefined) => (value && value.trim().length ? value.trim() : null);
  return {
    publisher: read(process.env.EXPO_PUBLIC_LEGAL_PUBLISHER) ?? PUBLISHER.name,
    address: PUBLISHER.address,
    siret: PUBLISHER.siret,
    phone: PUBLISHER.phone,
    email: read(process.env.EXPO_PUBLIC_LEGAL_EMAIL) ?? PUBLISHER.email,
    privacyUrl: read(process.env.EXPO_PUBLIC_PRIVACY_URL) ?? SITE_PAGES.privacy,
    termsUrl: read(process.env.EXPO_PUBLIC_TERMS_URL) ?? SITE_PAGES.terms,
    noticeUrl: SITE_PAGES.notice,
  };
}

/** True when every field a store listing needs is set. */
export const legalComplete = (info: LegalInfo) =>
  Boolean(
    info.publisher &&
    info.address &&
    info.siret &&
    info.phone &&
    info.email &&
    info.privacyUrl &&
    info.termsUrl,
  );

export function privacySections(info: LegalInfo): LegalSection[] {
  return [
    {
      title: 'Qui est responsable',
      body: [
        `${APP_NAME} est édité par ${v(info.publisher)}. Pour toute question sur tes données : ${v(info.email)}.`,
      ],
    },
    {
      title: 'Ta position ne quitte jamais ton téléphone',
      body: [
        'Pour savoir si tu es à ta salle, ton téléphone compare sa position à celle de ta salle (cercle de 150 m). Ce calcul se fait sur le téléphone.',
        'Le serveur ne reçoit jamais de coordonnées GPS : seulement l’identifiant de ta salle et l’heure d’arrivée et de départ de ta séance. Aucun trajet n’est enregistré.',
        'Pour chercher une salle « autour de moi », ton téléphone interroge directement le moteur de recherche d’OpenStreetMap (Nominatim) avec une position arrondie à environ 1 km. Nos serveurs ne la reçoivent que si ce moteur ne répond pas, et ne la conservent jamais.',
      ],
    },
    {
      title: 'Ce que l’on stocke',
      body: [
        'Ton compte (adresse e-mail ou identifiant Apple / Google), ton pseudo, ta photo si tu en ajoutes une, ton titre, ton objectif hebdomadaire et tes réponses de l’écran d’accueil.',
        'Les salles que tu as choisies (salles publiques issues d’OpenStreetMap), tes séances validées (date, heures, durée, salle), tes teams, spots, jokers, cartes SKIP, bilans et trophées.',
        'Le jeton de notification de ton téléphone, tes préférences (notifications, sons, vibrations) et l’état de ton abonnement.',
      ],
    },
    {
      title: 'Ce que ta team voit',
      body: [
        'Ton pseudo, ta photo, ton titre, ta carte de lifter, ton compteur de la semaine (par exemple 2/3) et un statut du jour : « Fait », « À la salle » ou « Pas encore ».',
        'Ta team ne voit jamais ta salle, ton heure d’arrivée ni ta position.',
      ],
    },
    {
      title: 'Pourquoi',
      body: [
        'Ces données servent uniquement à faire tourner le jeu (barre de la team, cartes SKIP, bilans, séries, ceintures), à t’envoyer les notifications que tu as choisies et à gérer ton abonnement. Base légale : l’exécution du service que tu as demandé.',
        'Aucune publicité, aucune revente, aucun profilage publicitaire.',
      ],
    },
    {
      title: 'Prestataires',
      body: [
        'Supabase (hébergement de la base de données et des fonctions serveur, région Paris), Expo (acheminement des notifications), RevenueCat, Apple et Google (abonnements et connexion), OpenStreetMap (Nominatim et Overpass pour la recherche de salles, avec une position arrondie à ~1 km ; API OpenStreetMap pour vérifier la salle choisie).',
      ],
    },
    {
      title: 'Durée de conservation',
      body: [
        'Tes données sont conservées tant que ton compte existe. Quand tu supprimes ton compte depuis l’app (Réglages → Supprimer mon compte), elles sont effacées immédiatement et définitivement.',
      ],
    },
    {
      title: 'Tes droits',
      body: [
        `Tu peux accéder à tes données (écran « Tes données »), les corriger (Réglages), les supprimer (Supprimer mon compte) et t’opposer aux notifications à tout moment. Pour toute autre demande : ${v(info.email)}. Tu peux aussi saisir la CNIL (cnil.fr).`,
      ],
    },
  ];
}

export function termsSections(info: LegalInfo): LegalSection[] {
  return [
    {
      title: 'Le service',
      body: [
        `${APP_NAME}, édité par ${v(info.publisher)}, est un jeu de motivation entre amis : tes séances de sport validées chargent la barre de ta team, et chaque semaine ratée vaut une carte SKIP.`,
      ],
    },
    {
      title: 'Ton compte',
      body: [
        'Tu dois avoir au moins 15 ans. Ton compte est personnel. Tu restes responsable de ce que tu publies (pseudo, photo, nom de team).',
      ],
    },
    {
      title: 'Les règles du jeu',
      body: [
        'Une séance compte si tu restes au moins 40 minutes dans ta salle, une fois par jour. Contourner le pointage (position simulée, salle inventée) est interdit et peut entraîner la suppression du compte.',
        'Les cartes SKIP se moquent de l’excuse ou du canapé, jamais de la personne. Pas de harcèlement : un créateur de team peut exclure un membre, et tout le monde peut en signaler un.',
      ],
    },
    {
      title: 'Abonnement',
      body: [
        `${APP_NAME} est payant (formule annuelle ou hebdomadaire, offre Team), avec une période d’essai gratuite quand elle est proposée. Le paiement et le renouvellement automatique sont gérés par l’App Store ou Google Play ; tu peux résilier à tout moment depuis les réglages de ton compte store, au plus tard 24 h avant la fin de la période en cours.`,
        'Une formule annuelle ou hebdomadaire donne aussi l’accès, sans frais, aux autres joueurs de ta première team (celle que tu as créée ou rejointe en premier) tant qu’elle compte 4 joueurs au plus. L’offre Team donne l’accès à toute ta team, jusqu’à 8 joueurs. Ces accès durent tant que l’abonnement de celui qui paie est actif.',
      ],
    },
    {
      title: 'Santé',
      body: [
        `${APP_NAME} n’est pas un service médical. Adapte ton entraînement à ta condition physique ; en cas de blessure, utilise le joker et prends soin de toi.`,
      ],
    },
    {
      title: 'Responsabilité et évolution',
      body: [
        'Le service peut évoluer ou être interrompu pour maintenance. Le pointage dépend du GPS de ton téléphone et peut parfois se tromper : le plan B « Je suis à la salle » est là pour ça.',
        'Ces conditions peuvent changer ; tout changement important sera annoncé dans l’app.',
      ],
    },
    {
      title: 'Contact et droit applicable',
      body: [
        `Contact : ${v(info.email)}. Droit français. En cas de litige, une solution amiable sera recherchée avant toute action.`,
      ],
    },
  ];
}

/** Mentions légales (LCEN, article 6 III): publisher, publication director, hosts. */
export function noticeSections(info: LegalInfo): LegalSection[] {
  return [
    {
      title: 'Éditeur',
      body: [
        `${APP_NAME} (application mobile et site ${SITE_PAGES.support}) est édité par ${v(info.publisher)}, entrepreneur individuel.`,
        `Adresse : ${v(info.address)}.`,
        `SIRET : ${v(info.siret)}.`,
        `Téléphone : ${v(info.phone)}. E-mail : ${v(info.email)}.`,
      ],
    },
    {
      title: 'Directeur de la publication',
      body: [`${v(info.publisher)}.`],
    },
    {
      title: 'Hébergement',
      body: [
        'Site : GitHub Pages, GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis (github.com).',
        'Données de l’application : Supabase (supabase.com), serveurs situés à Paris (France).',
      ],
    },
    {
      title: 'Propriété intellectuelle',
      body: [
        `Le nom ${APP_NAME}, le Canap’, les textes, illustrations et sons de l’application sont protégés. Toute reproduction sans autorisation est interdite. La police Archivo est distribuée sous licence SIL Open Font License ; les données des salles proviennent d’OpenStreetMap (© contributeurs OpenStreetMap, licence ODbL).`,
      ],
    },
  ];
}
