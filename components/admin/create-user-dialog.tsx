'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
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
import '@/components/admin/admin-edit-dialog.css';
import '@/components/workspace/mail-enregistrement.css';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAssignableRoles } from '@/hooks/use-assignable-roles';
import {
  welcomeEmailToastDescription,
  type WelcomeEmailDelivery,
} from '@/lib/welcome-email-delivery';
import { passwordPolicyErrorMessage } from '@/lib/auth/password-policy';
import { findEmailConflict } from '@/lib/form/field-duplicate';
import { permissionsForRole } from '@/lib/dg/role-permissions';
import { isDgRole, type RoleId } from '@/lib/dg/role-ids';

const DEFAULT_USER_PASSWORD = 'Password1234@';

const EMPTY_FORM = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: 'MANAGER' as RoleId,
  password: DEFAULT_USER_PASSWORD,
  passwordConfirm: DEFAULT_USER_PASSWORD,
  sendWelcomeEmail: true,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void | Promise<void>;
  existingUsers?: { id: string; email: string }[];
};

function FieldGroup({
  id,
  label,
  children,
  className,
}: {
  id?: string;
  label: string;
  children: ReactNode;
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

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
}) {
  return (
    <FieldGroup id={id} label={label}>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="admin-field pr-9"
          placeholder="••••••••"
        />
        <button
          type="button"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          onClick={onToggleShow}
          tabIndex={-1}
          aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </FieldGroup>
  );
}

export function CreateUserDialog({ open, onOpenChange, onCreated, existingUsers = [] }: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(true);
  const [showConfirm, setShowConfirm] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [emailServerError, setEmailServerError] = useState(false);
  const { roles: assignableRoles, loading: rolesLoading } = useAssignableRoles(open);

  const emailConflict = findEmailConflict(existingUsers, form.email);
  const emailDuplicate = Boolean(emailConflict) || emailServerError;
  const emailErrorMessage = emailConflict
    ? `L’adresse « ${emailConflict.email} » est déjà utilisée.`
    : emailServerError
      ? 'Cet email existe déjà.'
      : null;

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setShowPassword(true);
      setShowConfirm(true);
      setEmailServerError(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || assignableRoles.length === 0) return;
    if (!assignableRoles.some((r) => r.id === form.role)) {
      setForm((f) => ({ ...f, role: assignableRoles[0].id }));
    }
  }, [open, assignableRoles, form.role]);

  const [rolePermissions, setRolePermissions] = useState<string[]>(() =>
    isDgRole(form.role) ? permissionsForRole(form.role) : []
  );

  useEffect(() => {
    if (!form.role) return;
    let cancelled = false;
    void fetch(`/api/admin/roles/${form.role}/permission-labels`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { labels?: string[] } | null) => {
        if (cancelled) return;
        const fallback = isDgRole(form.role) ? permissionsForRole(form.role) : [];
        setRolePermissions(j?.labels?.length ? j.labels : fallback);
      })
      .catch(() => {
        if (!cancelled) {
          setRolePermissions(isDgRole(form.role) ? permissionsForRole(form.role) : []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [form.role]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password || form.passwordConfirm) {
      if (form.password !== form.passwordConfirm) {
        toast({
          variant: 'destructive',
          title: 'Mots de passe différents',
          description: 'La confirmation doit correspondre au mot de passe.',
        });
        return;
      }
    }

    if (emailConflict) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          role: form.role,
          password: form.password || undefined,
          sendWelcomeEmail: form.sendWelcomeEmail,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (j.error === 'EMAIL_EXISTS') {
          setEmailServerError(true);
          return;
        }
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description:
            j.error === 'INVALID_ROLE'
                ? 'Rôle invalide ou archivé.'
                : j.error === 'CREATE_FAILED'
                  ? 'Impossible d’enregistrer l’utilisateur. Vérifiez la base de données ou réessayez.'
                  : typeof j.error === 'string' && j.error.startsWith('PASSWORD_')
                    ? passwordPolicyErrorMessage(j.error)
                    : String(j.error ?? 'Échec'),
        });
        return;
      }
      const welcome = j.welcomeEmail as WelcomeEmailDelivery | undefined;
      toast({
        title: j.restoredFromTrash ? 'Compte restauré' : 'Utilisateur créé',
        description: j.restoredFromTrash
          ? `Le compte ${form.email} a été restauré depuis la corbeille. ${welcomeEmailToastDescription(welcome, form.sendWelcomeEmail)}`
          : welcomeEmailToastDescription(welcome, form.sendWelcomeEmail),
      });
      onOpenChange(false);
      await onCreated();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'admin-dialog admin-dialog-user-form admin-edit-dialog admin-create-user-dialog gap-0 border-[var(--admin-border)] p-0 shadow-[0_24px_60px_-20px_rgba(15,60,40,0.35)]'
        )}
      >
        <DialogHeader className="admin-dialog-header admin-create-user-header workspace-crud-dialog-header shrink-0 border-b border-border text-left">
          <DialogTitle className="admin-create-user-title workspace-crud-dialog-title">
            <span className="mail-edit-dialog-title">
              <span className="mail-edit-dialog-icon" aria-hidden>
                <UserPlus className="h-3.5 w-3.5" />
              </span>
              <span className="mail-edit-dialog-title-text">
                <span className="mail-edit-dialog-kicker">Administration</span>
                <span className="mail-edit-dialog-heading">Créer un utilisateur</span>
              </span>
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Ajoutez un nouvel utilisateur au système
          </DialogDescription>
        </DialogHeader>

        <form className="min-h-0" onSubmit={submit}>
          <div className="admin-dialog-body admin-create-user-grid mail-edit-form">
            <FieldGroup id="create-firstName" label="Prénom">
              <Input
                id="create-firstName"
                required
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="admin-field"
              />
            </FieldGroup>

            <FieldGroup id="create-lastName" label="Nom">
              <Input
                id="create-lastName"
                required
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="admin-field"
              />
            </FieldGroup>

            <FieldGroup id="create-email" label="Email">
              <Input
                id="create-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => {
                  setEmailServerError(false);
                  setForm({ ...form, email: e.target.value });
                }}
                className={inlineFieldErrorClass(emailDuplicate, 'admin-field')}
                aria-invalid={emailDuplicate || undefined}
                aria-describedby={emailErrorMessage ? 'create-email-error' : undefined}
              />
              <InlineFieldError id="create-email-error" message={emailErrorMessage} />
            </FieldGroup>

            <FieldGroup id="create-phone" label="Téléphone">
              <Input
                id="create-phone"
                type="tel"
                value={form.phone ?? ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Ex : +221 77 000 00 00"
                className="admin-field"
              />
            </FieldGroup>

            <PasswordField
              id="create-password"
              label="Mot de passe"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              show={showPassword}
              onToggleShow={() => setShowPassword((s) => !s)}
            />
            <PasswordField
              id="create-passwordConfirm"
              label="Confirmer"
              value={form.passwordConfirm}
              onChange={(v) => setForm({ ...form, passwordConfirm: v })}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((s) => !s)}
            />

            <p className="admin-create-user-span-2 admin-create-user-hint">
              Mot de passe vide = mot de passe par défaut de la plateforme.
            </p>

            <FieldGroup id="create-role" label="Rôle" className="admin-create-user-span-2">
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v as RoleId })}
                disabled={rolesLoading || assignableRoles.length === 0}
              >
                <SelectTrigger id="create-role" className="admin-field w-full">
                  <SelectValue
                    placeholder={
                      rolesLoading ? 'Chargement…' : 'Aucun rôle'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>

            <div className="admin-create-user-span-2">
              <RolePermissionsPreview permissions={rolePermissions} compact />
            </div>

            <div className="admin-create-user-span-2">
              <AdminDialogToggle
                id="create-sendWelcomeEmail"
                label="Email de bienvenue"
                checked={form.sendWelcomeEmail}
                onCheckedChange={(sendWelcomeEmail) => setForm({ ...form, sendWelcomeEmail })}
              />
            </div>
          </div>

          <div className="admin-dialog-footer workspace-crud-dialog-footer">
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
              className="admin-btn-create mail-edit-dialog-submit"
              disabled={submitting || emailDuplicate}
            >
              {submitting ? 'Création…' : 'Créer utilisateur'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
