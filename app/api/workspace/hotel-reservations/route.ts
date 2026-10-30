import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { createHotelReservationSchema } from '@/lib/workspace/schemas';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import {
  createWorkspaceHotelReservation,
  listWorkspaceHotelReservations,
} from '@/lib/services/workspace-service';

export async function GET(req: Request) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const url = new URL(req.url);
  const items = await listWorkspaceHotelReservations({
    missionId: url.searchParams.get('missionId') ?? undefined,
    q: url.searchParams.get('q') ?? undefined,
    year: parseYearFromRequest(url),
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { session, error } = await requireApiSession(['ASSISTANT']);
  if (error) return error;
  if (!canManageWorkspace(session.role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (!(await userHasPermission(session.role, 'action.missions.hotel'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const parsed = createHotelReservationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const d = parsed.data;
  const result = await createWorkspaceHotelReservation(
    {
      missionId: d.missionId,
      hotel: d.hotel,
      address: d.address ?? null,
      city: d.city,
      country: d.country,
      contact: d.contact ?? null,
      roomCount: d.roomCount,
      roomType: d.roomType ?? null,
      arrivalDate: d.arrivalDate,
      departureDate: d.departureDate,
      cost: d.cost ?? null,
      currency: d.currency,
      status: d.status,
      attachments: d.attachments,
    },
    session.userId,
    `${session.firstName} ${session.lastName}`.trim()
  );
  if ('error' in result) {
    const status = result.error === 'NOT_FOUND' ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ reservation: result }, { status: 201 });
}
