import dynamic from 'next/dynamic';

const WorkspaceShell = dynamic(
  () => import('@/components/workspace/workspace-shell').then((mod) => mod.WorkspaceShell),
  {
    loading: () => (
      <div className="admin-theme workspace-main workspace-main--compact min-w-0" aria-busy="true" />
    ),
  }
);

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
