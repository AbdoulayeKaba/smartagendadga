import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import {
  removeAccountAvatar,
  uploadAccountAvatar,
} from '@/lib/services/account-profile';
import { AVATAR_MAX_BYTES, isAllowedAvatarMime } from '@/lib/storage/user-avatars';

export async function POST(req: Request) {
  const { session, error } = await requireApiSession();
  if (error) return error;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 422 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0 || buffer.length > AVATAR_MAX_BYTES) {
    return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 422 });
  }

  const mimeType = file.type || 'application/octet-stream';
  if (!isAllowedAvatarMime(mimeType)) {
    return NextResponse.json({ error: 'UNSUPPORTED_FILE_TYPE' }, { status: 422 });
  }

  const result = await uploadAccountAvatar(session.userId, buffer, mimeType, file.name);
  return NextResponse.json({ avatarUrl: result.avatarUrl });
}

export async function DELETE() {
  const { session, error } = await requireApiSession();
  if (error) return error;

  await removeAccountAvatar(session.userId);
  return NextResponse.json({ ok: true });
}
