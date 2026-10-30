import type { AppointmentStatus, AppointmentType, Priority } from '@prisma/client';
import type { AppointmentRequestMeta } from '@/lib/dg/appointment-request-meta';
import { embedDescriptionWithMeta } from '@/lib/dg/appointment-request-meta';
import { AUTO_REJECT_EXPIRED_REASON } from '@/lib/dg/appointment-expiry';

export type DemoAppointmentSeed = {
  id: string;
  title: string;
  userText?: string;
  meta?: Partial<AppointmentRequestMeta>;
  slotStartOffset: number;
  slotStartHour: number;
  slotStartMinute?: number;
  durationMinutes: number;
  createdOffset: number;
  createdHour?: number;
  createdMinute?: number;
  status: AppointmentStatus;
  priority: Priority;
  type: AppointmentType;
  urgentOverride?: boolean;
  reviewed?: boolean;
  autoRejected?: boolean;
  location?: string | null;
};

export type DemoAppointmentDates = {
  startAt: Date;
  endAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export const DEMO_APPOINTMENT_RECORDS: DemoAppointmentSeed[] = [
  {
    id: 'appt-demo-1',
    title: 'RDV — Dr. Aissatou Bah',
    meta: { urgencyLevel: 'NORMAL' },
    slotStartOffset: -5,
    slotStartHour: 9,
    slotStartMinute: 0,
    durationMinutes: 60,
    createdOffset: -5,
    createdHour: 15,
    createdMinute: 42,
    status: 'PENDING',
    priority: 'MEDIUM',
    type: 'EXTERNAL',
  },
  {
    id: 'appt-demo-2',
    title: 'toomoro',
    meta: { urgencyLevel: 'NORMAL' },
    slotStartOffset: -4,
    slotStartHour: 11,
    slotStartMinute: 0,
    durationMinutes: 60,
    createdOffset: -4,
    createdHour: 10,
    createdMinute: 15,
    status: 'PENDING',
    priority: 'LOW',
    type: 'PERSONAL',
  },
  {
    id: 'appt-demo-3',
    title: 'cas 1',
    userText: 'nsdfje',
    meta: { urgencyLevel: 'TRES_URGENT', planningPriority: true },
    urgentOverride: true,
    slotStartOffset: -3,
    slotStartHour: 14,
    slotStartMinute: 0,
    durationMinutes: 60,
    createdOffset: -3,
    createdHour: 9,
    createdMinute: 30,
    status: 'APPROVED',
    priority: 'HIGH',
    type: 'INTERNAL',
    reviewed: true,
  },
  {
    id: 'appt-demo-4',
    title: 'Point coordination ministère',
    meta: { urgencyLevel: 'URGENT' },
    slotStartOffset: 2,
    slotStartHour: 10,
    slotStartMinute: 0,
    durationMinutes: 90,
    createdOffset: -1,
    createdHour: 16,
    createdMinute: 20,
    status: 'PENDING',
    priority: 'HIGH',
    type: 'MINISTRY',
  },
  {
    id: 'appt-demo-5',
    title: 'Revue hebdomadaire cabinet',
    meta: { urgencyLevel: 'NORMAL' },
    slotStartOffset: 1,
    slotStartHour: 15,
    slotStartMinute: 0,
    durationMinutes: 60,
    createdOffset: 0,
    createdHour: 8,
    createdMinute: 45,
    status: 'APPROVED',
    priority: 'MEDIUM',
    type: 'INTERNAL',
    reviewed: true,
    location: 'Cabinet DGA',
  },
  {
    id: 'appt-demo-6',
    title: 'Audience — partenaire technique',
    meta: { urgencyLevel: 'NORMAL', autoRejected: true },
    slotStartOffset: -7,
    slotStartHour: 16,
    slotStartMinute: 30,
    durationMinutes: 45,
    createdOffset: -7,
    createdHour: 11,
    createdMinute: 0,
    status: 'REJECTED',
    priority: 'MEDIUM',
    type: 'EXTERNAL',
    autoRejected: true,
    reviewed: true,
  },
];

function atDayOffset(offset: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export function resolveDemoAppointmentDates(row: DemoAppointmentSeed): DemoAppointmentDates {
  const startAt = atDayOffset(row.slotStartOffset, row.slotStartHour, row.slotStartMinute ?? 0);
  const endAt = new Date(startAt);
  endAt.setMinutes(endAt.getMinutes() + row.durationMinutes);
  const createdAt = atDayOffset(row.createdOffset, row.createdHour ?? 10, row.createdMinute ?? 0);
  return {
    startAt,
    endAt,
    createdAt,
    updatedAt: createdAt,
  };
}

export function buildDemoAppointmentDescription(row: DemoAppointmentSeed): string | null {
  const meta: AppointmentRequestMeta = {
    urgencyLevel: row.meta?.urgencyLevel ?? 'NORMAL',
    preContact: row.meta?.preContact ?? [],
    justification: row.meta?.justification,
    appointmentTypeRef: row.meta?.appointmentTypeRef,
    locationRef: row.meta?.locationRef,
    motifRef: row.meta?.motifRef,
    strategicProject: row.meta?.strategicProject,
    businessScore: row.meta?.businessScore,
    workflowSteps: row.meta?.workflowSteps,
    autoRejected: row.autoRejected ?? row.meta?.autoRejected,
    autoRejectReason: row.autoRejected ? AUTO_REJECT_EXPIRED_REASON : row.meta?.autoRejectReason,
    planningPriority: row.meta?.planningPriority,
    excelImport: row.meta?.excelImport,
  };
  const embedded = embedDescriptionWithMeta(row.userText ?? '', meta);
  return embedded || null;
}

export function demoAppointmentRejectionReason(row: DemoAppointmentSeed) {
  if (row.autoRejected) return AUTO_REJECT_EXPIRED_REASON;
  return null;
}

type PrismaAppointmentCreate = {
  id: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  priority: Priority;
  type: AppointmentType;
  requestedById: string;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  urgentOverride: boolean;
  location: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function demoAppointmentToPrismaCreate(
  row: DemoAppointmentSeed,
  actors: { requestedById: string; reviewedById: string }
): PrismaAppointmentCreate {
  const dates = resolveDemoAppointmentDates(row);
  const reviewed = Boolean(row.reviewed && row.status !== 'PENDING');
  return {
    id: row.id,
    title: row.title,
    description: buildDemoAppointmentDescription(row),
    startAt: dates.startAt,
    endAt: dates.endAt,
    status: row.status,
    priority: row.priority,
    type: row.type,
    requestedById: actors.requestedById,
    reviewedById: reviewed ? actors.reviewedById : null,
    reviewedAt: reviewed ? dates.updatedAt : null,
    rejectionReason: demoAppointmentRejectionReason(row),
    urgentOverride: row.urgentOverride ?? false,
    location: row.location ?? null,
    createdAt: dates.createdAt,
    updatedAt: dates.updatedAt,
  };
}
