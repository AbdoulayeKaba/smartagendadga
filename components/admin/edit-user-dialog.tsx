'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Eye, EyeOff, KeyRound, Pencil } from 'lucide-react';
import { signOut } from 'next-auth/react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
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
import { RolePermissionsPreview } from '@/components/admin/role-permissions-preview';
import type { UserProfileData } from '@/components/admin/user-profile-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import '@/components/workspace/mail-enregistrement.css';
import '@/components/admin/admin-edit-dialog.css';
import { toast } from '@/hooks/use-toast';
import { passwordPolicyErrorMessage } from '@/lib/auth/password-policy';
import { useAssignableRoles } from '@/hooks/use-assignable-roles';
import { findEmailConflict } from '@/lib/form/field-duplicate';
import { dgRoleLabel } from '@/lib/dg/role-labels';
import { permissionsForRole } from '@/lib/dg/role-permissions';
import { isDgRole, type RoleId } from '@/lib/dg/role-ids';
import { cn } from '@/lib/utils';

type FormState = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: RoleId;
  department: string;
  active: boolean;
  password: string;
  passwordConfirm: string;
};

type Props = {
  user: UserProfileData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
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
  onUserInput,
  show,
  onToggleShow,
  placeholder,
  tinted,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onUserInput?: () => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder?: string;
  tinted?: boolean;
}) {
  return (
    <FieldGroup id={id} label={label}>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          readOnly
          onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
          value={value}
          onChange={(e) => {
            onUserInput?.();
            onChange(e.target.value);
          }}
          className={cn('admin-field pr-9', tinted && 'admin-field-password')}
          placeholder={placeholder ?? '••••••••'}
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

function userToForm(user: UserProfileData): FormState {
  return {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? '',
    role: user.role,
    department: user.department,
    active: user.active,
    password: '',
    passwordConfirm: '',
  };
}

export function EditUserDialog({ user, open, onOpenChange, onSaved, existingUsers = [] }: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailServerError, setEmailServerError] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const { roles: assignableRoles, loading: rolesLoading } = useAssignableRoles(open);
  useEffect(() => {
    if (open && user) {
      setForm(userToForm(user));
      setShowPassword(false);
      setShowConfirm(false);
      setEmailServerError(false);
      setPasswordTouched(false);
      setPasswordOpen(false);
    }
    if (!open) setForm(null);
  }, [open, user]);

  const f = useMemo(() => {
    if (!user) return null;
    return form ?? userToForm(user);
  }, [form, user]);

  const emailConflict = f
    ? findEmailConflict(existingUsers, f.email, user?.id)
    : undefined;
  const emailDuplicate = Boolean(emailConflict) || emailServerError;
  const emailErrorMessage = emailConflict
    ? `L’adresse « ${emailConflict.email} » est déjà utilisée.`
    : emailServerError
      ? 'Cet email est déjà utilisé.'
      : null;

  const [rolePermissions, setRolePermissions] = useState<string[]>([]);

  useEffect(() => {
    if (!f?.role) {
      setRolePermissions([]);
      return;
    }
    let cancelled = false;
    void fetch(`/api/admin/roles/${f.role}/permission-labels`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { labels?: string[] } | null) => {
        if (cancelled) return;
        const fallback = isDgRole(f.role) ? permissionsForRole(f.role) : [];
        setRolePermissions(j?.labels?.length ? j.labels : fallback);
      })
      .catch(() => {
        if (!cancelled) {
          setRolePermissions(isDgRole(f.role) ? permissionsForRole(f.role) : []);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [f?.role]);

  const patchForm = (patch: Partial<FormState>) => {
    if (!user) return;
    if (patch.email !== undefined) setEmailServerError(false);
    setForm({ ...(form ?? userToForm(user)), ...patch });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !f) return;

    if (passwordTouched && (f.password || f.passwordConfirm)) {
      if (f.password !== f.passwordConfirm) {
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
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: f.email,
          firstName: f.firstName,
          lastName: f.lastName,
          phone: f.phone || undefined,
          role: f.role,
          department: f.department || undefined,
          active: f.active,
          password: passwordTouched && f.password ? f.password : undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessionRevoked?: boolean;
      };
      if (!res.ok) {
        if (j.error === 'EMAIL_EXISTS') {
          setEmailServerError(true);
          return;
        }
        toast({
          variant: 'destructive',
          title: 'Enregistrement impossible',
          description:
            j.error === 'UNAUTHORIZED'
              ? 'Session expirée ou invalide. Reconnectez-vous puis réessayez.'
              : j.error === 'FORBIDDEN'
                ? 'Vous n’avez pas les droits pour modifier cet utilisateur.'
                : j.error === 'LAST_ADMIN'
                  ? 'Il doit rester au moins une assistante active.'
                  : j.error === 'INVALID_ROLE'
                    ? 'Rôle invalide ou archivé.'
                    : typeof j.error === 'string' && j.error.startsWith('PASSWORD_')
                      ? passwordPolicyErrorMessage(j.error)
                      : String(j.error ?? 'Échec'),
        });
        if (j.error === 'UNAUTHORIZED') {
          return;
        }
        return;
      }
      if (j.sessionRevoked) {
        toast({
          title: 'Utilisateur enregistré',
          description: 'Votre session a été renouvelée. Reconnectez-vous.',
        });
        onOpenChange(false);
        await signOut({ callbackUrl: '/' });
        return;
      }
      toast({ title: 'Utilisateur enregistré' });
      onOpenChange(false);
      await onSaved();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !user || !f) return null;

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
                <span className="mail-edit-dialog-heading">Utilisateur</span>
              </span>
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Mettez à jour les informations et le rôle
          </DialogDescription>
        </DialogHeader>

        <form className="min-h-0" onSubmit={submit}>
          <div className="admin-dialog-body admin-create-user-grid mail-edit-form">
            <FieldGroup id="edit-firstName" label="Prénom">
              <Input
                id="edit-firstName"
                required
                value={f.firstName}
                onChange={(e) => patchForm({ firstName: e.target.value })}
                className="admin-field"
              />
            </FieldGroup>

            <FieldGroup id="edit-lastName" label="Nom">
              <Input
                id="edit-lastName"
                required
                value={f.lastName}
                onChange={(e) => patchForm({ lastName: e.target.value })}
                className="admin-field"
              />
            </FieldGroup>

            <FieldGroup id="edit-email" label="Email">
              <Input
                id="edit-email"
                type="email"
                required
                value={f.email}
                onChange={(e) => patchForm({ email: e.target.value })}
                className={inlineFieldErrorClass(emailDuplicate, 'admin-field')}
                aria-invalid={emailDuplicate || undefined}
                aria-describedby={emailErrorMessage ? 'edit-email-error' : undefined}
              />
              <InlineFieldError id="edit-email-error" message={emailErrorMessage} />
            </FieldGroup>

            <FieldGroup id="edit-phone" label="Téléphone">
              <Input
                id="edit-phone"
                type="tel"
                value={f.phone ?? ''}
                onChange={(e) => patchForm({ phone: e.target.value })}
                placeholder="Ex : +221 77 000 00 00"
                className="admin-field"
              />
            </FieldGroup>

            <FieldGroup id="edit-role" label="Rôle">
              <Select
                value={f.role}
                onValueChange={(v) => patchForm({ role: v as RoleId })}
                disabled={rolesLoading || assignableRoles.length === 0}
              >
                <SelectTrigger id="edit-role" className="admin-field w-full">
                  <SelectValue
                    placeholder={rolesLoading ? 'Chargement…' : 'Aucun rôle'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                  {!assignableRoles.some((r) => r.id === f.role) && (
                    <SelectItem value={f.role}>
                      {isDgRole(f.role) ? dgRoleLabel(f.role) : f.role} (archivé ou indisponible)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </FieldGroup>

            <FieldGroup id="edit-status" label="Statut">
              <Select
                value={f.active ? 'active' : 'inactive'}
                onValueChange={(v) => patchForm({ active: v === 'active' })}
              >
                <SelectTrigger id="edit-status" className="admin-field w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>

            <div className="admin-create-user-span-2">
              <RolePermissionsPreview permissions={rolePermissions} compact />
            </div>

            <Collapsible
              open={passwordOpen}
              onOpenChange={(open) => {
                setPasswordOpen(open);
                if (!open) {
                  setPasswordTouched(false);
                  patchForm({ password: '', passwordConfirm: '' });
                  setShowPassword(false);
                  setShowConfirm(false);
                }
              }}
              className="admin-create-user-span-2"
            >
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 border-dashed text-muted-foreground hover:text-foreground"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  {passwordOpen ? 'Masquer le changement de mot de passe' : 'Changer le mot de passe'}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 grid gap-3 sm:grid-cols-2">
                <PasswordField
                  id="edit-password"
                  label="Nouveau mot de passe"
                  value={f.password}
                  onChange={(v) => patchForm({ password: v })}
                  onUserInput={() => setPasswordTouched(true)}
                  show={showPassword}
                  onToggleShow={() => setShowPassword((s) => !s)}
                  tinted
                />
                <PasswordField
                  id="edit-passwordConfirm"
                  label="Confirmer"
                  value={f.passwordConfirm}
                  onChange={(v) => patchForm({ passwordConfirm: v })}
                  onUserInput={() => setPasswordTouched(true)}
                  show={showConfirm}
                  onToggleShow={() => setShowConfirm((s) => !s)}
                />
                <p className="admin-create-user-hint sm:col-span-2">
                  Laissez vide pour conserver le mot de passe actuel.
                </p>
              </CollapsibleContent>
            </Collapsible>
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
              className="mail-edit-dialog-submit"
              disabled={submitting || emailDuplicate}
            >
              {submitting ? 'Enregistrement…' : 'Mettre à jour'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
