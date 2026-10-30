import { NextResponse } from 'next/server';
import { requireWorkspaceManage, type Ctx } from '@/lib/api/workspace-id-route';
import { userHasPermission } from '@/lib/auth/permission-guard';
import { updateHotelReservationSchema } from '@/lib/workspace/schemas';
import {
  deleteWorkspaceHotelReservation,
  updateWorkspaceHotelReservation,
} from '@/lib/services/workspace-service';

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  if (!(await userHasPermission(auth.session!.role, 'action.missions.hotel'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const parsed = updateHotelReservationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const d = parsed.data;
  const result = await updateWorkspaceHotelReservation(
    id,
    {
      ...(d.missionId !== undefined ? { missionId: d.missionId } : {}),
      ...(d.hotel !== undefined ? { hotel: d.hotel } : {}),
      ...(d.address !== undefined ? { address: d.address } : {}),
      ...(d.city !== undefined ? { city: d.city } : {}),
      ...(d.country !== undefined ? { country: d.country } : {}),
      ...(d.contact !== undefined ? { contact: d.contact } : {}),
      ...(d.roomCount !== undefined ? { roomCount: d.roomCount } : {}),
      ...(d.roomType !== undefined ? { roomType: d.roomType } : {}),
      ...(d.arrivalDate !== undefined ? { arrivalDate: d.arrivalDate } : {}),
      ...(d.departureDate !== undefined ? { departureDate: d.departureDate } : {}),
      ...(d.cost !== undefined ? { cost: d.cost } : {}),
      ...(d.currency !== undefined ? { currency: d.currency } : {}),
      ...(d.status !== undefined ? { status: d.status } : {}),
      ...(d.attachments !== undefined ? { attachments: d.attachments } : {}),
    },
    auth.session!.userId,
    `${auth.session!.firstName} ${auth.session!.lastName}`.trim()
  );
  if (result && typeof result === 'object' && 'error' in result) {
    const status = result.error === 'NOT_FOUND' ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }
  if (!result) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ reservation: result });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspaceManage();
  if (auth.error) return auth.error;
  if (!(await userHasPermission(auth.session!.role, 'action.missions.hotel'))) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const { id } = await ctx.params;
  const result = await deleteWorkspaceHotelReservation(
    id,
    auth.session!.userId,
    `${auth.session!.firstName} ${auth.session!.lastName}`.trim()
  );
  if (typeof result === 'object' && result && 'error' in result) {
    const status = result.error === 'NOT_FOUND' ? 404 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }
  if (!result) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
