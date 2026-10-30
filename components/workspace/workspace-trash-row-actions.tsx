'use client';

import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  variant: 'active' | 'trash';
  onEdit?: () => void;
  onArchive?: () => void;
  archiveBlocked?: boolean;
  archiveTitle?: string;
  onRestore?: () => void;
  onDeletePermanent?: () => void;
  extraActions?: React.ReactNode;
};

export function WorkspaceTrashRowActions({
  variant,
  onEdit,
  onArchive,
  archiveBlocked = false,
  archiveTitle = 'Mettre dans la corbeille',
  onRestore,
  onDeletePermanent,
  extraActions,
}: Props) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {extraActions}
      {variant === 'trash' ? (
        <>
          {onRestore ? (
            <button
              type="button"
              className="workspace-row-action-btn workspace-row-action-btn--restore"
              onClick={onRestore}
              title="Restaurer"
              aria-label="Restaurer"
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </button>
          ) : null}
          {onDeletePermanent ? (
            <button
              type="button"
              className="workspace-row-action-btn workspace-row-action-btn--danger"
              onClick={onDeletePermanent}
              title="Supprimer définitivement"
              aria-label="Supprimer définitivement"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          ) : null}
        </>
      ) : (
        <>
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
          {onArchive ? (
            <button
              type="button"
              className={cn(
                'workspace-row-action-btn workspace-row-action-btn--archive',
                archiveBlocked && 'workspace-row-action-btn--archive-blocked'
              )}
              onClick={onArchive}
              title={archiveTitle}
              aria-label={archiveTitle}
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
