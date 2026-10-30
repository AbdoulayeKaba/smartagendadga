import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { readUserAvatar } from '@/lib/storage/user-avatars';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireApiSession();
  if (error) return error;

  const { id } = await params;
  // Photo de profil : accessible aux utilisateurs connectés (liste RDV, header, etc.)
  if (!id) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  const file = await readUserAvatar(id);
  if (!file) {
    return new NextResponse(null, { status: 204 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      'Content-Type': file.mimeType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
