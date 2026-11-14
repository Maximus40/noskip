// Renders the public legal site (GitHub Pages, served from docs/) from content/legal.ts, so the
// app and the web pages always say the same thing. Usage:
//   deno run --sloppy-imports --allow-read --allow-write --allow-env scripts/build-legal-site.ts
//   ... --check   (fails if docs/ is out of date; part of `npm run check`)
import { APP_NAME, APP_SCHEME, APP_WORDMARK } from '../content/brand.ts';
import {
  type LegalSection,
  legalInfo,
  noticeSections,
  privacySections,
  termsSections,
} from '../content/legal.ts';
import { APP_STORE_URL, SITE_PAGES } from '../content/publisher.ts';

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

/**
 * Invite landing page (…/rejoindre/?code=ABCD2345): what a guest sees when tapping the link a
 * friend shared. Install the app, open the invite in it, or copy the code to paste in the app.
 */
function joinPage(): string {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ta team t’attend · ${esc(APP_NAME)}</title>
<meta name="description" content="Un pote t’invite dans sa team sur ${esc(APP_NAME)}, le jeu de muscu entre potes.">
<meta property="og:title" content="Ta team t’attend sur ${esc(APP_NAME)}">
<meta property="og:description" content="Chaque séance charge la barre de la team. Chaque skip finit en carte pour le Canap’.">
<link rel="icon" type="image/png" href="../favicon.png">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<style>
  @font-face { font-family: ArchivoBlack; src: url('../fonts/Archivo-Black.ttf') format('truetype'); font-display: swap; }
  :root { color-scheme: dark; --bg: #111214; --card: #1D1E22; --text: #F5F5F0; --muted: #A3A4A9; --accent: #FF6A3D; --ink: #0E0E0F; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; color: var(--text);
    background: radial-gradient(ellipse 90% 45% at 50% 40%, rgba(255,106,61,.28), transparent 70%), var(--bg);
    font: 17px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  main { max-width: 480px; margin: 0 auto; padding: 32px 16px 48px; }
  .brand { font-family: ArchivoBlack, sans-serif; font-size: 24px; letter-spacing: -.05em; }
  .brand span, .dot { color: var(--accent); }
  .eyebrow { color: var(--accent); font-weight: 700; letter-spacing: .14em; text-transform: uppercase; font-size: 13px; margin: 40px 0 6px; }
  h1 { font-family: ArchivoBlack, sans-serif; font-size: clamp(44px, 14vw, 64px); line-height: .95; letter-spacing: -.04em; margin: 0 0 16px; }
  .lead { color: #C9CACE; margin: 0 0 24px; }
  .code { background: var(--card); border-radius: 18px; padding: 18px; text-align: center; margin-bottom: 20px; }
  .code small { color: var(--muted); display: block; letter-spacing: .12em; text-transform: uppercase; font-size: 12px; }
  .code strong { font-family: ArchivoBlack, sans-serif; font-size: 40px; letter-spacing: .04em; display: block; margin: 4px 0 10px; }
  .btn { display: block; width: 100%; text-align: center; padding: 16px; border-radius: 14px; font-weight: 700; font-size: 17px;
    text-decoration: none; border: 0; cursor: pointer; margin: 0 0 12px; font-family: inherit; }
  .primary { background: var(--accent); color: var(--ink); }
  .secondary { background: transparent; color: var(--text); border: 1.5px solid rgba(255,255,255,.22); }
  ol { padding-left: 20px; color: #C9CACE; margin: 24px 0 0; }
  li { margin-bottom: 8px; }
  .note { color: var(--muted); font-size: 14px; margin-top: 20px; }
  .bad { display: none; }
</style>
</head>
<body>
<main>
<div class="brand">${esc(APP_WORDMARK)}<span>.</span></div>
<p class="eyebrow">Invitation</p>
<h1>TA TEAM T’ATTEND<span class="dot">.</span></h1>
<p class="lead">Un pote t’invite dans sa team. Chaque séance charge la barre de la team, chaque skip finit en carte pour le Canap’.</p>
<div class="code" id="codebox">
  <small>Ton code d’invitation</small>
  <strong id="code">····-····</strong>
  <button class="btn secondary" id="copy" type="button">Copier le code</button>
</div>
<p class="lead bad" id="bad">Lien incomplet : demande le code à ton pote, ou un nouveau lien.</p>
<a class="btn primary" href="${APP_STORE_URL}">1 · Installer ${esc(APP_NAME)}</a>
<a class="btn secondary" id="open" href="${APP_SCHEME}://">2 · J’ai l’app : ouvrir l’invitation</a>
<ol>
  <li>Installe l’app (iPhone ; Android arrive bientôt).</li>
  <li>Reviens ici et touche « ouvrir l’invitation » : tu rejoins la team en créant ton compte.</li>
  <li>Le bouton ne marche pas ? Dans l’app, à l’étape « Avec qui tu soulèves ? », choisis « Rejoindre » puis « Coller le code reçu ».</li>
</ol>
<p class="note">Ta position ne quitte jamais ton téléphone : ta team voit seulement « venu » ou « pas venu ».</p>
</main>
<script>
  (function () {
    var raw = (new URLSearchParams(location.search).get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    var ok = /^[A-HJ-NP-Z2-9]{8}$/.test(raw);
    if (!ok) {
      document.getElementById('codebox').style.display = 'none';
      document.getElementById('bad').style.display = 'block';
      return;
    }
    var pretty = raw.slice(0, 4) + '-' + raw.slice(4);
    document.getElementById('code').textContent = pretty;
    document.getElementById('open').href = '${APP_SCHEME}://join/' + raw;
    var copy = document.getElementById('copy');
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = 'Code copié ✓'; };
      if (navigator.clipboard) navigator.clipboard.writeText(pretty).then(done, done);
      else done();
    });
  })();
</script>
</body>
</html>
`;
}

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
  'rejoindre/index.html': joinPage(),
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
