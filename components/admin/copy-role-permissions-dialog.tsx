'use client';

import { Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { RoleId } from '@/lib/dg/role-ids';

type RoleOption = {
  id: RoleId;
  label: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving?: boolean;
  sourceRoles: RoleOption[];
  targetRoles: RoleOption[];
  copyFrom: RoleId;
  copyTo: RoleId;
  onCopyFromChange: (roleId: RoleId) => void;
  onCopyToChange: (roleId: RoleId) => void;
  onApply: () => void;
};

function FieldGroup({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-create-user-field">
      <Label htmlFor={id} className="admin-create-user-label">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function CopyRolePermissionsDialog({
  open,
  onOpenChange,
  saving = false,
  sourceRoles,
  targetRoles,
  copyFrom,
  copyTo,
  onCopyFromChange,
  onCopyToChange,
  onApply,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-dialog admin-dialog-user-form admin-dialog-copy-perms gap-0 border-[var(--admin-border)] p-0 shadow-[0_24px_60px_-20px_rgba(15,60,40,0.35)]">
        <DialogHeader className="admin-dialog-header admin-create-user-header shrink-0 border-b border-border text-left">
          <DialogTitle className="admin-create-user-title">Appliquer un modèle de permissions</DialogTitle>
          <DialogDescription className="admin-create-role-desc">
            Copiez les permissions d&apos;un rôle source vers un rôle cible.
          </DialogDescription>
        </DialogHeader>

        <div className="admin-dialog-body admin-create-role-grid">
          <FieldGroup id="copy-role-from" label="Modèle source">
            <Select value={copyFrom} onValueChange={(v) => onCopyFromChange(v as RoleId)}>
              <SelectTrigger id="copy-role-from" className="admin-field w-full">
                <SelectValue placeholder="Choisir un rôle" />
              </SelectTrigger>
              <SelectContent>
                {sourceRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>

          <FieldGroup id="copy-role-to" label="Rôle cible">
            <Select value={copyTo} onValueChange={(v) => onCopyToChange(v as RoleId)}>
              <SelectTrigger id="copy-role-to" className="admin-field w-full">
                <SelectValue placeholder="Choisir un rôle" />
              </SelectTrigger>
              <SelectContent>
                {targetRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        <div className="admin-dialog-footer">
          <button
            type="button"
            className="admin-btn-cancel"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </button>
          <button
            type="button"
            className="admin-btn-primary admin-btn-create-role admin-btn-copy-perms"
            disabled={saving || copyFrom === copyTo}
            onClick={onApply}
          >
            <Copy className="admin-btn-copy-perms-icon" aria-hidden />
            {saving ? 'Application…' : 'Appliquer le modèle'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
