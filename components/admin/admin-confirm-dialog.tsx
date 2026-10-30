'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Check, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

export type AdminConfirmDialogIntent = 'destructive' | 'archive' | 'success' | 'blocked';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  intent?: AdminConfirmDialogIntent;
  hideConfirm?: boolean;
  onConfirm: () => void;
  loading?: boolean;
};

export function AdminConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Annuler',
  intent = 'destructive',
  hideConfirm = false,
  onConfirm,
  loading = false,
}: Props) {
  const isArchive = intent === 'archive';
  const isSuccess = intent === 'success';
  const isBlocked = intent === 'blocked' || hideConfirm;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="admin-confirm-dialog gap-0 p-0 sm:max-w-[22rem]">
        <div className="admin-confirm-dialog-body">
          <div
            className={cn(
              'admin-confirm-dialog-icon',
              isArchive && 'admin-confirm-dialog-icon--archive',
              isSuccess && 'admin-confirm-dialog-icon--success',
              isBlocked && !isArchive && !isSuccess && 'admin-confirm-dialog-icon--blocked',
            )}
            aria-hidden
          >
            {isArchive ? (
              <Trash2 strokeWidth={2.25} />
            ) : isSuccess ? (
              <Check strokeWidth={2.25} />
            ) : (
              <AlertTriangle strokeWidth={2.25} />
            )}
          </div>
          <AlertDialogTitle className="admin-confirm-dialog-title">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="admin-confirm-dialog-message">{message}</div>
          </AlertDialogDescription>
        </div>
        <div className="admin-confirm-dialog-footer">
          <AlertDialogCancel disabled={loading} className="admin-confirm-dialog-btn admin-confirm-dialog-btn--cancel">
            {isBlocked ? 'Fermer' : cancelLabel}
          </AlertDialogCancel>
          {!isBlocked ? (
            <button
              type="button"
              disabled={loading}
              className={cn(
                'admin-confirm-dialog-btn admin-confirm-dialog-btn--confirm',
                isArchive && 'admin-confirm-dialog-btn--archive',
                isSuccess && 'admin-confirm-dialog-btn--success',
              )}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {loading ? 'En cours…' : confirmLabel}
            </button>
          ) : null}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
