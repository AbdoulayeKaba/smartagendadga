import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import type { Ctx } from '@/lib/api/workspace-id-route';
import { parseYearFromRequest } from '@/lib/api/parse-year-filter';
import {
  getContactAppointmentStats,
  getWorkspaceContact,
  listContactAppointments,
} from '@/lib/services/workspace-service';

export async function GET(req: Request, ctx: Ctx) {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;

  const { id } = await ctx.params;
  const contact = await getWorkspaceContact(id);
  if (!contact) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const year = parseYearFromRequest(new URL(req.url));
  const items = await listContactAppointments(id, year);
  const stats = await getContactAppointmentStats(id, year);
  return NextResponse.json({ contact, items, stats });
}
