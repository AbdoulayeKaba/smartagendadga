'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { AuthPasswordField } from '@/components/auth/auth-password-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { PasswordPolicyConfig } from '@/lib/auth/password-policy'
import type { PlatformBranding } from '@/lib/dg/platform-branding'
import {
  onFrenchInputChange,
  onFrenchInputInvalid,
  validateFrenchForm,
} from '@/lib/auth/french-input-validation'

export function LoginForm({
  branding,
  passwordPolicy,
}: {
  branding: PlatformBranding
  passwordPolicy: PasswordPolicyConfig
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showMfa, setShowMfa] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
    mfaCode: '',
  })

  const [error, setError] = useState<string | null>(null)
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'down' | 'empty'>('checking')
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false)
  const [mockMode, setMockMode] = useState(false)

  useEffect(() => {
    void fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : { microsoft: false, mock: false }))
      .then((j: { microsoft?: boolean; mock?: boolean }) => {
        setMicrosoftEnabled(Boolean(j.microsoft))
        setMockMode(Boolean(j.mock))
        if (j.mock) setDbStatus('ok')
      })
    void fetch('/api/health/db')
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as {
          seeded?: boolean
          mock?: boolean
          ok?: boolean
        }
        if (r.status === 503 || j.ok === false) {
          setDbStatus('down')
          return
        }
        if (!r.ok) {
          setDbStatus('checking')
          return
        }
        if (j.mock) {
          setDbStatus('ok')
          setMockMode(true)
          return
        }
        setDbStatus(j.seeded ? 'ok' : 'empty')
      })
      .catch(() => setDbStatus('down'))
  }, [])

  const signInWithMicrosoft = async () => {
    setIsLoading(true)
    setError(null)
    try {
      await signIn('azure-ad', { callbackUrl: '/dashboard' })
    } catch {
      setError('Connexion Microsoft impossible.')
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateFrenchForm(e.currentTarget)) return

    setIsLoading(true)
    setError(null)

    if (!showMfa && formData.email && formData.password) {
      try {
        const pre = await fetch('/api/auth/credentials-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
          }),
        })
        const preJson = (await pre.json().catch(() => ({}))) as {
          ok?: boolean
          message?: string
          error?: string
          requiresMfa?: boolean
          redirectTo?: string
        }

        if (preJson.requiresMfa) {
          setShowMfa(true)
          setIsLoading(false)
          return
        }

        if (!pre.ok || !preJson.ok) {
          setError(
            preJson.message ??
              (preJson.error === 'DB_UNAVAILABLE' || pre.status === 503
                ? 'Base de données inaccessible. Vérifiez que MySQL est démarré sur localhost:3306.'
                : dbStatus === 'down'
                  ? 'Base de données inaccessible. Démarrez MySQL puis exécutez npm run db:migrate et npm run db:seed.'
                  : dbStatus === 'empty'
                    ? 'Aucun compte en base. Exécutez npm run db:seed (après npm run db:migrate).'
                    : 'Identifiants incorrects.')
          )
          setIsLoading(false)
          return
        }

        const result = await signIn('credentials', {
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          redirect: false,
        })
        if (!result || result.error) {
          setError('Connexion refusée. Réessayez ou utilisez Microsoft.')
          setIsLoading(false)
          return
        }
        router.push(preJson.redirectTo ?? '/dashboard')
        router.refresh()
      } catch {
        setError('Erreur réseau. Réessayez.')
      }
      setIsLoading(false)
      return
    }

    if (showMfa && formData.mfaCode) {
      try {
        const pre = await fetch('/api/auth/credentials-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
            totpCode: formData.mfaCode.trim(),
          }),
        })
        const preJson = (await pre.json().catch(() => ({}))) as {
          ok?: boolean
          message?: string
          redirectTo?: string
        }
        if (!pre.ok || !preJson.ok) {
          setError(preJson.message ?? 'Code de vérification incorrect.')
          setIsLoading(false)
          return
        }

        const result = await signIn('credentials', {
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          totpCode: formData.mfaCode.trim(),
          redirect: false,
        })
        if (!result || result.error) {
          setError('Code de vérification incorrect ou session refusée.')
          setIsLoading(false)
          return
        }
        router.push(preJson.redirectTo ?? '/dashboard')
        router.refresh()
      } catch {
        setError('Erreur réseau. Réessayez.')
      }
      setIsLoading(false)
      return
    }

    setIsLoading(false)
  }

  return (
    <AuthPageShell
      branding={branding}
      title={showMfa ? 'Vérification' : 'Connexion'}
      subtitle={
        showMfa
          ? 'Entrez le code de vérification envoyé à votre appareil'
          : 'Accédez à votre espace sécurisé'
      }
    >
      <div className="auth-login-card">
        {showMfa ? (
          <div className="auth-login-card-intro">
            <h3 className="auth-login-card-title">Vérification en deux étapes</h3>
            <p className="auth-login-card-desc">
              Saisissez le code à 6 chiffres de votre application d’authentification.
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="auth-login-form">
          {!showMfa ? (
            <>
              {mockMode ? (
                <p className="auth-login-hint auth-login-hint--ok">
                  Mode démo — utilisez un compte de test fourni par l’administrateur.
                </p>
              ) : dbStatus === 'down' ? (
                <p className="auth-login-hint auth-login-hint--error" role="alert">
                  Service temporairement indisponible. Réessayez dans quelques instants ou
                  contactez le support informatique.
                </p>
              ) : dbStatus === 'empty' ? (
                <p className="auth-login-hint auth-login-hint--warn" role="alert">
                  Accès en cours de configuration. Contactez l’administrateur de la plateforme.
                </p>
              ) : (
                <p className="auth-login-hint">
                  Connectez-vous avec votre adresse email institutionnelle. En cas d’oubli,
                  utilisez « Mot de passe oublié » ou contactez l’assistante de direction.
                </p>
              )}

              {error ? (
                <p className="auth-login-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="auth-login-field">
                <Label htmlFor="email" className="auth-login-label">
                  Adresse email
                </Label>
                <Input
                  id="email"
                  type="email"
                  className="auth-login-input"
                  placeholder="votre.email@arpt.gov.gn"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  onInvalid={onFrenchInputInvalid}
                  onInput={onFrenchInputChange}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="auth-login-field">
                <div className="auth-login-field-head">
                  <Label htmlFor="password" className="auth-login-label">
                    Mot de passe
                  </Label>
                  <Link href="/forgot-password" className="auth-login-forgot">
                    Mot de passe oublié ?
                  </Link>
                </div>
                <AuthPasswordField
                  id="password"
                  value={formData.password}
                  onChange={(password) => setFormData({ ...formData, password })}
                  policy={passwordPolicy}
                  placeholder="••••••••"
                  showStrength
                  compactStrength
                />
              </div>

              <div className="auth-login-remember">
                <Checkbox
                  id="remember"
                  className="auth-login-checkbox"
                  checked={formData.rememberMe}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, rememberMe: checked as boolean })
                  }
                />
                <Label htmlFor="remember" className="auth-login-remember-label">
                  Se souvenir de moi
                </Label>
              </div>
            </>
          ) : (
            <div className="auth-login-field">
              {error ? (
                <p className="auth-login-error" role="alert">
                  {error}
                </p>
              ) : null}
              <Label htmlFor="mfaCode" className="auth-login-label">
                Code de vérification
              </Label>
              <Input
                id="mfaCode"
                type="text"
                placeholder="123456"
                value={formData.mfaCode}
                onChange={(e) => setFormData({ ...formData, mfaCode: e.target.value })}
                onInvalid={onFrenchInputInvalid}
                onInput={onFrenchInputChange}
                required
                maxLength={6}
                className="auth-login-input text-center tracking-widest"
              />
              <button
                type="button"
                className="auth-login-back-link"
                onClick={() => {
                  setShowMfa(false)
                  setFormData((f) => ({ ...f, mfaCode: '' }))
                  setError(null)
                }}
              >
                Retour
              </button>
            </div>
          )}

          <Button type="submit" className="auth-login-submit" disabled={isLoading}>
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {showMfa ? 'Vérifier' : 'Se connecter'}
          </Button>

          {!showMfa && microsoftEnabled ? (
            <>
              <div className="auth-login-divider" role="presentation">
                <span>ou</span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="auth-login-microsoft"
                disabled={isLoading}
                onClick={() => void signInWithMicrosoft()}
              >
                <svg className="h-4 w-4" viewBox="0 0 21 21" aria-hidden>
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
                Se connecter avec Microsoft
              </Button>
            </>
          ) : null}
        </form>
      </div>
    </AuthPageShell>
  )
}
