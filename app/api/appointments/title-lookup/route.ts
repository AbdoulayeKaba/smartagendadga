import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { getAppointmentBusinessRules } from '@/lib/services/appointment-business-rules-admin';
import { lookupAppointmentTitleCandidates } from '@/lib/services/appointment-title-lookup';

export async function GET(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const excludeId = url.searchParams.get('excludeId') ?? undefined;
  const formDate = url.searchParams.get('date') ?? undefined;

  if (q.length < 2) {
    return NextResponse.json({ matches: [], exact: null, blocking: null });
  }

  const [reviewAll, rules] = await Promise.all([
    userHasPermission(session.role, 'appointments.review'),
    getAppointmentBusinessRules(),
  ]);
  const result = await lookupAppointmentTitleCandidates({
    query: q,
    requestedById: session.userId,
    formDate,
    excludeId,
    reviewAll,
  });

  if (!rules.duplicateControl.enabled) {
    return NextResponse.json({
      ...result,
      blocking: null,
      matches: result.matches.map((match) => ({ ...match, blocking: false })),
    });
  }

  return NextResponse.json(result);
}
