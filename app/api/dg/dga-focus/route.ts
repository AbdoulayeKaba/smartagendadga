import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import { loadDgaFocus } from '@/lib/dg/dga-focus';

export async function GET() {
  const { error } = await requireApiPermission('menu.dashboard');
  if (error) return error;

  try {
    const focus = await loadDgaFocus();
    return NextResponse.json(focus);
  } catch (err) {
    console.error('[dga-focus]', err);
    return NextResponse.json({ error: 'LOAD_FAILED' }, { status: 500 });
  }
}
