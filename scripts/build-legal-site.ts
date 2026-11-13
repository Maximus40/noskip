// Renders the public legal site (GitHub Pages, served from docs/) from content/legal.ts, so the
// app and the web pages always say the same thing. Usage:
//   deno run --sloppy-imports --allow-read --allow-write --allow-env scripts/build-legal-site.ts
//   ... --check   (fails if docs/ is out of date; part of `npm run check`)
import { APP_NAME, APP_WORDMARK } from '../content/brand.ts';
import {
  type LegalSection,
  legalInfo,
  noticeSections,
  privacySections,
  termsSections,
} from '../content/legal.ts';
import { SITE_PAGES } from '../content/publisher.ts';

const OUT = new URL('../docs/', import.meta.url);
const check = Deno.args.includes('--check');

const esc = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** Escapes, then turns bare URLs and e-mail addresses into links. */
function linkify(text: string): string {
  return esc(text)
    .replace(/https:\/\/[^\s,;)]+[^\s,;).]/g, (url) => `<a href="${url}">${url}</a>`)
    .replace(
      /(^|[\s(])([\w.+-]+@[\w-]+\.[\w.-]*\w)/g,
      (_m, pre: string, mail: string) => `${pre}<a href="mailto:${mail}">${mail}</a>`,
    );
}

const NAV = [
  ['Support', SITE_PAGES.support],
  ['Confidentialité', SITE_PAGES.privacy],
  ['CGU', SITE_PAGES.terms],
  ['Mentions légales', SITE_PAGES.notice],
] as const;

function page(title: string, heading: string, body: string, depth: number): string {
  const root = depth ? '../'.repeat(depth) : './';
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(APP_NAME)}</title>
<meta name="description" content="${esc(`${APP_NAME} : ${title}`)}">
<link rel="icon" type="image/png" href="${root}favicon.png">
<link rel="apple-touch-icon" href="${root}apple-touch-icon.png">
<style>
  @font-face { font-family: ArchivoBlack; src: url('${root}fonts/Archivo-Black.ttf') format('truetype'); font-display: swap; }
  :root { color-scheme: dark; --bg: #111214; --card: #1D1E22; --text: #F5F5F0; --muted: #A3A4A9; --accent: #FF6A3D; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  .brand { font-family: ArchivoBlack, sans-serif; font-size: 28px; letter-spacing: -.05em; color: var(--text); text-decoration: none; }
  .brand span { color: var(--accent); }
  h1 { font-size: clamp(32px, 8vw, 48px); line-height: 1.05; letter-spacing: -.02em; margin: 8px 0 24px; text-transform: uppercase; }
  nav { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-bottom: 32px; }
  nav a { color: var(--muted); }
  nav a[aria-current] { color: var(--text); font-weight: 600; }
  section { background: var(--card); border-radius: 18px; padding: 20px; margin: 0 0 16px; }
  h2 { font-size: 19px; margin: 0 0 8px; }
  p { margin: 0 0 10px; } p:last-child { margin-bottom: 0; }
  a { color: var(--accent); overflow-wrap: anywhere; }
  footer { color: var(--muted); font-size: 14px; margin-top: 32px; }
</style>
</head>
<body>
<main>
<a class="brand" href="${root}" aria-label="${esc(APP_NAME)}">${esc(APP_WORDMARK)}<span>.</span></a>
<h1>${esc(heading)}</h1>
<nav>${NAV.map(([label, url]) => `<a href="${url}"${label === title ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('')}</nav>
${body}
<footer>${esc(APP_NAME)} · le jeu de muscu entre potes.</footer>
</main>
</body>
</html>
`;
}

const sections = (list: LegalSection[]) =>
  list
    .map(
      (s) =>
        `<section><h2>${esc(s.title)}</h2>${s.body.map((p) => `<p>${linkify(p)}</p>`).join('')}</section>`,
    )
    .join('\n');

const info = legalInfo();
const contact = info.email ?? '[à compléter avant publication]';

const support: LegalSection[] = [
  {
    title: 'C’est quoi ?',
    body: [
      `${APP_NAME} est un jeu de motivation entre potes : chaque séance de muscu validée charge un disque sur la barre de ta team, et chaque semaine ratée vaut une carte SKIP signée le Canap’.`,
    ],
  },
  {
    title: 'Besoin d’aide ?',
    body: [`Écris-nous : ${contact}. On répond en général sous 48 h.`],
  },
  {
    title: 'Gérer ou résilier ton abonnement',
    body: [
      'Dans l’app : Réglages → Abonnement → Gérer mon abonnement. Ou sur iPhone : Réglages → ton nom → Abonnements. La résiliation doit être faite au plus tard 24 h avant la fin de la période en cours.',
    ],
  },
  {
    title: 'Supprimer ton compte',
    body: [
      'Dans l’app : Réglages → Supprimer mon compte. Toutes tes données sont effacées immédiatement. Ton abonnement store n’est pas résilié automatiquement : pense à le résilier aussi.',
    ],
  },
  {
    title: 'Ta position',
    body: [
      'Ta position ne quitte jamais ton téléphone : le serveur reçoit seulement l’identifiant de ta salle et les heures de ta séance. Détails dans la politique de confidentialité.',
    ],
  },
];

const files: Record<string, string> = {
  'index.html': page('Support', `${APP_NAME}.`, sections(support), 0),
  'confidentialite/index.html': page(
    'Confidentialité',
    'Politique de confidentialité.',
    sections(privacySections(info)),
    1,
  ),
  'cgu/index.html': page('CGU', 'Conditions d’utilisation.', sections(termsSections(info)), 1),
  'mentions-legales/index.html': page(
    'Mentions légales',
    'Mentions légales.',
    sections(noticeSections(info)),
    1,
  ),
  // Serve the files as they are (no Jekyll processing).
  '.nojekyll': '',
};

// The logo font (SIL OFL, see assets/fonts/OFL.txt) is served with the site.
const fontSrc = new URL('../assets/fonts/Archivo-Black.ttf', import.meta.url);
const fontDst = new URL('fonts/Archivo-Black.ttf', OUT);
const fontBytes = await Deno.readFile(fontSrc);
let fontCurrent: Uint8Array | null = null;
try {
  fontCurrent = await Deno.readFile(fontDst);
} catch {
  fontCurrent = null;
}
const sameFont =
  fontCurrent !== null &&
  fontCurrent.length === fontBytes.length &&
  fontCurrent.every((b, i) => b === fontBytes[i]);

let stale = false;
if (!sameFont) {
  if (check) {
    console.error('docs/fonts/Archivo-Black.ttf is out of date: run npm run build:site');
    stale = true;
  } else {
    await Deno.mkdir(new URL('fonts/', OUT), { recursive: true });
    await Deno.writeFile(fontDst, fontBytes);
    await Deno.copyFile(
      new URL('../assets/fonts/OFL.txt', import.meta.url),
      new URL('fonts/OFL.txt', OUT),
    );
    console.log('wrote docs/fonts/Archivo-Black.ttf');
  }
}
for (const [path, content] of Object.entries(files)) {
  const url = new URL(path, OUT);
  let current: string | null = null;
  try {
    current = await Deno.readTextFile(url);
  } catch {
    current = null;
  }
  if (current === content) continue;
  if (check) {
    console.error(`docs/${path} is out of date: run npm run build:site`);
    stale = true;
    continue;
  }
  await Deno.mkdir(new URL('.', url), { recursive: true });
  await Deno.writeTextFile(url, content);
  console.log(`wrote docs/${path}`);
}
if (stale) Deno.exit(1);
