import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession } from '@/lib/auth/api-auth';
import { userHasPermission } from '@/lib/auth/permission-guard';
import {
  countUnreadNotifications,
  listInboxNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type InboxAudienceScope,
} from '@/lib/services/notifications-inbox';

export async function GET(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Math.min(100, Math.max(10, Number(limitRaw) || 30)) : 30;
  const canReview = await userHasPermission(session.role, 'appointments.review');
  const scope: InboxAudienceScope = {
    email: session.email,
    audienceOnly: !canReview,
  };

  const [items, unread] = await Promise.all([
    listInboxNotifications(session.userId, session.role, limit, scope),
    countUnreadNotifications(session.userId, scope),
  ]);

  return NextResponse.json({ items, unread });
}

const patchSchema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  if (parsed.data.all) {
    const canReview = await userHasPermission(session.role, 'appointments.review');
    await markAllNotificationsRead(session.userId, {
      email: session.email,
      audienceOnly: !canReview,
    });
    return NextResponse.json({ ok: true });
  }

  if (!parsed.data.id) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const result = await markNotificationRead(session.userId, parsed.data.id, session.email);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ ok: true });
}
