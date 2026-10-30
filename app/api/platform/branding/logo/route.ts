import { NextResponse } from 'next/server';
import { readInstitutionLogo } from '@/lib/storage/platform-branding';

export async function GET() {
  const file = await readInstitutionLogo();
  if (!file) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  return new NextResponse(file.buffer, {
    headers: {
      'Content-Type': file.mimeType,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
