'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthPasswordField } from '@/components/auth/auth-password-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { PasswordPolicyConfig } from '@/lib/auth/password-policy';
import type { PlatformBranding } from '@/lib/dg/platform-branding';
import { homePathForRole } from '@/lib/auth/home-path-for-role';
import type { RoleId } from '@/lib/dg/role-ids';
import { validateFrenchForm } from '@/lib/auth/french-input-validation';

export function ChangePasswordForm({
  branding,
  passwordPolicy,
}: {
  branding: PlatformBranding;
  passwordPolicy: PasswordPolicyConfig;
}) {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateFrenchForm(e.currentTarget)) return;

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok || !json.ok) {
        setError(json.message ?? 'Impossible de mettre à jour le mot de passe.');
        setIsLoading(false);
        return;
      }

      await update({ mustChangePassword: false });
      const role = (session?.user?.role ?? 'MANAGER') as RoleId;
      router.push(homePathForRole(role));
      router.refresh();
    } catch {
      setError('Erreur réseau. Réessayez.');
      setIsLoading(false);
    }
  };

  const displayName =
    session?.user?.firstName?.trim() ||
    session?.user?.name?.split(' ')[0] ||
    'Utilisateur';

  return (
    <AuthPageShell
      branding={branding}
      title="Nouveau mot de passe"
      subtitle="Sécurisez votre compte avant d’accéder à la plateforme"
    >
      <div className="auth-change-password-card">
        <div className="auth-change-password-notice" role="status">
          <div className="auth-change-password-notice-head">
            <ShieldCheck className="auth-change-password-notice-icon" aria-hidden />
            <h3 className="auth-change-password-notice-title">Première connexion</h3>
          </div>
          <p className="auth-change-password-notice-text">
            Bonjour <strong>{displayName}</strong>, pour des raisons de sécurité, choisissez un
            nouveau mot de passe personnel. Il remplacera le mot de passe temporaire envoyé par
            e-mail.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-change-password-form auth-login-form">
          {error ? (
            <p className="auth-login-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="auth-login-field">
            <Label htmlFor="new-password" className="auth-login-label">
              Nouveau mot de passe
            </Label>
            <AuthPasswordField
              id="new-password"
              value={newPassword}
              onChange={setNewPassword}
              policy={passwordPolicy}
              placeholder="Choisissez un mot de passe sécurisé"
              autoComplete="new-password"
              enforceMinLength
              showStrength
              compactStrength
            />
          </div>

          <div className="auth-login-field">
            <Label htmlFor="confirm-password" className="auth-login-label">
              Confirmer le mot de passe
            </Label>
            <AuthPasswordField
              id="confirm-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              policy={passwordPolicy}
              placeholder="Répétez le mot de passe"
              autoComplete="new-password"
              showStrength={false}
            />
          </div>

          <Button type="submit" className="auth-login-submit" disabled={isLoading}>
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Enregistrer et continuer
          </Button>
        </form>
      </div>
    </AuthPageShell>
  );
}
