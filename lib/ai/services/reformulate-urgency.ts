import type { UrgencyLevel } from '@/lib/dg/appointment-business-rules';
import {
  DEFAULT_APPOINTMENT_BUSINESS_RULES,
  urgencyRequiresJustification,
} from '@/lib/dg/appointment-business-rules';
import { completeChat, parseJsonFromLlm } from '@/lib/ai/client';
import type { AiGenerationResult, ReformulateRequestInput, ReformulateRequestResult } from '@/lib/ai/types';

function capitalizeTitle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function fallbackReformulate(input: ReformulateRequestInput): ReformulateRequestResult {
  const changes: string[] = [];
  let title = cleanText(input.title);
  let description = cleanText(input.description);

  if (title && title !== capitalizeTitle(title)) {
    title = capitalizeTitle(title);
    changes.push('Titre mis en forme (majuscule initiale).');
  }

  if (title && !title.toLowerCase().startsWith('rdv') && input.type === 'EXTERNAL') {
    title = `RDV — ${title}`;
    changes.push('Préfixe « RDV — » ajouté pour une demande externe.');
  }

  if (description && description.length > 0 && !description.endsWith('.')) {
    description = `${description}.`;
    changes.push('Description ponctuée.');
  }

  if (!description && input.justification?.trim()) {
    description = input.justification.trim();
    changes.push('Description enrichie à partir de la justification.');
  }

  if (description.length > 0 && description.length < 40) {
    description = `${description} Demande soumise pour examen par le cabinet DGA.`;
    changes.push('Description complétée pour plus de contexte.');
  }

  if (changes.length === 0) {
    changes.push('Formulation déjà claire — aucun ajustement nécessaire.');
  }

  return { title, description, changes };
}

export async function reformulateAppointmentRequest(
  input: ReformulateRequestInput
): Promise<AiGenerationResult<ReformulateRequestResult>> {
  const fallback = fallbackReformulate(input);

  const aiRaw = await completeChat([
    {
      role: 'system',
      content:
        'Tu reformules des demandes de rendez-vous pour le cabinet DGA. Style formel, concis, en français. JSON : {"title":"...","description":"...","changes":["..."]}',
    },
    {
      role: 'user',
      content: JSON.stringify({
        title: input.title,
        description: input.description,
        justification: input.justification ?? '',
        urgencyLevel: input.urgencyLevel ?? 'NORMAL',
        type: input.type ?? 'INTERNAL',
      }),
    },
  ]);

  const parsed = aiRaw
    ? parseJsonFromLlm<ReformulateRequestResult>(aiRaw)
    : null;

  if (parsed?.title) {
    return {
      mode: 'ai',
      generatedAt: new Date().toISOString(),
      data: {
        title: parsed.title.trim(),
        description: (parsed.description ?? '').trim(),
        changes: parsed.changes?.length ? parsed.changes : ['Reformulation assistée par IA.'],
      },
    };
  }

  return {
    mode: 'fallback',
    generatedAt: new Date().toISOString(),
    data: fallback,
  };
}

const URGENCY_KEYWORDS: Record<UrgencyLevel, string[]> = {
  NORMAL: [],
  URGENT: ['urgent', 'rapidement', 'prioritaire', 'dès que possible'],
  TRES_URGENT: ['très urgent', 'tres urgent', 'immédiat', 'critique', 'asap'],
  CRITIQUE: ['critique', 'extrême', 'extrême urgence', 'national', 'ministre'],
};

function scoreUrgency(text: string): UrgencyLevel {
  const lower = text.toLowerCase();
  if (URGENCY_KEYWORDS.CRITIQUE.some((k) => lower.includes(k))) return 'CRITIQUE';
  if (URGENCY_KEYWORDS.TRES_URGENT.some((k) => lower.includes(k))) return 'TRES_URGENT';
  if (URGENCY_KEYWORDS.URGENT.some((k) => lower.includes(k))) return 'URGENT';
  return 'NORMAL';
}

const LEVEL_RANK: Record<UrgencyLevel, number> = {
  NORMAL: 0,
  URGENT: 1,
  TRES_URGENT: 2,
  CRITIQUE: 3,
};

function fallbackAnalyzeUrgency(input: import('@/lib/ai/types').AnalyzeUrgencyInput) {
  const corpus = [input.title, input.description, input.justification ?? ''].join(' ').trim();
  const suggestedLevel = scoreUrgency(corpus);
  const aligned = LEVEL_RANK[suggestedLevel] <= LEVEL_RANK[input.declaredLevel];
  const flags: string[] = [];
  const recommendations: string[] = [];

  if (
    urgencyRequiresJustification(
      DEFAULT_APPOINTMENT_BUSINESS_RULES.urgencyJustification,
      input.declaredLevel
    ) &&
    !input.justification?.trim()
  ) {
    flags.push('Justification manquante pour le niveau d\'urgence déclaré.');
    recommendations.push('Ajouter une justification détaillée (motif, impact, délai).');
  }

  if (!aligned) {
    flags.push('Le niveau déclaré semble supérieur au contenu de la demande.');
    recommendations.push('Réévaluer le niveau d\'urgence ou enrichir la justification.');
  }

  if (input.priority === 'HIGH' && suggestedLevel === 'NORMAL') {
    flags.push('Priorité haute avec urgence textuelle faible — vérifier la cohérence.');
  }

  if (corpus.length < 30) {
    flags.push('Demande peu détaillée — analyse limitée.');
    recommendations.push('Compléter le titre et la description pour une meilleure analyse.');
  }

  const rationale =
    suggestedLevel === input.declaredLevel
      ? `Le niveau « ${input.declaredLevel} » est cohérent avec le contenu analysé.`
      : `Analyse textuelle suggère « ${suggestedLevel} » alors que « ${input.declaredLevel} » est déclaré.`;

  return {
    suggestedLevel,
    declaredLevel: input.declaredLevel,
    aligned: aligned && flags.length === 0,
    confidence: corpus.length > 80 ? ('high' as const) : corpus.length > 30 ? ('medium' as const) : ('low' as const),
    rationale,
    flags,
    recommendations,
  };
}

export async function analyzeAppointmentUrgency(
  input: import('@/lib/ai/types').AnalyzeUrgencyInput
): Promise<AiGenerationResult<import('@/lib/ai/types').AnalyzeUrgencyResult>> {
  const fallback = fallbackAnalyzeUrgency(input);

  const aiRaw = await completeChat([
    {
      role: 'system',
      content:
        'Tu analyses l\'urgence des demandes de RDV pour le cabinet DGA. Niveaux : NORMAL, URGENT, TRES_URGENT, CRITIQUE. JSON : {"suggestedLevel":"...","rationale":"...","flags":["..."],"recommendations":["..."],"confidence":"low|medium|high"}',
    },
    { role: 'user', content: JSON.stringify(input) },
  ]);

  const parsed = aiRaw
    ? parseJsonFromLlm<{
        suggestedLevel: UrgencyLevel;
        rationale: string;
        flags: string[];
        recommendations: string[];
        confidence: 'low' | 'medium' | 'high';
      }>(aiRaw)
    : null;

  if (parsed?.suggestedLevel) {
    return {
      mode: 'ai',
      generatedAt: new Date().toISOString(),
      data: {
        suggestedLevel: parsed.suggestedLevel,
        declaredLevel: input.declaredLevel,
        aligned:
          LEVEL_RANK[parsed.suggestedLevel] <= LEVEL_RANK[input.declaredLevel] &&
          (!parsed.flags?.length || parsed.flags.length === 0),
        confidence: parsed.confidence ?? 'medium',
        rationale: parsed.rationale,
        flags: parsed.flags ?? [],
        recommendations: parsed.recommendations ?? [],
      },
    };
  }

  return {
    mode: 'fallback',
    generatedAt: new Date().toISOString(),
    data: fallback,
  };
}
