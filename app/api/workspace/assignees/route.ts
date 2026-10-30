import { NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth/api-auth';
import { listWorkspaceAssignees } from '@/lib/services/workspace-assignees';

export async function GET() {
  const { error } = await requireApiSession(['ASSISTANT', 'DG']);
  if (error) return error;
  const items = await listWorkspaceAssignees();
  return NextResponse.json({ items });
}
