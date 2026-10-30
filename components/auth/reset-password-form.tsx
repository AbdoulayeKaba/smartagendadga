'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthPasswordField } from '@/components/auth/auth-password-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { PasswordPolicyConfig } from '@/lib/auth/password-policy';
import type { PlatformBranding } from '@/lib/dg/platform-branding';
import { validateFrenchForm } from '@/lib/auth/french-input-validation';

export function ResetPasswordForm({
  branding,
  passwordPolicy,
}: {
  branding: PlatformBranding;
  passwordPolicy: PasswordPolicyConfig;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setTokenValid(false);
      return;
    }

    void (async () => {
      try {
        const res = await fetch(
          `/api/auth/reset-password?token=${encodeURIComponent(token)}`
        );
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          email?: string;
        };
        setTokenValid(Boolean(res.ok && json.ok));
        setEmail(json.email ?? '');
      } catch {
        setTokenValid(false);
      } finally {
        setChecking(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateFrenchForm(e.currentTarget) || !token) return;

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };

      if (!res.ok || !json.ok) {
        setError(json.message ?? 'Impossible de réinitialiser le mot de passe.');
        setIsLoading(false);
        return;
      }

      router.push('/login?reset=success');
    } catch {
      setError('Erreur réseau. Réessayez.');
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <AuthPageShell
        branding={branding}
        title="Réinitialisation"
        subtitle="Vérification du lien en cours…"
      >
        <div className="auth-login-card flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--admin-primary)]" />
        </div>
      </AuthPageShell>
    );
  }

  if (!tokenValid) {
    return (
      <AuthPageShell
        branding={branding}
        title="Lien invalide"
        subtitle="Ce lien de réinitialisation a expiré ou n’est plus valide"
      >
        <div className="auth-login-card">
          <p className="auth-forgot-success-text mb-4">
            Demandez un nouveau lien depuis la page « Mot de passe oublié ».
          </p>
          <Button asChild className="auth-login-submit">
            <Link href="/forgot-password">Nouvelle demande</Link>
          </Button>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      branding={branding}
      title="Nouveau mot de passe"
      subtitle="Choisissez un mot de passe sécurisé"
    >
      <div className="auth-login-card">
        <div className="auth-login-card-intro">
          <h3 className="auth-login-card-title">Réinitialisation</h3>
          <p className="auth-login-card-desc">
            {email ? (
              <>
                Compte <span className="font-medium text-foreground">{email}</span>
              </>
            ) : (
              'Définissez votre nouveau mot de passe.'
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-login-form">
          {error ? (
            <p className="auth-login-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="auth-login-field">
            <Label htmlFor="reset-password" className="auth-login-label">
              Nouveau mot de passe
            </Label>
            <AuthPasswordField
              id="reset-password"
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
            <Label htmlFor="reset-confirm" className="auth-login-label">
              Confirmer le mot de passe
            </Label>
            <AuthPasswordField
              id="reset-confirm"
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
            Enregistrer le mot de passe
          </Button>

          <Link href="/login" className="auth-login-back-link">
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Retour à la connexion
          </Link>
        </form>
      </div>
    </AuthPageShell>
  );
}
