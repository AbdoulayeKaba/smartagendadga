import type { UrgencyLevel } from '@/lib/dg/appointment-business-rules';

export type AiGenerationMode = 'ai' | 'fallback';

export type AiGenerationResult<T> = {
  mode: AiGenerationMode;
  data: T;
  generatedAt: string;
};

export type DailyAgendaAgendaItem = {
  id: string;
  time: string;
  title: string;
  requester: string;
  priority: string;
  urgencyLabel: string;
  urgentOverride: boolean;
  conflict?: boolean;
};

export type DailyAgendaPendingItem = {
  title: string;
  slot: string;
  requester: string;
  urgencyLabel: string;
  priority: string;
};

export type DailyAgendaStats = {
  approvedToday: number;
  /** RDV confirmés du jour déjà terminés (endAt < maintenant). */
  completedOrPast: number;
  pendingQueue: number;
  conflicts: number;
  highPriorityPending: number;
  approvedWeek: number;
  roomReservationsToday: number;
};

export type DailyAgendaResult = {
  title: string;
  briefing: string;
  highlights: string[];
  conflicts: DailyAgendaConflict[];
  agendaItems: DailyAgendaAgendaItem[];
  pendingItems: DailyAgendaPendingItem[];
  pendingCount: number;
  stats: DailyAgendaStats;
  aiNarrative?: string;
};

export type DailyAgendaConflict = {
  id: string;
  timeLabel: string;
  sameStart: boolean;
  appointmentIds: string[];
  items: { id: string; title: string; time: string; requester: string }[];
  message: string;
};

export type AgendaWeekDayPressure = {
  key: string;
  label: string;
  confirmed: number;
  pending: number;
  isToday: boolean;
};

/** Lecture complémentaire au cockpit : la semaine, pas le déroulé du jour. */
export type AgendaWeekPressure = {
  weekLabel: string;
  days: AgendaWeekDayPressure[];
  confirmedWeek: number;
  pendingOnWeek: number;
  pendingOutsideWeek: number;
  highPriorityPending: number;
  urgentPending: number;
  onsiteWeek: number;
  onlineWeek: number;
  roomsWeek: number;
  reading: string[];
};

export type DgaDaySummaryResult = {
  title: string;
  summary: string;
  keyPoints: string[];
  workload: { appointmentsToday: number; pendingQueue: number; loadPercent: number };
};

export type ReformulateRequestInput = {
  title: string;
  description: string;
  justification?: string;
  urgencyLevel?: UrgencyLevel;
  type?: string;
};

export type ReformulateRequestResult = {
  title: string;
  description: string;
  changes: string[];
};

export type AnalyzeUrgencyInput = {
  title: string;
  description: string;
  justification?: string;
  declaredLevel: UrgencyLevel;
  priority?: string;
  type?: string;
};

export type AnalyzeUrgencyResult = {
  suggestedLevel: UrgencyLevel;
  declaredLevel: UrgencyLevel;
  aligned: boolean;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
  flags: string[];
  recommendations: string[];
};
