import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { isMissionClosureReportRequired } from '@/lib/workspace/mission-settings';

export async function GET() {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const closureReportRequired = await isMissionClosureReportRequired();
  return NextResponse.json({ closureReportRequired });
}
