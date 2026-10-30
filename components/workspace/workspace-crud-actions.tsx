'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { AdminConfirmDialog } from '@/components/admin/admin-confirm-dialog';
import { useDgRole } from '@/lib/auth/use-dg-role';
import { canManageWorkspace } from '@/lib/workspace/rbac';
import { useWorkspaceCrud } from '@/components/workspace/use-workspace-crud';

type RowActionsProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  /** Si true, ignore le contrôle de rôle (permissions déjà vérifiées par le parent). */
  forceShow?: boolean;
};

export function WorkspaceRowActions({ onEdit, onDelete, forceShow = false }: RowActionsProps) {
  const role = useDgRole();
  if (!forceShow && !canManageWorkspace(role)) return null;
  if (!onEdit && !onDelete) return null;
  return (
    <div className="workspace-row-actions">
      {onEdit ? (
        <button
          type="button"
          className="workspace-row-action-btn workspace-row-action-btn--edit"
          onClick={onEdit}
          title="Modifier"
          aria-label="Modifier"
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          className="workspace-row-action-btn workspace-row-action-btn--danger"
          onClick={onDelete}
          title="Supprimer"
          aria-label="Supprimer"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  );
}

type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  loading: boolean;
  onConfirm: () => void;
};

export function WorkspaceDeleteDialog({
  open,
  onOpenChange,
  label,
  loading,
  onConfirm,
}: DeleteDialogProps) {
  return (
    <AdminConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Supprimer cet enregistrement ?"
      message={
        <>
          <span className="font-medium text-foreground">{label}</span> sera définitivement supprimé.
        </>
      }
      confirmLabel="Supprimer"
      loading={loading}
      onConfirm={onConfirm}
    />
  );
}

export function useWorkspaceCrudWithDelete(apiPath: string) {
  const crud = useWorkspaceCrud(apiPath);
  const role = useDgRole();
  const canManage = canManageWorkspace(role);

  const deleteDialog = crud.deleteTarget ? (
    <WorkspaceDeleteDialog
      open={!!crud.deleteTarget}
      onOpenChange={(o) => !o && crud.setDeleteTarget(null)}
      label={crud.deleteTarget.label}
      loading={crud.deleteLoading}
      onConfirm={() => void crud.confirmDelete()}
    />
  ) : null;

  const rowActions = (row: { id: string }, label: string, onEdit: () => void) =>
    canManage ? (
      <WorkspaceRowActions
        onEdit={onEdit}
        onDelete={() => crud.setDeleteTarget({ id: row.id, label })}
      />
    ) : null;

  return { ...crud, canManage, deleteDialog, rowActions };
}
