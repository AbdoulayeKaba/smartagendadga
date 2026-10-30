import { z } from 'zod';
import type { ReferentialCategoryId } from '@/lib/dg/referential-catalog';
import {
  CONFIDENTIALITY_OPTIONS,
  HOLIDAY_TYPE_OPTIONS,
  LEGACY_UNAVAILABILITY_TYPES,
  UNAVAILABILITY_TYPE_OPTIONS,
} from '@/lib/dg/referential-types';

const holidayTypeValues = HOLIDAY_TYPE_OPTIONS.map((o) => o.value) as [
  string,
  ...string[],
];
const unavailabilityTypeValues = [
  ...UNAVAILABILITY_TYPE_OPTIONS.map((o) => o.value),
  ...LEGACY_UNAVAILABILITY_TYPES,
] as [string, ...string[]];
const confidentialityValues = CONFIDENTIALITY_OPTIONS.map((o) => o.value) as [
  string,
  ...string[],
];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeHm = z.string().regex(/^\d{2}:\d{2}$/);

export const holidayMetaSchema = z.object({
  kind: z.literal('holiday'),
  date: isoDate,
  type: z.enum(holidayTypeValues),
  annualRepeat: z.boolean(),
  active: z.boolean(),
});

export const unavailabilityMetaSchema = z
  .object({
    kind: z.literal('unavailability'),
    type: z.enum(unavailabilityTypeValues),
    typeOther: z.string().trim().max(120).optional(),
    startDate: isoDate,
    endDate: isoDate,
    startTime: timeHm,
    endTime: timeHm,
    motif: z.string().trim().min(1).max(500),
    confidentialityLevel: z.enum(confidentialityValues),
    active: z.boolean(),
  })
  .refine((d) => d.endDate >= d.startDate, { message: 'INVALID_DATE_RANGE' })
  .superRefine((d, ctx) => {
    if (d.type === 'autres' && (!d.typeOther || d.typeOther.trim().length < 2)) {
      ctx.addIssue({
        code: 'custom',
        message: 'TYPE_OTHER_REQUIRED',
        path: ['typeOther'],
      });
    }
  });

export function validateReferentialPayload(
  categoryId: ReferentialCategoryId,
  data: { name: string; value?: string; meta?: unknown }
): { ok: true; value?: string; meta?: z.infer<typeof holidayMetaSchema> | z.infer<typeof unavailabilityMetaSchema> } | { ok: false; error: string } {
  const name = data.name.trim();
  if (!name) return { ok: false, error: 'NAME_REQUIRED' };

  if (categoryId === 'jours-feries') {
    const parsed = holidayMetaSchema.safeParse(data.meta);
    if (!parsed.success) return { ok: false, error: 'INVALID_HOLIDAY' };
    return {
      ok: true,
      value: parsed.data.date,
      meta: parsed.data,
    };
  }

  if (categoryId === 'indisponibilites') {
    const parsed = unavailabilityMetaSchema.safeParse(data.meta);
    if (!parsed.success) return { ok: false, error: 'INVALID_UNAVAILABILITY' };
    return { ok: true, meta: parsed.data };
  }

  if (categoryId === 'horaires') {
    return { ok: false, error: 'INVALID_CATEGORY' };
  }

  return { ok: true, value: data.value?.trim() || undefined };
}
