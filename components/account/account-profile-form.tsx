'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CalendarDays,
  Bell,
  Camera,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  MonitorSmartphone,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDepartmentsReferential } from '@/hooks/use-departments-referential';
import { passwordPolicyErrorMessage, PASSWORD_POLICY_ERROR_LABELS } from '@/lib/auth/password-policy';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/lib/app-context';
import {
  DG_ROOM_RESERVATIONS_HREF,
  DG_ROOM_RESERVATIONS_LIST_LABEL,
} from '@/lib/dg/meeting-room-config';
import { userInitials } from '@/lib/dg/role-labels';
import './account-profile.css';
import './account-security.css';
import './account-two-factor.css';

const DEPT_NONE = '__none__';

type AccountForm = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  department: string;
  password: string;
  passwordConfirm: string;
  avatarUrl: string | null;
};

const emptyForm = (): AccountForm => ({
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  department: '',
  password: '',
  passwordConfirm: '',
  avatarUrl: null,
});

export function AccountProfileForm() {
  const router = useRouter();
  const { currentUser, roleLabel } = useApp();
  const { departments } = useDepartmentsReferential();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [setupOtpauth, setSetupOtpauth] = useState<string | null>(null);
  const [setupQr, setSetupQr] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const setupOtpRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      fetch('/api/account').then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as {
          user?: {
            email: string;
            firstName: string;
            lastName: string;
            phone: string;
            department: string;
            avatarUrl?: string | null;
            lastLoginAt?: string | null;
          };
        };
        return { res, j };
      }),
      fetch('/api/account/two-factor').then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as { enabled?: boolean };
        return { res, j };
      }),
    ])
      .then(([{ res, j }, tf]) => {
        if (cancelled) return;
        if (res.ok && j.user) {
          setForm({
            email: j.user.email,
            firstName: j.user.firstName,
            lastName: j.user.lastName,
            phone: j.user.phone ?? '',
            department: j.user.department ?? '',
            password: '',
            passwordConfirm: '',
            avatarUrl: j.user.avatarUrl ?? null,
          });
          setLastLoginAt(j.user.lastLoginAt ?? null);
        } else {
          setForm({
            ...emptyForm(),
            email: currentUser.email,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            avatarUrl: currentUser.avatar ?? null,
          });
          setLastLoginAt(null);
        }
        if (tf.res.ok) setTwoFactorEnabled(Boolean(tf.j.enabled));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser.avatar, currentUser.email, currentUser.firstName, currentUser.lastName]);

  const beginTwoFactorSetup = async () => {
    setTwoFactorBusy(true);
    try {
      const res = await fetch('/api/account/two-factor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        secret?: string;
        otpauthUrl?: string;
        qrDataUrl?: string;
        error?: string;
      };
      if (!res.ok || !j.secret) {
        toast({
          variant: 'destructive',
          title: 'Impossible de démarrer la 2FA',
          description:
            j.error === 'ALREADY_ENABLED'
              ? 'La double authentification est déjà active.'
              : 'Réessayez dans un instant.',
        });
        return;
      }
      setSetupSecret(j.secret);
      setSetupOtpauth(j.otpauthUrl ?? null);
      setSetupQr(j.qrDataUrl ?? null);
      setSetupCode('');
      setSetupOpen(true);
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const confirmTwoFactorSetup = async () => {
    setTwoFactorBusy(true);
    try {
      const res = await fetch('/api/account/two-factor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', code: setupCode.trim() }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Code invalide',
          description: 'Vérifiez le code à 6 chiffres de votre application.',
        });
        return;
      }
      setTwoFactorEnabled(true);
      setSetupOpen(false);
      setSetupSecret(null);
      setSetupOtpauth(null);
      setSetupQr(null);
      setSetupCode('');
      toast({ title: '2FA activée', description: 'Votre compte est mieux protégé.' });
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const disableTwoFactor = async () => {
    if (!disableCode.trim() && !disablePassword.trim()) {
      toast({
        variant: 'destructive',
        title: 'Confirmation requise',
        description: 'Saisissez votre mot de passe ou un code 2FA.',
      });
      return;
    }
    setTwoFactorBusy(true);
    try {
      const res = await fetch('/api/account/two-factor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disable',
          ...(disableCode.trim() ? { code: disableCode.trim() } : {}),
          ...(disablePassword.trim() ? { password: disablePassword } : {}),
        }),
      });
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Désactivation refusée',
          description: 'Mot de passe ou code incorrect.',
        });
        return;
      }
      setTwoFactorEnabled(false);
      setDisableOpen(false);
      setDisableCode('');
      setDisablePassword('');
      toast({ title: '2FA désactivée' });
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const canSave =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    (!form.password || form.password === form.passwordConfirm);

  const initials = userInitials(
    form.firstName || currentUser.firstName,
    form.lastName || currentUser.lastName
  );
  const displayName =
    [form.firstName, form.lastName].map((s) => s.trim()).filter(Boolean).join(' ') ||
    `${currentUser.firstName} ${currentUser.lastName}`.trim();
  const pseudonym = form.email.includes('@')
    ? form.email.slice(0, form.email.indexOf('@'))
    : form.email;
  const lastLoginLabel = lastLoginAt
    ? formatDistanceToNow(new Date(lastLoginAt), { addSuffix: true, locale: fr })
    : null;

  const uploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const body = new FormData();
      body.set('file', file);
      const res = await fetch('/api/account/avatar', { method: 'POST', body });
      const j = (await res.json().catch(() => ({}))) as {
        avatarUrl?: string;
        error?: string;
      };
      if (!res.ok || !j.avatarUrl) {
        toast({
          variant: 'destructive',
          title: 'Photo non enregistrée',
          description:
            j.error === 'FILE_TOO_LARGE'
              ? 'Image trop lourde (2 Mo max).'
              : j.error === 'UNSUPPORTED_FILE_TYPE'
                ? 'Formats acceptés : JPG, PNG, WebP, GIF.'
                : 'Réessayez avec une autre image.',
        });
        return;
      }
      setForm((f) => ({ ...f, avatarUrl: j.avatarUrl ?? null }));
      toast({ title: 'Photo mise à jour' });
      router.refresh();
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAvatar = async () => {
    setUploadingAvatar(true);
    try {
      const res = await fetch('/api/account/avatar', { method: 'DELETE' });
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Suppression impossible',
          description: 'Réessayez.',
        });
        return;
      }
      setForm((f) => ({ ...f, avatarUrl: null }));
      toast({ title: 'Photo retirée' });
      router.refresh();
    } finally {
      setUploadingAvatar(false);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          department: form.department.trim(),
          ...(form.password
            ? { password: form.password, passwordConfirm: form.passwordConfirm }
            : {}),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessionRevoked?: boolean;
      };
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Enregistrement impossible',
          description:
            j.error === 'PASSWORD_MISMATCH'
              ? 'Les mots de passe ne correspondent pas.'
              : j.error === 'VALIDATION_ERROR'
                  ? 'Vérifiez les champs du formulaire.'
                : j.error && j.error in PASSWORD_POLICY_ERROR_LABELS
                  ? passwordPolicyErrorMessage(j.error)
                  : 'Réessayez.',
        });
        return;
      }
      toast({
        title: 'Profil mis à jour',
        description: j.sessionRevoked
          ? 'Mot de passe modifié — reconnectez-vous.'
          : 'Vos informations ont été enregistrées.',
      });
      if (j.sessionRevoked) {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/');
        router.refresh();
        return;
      }
      setForm((f) => ({ ...f, password: '', passwordConfirm: '' }));
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-profile-page">
      <div className="account-profile-shell-card">
        <header className="account-profile-topbar">
          <div className="account-profile-topbar-brand">
            <span className="account-profile-topbar-icon" aria-hidden>
              <UserRound className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h1 className="account-profile-topbar-title">Mon profil</h1>
              <p className="account-profile-topbar-subtitle">
                Identité, photo et sécurité du compte
              </p>
            </div>
          </div>
          <div className="account-profile-topbar-actions">
            <span className="account-profile-status-badge">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Compte actif
            </span>
            <button
              type="button"
              className="admin-btn-primary account-profile-save-btn"
              disabled={loading || !canSave || saving}
              onClick={() => void save()}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Enregistrer
            </button>
          </div>
        </header>

      {loading ? (
          <div className="account-profile-loading">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Chargement du profil…
        </div>
      ) : (
          <div className="account-profile-layout">
            <aside className="account-profile-aside">
              <div className="account-profile-identity">
                <div className="account-profile-identity-band" aria-hidden />
                <div className="account-profile-photo-wrap">
                  <button
                    type="button"
                    className="account-profile-photo"
                    disabled={uploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={form.avatarUrl ? 'Changer la photo' : 'Charger une photo'}
                  >
                    {form.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.avatarUrl} alt="" className="account-profile-photo-img" />
                    ) : (
                      <span className="account-profile-photo-initials">{initials}</span>
                    )}
                    {uploadingAvatar ? (
                      <span className="account-profile-photo-busy">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    className="account-profile-photo-fab"
                    disabled={uploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={form.avatarUrl ? 'Changer la photo' : 'Charger une photo'}
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                <div className="account-profile-identity-meta">
                  <p className="account-profile-identity-name">{displayName}</p>
                  <p className="account-profile-identity-email">{form.email}</p>
                  {roleLabel ? (
                    <span className="account-profile-role-pill">{roleLabel}</span>
                  ) : null}
                </div>
                <div className="account-profile-photo-toolbar">
                  <button
                    type="button"
                    className="account-profile-toolbar-btn"
                    disabled={uploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden />
                    {form.avatarUrl ? 'Changer' : 'Charger'}
                  </button>
                  {form.avatarUrl ? (
                    <button
                      type="button"
                      className="account-profile-toolbar-btn account-profile-toolbar-btn--danger"
                      disabled={uploadingAvatar}
                      onClick={() => void removeAvatar()}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Retirer
                    </button>
                  ) : null}
                </div>
                <p className="account-profile-photo-hint">
                  Cliquez sur la photo pour la modifier · JPG, PNG ou WebP — 2 Mo max.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAvatar(file);
                  }}
                />
          </div>

              <nav className="account-profile-shortcuts" aria-label="Accès rapides">
                <p className="account-profile-shortcuts-label">Accès rapides</p>
                <Link href="/dg/appointments" className="account-profile-shortcut">
                  <span className="account-profile-shortcut-icon" aria-hidden>
                    <CalendarDays className="h-3.5 w-3.5" />
                  </span>
                  <span className="account-profile-shortcut-text">
                    <span className="account-profile-shortcut-title">Liste des rendez-vous</span>
                    <span className="account-profile-shortcut-blurb">Suivi et historique</span>
                  </span>
                  <ChevronRight className="account-profile-shortcut-chevron" aria-hidden />
                </Link>
                <Link href={DG_ROOM_RESERVATIONS_HREF} className="account-profile-shortcut">
                  <span className="account-profile-shortcut-icon" aria-hidden>
                    <Building2 className="h-3.5 w-3.5" />
                  </span>
                  <span className="account-profile-shortcut-text">
                    <span className="account-profile-shortcut-title">
                      {DG_ROOM_RESERVATIONS_LIST_LABEL}
                    </span>
                    <span className="account-profile-shortcut-blurb">Salles & créneaux</span>
                  </span>
                  <ChevronRight className="account-profile-shortcut-chevron" aria-hidden />
                </Link>
              </nav>
            </aside>

            <div className="account-profile-main">
              <section className="account-profile-panel">
                <div className="account-profile-panel-head">
                  <span className="account-profile-panel-icon" aria-hidden>
                    <UserRound className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <h2 className="account-profile-panel-title">Identité</h2>
                    <p className="account-profile-panel-blurb">
                      Informations personnelles visibles dans l’annuaire interne
                    </p>
                  </div>
                </div>
                <div className="account-profile-grid">
                  <div className="account-profile-field account-profile-field--full">
                    <Label htmlFor="account-email" className="account-profile-label">
                      E-mail professionnel
              </Label>
                    <div className="account-profile-email-lock">
              <Input
                id="account-email"
                        className="admin-field account-profile-input"
                value={form.email}
                disabled
                readOnly
              />
                      <Lock className="account-profile-email-lock-icon" aria-hidden />
                    </div>
                  </div>
                  <div className="account-profile-field account-profile-field--full">
                    <Label htmlFor="account-pseudonym" className="account-profile-label">
                      Pseudonyme
                    </Label>
                    <div className="account-profile-email-lock">
                      <Input
                        id="account-pseudonym"
                        className="admin-field account-profile-input"
                        value={pseudonym}
                        disabled
                        readOnly
                      />
                      <Lock className="account-profile-email-lock-icon" aria-hidden />
                    </div>
                    <p className="account-profile-field-hint">
                      Pour modifier l’e-mail ou le pseudonyme, contactez votre administrateur
                    </p>
            </div>
                  <div className="account-profile-field">
                    <Label htmlFor="account-firstName" className="account-profile-label">
                      Prénom <span aria-hidden>*</span>
              </Label>
              <Input
                id="account-firstName"
                      className="admin-field account-profile-input"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                autoComplete="given-name"
              />
            </div>
                  <div className="account-profile-field">
                    <Label htmlFor="account-lastName" className="account-profile-label">
                      Nom <span aria-hidden>*</span>
              </Label>
              <Input
                id="account-lastName"
                      className="admin-field account-profile-input"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                autoComplete="family-name"
              />
            </div>
                  <div className="account-profile-field">
                    <Label htmlFor="account-phone" className="account-profile-label">
                Téléphone
              </Label>
              <Input
                id="account-phone"
                      className="admin-field account-profile-input"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                autoComplete="tel"
              />
            </div>
                  <div className="account-profile-field">
                    <Label htmlFor="account-department" className="account-profile-label">
                Département
              </Label>
              <Select
                value={form.department || DEPT_NONE}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, department: v === DEPT_NONE ? '' : v }))
                }
              >
                      <SelectTrigger
                        id="account-department"
                        className="admin-field account-profile-input h-9"
                      >
                  <SelectValue placeholder="— Département —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEPT_NONE}>— Aucun —</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
              </section>

              <section className="account-profile-panel account-profile-panel--security">
                <div className="account-profile-panel-head account-profile-panel-head--flush">
                  <span className="account-profile-panel-icon" aria-hidden>
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <h2 className="account-profile-panel-title">Sécurité</h2>
                    <p className="account-profile-panel-blurb">
                      Mot de passe, double authentification et sessions
                    </p>
                  </div>
            </div>

                <ul className="account-sec-list">
                  <li className={`account-sec-item${passwordOpen ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="account-sec-item-row"
                      aria-expanded={passwordOpen}
                      onClick={() => setPasswordOpen((v) => !v)}
                    >
                      <span className="account-sec-item-ico" aria-hidden>
                        <Lock />
                      </span>
                      <span className="account-sec-item-copy">
                        <span className="account-sec-item-label">Modifier le mot de passe</span>
                        <span className="account-sec-item-hint">
                          {passwordOpen ? 'Laisser vide pour conserver l’actuel' : 'Changer le mot de passe'}
                        </span>
                      </span>
                      <span className="account-sec-item-trail" aria-hidden>
                        <ChevronDown
                          className={`account-sec-item-chevron${passwordOpen ? ' is-open' : ''}`}
                        />
                      </span>
                    </button>
                    {passwordOpen ? (
                      <div className="account-sec-item-panel">
                        <div className="account-profile-grid">
                          <div className="account-profile-field">
                            <Label htmlFor="account-password" className="account-profile-label">
                  Nouveau mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="account-password"
                                className="admin-field account-profile-input pr-9"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                                onChange={(e) =>
                                  setForm((f) => ({ ...f, password: e.target.value }))
                                }
                    autoComplete="new-password"
                                placeholder="••••••••"
                  />
                  <button
                    type="button"
                                className="account-profile-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Masquer' : 'Afficher'}
                  >
                                {showPassword ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                  </button>
                </div>
              </div>
                          <div className="account-profile-field">
                            <Label
                              htmlFor="account-passwordConfirm"
                              className="account-profile-label"
                            >
                  Confirmation
                </Label>
                <Input
                  id="account-passwordConfirm"
                              className="admin-field account-profile-input"
                  type={showPassword ? 'text' : 'password'}
                  value={form.passwordConfirm}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, passwordConfirm: e.target.value }))
                              }
                  autoComplete="new-password"
                              placeholder="••••••••"
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </li>

                  <li className="account-sec-item">
                    <div className="account-sec-item-row">
                      <span className="account-sec-item-ico" aria-hidden>
                        <KeyRound />
                      </span>
                      <span className="account-sec-item-copy">
                        <span className="account-sec-item-label">
                          Authentification à deux facteurs
                        </span>
                        <span className="account-sec-item-hint">
                          {twoFactorEnabled
                            ? 'Protège la connexion par code applicatif'
                            : 'Activez un code via Authenticator'}
                        </span>
                      </span>
                      <span className="account-sec-item-trail">
                        <span
                          className={`account-sec-status ${
                            twoFactorEnabled
                              ? 'account-sec-status--on'
                              : 'account-sec-status--off'
                          }`}
                        >
                          {twoFactorEnabled ? 'Activé' : 'Désactivé'}
                        </span>
                        <Switch
                          className="account-sec-switch"
                          checked={twoFactorEnabled}
                          disabled={twoFactorBusy || loading}
                          onCheckedChange={(checked) => {
                            if (checked) void beginTwoFactorSetup();
                            else setDisableOpen(true);
                          }}
                          aria-label="Activer ou désactiver la double authentification"
                        />
                      </span>
                    </div>
                  </li>

                  <li className="account-sec-item">
                    <div className="account-sec-item-row">
                      <span className="account-sec-item-ico" aria-hidden>
                        <Bell />
                      </span>
                      <span className="account-sec-item-copy">
                        <span className="account-sec-item-label">Notifications</span>
                        <span className="account-sec-item-hint">RDV, missions et courriers</span>
                      </span>
                      <span className="account-sec-item-trail">
                        <span className="account-sec-status account-sec-status--on">E-mail</span>
                        <span className="account-sec-status account-sec-status--on">In-app</span>
                      </span>
                    </div>
                  </li>

                  <li className="account-sec-item">
                    <div className="account-sec-item-row">
                      <span className="account-sec-item-ico" aria-hidden>
                        <MonitorSmartphone />
                      </span>
                      <span className="account-sec-item-copy">
                        <span className="account-sec-item-label">Appareils &amp; sessions</span>
                        <span className="account-sec-item-hint">
                          {lastLoginLabel
                            ? `Activité ${lastLoginLabel}`
                            : 'Session active'}
                          <span className="account-sec-item-sep">·</span>
                          MDP → déconnecte les autres
                        </span>
                      </span>
                      <span className="account-sec-item-trail">
                        <span className="account-sec-status account-sec-status--on">
                          Cet appareil
                        </span>
                      </span>
                    </div>
                  </li>
                </ul>
              </section>
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={setupOpen}
        onOpenChange={(open) => {
          if (!open && !twoFactorBusy) {
            void fetch('/api/account/two-factor', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'cancel-setup' }),
            });
            setSetupOpen(false);
            setSetupSecret(null);
            setSetupOtpauth(null);
            setSetupQr(null);
            setSetupCode('');
          }
        }}
      >
        <DialogContent className="account-2fa-dialog" showCloseButton>
          <div className="account-2fa-head">
            <span className="account-2fa-head-ico" aria-hidden>
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <div>
              <DialogTitle className="account-2fa-title">Activer la 2FA</DialogTitle>
              <DialogDescription className="account-2fa-desc">
                Scannez le QR, puis validez avec le code de l’application.
              </DialogDescription>
            </div>
          </div>

          <ol className="account-2fa-steps" aria-hidden>
            <li className="account-2fa-step">
              <span className="account-2fa-step-num">1</span> Scanner
            </li>
            <li className="account-2fa-step">
              <span className="account-2fa-step-num">2</span> Code
            </li>
            <li className="account-2fa-step">
              <span className="account-2fa-step-num">3</span> Activer
            </li>
          </ol>

          <div className="account-2fa-body">
            <div className="account-2fa-qr-wrap">
              {setupQr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={setupQr} alt="QR code 2FA" className="account-2fa-qr" />
              ) : (
                <div className="account-2fa-qr grid place-items-center text-[0.6rem] text-muted-foreground">
                  QR…
                </div>
              )}
              <div className="account-2fa-qr-meta">
                <p className="account-2fa-qr-label">Google / Microsoft Authenticator</p>
                <p className="account-2fa-qr-hint">
                  Impossible de scanner ? Utilisez la clé ci-dessous.
                </p>
                {setupOtpauth ? (
                  <a href={setupOtpauth} className="account-2fa-copy" style={{ width: 'fit-content' }}>
                    Ouvrir l’app
                  </a>
                ) : null}
              </div>
            </div>

            {setupSecret ? (
              <div className="account-2fa-secret">
                <span className="account-2fa-secret-label">Clé manuelle</span>
                <div className="account-2fa-secret-row">
                  <code className="account-2fa-secret-code">
                    {setupSecret.replace(/(.{4})/g, '$1 ').trim()}
                  </code>
                  <button
                    type="button"
                    className="account-2fa-copy"
                    onClick={() => {
                      void navigator.clipboard?.writeText(setupSecret);
                      toast({ title: 'Clé copiée' });
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    Copier
                  </button>
                </div>
              </div>
            ) : null}

            <div className="account-2fa-code-block">
              <Label htmlFor="account-2fa-otp-0" className="account-2fa-code-label">
                Code de vérification
              </Label>
              <div className="account-2fa-otp" role="group" aria-label="Code à 6 chiffres">
                {Array.from({ length: 6 }, (_, i) => (
                  <input
                    key={i}
                    id={i === 0 ? 'account-2fa-otp-0' : undefined}
                    ref={(el) => {
                      setupOtpRefs.current[i] = el;
                    }}
                    className="account-2fa-otp-cell border-2 border-slate-400 bg-white"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    value={setupCode[i] ?? ''}
                    onChange={(e) => {
                      const digit = e.target.value.replace(/\D/g, '').slice(-1);
                      const chars = Array.from({ length: 6 }, (_, idx) => setupCode[idx] ?? '');
                      chars[i] = digit;
                      const code = chars.join('').replace(/\D/g, '').slice(0, 6);
                      setSetupCode(code);
                      if (digit && i < 5) setupOtpRefs.current[i + 1]?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !setupCode[i] && i > 0) {
                        setupOtpRefs.current[i - 1]?.focus();
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData
                        .getData('text')
                        .replace(/\D/g, '')
                        .slice(0, 6);
                      if (!pasted) return;
                      setSetupCode(pasted);
                      const focusIdx = Math.min(pasted.length, 5);
                      setupOtpRefs.current[focusIdx]?.focus();
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="account-2fa-footer">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="account-2fa-btn-cancel"
              disabled={twoFactorBusy}
              onClick={() => {
                void fetch('/api/account/two-factor', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'cancel-setup' }),
                });
                setSetupOpen(false);
                setSetupSecret(null);
                setSetupOtpauth(null);
                setSetupQr(null);
                setSetupCode('');
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              className="account-2fa-btn-primary"
              disabled={twoFactorBusy || setupCode.length !== 6}
              onClick={() => void confirmTwoFactorSetup()}
            >
              {twoFactorBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Activer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={disableOpen}
        onOpenChange={(open) => {
          if (!twoFactorBusy) {
            setDisableOpen(open);
            if (!open) {
              setDisableCode('');
              setDisablePassword('');
            }
          }
        }}
      >
        <DialogContent className="account-2fa-dialog" showCloseButton>
          <div className="account-2fa-head">
            <span className="account-2fa-head-ico" aria-hidden>
              <KeyRound className="h-3.5 w-3.5" />
            </span>
            <div>
              <DialogTitle className="account-2fa-title">Désactiver la 2FA</DialogTitle>
              <DialogDescription className="account-2fa-desc">
                Confirmez avec le mot de passe ou un code Authenticator.
              </DialogDescription>
            </div>
          </div>
          <div className="account-2fa-body">
            <div className="account-2fa-code-block">
              <Label htmlFor="account-2fa-disable-password" className="account-2fa-code-label">
                Mot de passe
              </Label>
              <Input
                id="account-2fa-disable-password"
                type="password"
                autoComplete="current-password"
                className="h-9"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
              />
            </div>
            <div className="account-2fa-code-block">
              <Label htmlFor="account-2fa-disable-code" className="account-2fa-code-label">
                Ou code 2FA
              </Label>
              <Input
                id="account-2fa-disable-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                className="h-9 text-center tracking-[0.35em]"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
          </div>
          <div className="account-2fa-footer">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="account-2fa-btn-cancel"
              disabled={twoFactorBusy}
              onClick={() => setDisableOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              className="account-2fa-btn-danger"
              disabled={twoFactorBusy}
              onClick={() => void disableTwoFactor()}
            >
              {twoFactorBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Désactiver
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
