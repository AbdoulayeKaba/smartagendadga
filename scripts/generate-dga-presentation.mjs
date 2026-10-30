/**
 * Présentation DGA — 5 diapositives avec captures d’écran.
 * Usage : node scripts/generate-dga-presentation.mjs
 */
import PptxGenJS from 'pptxgenjs';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'docs', 'presentations');
const captures = join(outDir, 'captures');
const outFile = join(outDir, 'Presentation-DGA-Agenda-Institution-ARPT.pptx');

const LOGO_FULL = join(root, 'scripts', 'arpt-logo-source.jpeg');
const LOGO_INST = join(root, 'data', 'platform-branding', 'institution-logo.jpg');
const logoPath = existsSync(LOGO_FULL) ? LOGO_FULL : LOGO_INST;

const IMG = {
  landing: join(captures, 'landing.png'),
  mail: join(captures, 'mail-table.png'),
  mailBoard: join(captures, 'mail-board.png'),
  missions: join(captures, 'missions-sync.png'),
  rdv: join(captures, 'rdv-salle.png'),
  form: join(captures, 'mail-form.png'),
};

mkdirSync(outDir, { recursive: true });

const RED = 'C8102E';
const GREEN = '1F7A3A';
const GREEN_DARK = '0F4A24';
const YELLOW = 'E8B923';
const SOFT = 'F4F8F5';
const MUTED = '5A6660';
const WHITE = 'FFFFFF';
const LINE = 'D7E3DA';
const INK = '1A2B22';

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'WIDE';
pptx.author = 'ARPT / DG / DGA';
pptx.title = 'Plateforme de gestion de l’agenda du DGA';
pptx.subject = 'Institution · Gain de temps · Traçabilité · Modules métier';

function addLogo(slide, opts = {}) {
  if (!existsSync(logoPath)) return;
  const { x = 0.55, y = 0.28, w = 2.2, h = 0.88, plate = true } = opts;
  if (plate) {
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x: x - 0.08,
      y: y - 0.06,
      w: w + 0.16,
      h: h + 0.12,
      fill: { color: WHITE },
      line: { color: LINE },
      rectRadius: 0.08,
    });
  }
  slide.addImage({ path: logoPath, x, y, w, h });
}

function addFooter(slide, page) {
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 7.12,
    w: 13.333,
    h: 0.38,
    fill: { color: SOFT },
    line: { color: SOFT },
  });
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 7.12,
    w: 13.333,
    h: 0.06,
    fill: { color: RED },
    line: { color: RED },
  });
  slide.addText('© 2026 — ARPT / DG / DGA · Usage interne', {
    x: 0.5,
    y: 7.2,
    w: 9,
    h: 0.25,
    fontSize: 10,
    color: MUTED,
    fontFace: 'Calibri',
  });
  slide.addText(`${page} / 5`, {
    x: 11.4,
    y: 7.2,
    w: 1.4,
    h: 0.25,
    fontSize: 10,
    color: MUTED,
    align: 'right',
    fontFace: 'Calibri',
  });
}

function addSideAccent(slide) {
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 0.14,
    h: 7.5,
    fill: { color: GREEN },
    line: { color: GREEN },
  });
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0.14,
    y: 0,
    w: 0.07,
    h: 7.5,
    fill: { color: YELLOW },
    line: { color: YELLOW },
  });
}

function shotFrame(slide, { x, y, w, h, path, label }) {
  if (!existsSync(path)) return false;
  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x,
    y,
    w,
    h,
    fill: { color: WHITE },
    line: { color: LINE },
    rectRadius: 0.08,
  });
  // image inset
  slide.addImage({
    path,
    x: x + 0.08,
    y: y + 0.08,
    w: w - 0.16,
    h: h - (label ? 0.42 : 0.16),
  });
  if (label) {
    slide.addText(label, {
      x: x + 0.1,
      y: y + h - 0.32,
      w: w - 0.2,
      h: 0.25,
      fontSize: 11,
      bold: true,
      color: GREEN_DARK,
      align: 'center',
      fontFace: 'Calibri',
    });
  }
  return true;
}

/** 1 — Titre + capture accueil */
function slideTitle() {
  const slide = pptx.addSlide();
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: WHITE },
  });
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.14,
    fill: { color: RED },
    line: { color: RED },
  });
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 0.14,
    w: 13.333,
    h: 0.06,
    fill: { color: YELLOW },
    line: { color: YELLOW },
  });
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 0.2,
    w: 13.333,
    h: 0.06,
    fill: { color: GREEN },
    line: { color: GREEN },
  });

  addLogo(slide, { x: 0.55, y: 0.45, w: 2.4, h: 0.95 });

  slide.addText('Plateforme de gestion de l’agenda du DGA', {
    x: 3.2,
    y: 0.5,
    w: 9.5,
    h: 0.55,
    fontSize: 26,
    bold: true,
    color: GREEN_DARK,
    fontFace: 'Calibri',
  });
  slide.addText(
    'Un outil de pilotage pour l’institution  ·  Gain de temps  ·  Traçabilité  ·  Visibilité',
    {
      x: 3.2,
      y: 1.05,
      w: 9.5,
      h: 0.35,
      fontSize: 14,
      color: MUTED,
      fontFace: 'Calibri',
    }
  );

  shotFrame(slide, {
    x: 0.55,
    y: 1.7,
    w: 12.2,
    h: 4.85,
    path: IMG.landing,
    label: 'Accueil institutionnel — Connexion sécurisée · Traçabilité complète',
  });

  addFooter(slide, 1);
}

/** 2 — Problème */
function slideProblem() {
  const slide = pptx.addSlide();
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: WHITE },
  });
  addSideAccent(slide);
  addLogo(slide, { x: 10.55, y: 0.28, w: 2.2, h: 0.88 });

  slide.addText('01  ·  Le contexte actuel', {
    x: 0.55,
    y: 0.35,
    w: 9.5,
    h: 0.3,
    fontSize: 13,
    bold: true,
    color: RED,
    fontFace: 'Calibri',
  });
  slide.addText('Les limites naturelles de l’organisation', {
    x: 0.55,
    y: 0.65,
    w: 9.5,
    h: 0.4,
    fontSize: 24,
    bold: true,
    color: GREEN_DARK,
    fontFace: 'Calibri',
  });

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.55,
    y: 1.2,
    w: 5.9,
    h: 5.4,
    fill: { color: SOFT },
    line: { color: LINE },
    rectRadius: 0.1,
  });
  slide.addText(
    'Monsieur le Directeur Général Adjoint, aujourd’hui la gestion de l’agenda et des activités de l’institution repose souvent sur plusieurs canaux : courriers, appels, WhatsApp ou mails.\n\nCela rend parfois le suivi difficile, allonge le temps de traitement et complique la recherche d’informations lorsqu’il faut revenir sur un ancien rendez-vous ou un dossier.',
    {
      x: 0.8,
      y: 1.45,
      w: 5.4,
      h: 3.2,
      fontSize: 14,
      color: INK,
      fontFace: 'Calibri',
    }
  );

  const points = [
    { t: 'Canaux multiples', d: 'Demandes dispersées sur plusieurs supports.' },
    { t: 'Suivi fragmenté', d: 'Statut d’une demande peu visible immédiatement.' },
    { t: 'Mémoire dispersée', d: 'Recherche lente d’un ancien RDV ou courrier.' },
  ];
  points.forEach((p, i) => {
    const y = 4.55 + i * 0.65;
    slide.addText(p.t, {
      x: 0.8,
      y,
      w: 5.4,
      h: 0.28,
      fontSize: 13,
      bold: true,
      color: GREEN_DARK,
      fontFace: 'Calibri',
    });
    slide.addText(p.d, {
      x: 0.8,
      y: y + 0.26,
      w: 5.4,
      h: 0.28,
      fontSize: 12,
      color: MUTED,
      fontFace: 'Calibri',
    });
  });

  shotFrame(slide, {
    x: 6.7,
    y: 1.2,
    w: 6.05,
    h: 5.4,
    path: IMG.form,
    label: 'Exemple — Enregistrement structuré d’un courrier',
  });

  addFooter(slide, 2);
}

/** 3 — Modules + captures */
function slideModules() {
  const slide = pptx.addSlide();
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: WHITE },
  });
  addSideAccent(slide);
  addLogo(slide, { x: 10.55, y: 0.22, w: 2.15, h: 0.82 });

  slide.addText('02  ·  Le périmètre de la plateforme', {
    x: 0.5,
    y: 0.25,
    w: 9.5,
    h: 0.28,
    fontSize: 13,
    bold: true,
    color: RED,
    fontFace: 'Calibri',
  });
  slide.addText('Modules métier de l’institution — vues réelles', {
    x: 0.5,
    y: 0.52,
    w: 9.5,
    h: 0.35,
    fontSize: 22,
    bold: true,
    color: GREEN_DARK,
    fontFace: 'Calibri',
  });

  // 3 captures
  shotFrame(slide, {
    x: 0.4,
    y: 1.05,
    w: 4.15,
    h: 3.55,
    path: IMG.mail,
    label: 'Courriers — tableau de board',
  });
  shotFrame(slide, {
    x: 4.7,
    y: 1.05,
    w: 4.15,
    h: 3.55,
    path: IMG.missions,
    label: 'Missions & navigation annuelle',
  });
  shotFrame(slide, {
    x: 9.0,
    y: 1.05,
    w: 3.9,
    h: 3.55,
    path: IMG.rdv,
    label: 'RDV + réservation de salle',
  });

  // Module chips
  const chips = [
    'Rendez-vous',
    'RDV personnels',
    'Missions',
    'Contacts stratégiques',
    'Réservation de salles',
    'Courriers',
    'Navigation annuelle',
    'Documents & suivi',
  ];
  chips.forEach((label, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.45 + col * 3.2;
    const y = 4.85 + row * 0.85;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x,
      y,
      w: 3.05,
      h: 0.7,
      fill: { color: SOFT },
      line: { color: LINE },
      rectRadius: 0.08,
    });
    slide.addShape(pptx.shapes.RECTANGLE, {
      x,
      y,
      w: 0.12,
      h: 0.7,
      fill: { color: col % 3 === 0 ? GREEN : col % 3 === 1 ? RED : YELLOW },
      line: { color: col % 3 === 0 ? GREEN : col % 3 === 1 ? RED : YELLOW },
    });
    slide.addText(label, {
      x: x + 0.25,
      y: y + 0.18,
      w: 2.65,
      h: 0.35,
      fontSize: 13,
      bold: true,
      color: GREEN_DARK,
      fontFace: 'Calibri',
      valign: 'middle',
    });
  });

  addFooter(slide, 3);
}

/** 4 — Bénéfices + capture */
function slideBenefits() {
  const slide = pptx.addSlide();
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: WHITE },
  });
  addSideAccent(slide);
  addLogo(slide, { x: 10.55, y: 0.22, w: 2.15, h: 0.82 });

  slide.addText('03  ·  Les bénéfices pour l’institution', {
    x: 0.5,
    y: 0.25,
    w: 9.5,
    h: 0.28,
    fontSize: 13,
    bold: true,
    color: RED,
    fontFace: 'Calibri',
  });
  slide.addText('Gain de temps · Traçabilité · Aide à la décision', {
    x: 0.5,
    y: 0.52,
    w: 9.5,
    h: 0.35,
    fontSize: 22,
    bold: true,
    color: GREEN_DARK,
    fontFace: 'Calibri',
  });

  const cols = [
    {
      title: 'Gain de temps',
      color: GREEN,
      items: [
        'Demande en quelques minutes',
        'Recherche en quelques secondes',
        'Disponibilités DGA immédiates',
        'Anti-doublon & notifications',
        'Programme quotidien généré',
      ],
    },
    {
      title: 'Traçabilité',
      color: RED,
      items: [
        'Demande enregistrée',
        'Modifications historisées',
        'Auteur / date / heure',
        'Documents conservés',
        'Contrôle par rôle',
      ],
    },
    {
      title: 'Aide à la décision',
      color: YELLOW,
      items: [
        'Volume de RDV / semaine',
        'Institutions les plus reçues',
        'Délai moyen de traitement',
        'Périodes chargées',
        'Dossiers en attente',
      ],
    },
  ];

  cols.forEach((c, i) => {
    const x = 0.4 + i * 2.95;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x,
      y: 1.05,
      w: 2.85,
      h: 5.55,
      fill: { color: i === 1 ? WHITE : SOFT },
      line: { color: LINE },
      rectRadius: 0.08,
    });
    slide.addShape(pptx.shapes.RECTANGLE, {
      x,
      y: 1.05,
      w: 2.85,
      h: 0.1,
      fill: { color: c.color },
      line: { color: c.color },
    });
    slide.addText(c.title, {
      x: x + 0.15,
      y: 1.3,
      w: 2.55,
      h: 0.4,
      fontSize: 15,
      bold: true,
      color: GREEN_DARK,
      fontFace: 'Calibri',
    });
    c.items.forEach((item, j) => {
      slide.addText('•  ' + item, {
        x: x + 0.15,
        y: 1.85 + j * 0.7,
        w: 2.55,
        h: 0.55,
        fontSize: 12,
        color: INK,
        fontFace: 'Calibri',
      });
    });
  });

  shotFrame(slide, {
    x: 9.3,
    y: 1.05,
    w: 3.55,
    h: 5.55,
    path: IMG.mailBoard,
    label: 'Suivi live — délais & priorités',
  });

  addFooter(slide, 4);
}

/** 5 — Conclusion */
function slideClosing() {
  const slide = pptx.addSlide();
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: WHITE },
  });
  addSideAccent(slide);
  addLogo(slide, { x: 10.55, y: 0.22, w: 2.15, h: 0.82 });

  slide.addText('04  ·  Conclusion', {
    x: 0.5,
    y: 0.25,
    w: 9.5,
    h: 0.28,
    fontSize: 13,
    bold: true,
    color: RED,
    fontFace: 'Calibri',
  });
  slide.addText('Moderniser le pilotage de l’institution', {
    x: 0.5,
    y: 0.52,
    w: 9.5,
    h: 0.35,
    fontSize: 22,
    bold: true,
    color: GREEN_DARK,
    fontFace: 'Calibri',
  });

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5,
    y: 1.05,
    w: 7.3,
    h: 2.35,
    fill: { color: SOFT },
    line: { color: LINE },
    rectRadius: 0.1,
  });
  slide.addText(
    'L’objectif est de moderniser la gestion de l’agenda et des activités du DGA avec trois bénéfices majeurs : un gain de temps significatif, une traçabilité complète et une meilleure qualité de suivi. L’institution gagne en efficacité, en sécurité et en visibilité.',
    {
      x: 0.75,
      y: 1.25,
      w: 6.85,
      h: 1.95,
      fontSize: 14,
      color: INK,
      fontFace: 'Calibri',
      valign: 'middle',
    }
  );

  shotFrame(slide, {
    x: 8.0,
    y: 1.05,
    w: 4.8,
    h: 2.35,
    path: IMG.missions,
    label: 'Bilan annuel missions / agenda',
  });

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 0.5,
    y: 3.6,
    w: 5.9,
    h: 1.85,
    fill: { color: WHITE },
    line: { color: LINE },
    rectRadius: 0.1,
  });
  slide.addText('L’IA comme assistant', {
    x: 0.75,
    y: 3.8,
    w: 5.4,
    h: 0.35,
    fontSize: 15,
    bold: true,
    color: GREEN,
    fontFace: 'Calibri',
  });
  slide.addText(
    'Elle n’a pas vocation à remplacer les décisions. Elle aide à reformuler, détecter les conflits, proposer des créneaux et préparer le programme de la journée.',
    {
      x: 0.75,
      y: 4.25,
      w: 5.4,
      h: 1.0,
      fontSize: 13,
      color: MUTED,
      fontFace: 'Calibri',
    }
  );

  slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
    x: 6.6,
    y: 3.6,
    w: 6.2,
    h: 1.85,
    fill: { color: GREEN_DARK },
    line: { color: GREEN_DARK },
    rectRadius: 0.1,
  });
  slide.addText(
    '« Nous ne proposons pas simplement un agenda numérique. Nous proposons un outil de pilotage qui rend l’organisation de l’institution plus rapide, plus transparente et plus efficace. »',
    {
      x: 6.9,
      y: 3.85,
      w: 5.65,
      h: 1.4,
      fontSize: 14,
      bold: true,
      color: WHITE,
      fontFace: 'Calibri',
      valign: 'middle',
    }
  );

  const kpis = [
    { v: 'Temps', l: 'Moins de tâches répétitives' },
    { v: 'Trace', l: 'Chaque action historisée' },
    { v: 'Vision', l: 'Pilotage annuel & modules' },
  ];
  kpis.forEach((k, i) => {
    const x = 0.5 + i * 4.2;
    slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
      x,
      y: 5.7,
      w: 4.0,
      h: 0.95,
      fill: { color: SOFT },
      line: { color: LINE },
      rectRadius: 0.08,
    });
    slide.addText(k.v, {
      x,
      y: 5.8,
      w: 4.0,
      h: 0.35,
      fontSize: 15,
      bold: true,
      color: GREEN_DARK,
      align: 'center',
      fontFace: 'Calibri',
    });
    slide.addText(k.l, {
      x,
      y: 6.15,
      w: 4.0,
      h: 0.35,
      fontSize: 12,
      color: MUTED,
      align: 'center',
      fontFace: 'Calibri',
    });
  });

  addFooter(slide, 5);
}

slideTitle();
slideProblem();
slideModules();
slideBenefits();
slideClosing();

await pptx.writeFile({ fileName: outFile });
console.log(`Presentation générée : ${outFile}`);
console.log('Captures intégrées :');
for (const [k, p] of Object.entries(IMG)) {
  console.log(`  - ${k}: ${existsSync(p) ? 'OK' : 'MANQUANT'}`);
}
