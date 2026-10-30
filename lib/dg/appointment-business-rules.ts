import { formatIsoDateInAppTz } from '@/lib/datetime/format';
import { normalizeMinSubmissionLeadRule } from '@/lib/dg/min-submission-lead';

export type UrgencyLevel = 'NORMAL' | 'URGENT' | 'TRES_URGENT' | 'CRITIQUE';

export type PreContactChoice = 'chef_service' | 'directeur' | 'aucun';

export type ValidationWorkflow = {
  id: string;
  label: string;
  /** Correspondance sur le type RDV référentiel ou motif (sous-chaîne insensible à la casse). */
  matchPattern: string;
  steps: string[];
};

export type ScoringWeights = {
  director: number;
  deptHead: number;
  strategicProject: number;
  urgencyNormal: number;
  urgencyUrgent: number;
  urgencyTresUrgent: number;
  urgencyCritique: number;
};

export type BusinessRuleId =
  | 'minSubmissionLead'
  | 'maxPendingPerEmployee'
  | 'duplicateControl'
  | 'urgencyJustification'
  | 'standardizedDuration'
  | 'maxPerMonth'
  | 'hierarchicalValidation'
  | 'allowedSlotsOnly'
  | 'preContactFilter'
  | 'autoPrioritization';

export type AppointmentBusinessRules = {
  minSubmissionLead: {
    enabled: boolean;
    minHours: number;
    minDays: number;
  };
  maxPendingPerEmployee: {
    enabled: boolean;
    maxCount: number;
  };
  duplicateControl: {
    enabled: boolean;
  };
  urgencyJustification: {
    enabled: boolean;
    minChars: number;
    levels: UrgencyLevel[];
  };
  standardizedDuration: {
    enabled: boolean;
  };
  maxPerMonth: {
    enabled: boolean;
    maxCount: number;
    periodDays: number;
  };
  hierarchicalValidation: {
    enabled: boolean;
    workflows: ValidationWorkflow[];
  };
  allowedSlotsOnly: {
    enabled: boolean;
  };
  preContactFilter: {
    enabled: boolean;
    warnIfNone: boolean;
  };
  autoPrioritization: {
    enabled: boolean;
    weights: ScoringWeights;
    priorityThreshold: number;
  };
};

export const DEFAULT_APPOINTMENT_BUSINESS_RULES: AppointmentBusinessRules = {
  minSubmissionLead: { enabled: true, minHours: 0, minDays: 1 },
  maxPendingPerEmployee: { enabled: true, maxCount: 2 },
  duplicateControl: { enabled: true },
  urgencyJustification: {
    enabled: true,
    minChars: 50,
    levels: ['URGENT', 'TRES_URGENT', 'CRITIQUE'],
  },
  standardizedDuration: { enabled: false },
  maxPerMonth: { enabled: false, maxCount: 5, periodDays: 30 },
  hierarchicalValidation: {
    enabled: false,
    workflows: [],
  },
  allowedSlotsOnly: { enabled: true },
  preContactFilter: { enabled: false, warnIfNone: false },
  autoPrioritization: {
    enabled: false,
    priorityThreshold: 0,
    weights: {
      director: 0,
      deptHead: 0,
      strategicProject: 0,
      urgencyNormal: 0,
      urgencyUrgent: 0,
      urgencyTresUrgent: 0,
      urgencyCritique: 0,
    },
  },
};

export const BUSINESS_RULE_CATALOG: {
  id: BusinessRuleId;
  title: string;
  description: string;
}[] = [
  {
    id: 'minSubmissionLead',
    title: 'Délai minimum de soumission',
    description:
      'Nombre minimum d’heures ou de jours avant le créneau souhaité pour soumettre une demande.',
  },
  {
    id: 'maxPendingPerEmployee',
    title: 'Demandes en attente par employé',
    description: 'Limite le nombre de demandes ouvertes simultanément par demandeur.',
  },
  {
    id: 'duplicateControl',
    title: 'Contrôle des doublons',
    description: 'Bloque une demande identique (même objet et période) du même demandeur.',
  },
  {
    id: 'urgencyJustification',
    title: 'Justification de l’urgence',
    description: 'Exige une justification détaillée pour les niveaux urgent, très urgent ou critique.',
  },
  {
    id: 'standardizedDuration',
    title: 'Durée standardisée',
    description: 'Les durées autorisées proviennent du paramétrage horaires / types de RDV.',
  },
  {
    id: 'maxPerMonth',
    title: 'Plafond de rendez-vous par période',
    description: 'Nombre maximal de rendez-vous (validés ou en attente) par employé sur une période.',
  },
  {
    id: 'allowedSlotsOnly',
    title: 'Créneaux autorisés uniquement',
    description: 'Seuls les créneaux conformes aux horaires, indisponibilités et agenda DGA sont acceptés.',
  },
];

export const URGENCY_LEVEL_OPTIONS: { value: UrgencyLevel; label: string }[] = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'TRES_URGENT', label: 'Très urgent' },
  { value: 'CRITIQUE', label: 'Critique' },
];

export const PRE_CONTACT_OPTIONS: { value: PreContactChoice; label: string }[] = [
  { value: 'chef_service', label: 'Chef de service' },
  { value: 'directeur', label: 'Directeur' },
  { value: 'aucun', label: 'Aucun' },
];

export type UrgencyJustificationRule = AppointmentBusinessRules['urgencyJustification'];

export function urgencyRequiresJustification(
  rule: UrgencyJustificationRule,
  level: UrgencyLevel
): boolean {
  return rule.enabled && rule.levels.includes(level);
}

/** Le délai de politesse est levé seulement si l’urgence exigée est justifiée. */
export function isMinSubmissionLeadWaivedByUrgency(
  rule: UrgencyJustificationRule,
  level: UrgencyLevel,
  justification: string | null | undefined
): boolean {
  if (!urgencyRequiresJustification(rule, level)) return false;
  return (justification ?? '').trim().length >= rule.minChars;
}

/**
 * Urgence justifiée : le jour courant redevient choisissable
 * (férié, week-end, mission ou indisponibilité). Les autres jours gardent ces blocages.
 */
export function isSameDayOpenByJustifiedUrgency(
  rule: UrgencyJustificationRule,
  level: UrgencyLevel,
  justification: string | null | undefined,
  isoDate: string,
  now: Date = new Date()
): boolean {
  if (!isoDate || isoDate !== formatIsoDateInAppTz(now)) return false;
  return isMinSubmissionLeadWaivedByUrgency(rule, level, justification);
}

export function validateUrgencyJustification(
  rule: UrgencyJustificationRule,
  level: UrgencyLevel,
  justification: string | undefined | null
): string | null {
  if (!urgencyRequiresJustification(rule, level)) return null;
  const text = (justification ?? '').trim();
  if (text.length < rule.minChars) {
    return `La justification de l’urgence est obligatoire (minimum ${rule.minChars} caractères).`;
  }
  return null;
}

export function normalizeBusinessRules(
  raw: Partial<AppointmentBusinessRules> | null | undefined
): AppointmentBusinessRules {
  const d = DEFAULT_APPOINTMENT_BUSINESS_RULES;
  if (!raw) return { ...d };
  const minSubmissionLead = normalizeMinSubmissionLeadRule({
    ...d.minSubmissionLead,
    ...raw.minSubmissionLead,
  });
  return {
    minSubmissionLead,
    maxPendingPerEmployee: { ...d.maxPendingPerEmployee, ...raw.maxPendingPerEmployee },
    duplicateControl: { ...d.duplicateControl, ...raw.duplicateControl },
    urgencyJustification: {
      ...d.urgencyJustification,
      ...raw.urgencyJustification,
      levels: raw.urgencyJustification?.levels ?? d.urgencyJustification.levels,
    },
    standardizedDuration: { ...d.standardizedDuration, ...raw.standardizedDuration },
    maxPerMonth: { ...d.maxPerMonth, ...raw.maxPerMonth, enabled: false },
    hierarchicalValidation: {
      enabled: false,
      workflows: [],
    },
    allowedSlotsOnly: { ...d.allowedSlotsOnly, ...raw.allowedSlotsOnly },
    preContactFilter: { enabled: false, warnIfNone: false },
    autoPrioritization: {
      enabled: false,
      priorityThreshold: 0,
      weights: { ...d.autoPrioritization.weights },
    },
  };
}
