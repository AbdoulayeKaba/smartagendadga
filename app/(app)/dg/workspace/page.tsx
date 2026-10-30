import { redirect } from 'next/navigation';
import { WORKSPACE_DEFAULT_TAB } from '@/components/workspace/workspace-menu';

export default function WorkspaceHomePage() {
  redirect(WORKSPACE_DEFAULT_TAB);
}
