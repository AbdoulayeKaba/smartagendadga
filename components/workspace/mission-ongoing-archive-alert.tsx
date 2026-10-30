'use client';

import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MissionOngoingArchiveAlert({ open, onOpenChange }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="admin-confirm-dialog gap-0 p-0 sm:max-w-md">
        <div className="admin-confirm-dialog-body">
          <div className="admin-confirm-dialog-icon" aria-hidden>
            <AlertTriangle strokeWidth={2.25} />
          </div>
          <AlertDialogTitle className="admin-confirm-dialog-title">
            Cette mission est actuellement en cours
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="admin-confirm-dialog-message space-y-3 text-left">
              <p>
                Elle ne peut pas être supprimée ni déplacée dans la corbeille afin de garantir
                l&apos;intégrité des données.
              </p>
              <div>
                <p className="font-medium text-foreground">Seules les actions suivantes sont autorisées :</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Ajouter des observations</li>
                  <li>Ajouter des documents</li>
                  <li>Consulter les informations</li>
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </div>
        <div className="admin-confirm-dialog-footer">
          <button
            type="button"
            className="admin-confirm-dialog-btn admin-confirm-dialog-btn--confirm w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Compris
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
