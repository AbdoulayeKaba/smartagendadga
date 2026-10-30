'use client';

import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const DIALOG_CLASS =
  'admin-dialog admin-dialog-user-form workspace-crud-dialog gap-0 border-[var(--admin-border)] p-0 shadow-[0_24px_60px_-20px_rgba(15,60,40,0.35)]';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  onSubmit?: () => void;
  className?: string;
};

export function WorkspaceCrudDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  onSubmit,
  className,
}: Props) {
  const a11yDescription =
    description ?? (typeof title === 'string' ? title : 'Formulaire');
  const body = (
    <>
      <DialogHeader className="admin-dialog-header workspace-crud-dialog-header shrink-0 text-left">
        <DialogTitle className="workspace-crud-dialog-title">{title}</DialogTitle>
        <DialogDescription className="sr-only">{a11yDescription}</DialogDescription>
      </DialogHeader>
      <div className="admin-dialog-body workspace-crud-dialog-body">{children}</div>
      <div className="admin-dialog-footer workspace-crud-dialog-footer">{footer}</div>
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_CLASS, className)}>
        {onSubmit ? (
          <form
            className="min-h-0"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {body}
          </form>
        ) : (
          body
        )}
      </DialogContent>
    </Dialog>
  );
}

type FieldProps = {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
};

export function WorkspaceCrudField({ id, label, children, className }: FieldProps) {
  return (
    <div className={cn('workspace-crud-field', className)}>
      <label htmlFor={id} className="workspace-crud-label">
        {label}
      </label>
      {children}
    </div>
  );
}
