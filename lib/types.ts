// User & Authentication Types
export type UserRole = 
  | 'super_admin' 
  | 'admin_metier' 
  | 'analyste' 
  | 'decideur' 
  | 'auditeur' 
  | 'lecture_seule';

export const USER_ROLE_LABELS: Record<UserRole, { fr: string; en: string }> = {
  super_admin: { fr: 'Super Administrateur', en: 'Super Administrator' },
  admin_metier: { fr: 'Administrateur Métier', en: 'Business Administrator' },
  analyste: { fr: 'Analyste / Chargé de veille', en: 'Analyst / Watch Officer' },
  decideur: { fr: 'Décideur / Manager', en: 'Decision Maker / Manager' },
  auditeur: { fr: 'Auditeur', en: 'Auditor' },
  lecture_seule: { fr: 'Lecture seule', en: 'Read Only' },
};

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  permissions: Permission[];
  perimeter: {
    countries: string[];
    themes: string[];
  };
  createdAt: Date;
  lastLogin?: Date;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  details: string;
  ipAddress: string;
  timestamp: Date;
}

// Document Types
export type DocumentStatus = 'en_vigueur' | 'abroge' | 'en_revision' | 'non_signe' | 'a_valider' | 'brouillon';
export type DocumentCriticality = 'critique' | 'majeur' | 'mineur' | 'info';

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, { fr: string; en: string }> = {
  en_vigueur: { fr: 'En vigueur', en: 'In Force' },
  abroge: { fr: 'Abrogé', en: 'Repealed' },
  en_revision: { fr: 'En révision', en: 'Under Revision' },
  non_signe: { fr: 'Non signé', en: 'Not Signed' },
  a_valider: { fr: 'À valider', en: 'Pending Validation' },
  brouillon: { fr: 'Brouillon', en: 'Draft' },
};

export const DOCUMENT_CRITICALITY_LABELS: Record<DocumentCriticality, { fr: string; en: string }> = {
  critique: { fr: 'Critique', en: 'Critical' },
  majeur: { fr: 'Majeur', en: 'Major' },
  mineur: { fr: 'Mineur', en: 'Minor' },
  info: { fr: 'Information', en: 'Information' },
};

export interface RegulatoryDocument {
  id: string;
  title: string;
  reference: string;
  type: string;
  country: string;
  institution: string;
  publicationDate: Date;
  effectiveDate?: Date;
  expirationDate?: Date;
  status: DocumentStatus;
  criticality: DocumentCriticality;
  themes: string[];
  tags: string[];
  summary?: string;
  sourceUrl?: string;
  fileUrl?: string;
  aiScore?: number;
  aiKeywords?: string[];
  aiSummary?: string;
  aiRecommendation?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  title: string;
  changes: string;
  fileUrl?: string;
  createdAt: Date;
  createdBy: string;
}

export type DocumentRelationType = 'abroge' | 'modifie' | 'complete' | 'remplace';

export interface DocumentRelation {
  id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  relationType: DocumentRelationType;
  description?: string;
  createdAt: Date;
}

export interface Annotation {
  id: string;
  documentId: string;
  userId: string;
  userName: string;
  content: string;
  highlightText?: string;
  position?: { page: number; x: number; y: number };
  createdAt: Date;
  updatedAt: Date;
}

// Source & Collection Types
export type SourceType = 'rss' | 'api' | 'scraping';
export type SourceStatus = 'active' | 'inactive' | 'error';

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  status: SourceStatus;
  countries: string[];
  themes: string[];
  frequency: string;
  priority: number;
  lastRun?: Date;
  nextRun?: Date;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type CollectionRunStatus = 'success' | 'partial' | 'failed' | 'running';

export interface CollectionRun {
  id: string;
  sourceId: string;
  sourceName: string;
  status: CollectionRunStatus;
  startedAt: Date;
  completedAt?: Date;
  itemsFound: number;
  itemsProcessed: number;
  duplicatesFound: number;
  errors: string[];
}

export interface CollectionItem {
  id: string;
  runId: string;
  title: string;
  url: string;
  extractedData: Record<string, unknown>;
  isDuplicate: boolean;
  duplicateOf?: string;
  processedAt?: Date;
}

// AI Agent Types
export interface AIKeyword {
  id: string;
  keyword: string;
  weight: number;
  language: string;
  themes: string[];
  synonyms: string[];
  isActive: boolean;
  createdAt: Date;
}

export interface AIRule {
  id: string;
  name: string;
  condition: {
    type: 'keyword' | 'theme' | 'source' | 'country';
    operator: 'contains' | 'equals' | 'starts_with';
    value: string;
  };
  action: {
    type: 'set_priority' | 'route_to' | 'notify';
    value: string;
  };
  isActive: boolean;
  createdAt: Date;
}

export interface AIDetection {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  relevanceScore: number;
  triggeredKeywords: string[];
  suggestedType: string;
  suggestedThemes: string[];
  suggestedCountry: string;
  explainability: string;
  detectedAt: Date;
  status: 'pending' | 'validated' | 'rejected' | 'published';
}

export interface AIMetric {
  id: string;
  period: string;
  precision: number;
  falsePositives: number;
  validationRate: number;
  averageScore: number;
  topKeywords: { keyword: string; count: number }[];
  bestSources: { source: string; score: number }[];
  noisySources: { source: string; falsePositives: number }[];
}

// Benchmark Types
export interface Benchmark {
  id: string;
  name: string;
  description: string;
  countries: string[];
  themes: string[];
  period: { start: Date; end: Date };
  criteria: BenchmarkCriterion[];
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
  createdBy: string;
}

export interface BenchmarkCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
}

export interface BenchmarkResult {
  id: string;
  benchmarkId: string;
  country: string;
  scores: { criterionId: string; score: number; comment: string }[];
  totalScore: number;
  maxPossibleScore: number;
  evaluatedAt: Date;
  evaluatedBy: string;
}

// Compliance Types
export interface ComplianceModel {
  id: string;
  name: string;
  description: string;
  version: number;
  indicators: ComplianceIndicator[];
  thresholds: {
    green: number;
    orange: number;
    red: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceIndicator {
  id: string;
  name: string;
  description: string;
  weight: number;
  formula?: string;
  dataSource?: string;
}

export interface ComplianceScore {
  id: string;
  modelId: string;
  country: string;
  theme: string;
  period: string;
  scores: { indicatorId: string; value: number }[];
  totalScore: number;
  status: 'green' | 'orange' | 'red';
  trend: 'up' | 'down' | 'stable';
  contributingDocuments: string[];
  calculatedAt: Date;
}

// Action Plan Types
export type ActionStatus = 'a_faire' | 'en_cours' | 'termine' | 'annule' | 'en_retard';
export type ActionPriority = 'haute' | 'moyenne' | 'basse';

export const ACTION_STATUS_LABELS: Record<ActionStatus, { fr: string; en: string }> = {
  a_faire: { fr: 'À faire', en: 'To Do' },
  en_cours: { fr: 'En cours', en: 'In Progress' },
  termine: { fr: 'Terminé', en: 'Completed' },
  annule: { fr: 'Annulé', en: 'Cancelled' },
  en_retard: { fr: 'En retard', en: 'Overdue' },
};

export interface ActionPlanItem {
  id: string;
  title: string;
  description: string;
  justification: string;
  priority: ActionPriority;
  status: ActionStatus;
  owner: string;
  ownerName: string;
  dueDate: Date;
  linkedDocumentId?: string;
  linkedBenchmarkId?: string;
  linkedComplianceId?: string;
  reminders: Date[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Alert & Notification Types
export type AlertChannel = 'email' | 'in_app' | 'sms' | 'teams';
export type AlertEventStatus = 'sent' | 'queued' | 'failed' | 'read';

export interface AlertSubscription {
  id: string;
  userId: string;
  name: string;
  filters: {
    countries?: string[];
    themes?: string[];
    types?: string[];
    institutions?: string[];
    keywords?: string[];
    criticality?: DocumentCriticality[];
  };
  channels: AlertChannel[];
  frequency: 'immediate' | 'daily' | 'weekly';
  isActive: boolean;
  createdAt: Date;
}

export interface AlertEvent {
  id: string;
  subscriptionId: string;
  userId: string;
  channel: AlertChannel;
  subject: string;
  content: string;
  status: AlertEventStatus;
  sentAt?: Date;
  readAt?: Date;
  error?: string;
  createdAt: Date;
}

// Referential Types
export interface Country {
  id: string;
  code: string;
  name: string;
  region: string;
  isActive: boolean;
}

export interface Institution {
  id: string;
  name: string;
  acronym: string;
  country: string;
  type: string;
  website?: string;
  isActive: boolean;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  color: string;
  isActive: boolean;
}

export interface DocumentType {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

// Translation Type
export type Language = 'fr' | 'en';

export interface Translation {
  fr: string;
  en: string;
}
