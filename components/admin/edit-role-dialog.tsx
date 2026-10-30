'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
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
import type { TemplateRoleOption } from '@/components/admin/create-role-dialog';
import { RolePermissionsPreview } from '@/components/admin/role-permissions-preview';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import '@/components/workspace/mail-enregistrement.css';
import '@/components/admin/admin-edit-dialog.css';
import { formatRoleDescription, parseRoleDescription } from '@/lib/admin/role-description';
import { rolePermissionLabels } from '@/lib/admin/role-permission-labels';
import { permissionsForRole } from '@/lib/dg/role-permissions';
import { isDgRole, type RoleId } from '@/lib/dg/role-ids';
import { findRoleLabelConflict } from '@/lib/form/field-duplicate';
import { cn } from '@/lib/utils';

type RoleEditTarget = {
  id: RoleId;
  label: string;
  description: string;
  isCustom?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleEditTarget | null;
  templateRoles: TemplateRoleOption[];
  existingRoles?: TemplateRoleOption[];
  permissionsByRole?: Record<string, Record<string, boolean>>;
  saving?: boolean;
  onSave: (payload: {
    label: string;
    description: string;
    copyFrom?: RoleId;
  }) => Promise<{ ok: boolean; error?: string }>;
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

const EMPTY_FORM = {
  label: '',
  shortName: '',
  description: '',
  template: 'MANAGER' as RoleId,
  applyTemplate: false,
};

export function EditRoleDialog({
  open,
  onOpenChange,
  role,
  templateRoles,
  existingRoles = [],
  permissionsByRole,
  saving = false,
  onSave,
}: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [currentPermissionLabels, setCurrentPermissionLabels] = useState<string[]>([]);
  const [templatePermissionLabels, setTemplatePermissionLabels] = useState<string[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [labelServerError, setLabelServerError] = useState(false);

  const trimmedLabel = form.label.trim();
  const labelConflict = useMemo(
    () => findRoleLabelConflict(existingRoles, trimmedLabel, role?.id),
    [existingRoles, trimmedLabel, role?.id]
  );
  const labelDuplicate = Boolean(labelConflict) || labelServerError;
  const labelErrorMessage = labelConflict
    ? `Un rôle « ${labelConflict.label} » porte déjà ce nom.`
    : labelServerError
      ? 'Un rôle porte déjà ce nom.'
      : null;

  useEffect(() => {
    if (!open || !role) {
      setForm(EMPTY_FORM);
      setCurrentPermissionLabels([]);
      setTemplatePermissionLabels([]);
      setPermissionsLoading(false);
      setLabelServerError(false);
      return;
    }
    const parsed = parseRoleDescription(role.description);
    const defaultTemplate =
      templateRoles.find((r) => r.id === 'MANAGER')?.id ??
      templateRoles[0]?.id ??
      ('MANAGER' as RoleId);
    setForm({
      label: role.label,
      shortName: parsed.shortName,
      description: parsed.description,
      template: defaultTemplate,
      applyTemplate: false,
    });
    setLabelServerError(false);
  }, [open, role, templateRoles]);

  useEffect(() => {
    if (!open || !role) return;

    const fromMap = rolePermissionLabels(permissionsByRole?.[role.id], role.id);
    if (fromMap.length > 0) {
      setCurrentPermissionLabels(fromMap);
      return;
    }

    let cancelled = false;
    void fetch(`/api/admin/roles/${role.id}/permission-labels`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { labels?: string[] } | null) => {
        if (cancelled) return;
        setCurrentPermissionLabels(
          j?.labels?.length ? j.labels : rolePermissionLabels(undefined, role.id)
        );
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentPermissionLabels(isDgRole(role.id) ? permissionsForRole(role.id) : []);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, role, permissionsByRole]);

  useEffect(() => {
    if (!open || !form.applyTemplate) return;

    const fromMap = rolePermissionLabels(permissionsByRole?.[form.template], form.template);
    if (fromMap.length > 0) {
      setTemplatePermissionLabels(fromMap);
      setPermissionsLoading(false);
      return;
    }

    let cancelled = false;
    setPermissionsLoading(true);
    void fetch(`/api/admin/roles/${form.template}/permission-labels`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { labels?: string[] } | null) => {
        if (cancelled) return;
        setTemplatePermissionLabels(
          j?.labels?.length ? j.labels : rolePermissionLabels(undefined, form.template)
        );
      })
      .catch(() => {
        if (!cancelled) {
          setTemplatePermissionLabels(
            isDgRole(form.template) ? permissionsForRole(form.template) : []
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPermissionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, form.applyTemplate, form.template, permissionsByRole]);

  const previewPermissions = useMemo(
    () => (form.applyTemplate ? templatePermissionLabels : currentPermissionLabels),
    [form.applyTemplate, templatePermissionLabels, currentPermissionLabels]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;

    const description = formatRoleDescription(form.shortName, form.description);
    const payload: { label: string; description: string; copyFrom?: RoleId } = {
      label: form.label.trim(),
      description,
    };
    if (form.applyTemplate && form.template !== role.id) {
      payload.copyFrom = form.template;
    }

    if (labelConflict) return;

    const ok = await onSave(payload);
    if (ok.ok) onOpenChange(false);
    else if (ok.error === 'ROLE_LABEL_EXISTS') setLabelServerError(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'admin-dialog admin-dialog-user-form admin-edit-dialog gap-0 border-[var(--admin-border)] p-0 shadow-[0_24px_60px_-20px_rgba(15,60,40,0.35)]'
        )}
      >
        <DialogHeader className="admin-dialog-header admin-create-user-header workspace-crud-dialog-header shrink-0 border-b border-border text-left">
          <DialogTitle className="admin-create-user-title workspace-crud-dialog-title">
            <span className="mail-edit-dialog-title">
              <span className="mail-edit-dialog-icon" aria-hidden>
                <Pencil className="h-4 w-4" />
              </span>
              <span className="mail-edit-dialog-title-text">
                <span className="mail-edit-dialog-kicker">Modification</span>
                <span className="mail-edit-dialog-heading">Rôle</span>
              </span>
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Modifiez les informations du rôle et appliquez un modèle de permissions si besoin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="admin-dialog-body admin-create-role-grid mail-edit-form">
            <FieldGroup id="edit-role-label" label="Nom du rôle">
              <Input
                id="edit-role-label"
                value={form.label}
                onChange={(e) => {
                  setLabelServerError(false);
                  setForm({ ...form, label: e.target.value });
                }}
                className={inlineFieldErrorClass(labelDuplicate, 'admin-field')}
                required
                maxLength={80}
                aria-invalid={labelDuplicate || undefined}
                aria-describedby={labelErrorMessage ? 'edit-role-label-error' : undefined}
              />
              <InlineFieldError id="edit-role-label-error" message={labelErrorMessage} />
            </FieldGroup>

            <FieldGroup id="edit-role-short" label="Sigle">
              <Input
                id="edit-role-short"
                value={form.shortName}
                onChange={(e) => setForm({ ...form, shortName: e.target.value })}
                className="admin-field"
                placeholder="Ex. ADM-MET"
                maxLength={24}
              />
            </FieldGroup>

            <FieldGroup id="edit-role-desc" label="Description" className="admin-create-user-span-2 admin-create-user-field">
              <Input
                id="edit-role-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="admin-field"
                placeholder="Périmètre et responsabilités du rôle"
                maxLength={500}
              />
            </FieldGroup>

            <FieldGroup id="edit-role-template" label="Rôle modèle" className="admin-create-user-span-2 admin-create-user-field">
              <Select
                value={form.template}
                onValueChange={(v) => setForm({ ...form, template: v as RoleId })}
                disabled={!form.applyTemplate || templateRoles.length === 0}
              >
                <SelectTrigger id="edit-role-template" className="admin-field w-full">
                  <SelectValue
                    placeholder={
                      templateRoles.length === 0 ? 'Aucun modèle disponible' : 'Choisir un rôle'
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
              {permissionsLoading && form.applyTemplate ? (
                <div className="admin-edit-role-perms-loading">
                  <Loader2 className="animate-spin" aria-hidden />
                  Chargement des permissions…
                </div>
              ) : (
                <RolePermissionsPreview
                  permissions={previewPermissions}
                  compact
                  emptyMessage={
                    form.applyTemplate
                      ? 'Aucune permission active pour ce modèle.'
                      : 'Aucune permission active pour ce rôle.'
                  }
                />
              )}
            </div>

            <div className="admin-create-user-span-2">
              <AdminDialogToggle
                id="edit-role-applyTemplate"
                label="Appliquer le modèle"
                checked={form.applyTemplate}
                onCheckedChange={(applyTemplate) => setForm({ ...form, applyTemplate })}
              />
            </div>
          </div>

          <div className="admin-dialog-footer workspace-crud-dialog-footer">
            <button
              type="button"
              className="admin-btn-cancel"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="mail-edit-dialog-submit"
              disabled={saving || !role || form.label.trim().length < 2 || labelDuplicate}
            >
              {saving ? 'Enregistrement…' : 'Mettre à jour'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
