'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineFieldError, inlineFieldErrorClass } from '@/components/ui/inline-field-error';
import { AdminDialogToggle } from '@/components/admin/admin-dialog-toggle';
import { RolePermissionsPreview } from '@/components/admin/role-permissions-preview';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { formatRoleDescription } from '@/lib/admin/role-description';
import { rolePermissionLabels } from '@/lib/admin/role-permission-labels';
import { findRoleLabelConflict } from '@/lib/form/field-duplicate';
import type { RoleId } from '@/lib/dg/role-ids';

const EMPTY_FORM = {
  label: '',
  shortName: '',
  description: '',
  template: 'MANAGER' as RoleId,
  applyTemplate: true,
};

export type TemplateRoleOption = {
  id: RoleId;
  label: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting?: boolean;
  templateRoles: TemplateRoleOption[];
  existingRoles?: TemplateRoleOption[];
  permissionsByRole?: Record<string, Record<string, boolean>>;
  onSubmit: (payload: {
    label: string;
    description: string;
    copyFrom: RoleId;
  }) => Promise<{ ok: boolean; roleId?: RoleId; error?: string }>;
};

function FieldGroup({
  id,
  label,
  children,
  className,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? 'admin-create-user-field'}>
      <Label htmlFor={id} className="admin-create-user-label">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function CreateRoleDialog({
  open,
  onOpenChange,
  submitting = false,
  templateRoles,
  existingRoles = [],
  permissionsByRole,
  onSubmit,
}: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fetchedLabels, setFetchedLabels] = useState<string[]>([]);
  const [labelServerError, setLabelServerError] = useState(false);

  const trimmedLabel = form.label.trim();
  const labelConflict = useMemo(
    () => findRoleLabelConflict(existingRoles, trimmedLabel),
    [existingRoles, trimmedLabel]
  );
  const labelDuplicate = Boolean(labelConflict) || labelServerError;
  const labelErrorMessage = labelConflict
    ? `Un rôle « ${labelConflict.label} » porte déjà ce nom.`
    : labelServerError
      ? 'Un rôle porte déjà ce nom.'
      : null;

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setFetchedLabels([]);
      setLabelServerError(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || templateRoles.length === 0) return;
    if (!templateRoles.some((r) => r.id === form.template)) {
      setForm((f) => ({ ...f, template: templateRoles[0].id }));
    }
  }, [open, templateRoles, form.template]);

  const templatePermissions = useMemo(() => {
    if (!form.applyTemplate) return [];
    if (permissionsByRole) {
      return rolePermissionLabels(permissionsByRole[form.template], form.template);
    }
    return fetchedLabels;
  }, [form.applyTemplate, form.template, permissionsByRole, fetchedLabels]);

  useEffect(() => {
    if (!open || !form.applyTemplate || permissionsByRole) return;
    let cancelled = false;
    void fetch(`/api/admin/roles/${form.template}/permission-labels`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { labels?: string[] } | null) => {
        if (cancelled) return;
        const labels = j?.labels?.length
          ? j.labels
          : rolePermissionLabels(undefined, form.template);
        setFetchedLabels(labels);
      })
      .catch(() => {
        if (!cancelled) setFetchedLabels(rolePermissionLabels(undefined, form.template));
      });
    return () => {
      cancelled = true;
    };
  }, [open, form.applyTemplate, form.template, permissionsByRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const label = form.label.trim();
    if (label.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Nom requis',
        description: 'Le nom du rôle doit contenir au moins 2 caractères.',
      });
      return;
    }

    if (labelConflict) return;

    const result = await onSubmit({
      label,
      description: formatRoleDescription(form.shortName, form.description),
      copyFrom: form.applyTemplate ? form.template : 'EXTERNAL',
    });

    if (result.ok) {
      onOpenChange(false);
    } else if (result.error === 'ROLE_LABEL_EXISTS') {
      setLabelServerError(true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="admin-dialog admin-dialog-user-form gap-0 border-[var(--admin-border)] p-0 shadow-[0_24px_60px_-20px_rgba(15,60,40,0.35)]">
        <DialogHeader className="admin-dialog-header admin-create-user-header shrink-0 border-b border-border text-left">
          <DialogTitle className="admin-create-user-title">Créer un rôle</DialogTitle>
          <DialogDescription className="admin-create-role-desc">
            Ajoutez un nouveau rôle au système
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="admin-dialog-body admin-create-role-grid">
            <FieldGroup id="create-role-label" label="Nom du rôle">
              <Input
                id="create-role-label"
                required
                value={form.label}
                onChange={(e) => {
                  setLabelServerError(false);
                  setForm({ ...form, label: e.target.value });
                }}
                className={inlineFieldErrorClass(labelDuplicate, 'admin-field')}
                placeholder="Ex. Administrateur Métier"
                maxLength={80}
                aria-invalid={labelDuplicate || undefined}
                aria-describedby={labelErrorMessage ? 'create-role-label-error' : undefined}
              />
              <InlineFieldError id="create-role-label-error" message={labelErrorMessage} />
            </FieldGroup>

            <FieldGroup id="create-role-short" label="Sigle">
              <Input
                id="create-role-short"
                value={form.shortName}
                onChange={(e) => setForm({ ...form, shortName: e.target.value })}
                className="admin-field"
                placeholder="Ex. ADM-MET"
                maxLength={24}
              />
            </FieldGroup>

            <FieldGroup id="create-role-desc" label="Description" className="admin-create-user-span-2 admin-create-user-field">
              <Input
                id="create-role-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="admin-field"
                placeholder="Périmètre et responsabilités du rôle"
                maxLength={500}
              />
            </FieldGroup>

            <p className="admin-create-user-span-2 admin-create-user-hint">
              Le modèle de permissions peut être ajusté après la création dans le panneau de droite.
            </p>

            <FieldGroup id="create-role-template" label="Rôle modèle" className="admin-create-user-span-2 admin-create-user-field">
              <Select
                value={form.template}
                onValueChange={(v) => setForm({ ...form, template: v as RoleId })}
                disabled={!form.applyTemplate || templateRoles.length === 0}
              >
                <SelectTrigger id="create-role-template" className="admin-field w-full">
                  <SelectValue
                    placeholder={
                      templateRoles.length === 0 ? 'Chargement des rôles…' : 'Choisir un rôle'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {templateRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>

            <div className="admin-create-user-span-2">
              <RolePermissionsPreview
                permissions={templatePermissions}
                compact
                emptyMessage="Activez le modèle pour préremplir les permissions."
              />
            </div>

            <div className="admin-create-user-span-2">
              <AdminDialogToggle
                id="create-role-applyTemplate"
                label="Appliquer le modèle"
                checked={form.applyTemplate}
                onCheckedChange={(applyTemplate) => setForm({ ...form, applyTemplate })}
              />
            </div>
          </div>

          <div className="admin-dialog-footer">
            <button
              type="button"
              className="admin-btn-cancel"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="admin-btn-primary admin-btn-create-role"
              disabled={submitting || form.label.trim().length < 2 || labelDuplicate}
            >
              {submitting ? 'Création…' : 'Créer rôle'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
