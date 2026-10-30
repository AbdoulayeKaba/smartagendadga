import { z } from 'zod';

const priority = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export const createProjectSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(5000).optional().nullable(),
  status: z.enum(['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
  ownerName: z.string().min(2).max(120),
  ownerUserId: z.string().optional().nullable(),
  phases: z.array(z.string().min(2).max(80)).max(12).default([]),
  startAt: z.string().datetime().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const assignTasksToProjectSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1).max(100),
  projectPhase: z.string().min(2).max(120).optional().nullable(),
});

export const createTaskSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  priority: priority.default('MEDIUM'),
  projectId: z.string().optional().nullable(),
  projectName: z.string().min(2).max(200).optional().nullable(),
  projectPhase: z.string().min(2).max(120).optional().nullable(),
  assigneeName: z.string().min(2).max(120),
  assigneeUserId: z.string().optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  estimatedHours: z.number().int().min(1).max(500).optional().nullable(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'SUSPENDED', 'COMPLETED', 'CANCELLED']).optional(),
});

export const taskCommentSchema = z.object({
  body: z.string().min(1).max(4000),
});

export const createDecisionSchema = z.object({
  title: z.string().min(3).max(200),
  context: z.string().max(5000).optional(),
  decisionText: z.string().min(3).max(8000),
  priority: priority.default('MEDIUM'),
  ownerName: z.string().min(2).max(120),
  ownerUserId: z.string().optional(),
  appointmentId: z.string().optional(),
  dueAt: z.string().datetime().optional().nullable(),
  meetingDate: z.string().datetime().optional().nullable(),
});

export const updateDecisionSchema = createDecisionSchema.partial().extend({
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CLOSED']).optional(),
});

const optionalDate = z.string().optional().nullable();

export const createMailSchema = z.object({
  direction: z.enum(['INCOMING', 'OUTGOING']),
  mailKind: z.enum(['DEPARTURE', 'VAULT']).optional(),
  registrationNumber: z.number().int().positive().max(999999).optional().nullable(),
  reference: z.string().min(2).max(80),
  counterpart: z.string().min(2).max(200),
  subject: z.string().min(3).max(300),
  mailDate: z.string(),
  priority: z.enum(['URGENT', 'NORMAL']).optional(),
  origin: z.string().max(200).optional().nullable(),
  dgaInstruction: z.string().max(120).optional().nullable(),
  executor: z.string().max(120).optional().nullable(),
  action: z.string().max(200).optional().nullable(),
  scSentAt: optionalDate,
  executionDeadline: optionalDate,
  followUp: z.string().max(4000).optional().nullable(),
  courierName: z.string().max(120).optional().nullable(),
  assignedService: z.string().max(120).optional().nullable(),
  assignedAt: optionalDate,
  notes: z.string().max(2000).optional().nullable(),
  hasAttachment: z.boolean().optional(),
  attachments: z
    .array(
      z.object({
        id: z.string().optional(),
        fileName: z.string().max(255),
        fileSize: z.number().int().nonnegative().max(50_000_000),
        mimeType: z.string().max(120),
        storageKey: z.string().max(500),
      })
    )
    .max(10)
    .optional(),
});

export const createContactSchema = z.object({
  category: z.enum([
    'MINISTRY',
    'INSTITUTION',
    'PARTNER',
    'SUPPLIER',
    'EMBASSY',
    'INTERNATIONAL_ORG',
    'OTHER',
  ]),
  fullName: z.string().min(2).max(120),
  jobTitle: z.string().max(120).optional(),
  organization: z.string().min(2).max(200),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(4000).optional(),
});

export const createAudienceSchema = z.object({
  heldAt: z.string().datetime(),
  endAt: z.string().datetime().optional().nullable(),
  participants: z.string().min(2).max(500),
  subject: z.string().min(3).max(300),
  outcome: z.string().max(2000).optional(),
  minutes: z.string().max(12000).optional(),
  appointmentId: z.string().optional(),
});

export const createInvitationSchema = z.object({
  organizer: z.string().min(2).max(200),
  eventTitle: z.string().min(3).max(300),
  eventDate: z.string().datetime(),
  location: z.string().max(300).optional(),
  importance: priority.default('MEDIUM'),
  notes: z.string().max(2000).optional(),
});

export const updateInvitationSchema = z.object({
  status: z.enum(['RECEIVED', 'ACCEPTED', 'REFUSED', 'DELEGATED', 'PENDING']).optional(),
  delegateName: z.string().max(120).optional().nullable(),
});

const missionDocumentInputSchema = z.object({
  id: z.string().min(1).optional(),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(50_000_000),
  mimeType: z.string().min(1).max(120).default('application/octet-stream'),
  storageKey: z.string().min(1).max(500),
});

export const createMissionSchema = z.object({
  subject: z.string().min(3).max(300),
  missionType: z.string().min(2).max(120),
  destinations: z.array(z.string().min(2).max(2)).min(1).max(50),
  details: z.string().max(2000).optional().nullable(),
  departAt: z.string().datetime(),
  returnAt: z.string().datetime(),
  participants: z.string().max(500),
  documents: z.array(missionDocumentInputSchema).max(20).default([]),
});

export const createDeadlineSchema = z.object({
  title: z.string().min(3).max(200),
  kind: z.enum(['CONTRACT', 'RENEWAL', 'REPORT', 'AUDIT', 'PERIODIC_MEETING', 'OTHER']),
  dueAt: z.string().datetime(),
  ownerName: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  alertDaysBefore: z.number().int().min(0).max(90).default(7),
});

export const createDocumentSchema = z.object({
  title: z.string().min(3).max(200),
  category: z.enum(['CONTRACT', 'MAIL', 'DECISION', 'REPORT', 'MINUTES', 'OTHER']),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(50_000_000),
  tags: z.array(z.string().max(40)).max(12).default([]),
  restricted: z.boolean().default(false),
});

const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const reportBodyHtmlSchema = z.string().max(500_000).optional().nullable();

export const createReportSchema = z
  .object({
    title: z.string().min(2).max(200),
    reportDate: isoDateString,
    bodyHtml: reportBodyHtmlSchema,
    fileName: z.string().max(255).optional(),
    fileSize: z.number().int().nonnegative().max(50_000_000).optional(),
    storageKey: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    const text = (data.bodyHtml ?? '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const hasWritten = text.length > 0;
    const hasFile =
      Boolean(data.storageKey?.trim()) &&
      Boolean(data.fileName?.trim()) &&
      (data.fileSize ?? 0) > 0;
    if (!hasWritten && !hasFile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Rédigez un contenu ou joignez un fichier.',
        path: ['bodyHtml'],
      });
    }
  });

export const updateReportSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  reportDate: isoDateString.optional(),
  bodyHtml: reportBodyHtmlSchema,
  fileName: z.string().max(255).optional(),
  fileSize: z.number().int().nonnegative().max(50_000_000).optional(),
  storageKey: z.string().max(500).optional(),
  archived: z.boolean().optional(),
});

export const updateMailSchema = createMailSchema.partial().extend({
  workflowStatus: z
    .enum(['RECEIVED', 'ASSIGNED', 'IN_PROGRESS', 'PROCESSED', 'ARCHIVED', 'SENT'])
    .optional(),
  priority: z.enum(['URGENT', 'NORMAL']).optional(),
  archived: z.boolean().optional(),
  hasAttachment: z.boolean().optional(),
  attachmentCount: z.number().int().min(0).max(20).optional(),
  attachments: z
    .array(
      z.object({
        id: z.string().optional(),
        fileName: z.string().max(255),
        fileSize: z.number().int().nonnegative().max(50_000_000),
        mimeType: z.string().max(120),
        storageKey: z.string().max(500),
      })
    )
    .max(10)
    .optional(),
});

export const updateContactSchema = createContactSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const updateAudienceSchema = createAudienceSchema.partial().extend({
  archived: z.boolean().optional(),
});

export const updateInvitationFullSchema = createInvitationSchema.partial().extend({
  status: z.enum(['RECEIVED', 'ACCEPTED', 'REFUSED', 'DELEGATED', 'PENDING']).optional(),
  delegateName: z.string().max(120).optional().nullable(),
});

export const updateMissionSchema = createMissionSchema.partial().extend({
  observations: z.string().max(4000).optional().nullable(),
  archived: z.boolean().optional(),
  documents: z.array(missionDocumentInputSchema).max(20).optional(),
  closureReport: z.string().max(8000).optional().nullable(),
  closureResults: z.string().max(8000).optional().nullable(),
  closureRecommendations: z.string().max(8000).optional().nullable(),
  closureComments: z.string().max(4000).optional().nullable(),
});

export const missionStatusActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({
    action: z.literal('close'),
    closureReport: z.string().max(8000).optional().nullable(),
    closureResults: z.string().max(8000).optional().nullable(),
    closureRecommendations: z.string().max(8000).optional().nullable(),
    closureComments: z.string().max(4000).optional().nullable(),
  }),
  z.object({
    action: z.literal('cancel'),
    cancelReason: z.enum(['REPORT_EVENT', 'ORGANIZER_CANCEL', 'BUDGET', 'DG_UNAVAILABLE', 'OTHER']),
    cancelReasonDetail: z.string().max(2000).optional().nullable(),
  }),
  z.object({
    action: z.literal('reopen'),
    returnAt: z.string().datetime().optional().nullable(),
    reopenReason: z.string().max(2000).optional().nullable(),
  }),
]);

export const extendMissionSchema = z.object({
  returnAt: z.string().datetime(),
  reason: z.string().min(3).max(2000),
  comment: z.string().max(4000).optional().nullable(),
});

const hotelAttachmentInputSchema = z.object({
  attachmentType: z.enum(['RECEIPT', 'OTHER']),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(50_000_000),
  mimeType: z.string().min(1).max(120).default('application/octet-stream'),
  storageKey: z.string().min(1).max(500),
});

export const createHotelReservationSchema = z.object({
  missionId: z.string().min(1),
  hotel: z.string().min(2).max(200),
  address: z.string().max(300).optional().nullable(),
  city: z.string().min(2).max(120),
  country: z.string().min(2).max(120),
  contact: z.string().max(200).optional().nullable(),
  roomCount: z.number().int().min(1).max(99),
  roomType: z.string().max(120).optional().nullable(),
  arrivalDate: z.string().datetime(),
  departureDate: z.string().datetime(),
  cost: z.number().nonnegative().max(999_999_999).optional().nullable(),
  currency: z.string().length(3).default('GNF'),
  status: z
    .enum(['TO_BOOK', 'BOOKING_IN_PROGRESS', 'BOOKED', 'CONFIRMED', 'CANCELLED'])
    .default('BOOKED'),
  attachments: z.array(hotelAttachmentInputSchema).max(20).default([]),
});

export const updateHotelReservationSchema = createHotelReservationSchema
  .partial()
  .extend({
    status: z
      .enum(['TO_BOOK', 'BOOKING_IN_PROGRESS', 'BOOKED', 'CONFIRMED', 'CANCELLED'])
      .optional(),
    attachments: z.array(hotelAttachmentInputSchema).max(20).optional(),
  });

export const updateDeadlineSchema = createDeadlineSchema.partial().extend({
  status: z.enum(['UPCOMING', 'DUE_SOON', 'OVERDUE', 'COMPLETED']).optional(),
});

export const updateDocumentSchema = createDocumentSchema.partial();
