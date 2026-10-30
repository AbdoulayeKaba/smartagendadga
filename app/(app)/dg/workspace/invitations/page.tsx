import { redirect } from 'next/navigation';
import { WORKSPACE_DEFAULT_TAB } from '@/components/workspace/workspace-menu';

export default function WorkspaceInvitationsPage() {
  redirect(WORKSPACE_DEFAULT_TAB);
}
