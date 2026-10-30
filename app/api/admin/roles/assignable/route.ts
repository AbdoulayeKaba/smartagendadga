import { NextResponse } from 'next/server';
import { requireApiPermission } from '@/lib/auth/permission-guard';
import { listAssignableRoles } from '@/lib/services/assignable-roles';

export async function GET() {
  const auth = await requireApiPermission('admin.users.read');
  if (auth.error) return auth.error;

  const roles = await listAssignableRoles();
  return NextResponse.json({ roles });
}
