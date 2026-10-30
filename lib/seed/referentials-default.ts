import type { ReferentialCategoryId } from '@/lib/dg/referential-catalog';
import type { ReferentialItemMeta } from '@/lib/dg/referential-types';

export type ReferentialSeedRow = {
  categoryId: ReferentialCategoryId;
  name: string;
  value?: string;
  meta?: ReferentialItemMeta;
};

/** Données référentiels par défaut (alignées sur le mode démo). */
export const DEFAULT_REFERENTIAL_SEED: ReferentialSeedRow[] = [
  {
    categoryId: 'jours-feries',
    name: 'Fête du Travail',
    value: '2026-05-01',
    meta: {
      kind: 'holiday',
      date: '2026-05-01',
      type: 'national',
      annualRepeat: true,
      active: true,
    },
  },
  {
    categoryId: 'jours-feries',
    name: 'Indépendance',
    value: '2026-10-02',
    meta: {
      kind: 'holiday',
      date: '2026-10-02',
      type: 'national',
      annualRepeat: true,
      active: true,
    },
  },
  {
    categoryId: 'jours-feries',
    name: 'Nouvel An',
    value: '2026-01-01',
    meta: {
      kind: 'holiday',
      date: '2026-01-01',
      type: 'national',
      annualRepeat: true,
      active: true,
    },
  },
  {
    categoryId: 'jours-feries',
    name: 'Fête de Noël',
    value: '2026-12-25',
    meta: {
      kind: 'holiday',
      date: '2026-12-25',
      type: 'religious',
      annualRepeat: true,
      active: true,
    },
  },
  {
    categoryId: 'indisponibilites',
    name: 'Mission institutionnelle',
    meta: {
      kind: 'unavailability',
      type: 'autres',
      typeOther: 'Mission institutionnelle',
      startDate: '2026-06-10',
      endDate: '2026-06-12',
      startTime: '08:00',
      endTime: '18:00',
      motif: 'Mission hors siège — coordination partenaires',
      confidentialityLevel: 'restreint',
      active: true,
    },
  },
  {
    categoryId: 'indisponibilites',
    name: 'Congé annuel',
    meta: {
      kind: 'unavailability',
      type: 'conge',
      startDate: '2026-08-01',
      endDate: '2026-08-15',
      startTime: '00:00',
      endTime: '23:59',
      motif: 'Congé annuel du cabinet',
      confidentialityLevel: 'standard',
      active: true,
    },
  },
  { categoryId: 'types-rdv', name: 'Audience officielle' },
  { categoryId: 'types-rdv', name: 'Point de coordination' },
  { categoryId: 'types-rdv', name: 'Visioconférence' },
  { categoryId: 'types-rdv', name: 'Urgence cabinet' },
  { categoryId: 'lieux', name: 'Bureau du DGA' },
  { categoryId: 'lieux', name: 'Salle du Conseil' },
  { categoryId: 'lieux', name: 'Salle de réunion 12ème étage' },
  { categoryId: 'lieux', name: 'Salle de réunion 11ème étage' },
  { categoryId: 'lieux', name: 'En ligne (Teams)' },
  { categoryId: 'motifs', name: 'Suivi de dossier' },
  { categoryId: 'motifs', name: 'Briefing partenaire' },
  { categoryId: 'motifs', name: 'Signature / validation' },
  { categoryId: 'motifs', name: 'Audience institutionnelle' },
  { categoryId: 'motifs', name: 'Arbitrage de dossier' },
  { categoryId: 'motifs', name: 'Point de conformité' },
  { categoryId: 'motifs', name: 'Préparation de déplacement' },
  { categoryId: 'departements', name: 'Cabinet DGA' },
  { categoryId: 'departements', name: 'DDCN' },
  { categoryId: 'departements', name: 'Affaires réglementaires' },
  { categoryId: 'departements', name: 'Communication' },
  { categoryId: 'departements', name: 'Juridique' },
];
